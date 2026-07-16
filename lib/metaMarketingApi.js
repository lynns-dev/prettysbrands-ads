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
// this is how a "revived" winning ad gets its proven creative into a fresh
// ad set without re-uploading anything.
export async function createAd(adAccountId, { name, adSetId, creativeId, status = 'PAUSED' }) {
  const data = await graphPost(`${normalizeAccountId(adAccountId)}/ads`, {
    name,
    adset_id: adSetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status,
  });
  return data.id;
}
