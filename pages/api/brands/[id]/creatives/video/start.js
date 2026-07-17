import { getBrand } from '../../../../../../lib/brandsStore';
import { startVideoUpload } from '../../../../../../lib/metaMarketingApi';
import { withAuthOrApiKey } from '../../../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const { fileSizeBytes } = req.body || {};
  if (!fileSizeBytes) return res.status(400).json({ error: 'fileSizeBytes is required.' });

  try {
    const result = await startVideoUpload(brand.adAccountId, fileSizeBytes);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuthOrApiKey(handler);
