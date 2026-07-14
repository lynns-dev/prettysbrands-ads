// QuickBooks Payments client-side card tokenization.
//
// Calls Intuit's Payments "tokens" REST endpoint directly from the browser
// with the raw card details, so the card number never touches our own
// server (keeps the site out of full PCI card-data scope). This endpoint
// takes no Authorization header by design — it's meant to be called
// client-side. The resulting one-time token is then sent to
// /api/qb-checkout, which charges it server-side via the QuickBooks
// Payments Charges API. Endpoint/request shape confirmed against Intuit's
// own sample code (Payments API docs).

const API_BASE = {
  sandbox: 'https://sandbox.api.intuit.com',
  production: 'https://api.intuit.com',
};

// card: { number, expMonth, expYear, cvc, name, postalCode, street, city, region, country }
// Resolves to a single-use card token string.
export async function tokenizeCard(card, environment = 'sandbox') {
  const base = API_BASE[environment] || API_BASE.sandbox;

  const res = await fetch(`${base}/quickbooks/v4/payments/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Request-Id': `si-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    },
    body: JSON.stringify({
      card: {
        number: card.number.replace(/\s+/g, ''),
        expMonth: card.expMonth,
        expYear: card.expYear,
        cvc: card.cvc,
        name: card.name,
        address: {
          streetAddress: card.street,
          city: card.city,
          region: card.region,
          postalCode: card.postalCode,
          country: card.country || 'US',
        },
      },
    }),
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Card tokenization failed (${res.status}): ${raw.slice(0, 200) || 'empty response'}`);
  }
  if (!res.ok || !data.value) {
    throw new Error(data?.errors?.[0]?.detail || data?.error || `Card tokenization failed (${res.status})`);
  }
  return data.value;
}
