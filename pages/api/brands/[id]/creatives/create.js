// Saves a draft from an already-uploaded asset (an image_hash, or a
// video_id + optional thumbnail_url — video processing may not be done
// yet, and that's fine at draft time) plus the campaign/budget/copy
// details. Nothing touches the ad account here — see publish.js for the
// step that actually creates the ad set/creatives/ads.

import { getBrand } from '../../../../../lib/brandsStore';
import { createDraft } from '../../../../../lib/creativeDraftStore';
import { withAuthOrApiKey } from '../../../../../lib/requireAuth';

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
  if (!copyVersions || copyVersions.length === 0) {
    return res.status(400).json({ error: 'At least one headline/body copy version is required.' });
  }

  let asset;
  if (assetType === 'video') {
    if (!videoId) return res.status(400).json({ error: 'videoId is required for video assets.' });
    asset = { videoId, thumbnailUrl: thumbnailUrl || null };
  } else {
    if (!imageHash) return res.status(400).json({ error: 'imageHash is required for image assets.' });
    asset = { imageHash };
  }

  try {
    const draft = await createDraft(brand.id, {
      adSetName: adSetName || 'New Creative',
      campaignId,
      costCapCents: Number(costCapCents),
      dailyBudgetCents: Number(dailyBudgetCents),
      link,
      ctaType: ctaType || 'SHOP_NOW',
      assetType: assetType === 'video' ? 'video' : 'image',
      asset,
      copyVersions,
    });
    return res.status(200).json({ draft });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuthOrApiKey(handler);
