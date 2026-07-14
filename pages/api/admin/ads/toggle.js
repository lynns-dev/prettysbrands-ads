// Flips the daily auto-adjust switch the Vercel Cron job checks before
// touching any live bids (see pages/api/cron/ads-auto-adjust.js). The
// "Run now" button (auto-adjust.js) always runs regardless of this switch —
// this only gates the unattended daily run.

import { setAutoAdjustEnabled, getAutoAdjustEnabled } from '../../../../lib/adSpendStore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await setAutoAdjustEnabled(Boolean(req.body?.enabled));
    const enabled = await getAutoAdjustEnabled();
    return res.status(200).json({ enabled });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
