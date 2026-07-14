// Thin client for the parts of the Meta Marketing API the cost-cap
// auto-adjust job needs: list an ad account's COST_CAP ad sets, pull their
// recent spend/purchase-revenue from Insights, and update an ad set's bid
// cap. All calls run server-side only (never expose META_APP_SECRET or the
// stored token to the client).

import { getValidAccessToken } from './metaAdsAuth';

const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Meta reports purchases under different action_types depending on how
// they're attributed (onsite pixel, offsite CAPI, cross-channel "omni").
// These are ordered by preference — take the first one present rather than
// summing them, since 'omni_purchase' already aggregates the others.
const PURCHASE_ACTION_TYPES = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];

function adAccountId() {
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) throw new Error('META_AD_ACCOUNT_ID is not set (format: act_1234567890).');
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

// Active ad sets on cost-cap bidding only — the only bid strategy this
// feature is designed to adjust. Everything else (lowest cost, bid cap on
// value optimization, etc.) is left alone.
export async function listCostCapAdSets() {
  const data = await graphGet(`${adAccountId()}/adsets`, {
    fields: 'id,name,campaign_id,campaign{name},effective_status,bid_strategy,bid_amount',
    limit: 200,
  });
  return (data.data || []).filter(
    (a) => a.bid_strategy === 'COST_CAP' && a.effective_status === 'ACTIVE' && Number(a.bid_amount) > 0
  );
}

// Spend + purchase revenue per ad set over the last `lookbackDays`, keyed
// by ad set id for easy lookup against listCostCapAdSets() results.
export async function getAdSetInsights(adSetIds, lookbackDays) {
  if (adSetIds.length === 0) return {};

  const until = new Date();
  const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const data = await graphGet(`${adAccountId()}/insights`, {
    level: 'adset',
    fields: 'adset_id,spend,actions,action_values',
    time_range: { since: fmt(since), until: fmt(until) },
    filtering: [{ field: 'adset.id', operator: 'IN', value: adSetIds }],
    limit: 500,
  });

  const byAdSet = {};
  for (const row of data.data || []) {
    byAdSet[row.adset_id] = {
      spend: Number(row.spend) || 0,
      purchases: pickAction(row.actions),
      revenue: pickAction(row.action_values),
    };
  }
  return byAdSet;
}

function pickAction(list) {
  if (!Array.isArray(list)) return 0;
  for (const type of PURCHASE_ACTION_TYPES) {
    const match = list.find((a) => a.action_type === type);
    if (match) return Number(match.value) || 0;
  }
  return 0;
}

// bidAmountCents is in the ad account's currency minor unit (cents for USD),
// matching what bid_amount already reports on the way in.
export async function updateAdSetBidAmount(adSetId, bidAmountCents) {
  return graphPost(adSetId, { bid_amount: String(Math.round(bidAmountCents)) });
}
