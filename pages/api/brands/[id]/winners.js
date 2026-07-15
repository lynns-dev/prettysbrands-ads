// Runs the AI winner-detection pass on demand (costs Claude API tokens, so
// this is a deliberate action, not something that runs on every page load
// or on the daily cron). Read-only — never changes anything in the ad
// account.

import { getBrand } from '../../../../lib/brandsStore';
import { findWinningTestAds } from '../../../../lib/aiInsights';
import { withAuth } from '../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  try {
    const result = await findWinningTestAds(brand);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuth(handler);
