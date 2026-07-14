// Meta Pixel — client-side event firing. Paired with server-side
// Conversions API calls (lib/metaCapi.js) via a shared event_id so Meta
// dedupes a pixel+CAPI pair instead of double-counting the same action.
// Wiring: PageView/init in pages/_app.jsx, ViewContent in
// pages/product/[id].jsx, AddToCart in lib/useCart.js, InitiateCheckout in
// pages/checkout.jsx, Purchase in pages/success.jsx.

export function generateEventId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadPixel(pixelId) {
  if (typeof window === 'undefined' || !pixelId || window.fbq) return;

  const n = function (...args) {
    n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
  };
  window.fbq = n;
  window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  n('init', pixelId);
}

export function fbTrack(eventName, params, eventId) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', eventName, params || {}, eventId ? { eventID: eventId } : undefined);
}
