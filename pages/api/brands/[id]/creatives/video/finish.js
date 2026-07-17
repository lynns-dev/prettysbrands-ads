import { getBrand } from '../../../../../../lib/brandsStore';
import { finishVideoUpload, getVideoThumbnail } from '../../../../../../lib/metaMarketingApi';
import { withAuth } from '../../../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const { uploadSessionId, videoId } = req.body || {};
  if (!uploadSessionId || !videoId) return res.status(400).json({ error: 'uploadSessionId and videoId are required.' });

  try {
    await finishVideoUpload(brand.adAccountId, uploadSessionId);
    // Best-effort — video processing often isn't done yet this soon;
    // creatives/create.js polls again before it actually needs the thumbnail.
    const thumbnailUrl = await getVideoThumbnail(videoId, { attempts: 1 });
    return res.status(200).json({ videoId, thumbnailUrl });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuth(handler);
