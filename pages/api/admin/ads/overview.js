// Read-only snapshot for the admin "Facebook Ads" panel: connection status,
// the current auto-adjust switch, a dry-run preview of every COST_CAP ad
// set (so admins can see what the next pass would do before it runs), and
// the recent adjustment history.

import { getConnectionStatus } from '../../../../lib/metaAdsAuth';
import { getAutoAdjustEnabled, getAdjustmentLog } from '../../../../lib/adSpendStore';
import { runAutoAdjustPass } from '../../../../lib/costCapBidding';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connection = await getConnectionStatus().catch(() => ({ connected: false }));
  const autoAdjustEnabled = await getAutoAdjustEnabled().catch(() => false);
  const recentAdjustments = await getAdjustmentLog(20).catch(() => []);

  if (!connection.connected) {
    return res.status(200).json({ connection, autoAdjustEnabled, recentAdjustments, preview: null, configError: null });
  }

  try {
    const preview = await runAutoAdjustPass({ dryRun: true });
    return res.status(200).json({ connection, autoAdjustEnabled, recentAdjustments, preview, configError: null });
  } catch (err) {
    // Missing/invalid META_* config, or a Graph API error — surface it as
    // data rather than a 500 so the panel can render setup guidance.
    return res.status(200).json({ connection, autoAdjustEnabled, recentAdjustments, preview: null, configError: err.message });
  }
}
