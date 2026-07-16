// Recognizes creatives that worked in the past, are not live now, and
// lets an operator duplicate one into its own fresh ad set — on Meta's
// COST_CAP bidding with its own (ABO) daily budget — inside the brand's
// designated scaling campaign. Manual, reviewed action: nothing is created
// on the ad account until the operator clicks "Duplicate" on a specific
// candidate.

import { listAds, getInsights, copyAdSet, setCostCapBudget, updateAdSetStatus, createAd } from './metaMarketingApi';
import { recordRevival } from './creativeRevivalStore';
import { lookbackRange } from './dateRange';

// Scans every non-active ad in the account and flags the ones whose
// historical ROAS clears the brand's bar with enough spend to trust it.
// Read-only — never changes anything in the ad account.
export async function findRevivableCreatives(brand) {
  const ads = await listAds(brand.adAccountId);
  const candidates = ads.filter((a) => a.effective_status !== 'ACTIVE' && a.creative?.id);
  if (candidates.length === 0) return [];

  const range = lookbackRange(brand.winnersLookbackDays);
  const insights = await getInsights(brand.adAccountId, { level: 'ad', ids: candidates.map((a) => a.id), ...range });

  const results = candidates.map((ad) => {
    const insight = insights[ad.id] || { spend: 0, revenue: 0, purchases: 0 };
    const roas = insight.spend > 0 ? insight.revenue / insight.spend : 0;
    return {
      adId: ad.id,
      adName: ad.name,
      status: ad.effective_status,
      creativeId: ad.creative.id,
      thumbnailUrl: ad.creative.thumbnail_url,
      spend: insight.spend,
      revenue: insight.revenue,
      purchases: insight.purchases,
      roas,
      qualifies: insight.spend >= brand.minSpendCents && roas >= brand.targetRoas,
    };
  }).filter((r) => r.qualifies);

  return results.sort((a, b) => b.roas - a.roas);
}

// Duplicates one winning creative into a brand-new ad set: copies the
// brand's template ad set (targeting/placements/optimization goal) into
// the designated scaling campaign, switches it to COST_CAP bidding with
// its own ABO daily budget, creates a new ad there reusing the winning
// creative, then activates the ad set. Every step is logged so a partial
// failure (e.g. the ad set copy succeeds but the budget update fails) is
// visible rather than silently leaving an orphaned ad set behind.
export async function reviveCreative(brand, { adId, adName, creativeId }) {
  if (!brand.templateAdSetId || !brand.scalingCampaignId || !brand.costCapCents || !brand.aboDailyBudgetCents) {
    throw new Error('Set a template ad set, scaling campaign, cost cap, and ABO daily budget in this brand\'s settings first.');
  }

  const entry = { adId, adName, appliedAt: new Date().toISOString() };
  let newAdSetId;
  try {
    newAdSetId = await copyAdSet(brand.templateAdSetId, {
      deepCopy: false,
      statusOption: 'PAUSED',
      campaignId: brand.scalingCampaignId,
    });
    await setCostCapBudget(newAdSetId, { bidAmountCents: brand.costCapCents, dailyBudgetCents: brand.aboDailyBudgetCents });
    const newAdId = await createAd(brand.adAccountId, {
      name: `${adName} (revived)`,
      adSetId: newAdSetId,
      creativeId,
      status: 'ACTIVE',
    });
    await updateAdSetStatus(newAdSetId, 'ACTIVE');

    const applied = { ...entry, action: 'revived', newAdSetId, newAdId };
    await recordRevival(brand.id, applied);
    return applied;
  } catch (err) {
    const applied = { ...entry, action: 'failed', reason: err.message, newAdSetId: newAdSetId || null };
    await recordRevival(brand.id, applied);
    throw err;
  }
}
