// Brand = one client/ad account this app manages. Stored as a single JSON
// list in KV (a handful to a few dozen brands is the expected scale for an
// agency dashboard — no need for a real database). Each brand carries its
// own cost-cap bidding guardrails and an optional monthly budget for pacing,
// so different clients can run different targets against the one shared
// Meta connection.

import { randomUUID } from 'crypto';
import { kvGetJson, kvSetJson } from './kv';

const KEY = 'brands';

const DEFAULTS = {
  maxAdjustmentPct: 20,
  minSpendMultiplier: 10,
  lookbackDays: 7,
  autoAdjustEnabled: false,
  monthlyBudgetCents: null,
  // Naming substring (case-insensitive) that marks a campaign as part of the
  // testing pool the AI winner-detection feature scans — e.g. "test" for
  // campaigns named "TOF - Test - Jan26". Null until the operator sets one.
  testingCampaignPattern: null,
  // Ad-refresh (fatigue) guardrails — see lib/adFatigue.js for what these mean.
  autoRefreshEnabled: false,
  fatigueCostCapMarginPct: 20,
  fatigueMinSpendVsBudgetPct: 70,
  fatigueLookbackDays: 3,
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
  if (!(Number(brand.targetRoas) > 0)) throw new Error('targetRoas must be a positive number.');
  if (!(Number(brand.minCostCapCents) > 0) || !(Number(brand.maxCostCapCents) > Number(brand.minCostCapCents))) {
    throw new Error('minCostCapCents and maxCostCapCents must both be set, with min < max (currency minor units).');
  }
  if (brand.monthlyBudgetCents != null && !(Number(brand.monthlyBudgetCents) > 0)) {
    throw new Error('monthlyBudgetCents must be a positive number, or omitted.');
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
    id: randomUUID(),
    adAccountId: normalizeAdAccountId(input.adAccountId),
    targetRoas: Number(input.targetRoas),
    minCostCapCents: Number(input.minCostCapCents),
    maxCostCapCents: Number(input.maxCostCapCents),
    monthlyBudgetCents: input.monthlyBudgetCents ? Number(input.monthlyBudgetCents) : null,
    testingCampaignPattern: input.testingCampaignPattern ? String(input.testingCampaignPattern).trim() : null,
    fatigueCostCapMarginPct: input.fatigueCostCapMarginPct != null ? Number(input.fatigueCostCapMarginPct) : DEFAULTS.fatigueCostCapMarginPct,
    fatigueMinSpendVsBudgetPct: input.fatigueMinSpendVsBudgetPct != null ? Number(input.fatigueMinSpendVsBudgetPct) : DEFAULTS.fatigueMinSpendVsBudgetPct,
    fatigueLookbackDays: input.fatigueLookbackDays != null ? Number(input.fatigueLookbackDays) : DEFAULTS.fatigueLookbackDays,
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
  if (patch.minCostCapCents != null) merged.minCostCapCents = Number(patch.minCostCapCents);
  if (patch.maxCostCapCents != null) merged.maxCostCapCents = Number(patch.maxCostCapCents);
  if ('monthlyBudgetCents' in patch) merged.monthlyBudgetCents = patch.monthlyBudgetCents ? Number(patch.monthlyBudgetCents) : null;
  if ('testingCampaignPattern' in patch) merged.testingCampaignPattern = patch.testingCampaignPattern ? String(patch.testingCampaignPattern).trim() : null;
  if (patch.fatigueCostCapMarginPct != null) merged.fatigueCostCapMarginPct = Number(patch.fatigueCostCapMarginPct);
  if (patch.fatigueMinSpendVsBudgetPct != null) merged.fatigueMinSpendVsBudgetPct = Number(patch.fatigueMinSpendVsBudgetPct);
  if (patch.fatigueLookbackDays != null) merged.fatigueLookbackDays = Number(patch.fatigueLookbackDays);
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
