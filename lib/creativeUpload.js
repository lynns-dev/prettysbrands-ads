// Uploads a new creative asset once and spins up a fresh ad set for it in
// a designated campaign at a designated cost cap — with the ability to
// pair the SAME asset against multiple headline/body copy variants, each
// becoming its own ad inside that one new ad set (a copy A/B test against
// one visual, not a separate asset per version). Targeting is fixed (see
// metaMarketingApi.js's createAdSet): United States, automatic (Advantage+)
// placements, purchase-goal optimization via the brand's pixel.
//
// The asset itself (image upload, or video's resumable upload) is handled
// by the API routes in pages/api/brands/[id]/creatives/ — by the time this
// runs, the asset already exists on Meta's side (an image_hash or a
// video_id + thumbnail_url).

import { createAdSet, createAdCreative, createAd, updateAdSetStatus } from './metaMarketingApi';
import { recordNewCreative } from './newCreativeStore';

export async function createAdSetWithCopyVersions(brand, {
  adSetName, campaignId, costCapCents, dailyBudgetCents, link, ctaType, asset, copyVersions,
}) {
  if (!brand.pageId || !brand.pixelId) {
    throw new Error('Set a Facebook Page ID and Pixel ID in this brand\'s settings first.');
  }
  if (!copyVersions || copyVersions.length === 0) {
    throw new Error('At least one headline/body copy version is required.');
  }

  const newAdSetId = await createAdSet(brand.adAccountId, {
    name: adSetName,
    campaignId,
    bidAmountCents: costCapCents,
    dailyBudgetCents,
    pixelId: brand.pixelId,
    status: 'PAUSED',
  });

  // Every version reuses the same uploaded asset — only the creative
  // (headline/body) differs — so one ad set failure-tolerant loop creates
  // one ad creative + one ad per version, and a partial failure (e.g. one
  // bad headline) doesn't take down the versions that did work.
  const ads = [];
  const errors = [];
  for (const [i, version] of copyVersions.entries()) {
    try {
      const creativeId = await createAdCreative(brand.adAccountId, {
        pageId: brand.pageId,
        headline: version.headline,
        body: version.body,
        link,
        ctaType,
        ...asset,
      });
      const adId = await createAd(brand.adAccountId, {
        name: `${adSetName} — v${i + 1}`,
        adSetId: newAdSetId,
        creativeId,
        status: 'ACTIVE',
      });
      ads.push({ headline: version.headline, adId, creativeId });
    } catch (err) {
      errors.push({ headline: version.headline, reason: err.message });
    }
  }

  // Only go live if at least one version made it in — an ad set with zero
  // ads left active is just spend with nothing to show for it.
  if (ads.length > 0) {
    await updateAdSetStatus(newAdSetId, 'ACTIVE');
  }

  const entry = {
    adSetName, newAdSetId, campaignId,
    adsCreated: ads.length, adsFailed: errors.length,
    ads, errors,
    appliedAt: new Date().toISOString(),
  };
  await recordNewCreative(brand.id, entry);
  return entry;
}
