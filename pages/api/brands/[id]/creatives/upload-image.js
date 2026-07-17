// Single-request image upload — images are small enough that Meta's
// `bytes` (base64) shortcut works in one shot, unlike video (see
// creatives/video/*.js for the chunked/resumable flow that needs).

import { getBrand } from '../../../../../lib/brandsStore';
import { uploadImage } from '../../../../../lib/metaMarketingApi';
import { withAuthOrApiKey } from '../../../../../lib/requireAuth';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const { base64 } = req.body || {};
  if (!base64) return res.status(400).json({ error: 'base64 image data is required.' });

  try {
    const imageHash = await uploadImage(brand.adAccountId, { base64 });
    return res.status(200).json({ imageHash });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuthOrApiKey(handler);
