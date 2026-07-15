import { getBrand, updateBrand, deleteBrand } from '../../../lib/brandsStore';
import { withAuth } from '../../../lib/requireAuth';

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const brand = await getBrand(id);
    if (!brand) return res.status(404).json({ error: 'Brand not found.' });
    return res.status(200).json({ brand });
  }

  if (req.method === 'PATCH') {
    try {
      const brand = await updateBrand(id, req.body || {});
      return res.status(200).json({ brand });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const brands = await deleteBrand(id);
    return res.status(200).json({ brands });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
