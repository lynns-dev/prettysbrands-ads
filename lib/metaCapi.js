// Meta Conversions API — server-side event sends, paired with the browser
// Pixel (lib/fbPixel.js) via a shared event_id so Meta dedupes a pixel+CAPI
// pair instead of double-counting. Wired into pages/api/track/event.js
// (AddToCart, InitiateCheckout) and pages/api/qb-checkout.js (Purchase).

const GRAPH_VERSION = 'v19.0';

// fbp/fbc cookies, IP, and user agent all improve Meta's match quality —
// none of this is sensitive PII, so no hashing is needed (unlike email/phone).
export function getRequestUserData(req) {
  const cookies = req.cookies || {};
  const forwardedFor = req.headers['x-forwarded-for'];
  return {
    client_ip_address: (forwardedFor ? forwardedFor.split(',')[0].trim() : null) || req.socket?.remoteAddress,
    client_user_agent: req.headers['user-agent'],
    fbp: cookies._fbp,
    fbc: cookies._fbc,
  };
}

export async function sendCapiEvent({ eventName, eventId, eventSourceUrl, userData, customData }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.error('NEXT_PUBLIC_META_PIXEL_ID / META_CAPI_ACCESS_TOKEN are not set — skipping CAPI event.');
    return;
  }

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: customData,
      },
    ],
  };
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE;
  if (testEventCode) body.test_event_code = testEventCode;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Meta CAPI event failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Meta CAPI request failed:', err.message);
  }
}
