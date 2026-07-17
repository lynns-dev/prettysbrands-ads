// Pending "new creative" drafts, per brand — a draft holds everything
// needed to publish (the already-uploaded asset reference, campaign/cost
// cap/budget, and copy versions) but hasn't touched the ad account yet.
// Publishing (lib/creativeUpload.js) turns a draft into an actual ad set +
// ads and flips its status; nothing is live until that happens.

import { randomUUID } from 'crypto';
import { kvGetJson, kvSetJson } from './kv';

const key = (brandId) => `creative-drafts:${brandId}`;

export async function listDrafts(brandId) {
  return kvGetJson(key(brandId), []);
}

export async function getDraft(brandId, draftId) {
  const drafts = await kvGetJson(key(brandId), []);
  return drafts.find((d) => d.id === draftId) || null;
}

export async function createDraft(brandId, draft) {
  const drafts = await kvGetJson(key(brandId), []);
  const entry = { ...draft, id: randomUUID(), status: 'draft', createdAt: new Date().toISOString() };
  drafts.unshift(entry);
  await kvSetJson(key(brandId), drafts);
  return entry;
}

export async function updateDraft(brandId, draftId, patch) {
  const drafts = await kvGetJson(key(brandId), []);
  const index = drafts.findIndex((d) => d.id === draftId);
  if (index === -1) throw new Error('Draft not found.');
  drafts[index] = { ...drafts[index], ...patch };
  await kvSetJson(key(brandId), drafts);
  return drafts[index];
}

export async function deleteDraft(brandId, draftId) {
  const drafts = await kvGetJson(key(brandId), []);
  const remaining = drafts.filter((d) => d.id !== draftId);
  await kvSetJson(key(brandId), remaining);
  return remaining;
}
