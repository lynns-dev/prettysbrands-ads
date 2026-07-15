// Everything the brand detail page needs in one call: campaign/ad-set
// browser (with spend/ROAS), creative-level performance, the cost-cap
// auto-adjust preview, budget pacing, and recent adjustment history.

import { getBrand } from '../../../../lib/brandsStore';
import { listCampaigns, listAdSets, listAds, getInsights } from '../../../../lib/metaMarketingApi';
import { previewBrandAdjustments } from '../../../../lib/costCapBidding';
import { previewBrandFatigue } from '../../../../lib/adFatigue';
import { getBrandPacing } from '../../../../lib/budgetPacing';
import { getAdjustmentLog } from '../../../../lib/adSpendStore';
import { getRefreshLog } from '../../../../lib/adRefreshStore';
import { getConnectionStatus } from '../../../../lib/metaAdsAuth';
import { withAuth } from '../../../../lib/requireAuth';
import { lookbackRange } from '../../../../lib/dateRange';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const connection = await getConnectionStatus().catch(() => ({ connected: false }));
  const empty = { brand, connection, campaigns: [], creatives: [], costCap: null, pacing: null, recentAdjustments: [], fatigue: null, recentRefreshes: [], error: null };
  if (!connection.connected) return res.status(200).json(empty);

  try {
    const range = lookbackRange(brand.lookbackDays);

    const [campaignsRaw, adSetsRaw, adsRaw] = await Promise.all([
      listCampaigns(brand.adAccountId),
      listAdSets(brand.adAccountId),
      listAds(brand.adAccountId),
    ]);

    const [adSetInsights, adInsights] = await Promise.all([
      getInsights(brand.adAccountId, { level: 'adset', ids: adSetsRaw.map((a) => a.id), ...range }),
      getInsights(brand.adAccountId, { level: 'ad', ids: adsRaw.map((a) => a.id), ...range }),
    ]);

    const adSets = adSetsRaw.map((a) => {
      const insight = adSetInsights[a.id] || { spend: 0, revenue: 0, purchases: 0 };
      return { ...a, ...insight, roas: insight.spend > 0 ? insight.revenue / insight.spend : 0 };
    });

    const campaigns = campaignsRaw.map((c) => {
      const cAdSets = adSets.filter((a) => a.campaign_id === c.id);
      const spend = cAdSets.reduce((s, a) => s + a.spend, 0);
      const revenue = cAdSets.reduce((s, a) => s + a.revenue, 0);
      return { ...c, adSets: cAdSets, spend, revenue, roas: spend > 0 ? revenue / spend : 0 };
    });

    const creatives = adsRaw.map((a) => {
      const insight = adInsights[a.id] || { spend: 0, revenue: 0, purchases: 0 };
      return { ...a, ...insight, roas: insight.spend > 0 ? insight.revenue / insight.spend : 0 };
    });

    const [costCapResults, fatigueResults, pacing, recentAdjustments, recentRefreshes] = await Promise.all([
      previewBrandAdjustments(brand),
      previewBrandFatigue(brand),
      getBrandPacing(brand),
      getAdjustmentLog(brand.id, 20),
      getRefreshLog(brand.id, 20),
    ]);

    return res.status(200).json({
      brand, connection, campaigns, creatives,
      costCap: { results: costCapResults, lookbackDays: brand.lookbackDays, targetRoas: brand.targetRoas },
      fatigue: { results: fatigueResults },
      pacing, recentAdjustments, recentRefreshes, error: null,
    });
  } catch (err) {
    return res.status(200).json({ ...empty, error: err.message });
  }
}

export default withAuth(handler);
