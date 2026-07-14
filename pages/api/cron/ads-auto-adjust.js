// Vercel Cron entry point (see vercel.json) for the daily cost-cap
// adjustment pass. Only runs when an admin has switched auto-adjust on in
// the panel — connecting Facebook Ads never enables unattended bid changes
// by itself. Protected by CRON_SECRET: when that env var is set, Vercel
// automatically sends it as `Authorization: Bearer <CRON_SECRET>` on
// scheduled invocations, so any other caller is rejected.

import { getAutoAdjustEnabled } from '../../../lib/adSpendStore';
import { runAutoAdjustPass } from '../../../lib/costCapBidding';

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const enabled = await getAutoAdjustEnabled();
    if (!enabled) {
      return res.status(200).json({ skipped: true, reason: 'Auto-adjust is turned off in the admin panel.' });
    }
    const result = await runAutoAdjustPass({ dryRun: false });
    return res.status(200).json({ skipped: false, ...result });
  } catch (err) {
    console.error('Cost-cap auto-adjust cron run failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
