// Audit log of every cost-cap adjustment actually applied, per brand — the
// on/off switch itself lives on the brand record (lib/brandsStore.js), not
// here.

import { kvGetJson, kvSetJson } from './kv';

const LOG_LIMIT = 200;
const logKey = (brandId) => `ads:adjustments:${brandId}`;

export async function recordAdjustments(brandId, entries) {
  if (entries.length === 0) return;
  const existing = await kvGetJson(logKey(brandId), []);
  const updated = [...entries, ...existing].slice(0, LOG_LIMIT);
  await kvSetJson(logKey(brandId), updated);
}

export async function getAdjustmentLog(brandId, limit = 50) {
  const all = await kvGetJson(logKey(brandId), []);
  return all.slice(0, limit);
}
