// Vercel Cron entry point (see vercel.json) for the daily cost-cap
// adjustment pass across every brand with autoAdjustEnabled switched on.
// Protected by CRON_SECRET: when that env var is set, Vercel automatically
// sends it as `Authorization: Bearer <CRON_SECRET>` on scheduled
// invocations, so any other caller is rejected.

import { runAutoAdjustAllEnabledBrands } from '../../../lib/costCapBidding';

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const summary = await runAutoAdjustAllEnabledBrands();
    return res.status(200).json({ brands: summary });
  } catch (err) {
    console.error('Cost-cap auto-adjust cron run failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
