// Persists QuickBooks OAuth tokens in a Redis-compatible KV store (Vercel KV
// or Upstash Redis both speak this same REST API) so the access token can be
// refreshed automatically across serverless invocations, with no manual
// rotation. Set KV_REST_API_URL / KV_REST_API_TOKEN to enable this.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'qb:tokens';

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error(
      'KV_REST_API_URL / KV_REST_API_TOKEN are not set — connect a KV store (Vercel KV or Upstash Redis) so QuickBooks tokens can persist between requests.'
    );
  }
}

export async function getTokens() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

export async function setTokens(tokens) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(tokens),
  });
  if (!res.ok) {
    throw new Error('Failed to persist QuickBooks tokens to the KV store.');
  }
}
