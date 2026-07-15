// Per-ad-set "today" view: for every active ad set in a brand's account,
// today's spend, ROAS, and CPA (cost per acquisition — cost per purchase).
// This is the entire data surface of the app right now, by design — start
// small, add features back deliberately rather than all at once.

import { listAdSets, getInsights } from './metaMarketingApi';

export async function getTodayPerformance(brand) {
  const adSets = await listAdSets(brand.adAccountId);
  if (adSets.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const insights = await getInsights(brand.adAccountId, { ids: adSets.map((a) => a.id), since: today, until: today });

  const results = adSets.map((adSet) => {
    const insight = insights[adSet.id] || { spend: 0, revenue: 0, purchases: 0 };
    return {
      adSetId: adSet.id,
      adSetName: adSet.name,
      spendCents: insight.spend,
      revenueCents: insight.revenue,
      purchases: insight.purchases,
      roas: insight.spend > 0 ? insight.revenue / insight.spend : 0,
      cpaCents: insight.purchases > 0 ? insight.spend / insight.purchases : null,
    };
  });

  // Highest spend first — the ad sets worth looking at sort to the top.
  return results.sort((a, b) => b.spendCents - a.spendCents);
}
