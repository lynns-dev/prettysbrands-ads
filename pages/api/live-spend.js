// Today's account-level spend, per brand and totaled — polled every ~30s by
// the LiveSpendTicker component. Cached in Redis for a short TTL so several
// open tabs/brands polling at once don't multiply Meta API calls; the cache
// key is scoped to the ad account + calendar day so it naturally resets at
// midnight.

import { listBrands } from '../../lib/brandsStore';
import { getAccountInsights } from '../../lib/metaMarketingApi';
import { getConnectionStatus } from '../../lib/metaAdsAuth';
import { kvGetRaw, kvSetRaw } from '../../lib/kv';
import { withAuth } from '../../lib/requireAuth';

const CACHE_TTL_SECONDS = 20;

async function getCachedTodaySpend(adAccountId) {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `live-spend:${adAccountId}:${today}`;
  const cached = await kvGetRaw(cacheKey);
  if (cached) return JSON.parse(cached);

  const insight = await getAccountInsights(adAccountId, { since: today, until: today });
  await kvSetRaw(cacheKey, JSON.stringify(insight), { exSeconds: CACHE_TTL_SECONDS });
  return insight;
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connection = await getConnectionStatus().catch(() => ({ connected: false }));
  if (!connection.connected) {
    return res.status(200).json({ connected: false, totalCents: 0, brands: [], updatedAt: new Date().toISOString() });
  }

  const { brandId } = req.query;
  const allBrands = await listBrands();
  const brands = brandId ? allBrands.filter((b) => b.id === brandId) : allBrands;

  const results = await Promise.all(brands.map(async (b) => {
    try {
      const insight = await getCachedTodaySpend(b.adAccountId);
      return { id: b.id, name: b.name, spendCents: insight.spend, error: null };
    } catch (err) {
      return { id: b.id, name: b.name, spendCents: 0, error: err.message };
    }
  }));

  const totalCents = results.reduce((sum, r) => sum + r.spendCents, 0);
  return res.status(200).json({ connected: true, totalCents, brands: results, updatedAt: new Date().toISOString() });
}

export default withAuth(handler);
