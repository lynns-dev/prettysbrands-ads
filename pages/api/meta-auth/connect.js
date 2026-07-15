// One-time setup step. Visit this route in a browser once, log into the
// Facebook account that's an admin (in Business Manager) on every ad
// account you plan to add as a brand here, and grant ads_management +
// ads_read. The resulting token is shared across all brands — adding a new
// brand just means adding its ad account ID, not reconnecting.

import { withAuth } from '../../../lib/requireAuth';

const GRAPH_VERSION = 'v21.0';

function handler(req, res) {
  const appId = process.env.META_APP_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!appId || !baseUrl) {
    return res.status(500).send('META_APP_ID and NEXT_PUBLIC_BASE_URL must be set before connecting Facebook Ads.');
  }

  const redirectUri = `${baseUrl}/api/meta-auth/callback`;
  const authorizeUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  authorizeUrl.searchParams.set('client_id', appId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'ads_management,ads_read');
  authorizeUrl.searchParams.set('state', Math.random().toString(36).slice(2));

  res.redirect(authorizeUrl.toString());
}

export default withAuth(handler, { redirectToLogin: true });
