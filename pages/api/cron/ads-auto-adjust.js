// Vercel Cron entry point (see vercel.json) for the daily automation pass:
// cost-cap bid adjustment (brands with autoAdjustEnabled) and ad-refresh
// fatigue detection (brands with autoRefreshEnabled). Protected by
// CRON_SECRET: when that env var is set, Vercel automatically sends it as
// `Authorization: Bearer <CRON_SECRET>` on scheduled invocations, so any
// other caller is rejected.

import { runAutoAdjustAllEnabledBrands } from '../../../lib/costCapBidding';
import { runFatigueRefreshAllEnabledBrands } from '../../../lib/adFatigue';

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [costCap, fatigue] = await Promise.all([
      runAutoAdjustAllEnabledBrands(),
      runFatigueRefreshAllEnabledBrands(),
    ]);
    return res.status(200).json({ costCap, fatigue });
  } catch (err) {
    console.error('Daily ads automation cron run failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
