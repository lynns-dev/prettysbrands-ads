// Audit log of every "upload new creative" run, per brand.

import { kvGetJson, kvSetJson } from './kv';

const LOG_LIMIT = 100;
const logKey = (brandId) => `new-creative-runs:${brandId}`;

export async function recordNewCreative(brandId, entry) {
  const existing = await kvGetJson(logKey(brandId), []);
  const updated = [entry, ...existing].slice(0, LOG_LIMIT);
  await kvSetJson(logKey(brandId), updated);
}

export async function getNewCreativeLog(brandId, limit = 20) {
  const all = await kvGetJson(logKey(brandId), []);
  return all.slice(0, limit);
}
