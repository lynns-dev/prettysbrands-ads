// Audit log of every ad-refresh (fatigue) action applied, per brand.

import { kvGetJson, kvSetJson } from './kv';

const LOG_LIMIT = 200;
const logKey = (brandId) => `ads:refreshes:${brandId}`;

export async function recordRefreshes(brandId, entries) {
  if (entries.length === 0) return;
  const existing = await kvGetJson(logKey(brandId), []);
  const updated = [...entries, ...existing].slice(0, LOG_LIMIT);
  await kvSetJson(logKey(brandId), updated);
}

export async function getRefreshLog(brandId, limit = 50) {
  const all = await kvGetJson(logKey(brandId), []);
  return all.slice(0, limit);
}
