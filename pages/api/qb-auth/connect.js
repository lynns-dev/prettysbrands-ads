// One-time setup step. Visit this route in a browser once, log into the
// QuickBooks Online account that has Payments enabled, and authorize this
// app. From then on /api/qb-checkout refreshes its own access token
// automatically (see lib/qbServerAuth.js) — this route never needs to be
// visited again unless the connection is revoked or goes unused for 100+ days.

export default function handler(req, res) {
  const clientId = process.env.QB_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!clientId || !baseUrl) {
    return res.status(500).send('QB_CLIENT_ID and NEXT_PUBLIC_BASE_URL must be set before connecting QuickBooks.');
  }

  const redirectUri = `${baseUrl}/api/qb-auth/callback`;
  const authorizeUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  // Payment scope only — requesting accounting + payment together produces a
  // token that 401s on the Charges API (confirmed via direct testing).
  authorizeUrl.searchParams.set('scope', 'com.intuit.quickbooks.payment');
  authorizeUrl.searchParams.set('state', Math.random().toString(36).slice(2));

  res.redirect(authorizeUrl.toString());
}
