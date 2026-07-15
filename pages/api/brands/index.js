import { listBrands, createBrand } from '../../../lib/brandsStore';
import { withAuth } from '../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const brands = await listBrands();
      return res.status(200).json({ brands });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const brand = await createBrand(req.body || {});
      return res.status(201).json({ brand });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
