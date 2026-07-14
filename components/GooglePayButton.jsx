import React from 'react';
import { generateEventId } from '../lib/fbPixel';
import { loadPaypalSdk } from '../lib/paypalSdk';

const GOOGLE_PAY_SCRIPT_SRC = 'https://pay.google.com/gp/p/js/pay.js';
let googlePayScriptPromise = null;

function loadGooglePayScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Pay can only load in the browser.'));
  if (window.google?.payments?.api) return Promise.resolve(window.google);
  if (googlePayScriptPromise) return googlePayScriptPromise;

  googlePayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_PAY_SCRIPT_SRC;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load the Google Pay SDK.'));
    document.body.appendChild(script);
  });
  return googlePayScriptPromise;
}

// PayPal's Google Pay bridge: paypal.Googlepay().config() returns the
// allowedPaymentMethods/merchantInfo shape Google's own PaymentsClient
// expects, with PayPal set as the payment gateway. Google's client renders
// the actual branded button (via createButton) so it always matches
// Google's current guidelines instead of a hand-rolled lookalike; clicking
// it opens Google's payment sheet, and confirmOrder() finalizes the same
// create-order/capture-order pair PayPalButton uses.
//
// Uses PRODUCTION in a production build and TEST otherwise — deliberately
// not a synced pair of env vars like NEXT_PUBLIC_QB_ENVIRONMENT/
// QB_ENVIRONMENT were, since that pattern is exactly what caused silent
// sandbox-mode charging earlier. Requires Google Pay to be enabled on the
// PayPal account; no domain-verification file needed (unlike Apple Pay).
export default function GooglePayButton({ amount, items, url, disabled, onSuccess, onError }) {
  const containerRef = React.useRef(null);
  const [eligible, setEligible] = React.useState(false);
  const stateRef = React.useRef({ amount, items, url });
  stateRef.current.amount = amount;
  stateRef.current.items = items;
  stateRef.current.url = url;

  const handleClick = React.useCallback(async (googlepay, paymentsClient, config) => {
    try {
      const paymentData = await paymentsClient.loadPaymentData({
        apiVersion: config.apiVersion,
        apiVersionMinor: config.apiVersionMinor,
        allowedPaymentMethods: config.allowedPaymentMethods,
        merchantInfo: config.merchantInfo,
        transactionInfo: {
          countryCode: config.countryCode,
          currencyCode: 'USD',
          totalPriceStatus: 'FINAL',
          totalPrice: Number(stateRef.current.amount).toFixed(2),
        },
      });

      const eventId = generateEventId();
      const orderRes = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: stateRef.current.amount }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Could not start Google Pay checkout.');

      await googlepay.confirmOrder({ orderId: orderData.id, paymentMethodData: paymentData.paymentMethodData });

      const captureRes = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.id,
          items: stateRef.current.items,
          eventId,
          url: stateRef.current.url,
          paymentMethod: 'Google Pay',
        }),
      });
      const result = await captureRes.json();
      if (!captureRes.ok) throw new Error(result.error || 'Payment could not be completed.');

      onSuccess?.({ ...result, eventId });
    } catch (err) {
      if (err.statusCode === 'CANCELED') return; // shopper closed the Google Pay sheet
      console.error('Google Pay payment failed:', err);
      onError?.(err.message || 'Google Pay checkout failed. Please try again.');
    }
  }, [onSuccess, onError]);

  React.useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId || !containerRef.current) return;

    let cancelled = false;
    Promise.all([loadPaypalSdk(clientId), loadGooglePayScript()])
      .then(async ([paypal, google]) => {
        if (cancelled || !paypal.Googlepay || !containerRef.current) return;
        const googlepay = paypal.Googlepay();
        const config = await googlepay.config();
        if (cancelled || !containerRef.current) return;

        const paymentsClient = new google.payments.api.PaymentsClient({
          environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST',
        });

        const isReady = await paymentsClient.isReadyToPay({
          apiVersion: config.apiVersion,
          apiVersionMinor: config.apiVersionMinor,
          allowedPaymentMethods: config.allowedPaymentMethods,
        });
        if (cancelled || !isReady.result || !containerRef.current) return;

        const button = paymentsClient.createButton({
          onClick: () => handleClick(googlepay, paymentsClient, config),
          buttonColor: 'black',
          buttonType: 'pay',
          buttonSizeMode: 'fill',
        });
        containerRef.current.appendChild(button);
        setEligible(true);
      })
      .catch((err) => {
        // Same rule as PayPalButton: a setup/eligibility failure just hides
        // this button rather than surfacing a page-level error.
        console.error('Google Pay setup failed:', err);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: eligible ? 'block' : 'none', height: 45, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div ref={containerRef} style={{ height: '100%' }} />
    </div>
  );
}
