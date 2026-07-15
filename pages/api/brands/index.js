import { listBrands, createBrand } from '../../../lib/brandsStore';
import { getBrandPacing } from '../../../lib/budgetPacing';
import { withAuth } from '../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const brands = await listBrands();
      // Only brands with a monthly budget set cost an extra Graph API call
      // here — everyone else is just the stored config, no live data.
      const withPacing = await Promise.all(
        brands.map(async (brand) => {
          const pacing = await getBrandPacing(brand).catch(() => null);
          return { ...brand, pacing };
        })
      );
      return res.status(200).json({ brands: withPacing });
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
