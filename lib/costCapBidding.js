// Core cost-cap bidding logic: for a brand's ad account, pull each COST_CAP
// ad set's recent spend and Meta-attributed purchase revenue, and nudge its
// bid cap toward the value that would hit that brand's target ROAS —
// capped on every axis so a bad signal (or a bug) can't move spend far in
// one pass:
//   - per-run change is bounded to +/-brand.maxAdjustmentPct
//   - the result is clamped to [brand.minCostCapCents, brand.maxCostCapCents]
//   - an ad set is skipped until it has spent at least
//     brand.minSpendMultiplier x its current cap in the lookback window, so
//     a handful of early results can't swing the cap on noise
//
// Called both from the dashboard's per-brand "Run now" button and the daily
// Vercel Cron job (pages/api/cron/ads-auto-adjust.js), which only touches
// brands with autoAdjustEnabled set.

import { listCostCapAdSets, getInsights, updateAdSetBidAmount } from './metaMarketingApi';
import { recordAdjustments } from './adSpendStore';
import { listBrands } from './brandsStore';
import { lookbackRange, previousPeriodRange } from './dateRange';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// A single bad/great day can swing ROAS without meaning anything — this
// compares the current period against the period right before it, so a
// "decline" badge means a sustained drop, not one blip. +/-20% is the line
// between "this is just noise" and "this ad set is actually trending
// somewhere." The comparison window is always a fixed 7 days regardless of
// the brand's configured lookbackDays — a variable-length window that
// scales with lookbackDays could reach back further than an ad set has
// existed (or further than it's had this cap), leaving nothing to compare.
const TREND_DECLINE_THRESHOLD_PCT = -20;
const TREND_IMPROVE_THRESHOLD_PCT = 20;
const TREND_COMPARISON_DAYS = 7;

function classifyTrend(roasChangePct) {
  if (roasChangePct == null) return null;
  if (roasChangePct <= TREND_DECLINE_THRESHOLD_PCT) return 'declining';
  if (roasChangePct >= TREND_IMPROVE_THRESHOLD_PCT) return 'improving';
  return 'stable';
}

// Exported separately from the run loop so the brand overview endpoint can
// show "what would happen" for every ad set, including ones that won't be
// touched (not enough spend yet, or already at the right cap).
export function computeAdjustment(adSet, insights, brand) {
  const currentBidAmount = Number(adSet.bid_amount);
  const spend = insights?.spend || 0;
  const revenue = insights?.revenue || 0;
  const purchases = insights?.purchases || 0;
  const minSpendRequired = currentBidAmount * brand.minSpendMultiplier;

  const actualCostPerResult = purchases > 0 ? spend / purchases : null;

  const base = {
    adSetId: adSet.id,
    adSetName: adSet.name,
    campaignId: adSet.campaign_id,
    currentBidAmount,
    spend,
    revenue,
    purchases,
    actualRoas: spend > 0 ? revenue / spend : 0,
    actualCostPerResult,
    // Flags an ad set whose actual cost per result is running over its own
    // cost cap right now — independent of the adjust/unchanged/skipped
    // decision below, which is driven by ROAS vs. target, not the cap itself.
    overCap: actualCostPerResult != null && actualCostPerResult > currentBidAmount,
  };

  if (spend < minSpendRequired) {
    return { ...base, action: 'skipped', reason: `Spend $${(spend / 100).toFixed(2)} is below the $${(minSpendRequired / 100).toFixed(2)} sample-size threshold.` };
  }
  if (revenue <= 0) {
    return { ...base, action: 'skipped', reason: 'No attributed purchase revenue in the lookback window.' };
  }

  const rawNewBid = currentBidAmount * (base.actualRoas / brand.targetRoas);
  const maxDelta = currentBidAmount * (brand.maxAdjustmentPct / 100);
  const stepClamped = clamp(rawNewBid, currentBidAmount - maxDelta, currentBidAmount + maxDelta);
  const newBidAmount = Math.round(clamp(stepClamped, brand.minCostCapCents, brand.maxCostCapCents));

  if (newBidAmount === currentBidAmount) {
    return { ...base, action: 'unchanged', reason: 'Already at the right cap for the current ROAS.' };
  }

  return {
    ...base,
    action: 'adjust',
    newBidAmount,
    reason: `Actual ROAS ${base.actualRoas.toFixed(2)}x vs target ${brand.targetRoas}x.`,
  };
}

// Ad sets are returned sorted by spend, highest first — the ones worth
// looking at (and the ones a fixed cap is costing the most on) sort to the
// top rather than requiring a manual re-sort.
export async function previewBrandAdjustments(brand) {
  const adSets = await listCostCapAdSets(brand.adAccountId);
  const ids = adSets.map((a) => a.id);
  const { since, until } = lookbackRange(brand.lookbackDays);
  const prevRange = previousPeriodRange(brand.lookbackDays, TREND_COMPARISON_DAYS);

  const [insights, prevInsights] = await Promise.all([
    getInsights(brand.adAccountId, { level: 'adset', ids, since, until }),
    getInsights(brand.adAccountId, { level: 'adset', ids, ...prevRange }),
  ]);

  const results = adSets.map((adSet) => {
    const result = computeAdjustment(adSet, insights[adSet.id], brand);
    const prev = prevInsights[adSet.id];
    const prevSpend = prev?.spend || 0;
    const prevRoas = prevSpend > 0 ? prev.revenue / prevSpend : null;
    const roasChangePct = prevRoas != null && prevRoas > 0
      ? Math.round(((result.actualRoas - prevRoas) / prevRoas) * 1000) / 10
      : null;

    return {
      ...result,
      prevSpend,
      prevRoas,
      roasChangePct,
      trend: classifyTrend(roasChangePct),
    };
  });

  return results.sort((a, b) => b.spend - a.spend);
}

// dryRun: true previews the adjustments without calling the Marketing API
// or writing to the audit log — used by the brand overview screen.
export async function runAutoAdjustForBrand(brand, { dryRun = false } = {}) {
  const results = await previewBrandAdjustments(brand);
  const toApply = results.filter((r) => r.action === 'adjust');
  if (dryRun) return { results, applied: [] };

  const applied = [];
  for (const r of toApply) {
    try {
      await updateAdSetBidAmount(r.adSetId, r.newBidAmount);
      applied.push({ ...r, appliedAt: new Date().toISOString() });
    } catch (err) {
      applied.push({ ...r, action: 'failed', reason: err.message, appliedAt: new Date().toISOString() });
    }
  }
  await recordAdjustments(brand.id, applied);
  return { results, applied };
}

// The daily cron entry point — loops every brand with auto-adjust switched
// on. One brand's failure (bad config, a Graph API error) doesn't stop the
// others from running.
export async function runAutoAdjustAllEnabledBrands() {
  const brands = (await listBrands()).filter((b) => b.autoAdjustEnabled);
  const summary = [];
  for (const brand of brands) {
    try {
      const result = await runAutoAdjustForBrand(brand, { dryRun: false });
      summary.push({ brandId: brand.id, brandName: brand.name, ...result });
    } catch (err) {
      summary.push({ brandId: brand.id, brandName: brand.name, error: err.message });
    }
  }
  return summary;
}
