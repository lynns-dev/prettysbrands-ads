// One id per browser tab session (cleared when the tab closes), used to
// tell "the same visitor did this twice" apart from "two different
// visitors did this once" in admin analytics — e.g. adding 3 items to
// cart or reloading /checkout twice shouldn't count as 3/2 people.

const SESSION_STORAGE_KEY = 'si-session-id';

export function getSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
