// Receives the authorization code from /api/qb-auth/connect, exchanges it
// for an access + refresh token pair, and stores both in the KV store. This
// is the only place the initial token pair is ever created — after this,
// lib/qbServerAuth.js keeps them fresh on its own.

import { setTokens } from '../../../lib/qbTokenStore';

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) return res.status(400).send(`QuickBooks authorization failed: ${error}`);
  if (!code) return res.status(400).send('Missing authorization code.');

  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    return res.status(500).send('QB_CLIENT_ID, QB_CLIENT_SECRET, and NEXT_PUBLIC_BASE_URL must be set.');
  }

  const redirectUri = `${baseUrl}/api/qb-auth/callback`;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(500).send(`Token exchange failed: ${data.error_description || data.error}`);
    }

    await setTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });

    res.status(200).send('QuickBooks Payments connected. You can close this tab — checkout will now stay authorized automatically.');
  } catch (err) {
    res.status(500).send(`Connection failed: ${err.message}`);
  }
}
