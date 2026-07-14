// Cost-cap auto-adjust state: the on/off switch (defaults OFF — connecting
// Facebook Ads never silently turns on live bid changes, an admin has to
// flip this deliberately) and an audit log of every adjustment actually
// applied, for the admin panel's history table.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const ENABLED_KEY = 'ads:auto_adjust_enabled';
const LOG_KEY = 'ads:adjustments';
const LOG_LIMIT = 200;

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

export async function getAutoAdjustEnabled() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${ENABLED_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result === '1';
}

export async function setAutoAdjustEnabled(enabled) {
  assertConfigured();
  await fetch(`${KV_URL}/set/${ENABLED_KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: enabled ? '1' : '0',
  });
}

export async function recordAdjustments(entries) {
  if (entries.length === 0) return;
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${LOG_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  const existing = data.result ? JSON.parse(data.result) : [];
  const updated = [...entries, ...existing].slice(0, LOG_LIMIT);
  await fetch(`${KV_URL}/set/${LOG_KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
}

export async function getAdjustmentLog(limit = 50) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${LOG_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  const all = data.result ? JSON.parse(data.result) : [];
  return all.slice(0, limit);
}
