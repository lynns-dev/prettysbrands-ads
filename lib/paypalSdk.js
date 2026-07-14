// Shared PayPal JS SDK loader — every express-checkout button (PayPal,
// Venmo, Apple Pay, Google Pay) needs the same script tag, just once.
// `components` must list applepay/googlepay explicitly or window.paypal
// won't expose paypal.Applepay()/paypal.Googlepay() at all.

let sdkPromise = null;

export function loadPaypalSdk(clientId) {
  if (typeof window === 'undefined') return Promise.reject(new Error('PayPal SDK can only load in the browser.'));
  if (window.paypal) return Promise.resolve(window.paypal);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // disable-funding=card suppresses PayPal's own separate "Debit or Credit
    // Card" button — the site already has its own card checkout via
    // QuickBooks, so only wallet buttons should render here. enable-funding
    // opts into Venmo, which the SDK doesn't render by default even on
    // merchant accounts that support it.
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons,applepay,googlepay&disable-funding=card&enable-funding=venmo`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error('Failed to load the PayPal SDK.'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}
