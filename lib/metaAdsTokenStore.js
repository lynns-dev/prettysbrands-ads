// Persists the Meta (Facebook) Marketing API long-lived access token in the
// same KV store used for QuickBooks tokens. Unlike QuickBooks, Meta's
// long-lived user tokens (~60 days) can't be silently refreshed with a
// refresh_token — re-authorizing means visiting /api/meta-ads-auth/connect
// again before the stored token expires.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'meta-ads:token';

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error(
      'KV_REST_API_URL / KV_REST_API_TOKEN are not set — connect a KV store (Vercel KV or Upstash Redis) so the Meta Ads token can persist between requests.'
    );
  }
}

export async function getMetaAdsToken() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

export async function setMetaAdsToken(record) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    throw new Error('Failed to persist the Meta Ads token to the KV store.');
  }
}
