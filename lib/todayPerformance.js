// Per-ad-set "how's today going" view: today's ROAS and cost per result next
// to the ad set's own cost cap and its own daily budget, so a media buyer can
// see at a glance whether an ad set is on pace *today* — not the multi-day
// lookback window costCapBidding.js uses for its adjustment decisions. Reuses
// computeDailyPacing (lib/pacingAlerts.js) at ad-set granularity: each ad
// set's own daily_budget stands in for "dailyBudgetCents" instead of a
// brand-wide monthly-budget split.

import { listAdSets, getInsights } from './metaMarketingApi';
import { computeDailyPacing } from './pacingAlerts';

export async function getTodayPerformance(brand) {
  const adSets = await listAdSets(brand.adAccountId);
  const costCapAdSets = adSets.filter((a) => a.bid_strategy === 'COST_CAP' && a.effective_status === 'ACTIVE' && Number(a.bid_amount) > 0);
  if (costCapAdSets.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const insights = await getInsights(brand.adAccountId, { level: 'adset', ids: costCapAdSets.map((a) => a.id), since: today, until: today });
  const now = new Date();

  const results = costCapAdSets.map((adSet) => {
    const insight = insights[adSet.id] || { spend: 0, revenue: 0, purchases: 0 };
    const dailyBudgetCents = Number(adSet.daily_budget) || null;
    return {
      adSetId: adSet.id,
      adSetName: adSet.name,
      spendTodayCents: insight.spend,
      revenueTodayCents: insight.revenue,
      purchasesToday: insight.purchases,
      roas: insight.spend > 0 ? insight.revenue / insight.spend : 0,
      costPerResultCents: insight.purchases > 0 ? insight.spend / insight.purchases : null,
      costCapCents: Number(adSet.bid_amount),
      pacing: dailyBudgetCents ? computeDailyPacing({ dailyBudgetCents, spendTodayCents: insight.spend, now }) : null,
    };
  });

  // Highest spend first — same ordering as the Cost-cap bidding table.
  return results.sort((a, b) => b.spendTodayCents - a.spendTodayCents);
}
