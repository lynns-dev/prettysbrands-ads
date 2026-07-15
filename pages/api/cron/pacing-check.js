// Vercel Cron entry point (see vercel.json) for the hourly pacing check —
// pushes a phone notification when a brand's daily spend is tracking too
// fast or too slow against its budget (see lib/pacingAlerts.js). Protected
// by CRON_SECRET the same way as the daily automation cron.

import { runPacingCheckAllBrands } from '../../../lib/pacingAlerts';

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const summary = await runPacingCheckAllBrands();
    return res.status(200).json({ summary });
  } catch (err) {
    console.error('Pacing-check cron run failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
