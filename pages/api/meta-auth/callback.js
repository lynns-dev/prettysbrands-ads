// Receives the authorization code from /api/meta-auth/connect, exchanges it
// for a short-lived user token, upgrades that to a long-lived (~60 day)
// token, and stores it — the one shared connection used across every brand.

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

  if (!appId || !appSecret || !baseUrl) {
    return res.status(500).send('META_APP_ID, META_APP_SECRET, and NEXT_PUBLIC_BASE_URL must be set.');
  }

  const redirectUri = `${baseUrl}/api/meta-auth/callback`;

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
      expires_at: Date.now() + (longLivedData.expires_in || 60 * 24 * 60 * 60) * 1000,
    });

    res.status(200).send(
      'Facebook Ads connected. You can close this tab and add brands from the dashboard. ' +
      'This connection lasts about 60 days; the dashboard shows the expiry so you can re-authorize in time.'
    );
  } catch (err) {
    res.status(500).send(`Connection failed: ${err.message}`);
  }
}
