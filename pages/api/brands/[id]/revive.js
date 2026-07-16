// Duplicates one winning creative into its own fresh ad set — applies
// immediately, no dry run, since it's a deliberate per-creative operator
// decision made after reviewing the revivable-creatives scan.

import { getBrand } from '../../../../lib/brandsStore';
import { reviveCreative } from '../../../../lib/creativeRevival';
import { withAuth } from '../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const { adId, adName, creativeId } = req.body || {};
  if (!adId || !creativeId) return res.status(400).json({ error: 'adId and creativeId are required.' });

  try {
    const result = await reviveCreative(brand, { adId, adName: adName || adId, creativeId });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuth(handler);
