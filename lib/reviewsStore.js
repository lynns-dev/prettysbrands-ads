// Product reviews persisted in the same Upstash KV store used for
// QuickBooks tokens. One key per product: reviews:<productId> -> JSON array
// of review objects, newest last.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

export async function getReviews(productId) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/reviews:${productId}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

export async function addReview(productId, review) {
  const existing = await getReviews(productId);
  const updated = [...existing, review];
  const res = await fetch(`${KV_URL}/set/reviews:${productId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  if (!res.ok) throw new Error('Failed to save review.');
  return updated;
}

export async function deleteReview(productId, reviewId) {
  const existing = await getReviews(productId);
  const updated = existing.filter((r) => r.id !== reviewId);
  const res = await fetch(`${KV_URL}/set/reviews:${productId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  if (!res.ok) throw new Error('Failed to delete review.');
  return updated;
}

export async function approveReview(productId, reviewId) {
  const existing = await getReviews(productId);
  const updated = existing.map((r) => (r.id === reviewId ? { ...r, status: 'approved' } : r));
  const res = await fetch(`${KV_URL}/set/reviews:${productId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  if (!res.ok) throw new Error('Failed to approve review.');
  return updated;
}
