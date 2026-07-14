// Captures which ad/campaign brought a visitor in, so it can be attached to
// their order later (checkout often happens well after the ad click).
// Stored in localStorage (survives across the whole visit, not just one
// tab/session) and only overwritten when a NEW url actually carries
// utm/click-id params -- plain internal navigation between pages never
// clears a previously captured touch.

const STORAGE_KEY = 'si-attribution';
const PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];

export function captureAttribution() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const found = {};
  let hasAny = false;
  for (const key of PARAM_KEYS) {
    const value = params.get(key);
    if (value) {
      found[key] = value;
      hasAny = true;
    }
  }
  if (!hasAny) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...found,
      landingPage: window.location.pathname,
      capturedAt: new Date().toISOString(),
    }));
  } catch (e) {
    // ignore storage write failures (e.g. private browsing quota)
  }
}

export function getStoredAttribution() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
