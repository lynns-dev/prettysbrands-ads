// Persists the single shared Meta (Facebook) Marketing API access token —
// one connection is authorized once and used across every brand's ad
// account (the authorizing Facebook user needs admin access to each one via
// Business Manager). Long-lived user tokens (~60 days) can't refresh
// themselves like QuickBooks' refresh_token can — re-authorizing means
// visiting /api/meta-auth/connect again before the stored token expires.

import { kvGetJson, kvSetJson } from './kv';

const KEY = 'meta:token';

export async function getMetaAdsToken() {
  return kvGetJson(KEY);
}

export async function setMetaAdsToken(record) {
  return kvSetJson(KEY, record);
}
