import { getConnectionStatus } from '../../lib/metaAdsAuth';
import { withAuth } from '../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const connection = await getConnectionStatus().catch(() => ({ connected: false }));
  return res.status(200).json(connection);
}

export default withAuth(handler);
