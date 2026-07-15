// Single shared admin login (ADMIN_PASSWORD) — this app has no per-brand or
// per-user accounts, just one operator managing every connected brand.
// Sessions are random tokens in the KV store, set to expire in a year so a
// login stays valid indefinitely in practice; logging out is the only way
// to end one sooner.

import { randomUUID } from 'crypto';
import { kvSetRaw, kvGetRaw, kvDel } from './kv';

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
export const SESSION_COOKIE = 'admin_session';

export function checkPassword(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error('ADMIN_PASSWORD is not set.');
  return Boolean(password) && password === expected;
}

export async function createSession() {
  const token = randomUUID().replace(/-/g, '');
  await kvSetRaw(`admin_session:${token}`, '1', { exSeconds: SESSION_TTL_SECONDS });
  return token;
}

export async function verifySession(token) {
  if (!token) return false;
  return Boolean(await kvGetRaw(`admin_session:${token}`));
}

export async function deleteSession(token) {
  if (!token) return;
  await kvDel(`admin_session:${token}`);
}
