// Manual "duplicate this ad set" action, triggered from the Cost-cap
// bidding table (e.g. an ad set running over its cost cap). Applies
// immediately — no dry run — since it's a deliberate, single-ad-set
// operator decision, not an automated pass.

import { getBrand } from '../../../../../lib/brandsStore';
import { duplicateAdSetManually } from '../../../../../lib/adFatigue';
import { withAuth } from '../../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const { adSetId, adSetName } = req.body || {};
  if (!adSetId) return res.status(400).json({ error: 'adSetId is required.' });

  try {
    const result = await duplicateAdSetManually(brand, adSetId, adSetName || adSetId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuth(handler);
