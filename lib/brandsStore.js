// Brand = one client/ad account this app manages. Stored as a single JSON
// list in KV (a handful to a few dozen brands is the expected scale for an
// agency dashboard — no need for a real database). Core identity is just a
// name and an ad account ID, sharing the one Meta connection. The rest of
// the fields configure creative revival (lib/creativeRevival.js): what
// counts as a past winner, and where/how a revived creative gets its own
// ad set. Those stay null until an operator fills them in — the feature
// simply isn't runnable until they are (see findRevivableCreatives()).

import { randomUUID } from 'crypto';
import { kvGetJson, kvSetJson } from './kv';

const KEY = 'brands';

const DEFAULTS = {
  // Creative revival: a paused/inactive ad qualifies as a past winner when
  // its historical ROAS (over winnersLookbackDays) is at or above
  // targetRoas, with at least minSpendCents of spend to trust the number.
  targetRoas: 2,
  winnersLookbackDays: 30,
  minSpendCents: 5000,
  // Where a revived creative lands: templateAdSetId supplies the
  // targeting/placements/optimization goal (copied via Meta's ad-set-copy
  // endpoint); scalingCampaignId is the destination campaign, which must
  // NOT have Campaign Budget Optimization on (ABO needs ad-set-level
  // budgets, which CBO campaigns don't allow). costCapCents/
  // aboDailyBudgetCents are applied to every new ad set.
  templateAdSetId: null,
  scalingCampaignId: null,
  costCapCents: null,
  aboDailyBudgetCents: null,
};

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
  if (brand.targetRoas != null && !(Number(brand.targetRoas) > 0)) {
    throw new Error('targetRoas must be a positive number.');
  }
  if (brand.winnersLookbackDays != null && !(Number(brand.winnersLookbackDays) > 0)) {
    throw new Error('winnersLookbackDays must be a positive number.');
  }
  if (brand.minSpendCents != null && Number(brand.minSpendCents) < 0) {
    throw new Error('minSpendCents cannot be negative.');
  }
  if (brand.costCapCents != null && !(Number(brand.costCapCents) > 0)) {
    throw new Error('costCapCents must be a positive number, or omitted.');
  }
  if (brand.aboDailyBudgetCents != null && !(Number(brand.aboDailyBudgetCents) > 0)) {
    throw new Error('aboDailyBudgetCents must be a positive number, or omitted.');
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
    ...DEFAULTS,
    ...input,
    adAccountId: normalizeAdAccountId(input.adAccountId),
    targetRoas: input.targetRoas != null ? Number(input.targetRoas) : DEFAULTS.targetRoas,
    winnersLookbackDays: input.winnersLookbackDays != null ? Number(input.winnersLookbackDays) : DEFAULTS.winnersLookbackDays,
    minSpendCents: input.minSpendCents != null ? Number(input.minSpendCents) : DEFAULTS.minSpendCents,
    templateAdSetId: input.templateAdSetId ? String(input.templateAdSetId).trim() : null,
    scalingCampaignId: input.scalingCampaignId ? String(input.scalingCampaignId).trim() : null,
    costCapCents: input.costCapCents ? Number(input.costCapCents) : null,
    aboDailyBudgetCents: input.aboDailyBudgetCents ? Number(input.aboDailyBudgetCents) : null,
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
  if (patch.targetRoas != null) merged.targetRoas = Number(patch.targetRoas);
  if (patch.winnersLookbackDays != null) merged.winnersLookbackDays = Number(patch.winnersLookbackDays);
  if (patch.minSpendCents != null) merged.minSpendCents = Number(patch.minSpendCents);
  if ('templateAdSetId' in patch) merged.templateAdSetId = patch.templateAdSetId ? String(patch.templateAdSetId).trim() : null;
  if ('scalingCampaignId' in patch) merged.scalingCampaignId = patch.scalingCampaignId ? String(patch.scalingCampaignId).trim() : null;
  if ('costCapCents' in patch) merged.costCapCents = patch.costCapCents ? Number(patch.costCapCents) : null;
  if ('aboDailyBudgetCents' in patch) merged.aboDailyBudgetCents = patch.aboDailyBudgetCents ? Number(patch.aboDailyBudgetCents) : null;
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
