// Brand = one client/ad account this app manages. Stored as a single JSON
// list in KV (a handful to a few dozen brands is the expected scale for an
// agency dashboard — no need for a real database). Deliberately minimal for
// now: just a name and an ad account ID, sharing the one Meta connection —
// everything else (bidding automation, AI features, budgets) was stripped
// out to restart from a clean, small base.

import { randomUUID } from 'crypto';
import { kvGetJson, kvSetJson } from './kv';

const KEY = 'brands';

function normalizeAdAccountId(id) {
  const trimmed = String(id || '').trim();
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

// Applied to the merged (existing + patch) record on both create and
// update, so a partial PATCH can't leave the brand in an invalid state.
function validate(brand) {
  if (!brand.name || !brand.name.trim()) throw new Error('Brand name is required.');
  if (!brand.adAccountId || !/^act_\d+$/.test(brand.adAccountId)) {
    throw new Error('adAccountId must look like act_1234567890.');
  }
}

export async function listBrands() {
  const brands = await kvGetJson(KEY, []);
  return brands.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBrand(id) {
  const brands = await kvGetJson(KEY, []);
  return brands.find((b) => b.id === id) || null;
}

export async function createBrand(input) {
  const now = new Date().toISOString();
  const brand = {
    name: input.name,
    adAccountId: normalizeAdAccountId(input.adAccountId),
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  validate(brand);

  const brands = await kvGetJson(KEY, []);
  brands.push(brand);
  await kvSetJson(KEY, brands);
  return brand;
}

export async function updateBrand(id, patch) {
  const brands = await kvGetJson(KEY, []);
  const index = brands.findIndex((b) => b.id === id);
  if (index === -1) throw new Error('Brand not found.');

  const merged = { ...brands[index], ...patch };
  if (patch.adAccountId) merged.adAccountId = normalizeAdAccountId(patch.adAccountId);
  merged.updatedAt = new Date().toISOString();
  validate(merged);

  brands[index] = merged;
  await kvSetJson(KEY, brands);
  return merged;
}

export async function deleteBrand(id) {
  const brands = await kvGetJson(KEY, []);
  const remaining = brands.filter((b) => b.id !== id);
  await kvSetJson(KEY, remaining);
  return remaining;
}
