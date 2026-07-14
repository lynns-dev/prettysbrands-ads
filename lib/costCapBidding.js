// Core cost-cap bidding logic: pull each COST_CAP ad set's recent spend and
// Meta-attributed purchase revenue, and nudge its bid cap toward the value
// that would hit the target ROAS — capped on every axis so a bad signal
// (or a bug) can't move spend far in one pass:
//   - per-run change is bounded to +/-META_MAX_ADJUSTMENT_PCT
//   - the result is clamped to [META_MIN_COST_CAP_CENTS, META_MAX_COST_CAP_CENTS]
//   - an ad set is skipped entirely until it has spent at least
//     META_MIN_SPEND_MULTIPLIER x its current cap in the lookback window,
//     so a handful of early results can't swing the cap on noise
//
// Called both from the admin "Run now" button (pages/api/admin/ads/auto-adjust.js)
// and the daily Vercel Cron job (pages/api/cron/ads-auto-adjust.js) — the
// cron path additionally checks the auto_adjust_enabled switch first.

import { listCostCapAdSets, getAdSetInsights, updateAdSetBidAmount } from './metaMarketingApi';
import { recordAdjustments } from './adSpendStore';
import { sendPushToAdmins } from './webPush';

function loadConfig() {
  const targetRoas = Number(process.env.META_TARGET_ROAS);
  const minCostCapCents = Number(process.env.META_MIN_COST_CAP_CENTS);
  const maxCostCapCents = Number(process.env.META_MAX_COST_CAP_CENTS);

  if (!targetRoas || targetRoas <= 0) {
    throw new Error('META_TARGET_ROAS must be set to a positive number (e.g. 3 for a 3x return target).');
  }
  if (!minCostCapCents || !maxCostCapCents || minCostCapCents <= 0 || maxCostCapCents <= minCostCapCents) {
    throw new Error('META_MIN_COST_CAP_CENTS and META_MAX_COST_CAP_CENTS must both be set, with min < max (currency minor units, e.g. cents).');
  }

  return {
    targetRoas,
    minCostCapCents,
    maxCostCapCents,
    maxAdjustmentPct: Number(process.env.META_MAX_ADJUSTMENT_PCT) || 20,
    minSpendMultiplier: Number(process.env.META_MIN_SPEND_MULTIPLIER) || 10,
    lookbackDays: Number(process.env.META_INSIGHTS_LOOKBACK_DAYS) || 7,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Exported separately from the run loop so the admin overview endpoint can
// show "what would happen" for every ad set, including ones that won't be
// touched (not enough spend yet, or already at the right cap).
export function computeAdjustment(adSet, insights, config) {
  const currentBidAmount = Number(adSet.bid_amount);
  const spend = insights?.spend || 0;
  const revenue = insights?.revenue || 0;
  const purchases = insights?.purchases || 0;
  const minSpendRequired = currentBidAmount * config.minSpendMultiplier;

  const base = {
    adSetId: adSet.id,
    adSetName: adSet.name,
    campaignName: adSet.campaign?.name || null,
    currentBidAmount,
    spend,
    revenue,
    purchases,
    actualRoas: spend > 0 ? revenue / spend : 0,
  };

  if (spend < minSpendRequired) {
    return { ...base, action: 'skipped', reason: `Spend $${(spend / 100).toFixed(2)} is below the $${(minSpendRequired / 100).toFixed(2)} sample-size threshold.` };
  }
  if (revenue <= 0) {
    return { ...base, action: 'skipped', reason: 'No attributed purchase revenue in the lookback window.' };
  }

  const rawNewBid = currentBidAmount * (base.actualRoas / config.targetRoas);
  const maxDelta = currentBidAmount * (config.maxAdjustmentPct / 100);
  const stepClamped = clamp(rawNewBid, currentBidAmount - maxDelta, currentBidAmount + maxDelta);
  const newBidAmount = Math.round(clamp(stepClamped, config.minCostCapCents, config.maxCostCapCents));

  if (newBidAmount === currentBidAmount) {
    return { ...base, action: 'unchanged', reason: 'Already at the right cap for the current ROAS.' };
  }

  return {
    ...base,
    action: 'adjust',
    newBidAmount,
    reason: `Actual ROAS ${base.actualRoas.toFixed(2)}x vs target ${config.targetRoas}x.`,
  };
}

// dryRun: true previews the adjustments without calling the Marketing API
// or writing to the audit log — used for the admin overview screen.
export async function runAutoAdjustPass({ dryRun = false } = {}) {
  const config = loadConfig();
  const adSets = await listCostCapAdSets();
  const insights = await getAdSetInsights(adSets.map((a) => a.id), config.lookbackDays);

  const results = adSets.map((adSet) => computeAdjustment(adSet, insights[adSet.id], config));
  const toApply = results.filter((r) => r.action === 'adjust');

  if (dryRun) return { config, results, applied: [] };

  const applied = [];
  for (const r of toApply) {
    try {
      await updateAdSetBidAmount(r.adSetId, r.newBidAmount);
      applied.push({ ...r, appliedAt: new Date().toISOString() });
    } catch (err) {
      applied.push({ ...r, action: 'failed', reason: err.message, appliedAt: new Date().toISOString() });
    }
  }

  const succeeded = applied.filter((a) => a.action === 'adjust');
  await recordAdjustments(applied).catch((err) => console.error('Failed to write ad spend adjustment log:', err.message));

  if (succeeded.length > 0) {
    const lines = succeeded
      .map((a) => `${a.adSetName}: $${(a.currentBidAmount / 100).toFixed(2)} → $${(a.newBidAmount / 100).toFixed(2)}`)
      .join('; ');
    await sendPushToAdmins({
      title: `Cost-cap bids adjusted (${succeeded.length})`,
      body: lines.slice(0, 180),
      url: '/admin',
    }).catch((err) => console.error('Failed to push ad spend adjustment notification:', err.message));
  }

  return { config, results, applied };
}
