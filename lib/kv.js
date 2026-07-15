// Thin helper over the Upstash-compatible REST API (Vercel KV or a
// standalone Upstash Redis both speak this), shared by every store in this
// app (sessions, brand configs, the Meta token, adjustment logs).

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set — provision a KV store (Vercel KV or Upstash Redis).');
  }
}

export async function kvGetJson(key, fallback = null) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : fallback;
}

export async function kvSetJson(key, value) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Failed to write KV key "${key}".`);
}

export async function kvGetRaw(key) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ?? null;
}

export async function kvSetRaw(key, value, { exSeconds } = {}) {
  assertConfigured();
  const url = exSeconds ? `${KV_URL}/set/${key}?EX=${exSeconds}` : `${KV_URL}/set/${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: value,
  });
  if (!res.ok) throw new Error(`Failed to write KV key "${key}".`);
}

export async function kvDel(key) {
  assertConfigured();
  await fetch(`${KV_URL}/del/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
}
