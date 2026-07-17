// Everything the brand detail page needs: connection status, today's
// per-ad-set spend/ROAS/CPA, and the recent creative-revival / new-creative
// logs. The revival scan and the new-creative upload flow are separate
// on-demand endpoints — they cost extra Graph API calls, so they aren't
// run on every page load.

import { getBrand } from '../../../../lib/brandsStore';
import { getTodayPerformance } from '../../../../lib/todayPerformance';
import { getRevivalLog } from '../../../../lib/creativeRevivalStore';
import { getNewCreativeLog } from '../../../../lib/newCreativeStore';
import { getConnectionStatus } from '../../../../lib/metaAdsAuth';
import { withAuth } from '../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const connection = await getConnectionStatus().catch(() => ({ connected: false }));
  const recentRevivals = await getRevivalLog(brand.id, 20);
  const recentNewCreatives = await getNewCreativeLog(brand.id, 20);
  const empty = { brand, connection, todayPerformance: [], recentRevivals, recentNewCreatives, error: null };
  if (!connection.connected) return res.status(200).json(empty);

  try {
    const todayPerformance = await getTodayPerformance(brand);
    return res.status(200).json({ brand, connection, todayPerformance, recentRevivals, recentNewCreatives, error: null });
  } catch (err) {
    return res.status(200).json({ ...empty, error: err.message });
  }
}

export default withAuth(handler);
