// Keeps a QuickBooks Payments access token valid with zero manual steps.
//
// Access tokens last ~1hr; refresh tokens last ~100 days and rotate on every
// use. getValidAccessToken() refreshes automatically whenever the stored
// token is close to expiring and saves the newly-rotated pair back to the
// KV store — so as long as checkout runs at least once every 100 days, the
// connection never needs re-authorizing by hand after the initial one-time
// /api/qb-auth/connect flow.

import { getTokens, setTokens } from './qbTokenStore';

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function basicAuthHeader() {
  const id = process.env.QB_CLIENT_ID;
  const secret = process.env.QB_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('QB_CLIENT_ID / QB_CLIENT_SECRET are not set.');
  }
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

async function refresh(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh QuickBooks access token');
  }
  const record = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  await setTokens(record);
  return record;
}

// Returns a currently-valid access token, transparently refreshing first if needed.
export async function getValidAccessToken() {
  const stored = await getTokens();
  if (!stored) {
    throw new Error('QuickBooks Payments is not connected yet — visit /api/qb-auth/connect once to authorize.');
  }
  if (Date.now() < stored.expires_at - REFRESH_MARGIN_MS) {
    return stored.access_token;
  }
  const refreshed = await refresh(stored.refresh_token);
  return refreshed.access_token;
}
