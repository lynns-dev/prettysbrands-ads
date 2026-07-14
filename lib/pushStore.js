// Web Push subscriptions for admin order notifications, stored in the same
// KV store as everything else. Key: push_subscriptions -> JSON array of
// PushSubscription objects (endpoint + keys), one per device that enabled
// notifications on /admin.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'push_subscriptions';

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

export async function getSubscriptions() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

async function saveSubscriptions(subs) {
  assertConfigured();
  await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(subs),
  });
}

export async function addSubscription(subscription) {
  const existing = await getSubscriptions();
  const updated = [...existing.filter((s) => s.endpoint !== subscription.endpoint), subscription];
  await saveSubscriptions(updated);
  return updated;
}

export async function removeSubscription(endpoint) {
  const existing = await getSubscriptions();
  const updated = existing.filter((s) => s.endpoint !== endpoint);
  await saveSubscriptions(updated);
  return updated;
}
