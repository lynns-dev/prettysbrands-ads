import { updateBrand } from '../../../../lib/brandsStore';
import { withAuth } from '../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const brand = await updateBrand(req.query.id, { autoRefreshEnabled: Boolean(req.body?.enabled) });
    return res.status(200).json({ brand });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuth(handler);
