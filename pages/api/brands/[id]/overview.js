// Everything the brand detail page needs: connection status and today's
// per-ad-set spend/ROAS/CPA. Deliberately minimal — see lib/todayPerformance.js.

import { getBrand } from '../../../../lib/brandsStore';
import { getTodayPerformance } from '../../../../lib/todayPerformance';
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
  const empty = { brand, connection, todayPerformance: [], error: null };
  if (!connection.connected) return res.status(200).json(empty);

  try {
    const todayPerformance = await getTodayPerformance(brand);
    return res.status(200).json({ brand, connection, todayPerformance, error: null });
  } catch (err) {
    return res.status(200).json({ ...empty, error: err.message });
  }
}

export default withAuth(handler);
