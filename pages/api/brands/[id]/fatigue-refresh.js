// Manual "Check for fatigued ads now" for one brand — applies live
// duplicate+pause actions immediately, independent of that brand's
// autoRefreshEnabled flag (which only gates the unattended daily cron run).

import { getBrand } from '../../../../lib/brandsStore';
import { runFatigueRefreshForBrand } from '../../../../lib/adFatigue';
import { withAuth } from '../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  try {
    const result = await runFatigueRefreshForBrand(brand, { dryRun: false });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
