// Detects ads that have "died out": Meta keeps spending on them — still
// absorbing a healthy share of the ad set's daily budget — but the actual
// cost per result has drifted well above the ad set's cost cap. That
// combination (cap blown, yet delivery hasn't throttled back) means Meta is
// coasting on the ad's accumulated relevance/familiarity rather than
// genuinely meeting the advertiser's efficiency target — the leading sign
// of creative fatigue described in the brief this feature was built from.
//
// On trigger, the fatigued ad set is deep-copied into a fresh ad set (new
// ad ID, same targeting/budget/cost-cap) and the original is paused. This
// only makes sense for ad sets with exactly one active ad (this app's
// "scaling" convention) — deep-copying an ad set with several ads would
// duplicate all of them, not just the fatigued one, so multi-ad ad sets are
// skipped entirely rather than guessed at.

import { listCostCapAdSets, listAds, getInsights, copyAdSet, updateAdSetStatus } from './metaMarketingApi';
import { recordRefreshes } from './adRefreshStore';
import { listBrands } from './brandsStore';
import { lookbackRange } from './dateRange';

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Exported separately from the run loop so the brand overview endpoint can
// preview what the next pass would do.
export function computeFatigue(adSet, ad, insight, brand) {
  const costCap = Number(adSet.bid_amount);
  const dailyBudget = Number(adSet.daily_budget) || 0;
  const spend = insight?.spend || 0;
  const purchases = insight?.purchases || 0;
  const lookbackDays = brand.fatigueLookbackDays;
  const marginPct = brand.fatigueCostCapMarginPct;
  const minSpendVsBudgetPct = brand.fatigueMinSpendVsBudgetPct;

  const base = { adSetId: adSet.id, adSetName: adSet.name, adId: ad.id, adName: ad.name, spend, purchases, costCap };

  if (purchases === 0) {
    return { ...base, action: 'skipped', reason: 'No purchases in the lookback window — not enough signal to judge cap performance.' };
  }

  const actualCostPerResult = spend / purchases;
  const capExceededRatio = actualCostPerResult / costCap;

  if (capExceededRatio <= 1 + marginPct / 100) {
    return { ...base, action: 'ok', actualCostPerResult, reason: `Cost per result ${money(actualCostPerResult)} is within ${marginPct}% of the ${money(costCap)} cap.` };
  }

  if (!dailyBudget) {
    return { ...base, action: 'skipped', actualCostPerResult, reason: 'No daily budget set on this ad set to compare spend against.' };
  }

  const expectedSpend = dailyBudget * lookbackDays;
  const spendVsBudgetPct = (spend / expectedSpend) * 100;

  if (spendVsBudgetPct < minSpendVsBudgetPct) {
    return {
      ...base, action: 'skipped', actualCostPerResult,
      reason: `Cost per result is over cap, but spend (${spendVsBudgetPct.toFixed(0)}% of budget) has already dropped off — likely delivery throttling, not fatigue.`,
    };
  }

  return {
    ...base,
    action: 'fatigued',
    actualCostPerResult,
    reason: `Cost per result ${money(actualCostPerResult)} is ${Math.round((capExceededRatio - 1) * 100)}% over the ${money(costCap)} cap, yet spend is still ${spendVsBudgetPct.toFixed(0)}% of budget — likely coasting on stale relevance rather than being naturally throttled.`,
  };
}

export async function previewBrandFatigue(brand) {
  const [costCapAdSets, allAds] = await Promise.all([
    listCostCapAdSets(brand.adAccountId),
    listAds(brand.adAccountId),
  ]);

  const adsBySet = {};
  for (const ad of allAds) {
    if (ad.effective_status !== 'ACTIVE') continue;
    (adsBySet[ad.adset_id] ||= []).push(ad);
  }

  // Only single-ad ad sets are unambiguous to deep-copy — see file header.
  const targetAdSets = costCapAdSets.filter((a) => (adsBySet[a.id] || []).length === 1);
  if (targetAdSets.length === 0) return [];

  const range = lookbackRange(brand.fatigueLookbackDays);
  const adIds = targetAdSets.map((a) => adsBySet[a.id][0].id);
  const insights = await getInsights(brand.adAccountId, { level: 'ad', ids: adIds, ...range });

  return targetAdSets.map((adSet) => {
    const ad = adsBySet[adSet.id][0];
    return computeFatigue(adSet, ad, insights[ad.id], brand);
  });
}

// dryRun: true previews without touching the ad account or the audit log —
// used by the brand overview screen.
export async function runFatigueRefreshForBrand(brand, { dryRun = false } = {}) {
  const results = await previewBrandFatigue(brand);
  const toRefresh = results.filter((r) => r.action === 'fatigued');
  if (dryRun) return { results, applied: [] };

  const applied = [];
  for (const r of toRefresh) {
    try {
      const newAdSetId = await copyAdSet(r.adSetId, { deepCopy: true, statusOption: 'ACTIVE' });
      await updateAdSetStatus(r.adSetId, 'PAUSED');
      applied.push({ ...r, action: 'refreshed', newAdSetId, appliedAt: new Date().toISOString() });
    } catch (err) {
      applied.push({ ...r, action: 'failed', reason: err.message, appliedAt: new Date().toISOString() });
    }
  }
  await recordRefreshes(brand.id, applied);
  return { results, applied };
}

// The daily cron entry point — loops every brand with autoRefreshEnabled
// switched on. One brand's failure doesn't stop the others from running.
export async function runFatigueRefreshAllEnabledBrands() {
  const brands = (await listBrands()).filter((b) => b.autoRefreshEnabled);
  const summary = [];
  for (const brand of brands) {
    try {
      const result = await runFatigueRefreshForBrand(brand, { dryRun: false });
      summary.push({ brandId: brand.id, brandName: brand.name, ...result });
    } catch (err) {
      summary.push({ brandId: brand.id, brandName: brand.name, error: err.message });
    }
  }
  return summary;
}
