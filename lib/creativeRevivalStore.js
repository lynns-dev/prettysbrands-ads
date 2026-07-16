// Audit log of every creative-revival action applied, per brand.

import { kvGetJson, kvSetJson } from './kv';

const LOG_LIMIT = 200;
const logKey = (brandId) => `creative-revivals:${brandId}`;

export async function recordRevival(brandId, entry) {
  const existing = await kvGetJson(logKey(brandId), []);
  const updated = [entry, ...existing].slice(0, LOG_LIMIT);
  await kvSetJson(logKey(brandId), updated);
}

export async function getRevivalLog(brandId, limit = 50) {
  const all = await kvGetJson(logKey(brandId), []);
  return all.slice(0, limit);
}
