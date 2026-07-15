// Manual "Run now" for one brand — applies live bid changes immediately,
// independent of that brand's autoAdjustEnabled flag (which only gates the
// unattended daily cron run). An operator clicking this button is itself
// the deliberate approval step.

import { getBrand } from '../../../../lib/brandsStore';
import { runAutoAdjustForBrand } from '../../../../lib/costCapBidding';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  try {
    const result = await runAutoAdjustForBrand(brand, { dryRun: false });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
