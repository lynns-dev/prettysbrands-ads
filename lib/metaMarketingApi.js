// Thin client for the parts of the Meta Marketing API this app needs, for
// any brand's ad account: campaigns/ad sets/ads (creatives) with insights,
// and updating a COST_CAP ad set's bid. All calls run server-side only
// (never expose META_APP_SECRET or the stored token to the client).

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
// unit (e.g. whole dollars, "12.34"), while ad set bid_amount is in minor
// units (cents) — a well-known Marketing API inconsistency. Converting to
// minor units here keeps every dollar figure elsewhere in this app (bid
// caps, spend, revenue, budgets) in the same unit. This assumes a
// 2-decimal currency (USD/EUR/GBP/...); zero-decimal currencies (JPY, KRW,
// ...) would need to skip this multiplication.
const MINOR_UNIT_MULTIPLIER = 100;

export async function listCampaigns(adAccountId) {
  const data = await graphGet(`${normalizeAccountId(adAccountId)}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
    limit: 200,
  });
  return data.data || [];
}

export async function listAdSets(adAccountId) {
  const data = await graphGet(`${normalizeAccountId(adAccountId)}/adsets`, {
    fields: 'id,name,campaign_id,status,effective_status,bid_strategy,bid_amount,daily_budget,lifetime_budget',
    limit: 500,
  });
  return data.data || [];
}

export async function listAds(adAccountId) {
  const data = await graphGet(`${normalizeAccountId(adAccountId)}/ads`, {
    fields: 'id,name,adset_id,campaign_id,status,effective_status,creative{id,name,thumbnail_url}',
    limit: 500,
  });
  return data.data || [];
}

// Active ad sets on cost-cap bidding only — the only bid strategy the
// auto-adjust feature touches. Everything else is left alone, but still
// shows up in the plain campaign/ad set browser via listAdSets().
export async function listCostCapAdSets(adAccountId) {
  const adSets = await listAdSets(adAccountId);
  return adSets.filter((a) => a.bid_strategy === 'COST_CAP' && a.effective_status === 'ACTIVE' && Number(a.bid_amount) > 0);
}

// Spend + purchase revenue for a set of campaign/ad-set/ad ids over a date
// range, keyed by id for easy lookup against the list*() results above.
export async function getInsights(adAccountId, { level, ids, since, until }) {
  if (!ids || ids.length === 0) return {};
  const idKey = level === 'campaign' ? 'campaign_id' : level === 'ad' ? 'ad_id' : 'adset_id';
  const idField = level === 'campaign' ? 'campaign.id' : level === 'ad' ? 'ad.id' : 'adset.id';

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

// Account-wide spend/revenue for a date range — used for budget pacing,
// where the total matters more than any single campaign/ad set.
export async function getAccountInsights(adAccountId, { since, until }) {
  const data = await graphGet(`${normalizeAccountId(adAccountId)}/insights`, {
    level: 'account',
    fields: 'spend,actions,action_values',
    time_range: { since, until },
  });
  const row = (data.data || [])[0];
  if (!row) return { spend: 0, purchases: 0, revenue: 0 };
  return {
    spend: (Number(row.spend) || 0) * MINOR_UNIT_MULTIPLIER,
    purchases: pickAction(row.actions),
    revenue: pickAction(row.action_values) * MINOR_UNIT_MULTIPLIER,
  };
}

// bidAmountCents is in the ad account's currency minor unit (cents for USD),
// matching what bid_amount already reports on the way in.
export async function updateAdSetBidAmount(adSetId, bidAmountCents) {
  return graphPost(adSetId, { bid_amount: String(Math.round(bidAmountCents)) });
}
