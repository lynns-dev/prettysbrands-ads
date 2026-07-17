// Builds the new ad set + one ad creative/ad per copy version from an
// already-uploaded asset (an image_hash, or a video_id + thumbnail_url).
// Applies immediately — this is the deliberate final step after uploading
// an asset and filling in the copy versions, not a preview.

import { getBrand } from '../../../../../lib/brandsStore';
import { createAdSetWithCopyVersions } from '../../../../../lib/creativeUpload';
import { getVideoThumbnail } from '../../../../../lib/metaMarketingApi';
import { withAuth } from '../../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const {
    adSetName, campaignId, costCapCents, dailyBudgetCents, link, ctaType,
    assetType, imageHash, videoId, thumbnailUrl, copyVersions,
  } = req.body || {};

  if (!campaignId || !costCapCents || !dailyBudgetCents || !link) {
    return res.status(400).json({ error: 'campaignId, costCapCents, dailyBudgetCents, and link are required.' });
  }

  let asset;
  if (assetType === 'video') {
    if (!videoId) return res.status(400).json({ error: 'videoId is required for video assets.' });
    let finalThumbnailUrl = thumbnailUrl;
    if (!finalThumbnailUrl) {
      finalThumbnailUrl = await getVideoThumbnail(videoId, { attempts: 2, delayMs: 1500 });
    }
    if (!finalThumbnailUrl) {
      return res.status(409).json({ error: "Video is still processing on Meta's side — wait a few seconds and try creating the ad set again (no need to re-upload)." });
    }
    asset = { videoId, thumbnailUrl: finalThumbnailUrl };
  } else {
    if (!imageHash) return res.status(400).json({ error: 'imageHash is required for image assets.' });
    asset = { imageHash };
  }

  try {
    const result = await createAdSetWithCopyVersions(brand, {
      adSetName: adSetName || 'New Creative',
      campaignId,
      costCapCents: Number(costCapCents),
      dailyBudgetCents: Number(dailyBudgetCents),
      link,
      ctaType: ctaType || 'SHOP_NOW',
      asset,
      copyVersions,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuth(handler);
