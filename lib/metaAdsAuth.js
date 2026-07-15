// Reads the currently-stored Meta Marketing API access token. There is no
// silent refresh path (see lib/metaAdsTokenStore.js) — this surfaces a clear
// error pointing back at the connect flow once the token is missing or has
// expired, instead of letting a Graph API 401 leak through.

import { getMetaAdsToken } from './metaAdsTokenStore';

export async function getValidAccessToken() {
  const stored = await getMetaAdsToken();
  if (!stored) {
    throw new Error('Facebook Ads is not connected yet — visit /api/meta-auth/connect once to authorize.');
  }
  if (Date.now() > stored.expires_at) {
    throw new Error('The Facebook Ads connection expired — visit /api/meta-auth/connect to re-authorize.');
  }
  return stored.access_token;
}

// Surfaced in the dashboard so a lapsing connection is visible well before
// it actually breaks the daily auto-adjust run.
export async function getConnectionStatus() {
  const stored = await getMetaAdsToken();
  if (!stored) return { connected: false };
  return { connected: Date.now() <= stored.expires_at, expiresAt: stored.expires_at };
}
