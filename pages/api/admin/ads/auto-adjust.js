// Manual "Run now" trigger from the admin panel — applies live bid changes
// immediately, independent of the auto_adjust_enabled switch (which only
// gates the unattended daily cron run). An admin clicking this button is
// itself the deliberate approval step.

import { runAutoAdjustPass } from '../../../../lib/costCapBidding';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await runAutoAdjustPass({ dryRun: false });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
