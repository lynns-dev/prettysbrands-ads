// One-time setup step. Visit this route in a browser once, log into the
// Facebook account that's an admin on the ad account being managed, and
// grant ads_management + ads_read. From then on the cost-cap auto-adjust
// pass (lib/costCapBidding.js) uses the stored token — but unlike
// QuickBooks, this token can't refresh itself: it lasts ~60 days, and this
// route needs to be visited again before it lapses (the admin panel shows
// the expiry date).

const GRAPH_VERSION = 'v21.0';

export default function handler(req, res) {
  const appId = process.env.META_APP_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!appId || !baseUrl) {
    return res.status(500).send('META_APP_ID and NEXT_PUBLIC_BASE_URL must be set before connecting Facebook Ads.');
  }

  const redirectUri = `${baseUrl}/api/meta-ads-auth/callback`;
  const authorizeUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  authorizeUrl.searchParams.set('client_id', appId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'ads_management,ads_read');
  authorizeUrl.searchParams.set('state', Math.random().toString(36).slice(2));

  res.redirect(authorizeUrl.toString());
}
