// The deliberate "go live" step: takes a saved draft and actually creates
// the ad set + one ad creative/ad per copy version on Meta. This is the
// only place in the creative-upload flow that touches the ad account.

import { getBrand } from '../../../../../lib/brandsStore';
import { getDraft, updateDraft } from '../../../../../lib/creativeDraftStore';
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

  const { draftId } = req.body || {};
  if (!draftId) return res.status(400).json({ error: 'draftId is required.' });

  const draft = await getDraft(brand.id, draftId);
  if (!draft) return res.status(404).json({ error: 'Draft not found.' });
  if (draft.status === 'published') return res.status(400).json({ error: 'This draft was already published.' });

  let asset = draft.asset;
  if (draft.assetType === 'video' && !asset.thumbnailUrl) {
    const thumbnailUrl = await getVideoThumbnail(asset.videoId, { attempts: 2, delayMs: 1500 });
    if (!thumbnailUrl) {
      return res.status(409).json({ error: "Video is still processing on Meta's side — try publishing again shortly (this draft is unchanged)." });
    }
    asset = { ...asset, thumbnailUrl };
  }

  try {
    const result = await createAdSetWithCopyVersions(brand, {
      adSetName: draft.adSetName,
      campaignId: draft.campaignId,
      costCapCents: draft.costCapCents,
      dailyBudgetCents: draft.dailyBudgetCents,
      link: draft.link,
      ctaType: draft.ctaType,
      asset,
      copyVersions: draft.copyVersions,
    });
    const updated = await updateDraft(brand.id, draftId, { status: 'published', publishedAt: new Date().toISOString(), result });
    return res.status(200).json(updated);
  } catch (err) {
    const updated = await updateDraft(brand.id, draftId, { status: 'failed', error: err.message });
    return res.status(400).json({ error: err.message, draft: updated });
  }
}

export default withAuth(handler);
