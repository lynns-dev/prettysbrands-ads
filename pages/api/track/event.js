// Public, fire-and-forget funnel event tracking. Never throws in a way that
// would surface to the visitor — a lost analytics ping shouldn't affect
// their experience.

import { incrementEvent, logEvent } from '../../../lib/analyticsStore';
import { sendCapiEvent, getRequestUserData } from '../../../lib/metaCapi';
import { isExcludedIp } from '../../../lib/ipFilter';

const ALLOWED = ['pageview', 'addtocart', 'checkout_start'];
// Logged to the timestamped recent-events feed for the live-activity view.
// pageview is excluded — too high-volume to be useful there.
const LOGGED = ['addtocart', 'checkout_start'];

// Maps our internal event names to Meta's standard event names for CAPI,
// paired with the browser Pixel call sharing the same eventId (see
// lib/useCart.js, pages/checkout.jsx) so Meta dedupes instead of
// double-counting.
const CAPI_EVENT_NAMES = { addtocart: 'AddToCart', checkout_start: 'InitiateCheckout' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { event, productName, eventId, contentId, contentIds, contents, value, url, sessionId } = req.body || {};
  if (ALLOWED.includes(event) && !isExcludedIp(req)) {
    try {
      await incrementEvent(event, sessionId);
      if (LOGGED.includes(event)) {
        await logEvent(event, {
          ...(productName ? { productName } : {}),
          ...(sessionId ? { sessionId } : {}),
        });
      }

      const capiEventName = CAPI_EVENT_NAMES[event];
      if (capiEventName && eventId) {
        await sendCapiEvent({
          eventName: capiEventName,
          eventId,
          eventSourceUrl: url,
          userData: getRequestUserData(req),
          customData: {
            currency: 'USD',
            value,
            content_ids: contentIds || (contentId ? [contentId] : undefined),
            contents,
          },
        });
      }
    } catch (err) {
      console.error('Event tracking failed:', err);
    }
  }

  return res.status(204).end();
}
