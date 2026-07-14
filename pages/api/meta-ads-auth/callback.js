// Receives the authorization code from /api/meta-ads-auth/connect, exchanges
// it for a short-lived user token, immediately upgrades that to a long-lived
// (~60 day) token, and stores it. This is the only place the token is ever
// created — there's no refresh_token like QuickBooks has, so re-authorizing
// later always comes back through this same flow.

import { setMetaAdsToken } from '../../../lib/metaAdsTokenStore';

const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) return res.status(400).send(`Facebook authorization failed: ${error_description || error}`);
  if (!code) return res.status(400).send('Missing authorization code.');

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!appId || !appSecret || !baseUrl) {
    return res.status(500).send('META_APP_ID, META_APP_SECRET, and NEXT_PUBLIC_BASE_URL must be set.');
  }

  const redirectUri = `${baseUrl}/api/meta-ads-auth/callback`;

  try {
    const shortLivedUrl = new URL(`${GRAPH_URL}/oauth/access_token`);
    shortLivedUrl.searchParams.set('client_id', appId);
    shortLivedUrl.searchParams.set('client_secret', appSecret);
    shortLivedUrl.searchParams.set('redirect_uri', redirectUri);
    shortLivedUrl.searchParams.set('code', code);

    const shortLivedRes = await fetch(shortLivedUrl.toString());
    const shortLivedData = await shortLivedRes.json();
    if (!shortLivedRes.ok) {
      return res.status(500).send(`Token exchange failed: ${shortLivedData.error?.message || 'unknown error'}`);
    }

    const longLivedUrl = new URL(`${GRAPH_URL}/oauth/access_token`);
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', appId);
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedData.access_token);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();
    if (!longLivedRes.ok) {
      return res.status(500).send(`Long-lived token exchange failed: ${longLivedData.error?.message || 'unknown error'}`);
    }

    await setMetaAdsToken({
      access_token: longLivedData.access_token,
      // Meta returns expires_in for the long-lived token (~5,184,000s / 60 days).
      expires_at: Date.now() + (longLivedData.expires_in || 60 * 24 * 60 * 60) * 1000,
      ad_account_id: adAccountId || null,
    });

    res.status(200).send(
      'Facebook Ads connected. You can close this tab — cost-cap auto-adjust can now read spend/revenue and update bids. ' +
      'This connection lasts about 60 days; the admin panel will show you the expiry so you can re-authorize in time.'
    );
  } catch (err) {
    res.status(500).send(`Connection failed: ${err.message}`);
  }
}
