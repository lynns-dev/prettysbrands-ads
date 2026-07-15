// Thin client for the parts of the Meta Marketing API this app needs, for
// any brand's ad account: active ad sets and their spend/revenue/purchases
// over a date range. All calls run server-side only (never expose
// META_APP_SECRET or the stored token to the client).

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

// Spend + purchase revenue for a set of ad-set ids over a date range, keyed
// by id for easy lookup against listAdSets()'s results.
export async function getInsights(adAccountId, { ids, since, until }) {
  if (!ids || ids.length === 0) return {};

  const data = await graphGet(`${normalizeAccountId(adAccountId)}/insights`, {
    level: 'adset',
    fields: 'adset_id,spend,actions,action_values',
    time_range: { since, until },
    filtering: [{ field: 'adset.id', operator: 'IN', value: ids }],
    limit: 500,
  });

  const byId = {};
  for (const row of data.data || []) {
    byId[row.adset_id] = {
      spend: (Number(row.spend) || 0) * MINOR_UNIT_MULTIPLIER,
      purchases: pickAction(row.actions),
      revenue: pickAction(row.action_values) * MINOR_UNIT_MULTIPLIER,
    };
  }
  return byId;
}
