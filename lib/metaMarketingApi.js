// Thin client for the parts of the Meta Marketing API this app needs, for
// any brand's ad account: active ad sets and ads with insights, plus the
// handful of write calls creative revival needs (copy an ad set into a
// different campaign, set its cost-cap bid + ABO budget, and create a new
// ad from an existing creative). All calls run server-side only (never
// expose META_APP_SECRET or the stored token to the client).

import { getValidAccessToken } from './metaAdsAuth';

const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Meta reports purchases under different action_types depending on how
// they're attributed (onsite pixel, offsite CAPI, cross-channel "omni").
// These are ordered by preference — take the first one present rather than
// summing them, since 'omni_purchase' already aggregates the others.
const PURCHASE_ACTION_TYPES = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];

function normalizeAccountId(id) {
  return id.startsWith('act_') ? id : `act_${id}`;
}

async function graphGet(path, params = {}) {
  const token = await getValidAccessToken();
  const url = new URL(`${GRAPH_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  url.searchParams.set('access_token', token);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Meta Graph API GET ${path} failed`);
  return data;
}

async function graphPost(path, body) {
  const token = await getValidAccessToken();
  const url = new URL(`${GRAPH_URL}/${path}`);
  url.searchParams.set('access_token', token);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Meta Graph API POST ${path} failed`);
  return data;
}

// multipart/form-data POST — only the video resumable-upload "transfer"
// phase needs this (a binary chunk can't safely travel through
// URLSearchParams). Let fetch set the multipart Content-Type/boundary
// itself; don't override it.
async function graphPostForm(path, formData) {
  const token = await getValidAccessToken();
  const url = new URL(`${GRAPH_URL}/${path}`);
  url.searchParams.set('access_token', token);
  const res = await fetch(url.toString(), { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Meta Graph API POST ${path} failed`);
  return data;
}

function pickAction(list) {
  if (!Array.isArray(list)) return 0;
  for (const type of PURCHASE_ACTION_TYPES) {
    const match = list.find((a) => a.action_type === type);
    if (match) return Number(match.value) || 0;
  }
  return 0;
}

// Insights reports spend/action_values in the account's standard currency
// unit (e.g. whole dollars, "12.34") — converting to minor units (cents)
// here keeps every dollar figure in this app in the same unit. Assumes a
// 2-decimal currency (USD/EUR/GBP/...); zero-decimal currencies (JPY, KRW,
// ...) would need to skip this multiplication.
const MINOR_UNIT_MULTIPLIER = 100;

export async function listAdSets(adAccountId) {
  const data = await graphGet(`${normalizeAccountId(adAccountId)}/adsets`, {
    fields: 'id,name,status,effective_status',
    filtering: [{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }],
    limit: 500,
  });
  return data.data || [];
}

// Every ad regardless of status — creative revival specifically needs to
// see ads that are NOT currently active, so this deliberately doesn't
// filter by effective_status the way listAdSets() does.
export async function listAds(adAccountId) {
  const data = await graphGet(`${normalizeAccountId(adAccountId)}/ads`, {
    fields: 'id,name,adset_id,status,effective_status,creative{id,name,thumbnail_url}',
    limit: 500,
  });
  return data.data || [];
}

// Spend + purchase revenue for a set of ad-set or ad ids over a date range,
// keyed by id for easy lookup against listAdSets()/listAds()'s results.
export async function getInsights(adAccountId, { level = 'adset', ids, since, until }) {
  if (!ids || ids.length === 0) return {};
  const idKey = level === 'ad' ? 'ad_id' : 'adset_id';
  const idField = level === 'ad' ? 'ad.id' : 'adset.id';

  const data = await graphGet(`${normalizeAccountId(adAccountId)}/insights`, {
    level,
    fields: `${idKey},spend,actions,action_values`,
    time_range: { since, until },
    filtering: [{ field: idField, operator: 'IN', value: ids }],
    limit: 500,
  });

  const byId = {};
  for (const row of data.data || []) {
    byId[row[idKey]] = {
      spend: (Number(row.spend) || 0) * MINOR_UNIT_MULTIPLIER,
      purchases: pickAction(row.actions),
      revenue: pickAction(row.action_values) * MINOR_UNIT_MULTIPLIER,
    };
  }
  return byId;
}

// Meta's Ad Set Copies endpoint. campaignId lets the copy land in a
// different campaign than the source ad set — used by creative revival to
// clone a "template" ad set's targeting/optimization/placements into the
// brand's designated scaling campaign. deep_copy: false means the ads
// inside the source ad set are NOT copied — the caller adds its own ad
// via createAd() once the new ad set is configured.
export async function copyAdSet(adSetId, { deepCopy = false, statusOption = 'PAUSED', campaignId } = {}) {
  const data = await graphPost(`${adSetId}/copies`, {
    deep_copy: deepCopy ? 'true' : 'false',
    status_option: statusOption,
    ...(campaignId ? { campaign_id: campaignId } : {}),
  });
  return data.ad_set_id;
}

// Switches an ad set onto COST_CAP bidding with its own ad-set-level daily
// budget (ABO). Note: this only works if the ad set's campaign does NOT
// have Campaign Budget Optimization (CBO) turned on — Meta rejects an
// ad-set-level budget under a CBO campaign. The brand's designated scaling
// campaign needs to be a plain (non-CBO) campaign for this to succeed.
export async function setCostCapBudget(adSetId, { bidAmountCents, dailyBudgetCents }) {
  return graphPost(adSetId, {
    bid_strategy: 'COST_CAP',
    bid_amount: String(Math.round(bidAmountCents)),
    daily_budget: String(Math.round(dailyBudgetCents)),
  });
}

export async function updateAdSetStatus(adSetId, status) {
  return graphPost(adSetId, { status });
}

// Creates a new ad in adSetId reusing an existing creative (creativeId) —
// this is how a "revived" winning ad (or a freshly uploaded one) gets its
// creative into an ad set without re-uploading anything.
export async function createAd(adAccountId, { name, adSetId, creativeId, status = 'PAUSED' }) {
  const data = await graphPost(`${normalizeAccountId(adAccountId)}/ads`, {
    name,
    adset_id: adSetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status,
  });
  return data.id;
}

// Uploads an image asset via Meta's `bytes` shortcut (base64-encoded
// content as a plain POST param — no multipart needed since images are
// small enough for a single request). Returns the image_hash used by
// createAdCreative()'s link_data.image_hash.
export async function uploadImage(adAccountId, { base64 }) {
  const data = await graphPost(`${normalizeAccountId(adAccountId)}/adimages`, { bytes: base64 });
  const first = Object.values(data.images || {})[0];
  if (!first?.hash) throw new Error('Image upload did not return a usable image hash.');
  return first.hash;
}

// The three phases of Meta's resumable video upload protocol — needed
// because video files routinely exceed the ~4.5MB request-body limit this
// app's API routes run under (Vercel serverless functions), so the browser
// sends the file in chunks that get relayed to Meta one at a time instead
// of as a single upload.
export async function startVideoUpload(adAccountId, fileSizeBytes) {
  const data = await graphPost(`${normalizeAccountId(adAccountId)}/advideos`, {
    upload_phase: 'start',
    file_size: String(fileSizeBytes),
  });
  return { videoId: data.video_id, uploadSessionId: data.upload_session_id, startOffset: Number(data.start_offset), endOffset: Number(data.end_offset) };
}

export async function transferVideoChunk(adAccountId, { uploadSessionId, startOffset, chunk }) {
  const form = new FormData();
  form.set('upload_phase', 'transfer');
  form.set('upload_session_id', uploadSessionId);
  form.set('start_offset', String(startOffset));
  form.set('video_file_chunk', new Blob([chunk]));
  const data = await graphPostForm(`${normalizeAccountId(adAccountId)}/advideos`, form);
  return { startOffset: Number(data.start_offset), endOffset: Number(data.end_offset) };
}

export async function finishVideoUpload(adAccountId, uploadSessionId) {
  return graphPost(`${normalizeAccountId(adAccountId)}/advideos`, {
    upload_phase: 'finish',
    upload_session_id: uploadSessionId,
  });
}

// Meta processes an uploaded video asynchronously before a thumbnail is
// available, so this polls a few times with a short delay rather than
// failing immediately — a video ad creative needs a thumbnail image_url,
// there's no way around waiting for one.
export async function getVideoThumbnail(videoId, { attempts = 4, delayMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const data = await graphGet(`${videoId}/thumbnails`, {});
    const thumb = (data.data || []).find((t) => t.is_preferred) || (data.data || [])[0];
    if (thumb?.uri) return thumb.uri;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

// Creates a brand-new ad set with fixed, deliberately simple targeting —
// United States, automatic (Advantage+) placements since no publisher
// platform/position fields are specified, optimized for purchases via the
// brand's pixel — on COST_CAP bidding with its own ad-set-level (ABO)
// daily budget. Same CBO caveat as setCostCapBudget(): campaignId's
// campaign must not have Campaign Budget Optimization on.
export async function createAdSet(adAccountId, { name, campaignId, bidAmountCents, dailyBudgetCents, pixelId, status = 'PAUSED' }) {
  const data = await graphPost(`${normalizeAccountId(adAccountId)}/adsets`, {
    name,
    campaign_id: campaignId,
    bid_strategy: 'COST_CAP',
    bid_amount: String(Math.round(bidAmountCents)),
    daily_budget: String(Math.round(dailyBudgetCents)),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    promoted_object: JSON.stringify({ pixel_id: pixelId, custom_event_type: 'PURCHASE' }),
    targeting: JSON.stringify({ geo_locations: { countries: ['US'] } }),
    status,
  });
  return data.id;
}

// Builds the ad creative (headline/body/link/CTA paired with either an
// uploaded image or video) that createAd() then turns into an actual ad.
export async function createAdCreative(adAccountId, { pageId, headline, body, link, ctaType, imageHash, videoId, thumbnailUrl }) {
  const objectStorySpec = videoId
    ? {
        page_id: pageId,
        video_data: {
          video_id: videoId,
          image_url: thumbnailUrl,
          title: headline,
          message: body,
          call_to_action: { type: ctaType, value: { link } },
        },
      }
    : {
        page_id: pageId,
        link_data: {
          image_hash: imageHash,
          link,
          name: headline,
          message: body,
          call_to_action: { type: ctaType, value: { link } },
        },
      };

  const data = await graphPost(`${normalizeAccountId(adAccountId)}/adcreatives`, {
    name: headline,
    object_story_spec: JSON.stringify(objectStorySpec),
  });
  return data.id;
}
