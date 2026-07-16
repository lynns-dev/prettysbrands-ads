// Runs the creative-revival scan on demand — costs a Graph API call over
// every non-active ad in the account, so this is a deliberate action, not
// something loaded automatically on every page view. Read-only.

import { getBrand } from '../../../../lib/brandsStore';
import { findRevivableCreatives } from '../../../../lib/creativeRevival';
import { withAuth } from '../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  try {
    const results = await findRevivableCreatives(brand);
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuth(handler);
