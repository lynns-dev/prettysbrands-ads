// Shared "last N days" range used everywhere a lookback window is needed
// (cost-cap bidding, budget pacing is its own month-to-date range, winner
// detection, fatigue detection).

export function lookbackRange(lookbackDays) {
  const until = new Date();
  const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}

// The window immediately before the current lookback range — e.g. for a
// 7-day lookback ending today, this is the 7 days before that. Used to tell
// a real decline from a one-day blip: compare the current period's numbers
// against this one rather than judging a single day.
//
// anchorLookbackDays positions where the current period starts (so this
// window is genuinely "right before" it, not overlapping); windowDays sizes
// this window itself and defaults to matching anchorLookbackDays. They're
// separate parameters because a comparison window that scales with a large
// anchorLookbackDays can reach back further than an ad set existed, leaving
// nothing to compare — callers that want a fixed-size comparison regardless
// of the main lookback (e.g. "always compare to the 7 days before that")
// pass a smaller windowDays.
export function previousPeriodRange(anchorLookbackDays, windowDays = anchorLookbackDays) {
  const { since: currentSince } = lookbackRange(anchorLookbackDays);
  const until = new Date(new Date(currentSince).getTime() - 24 * 60 * 60 * 1000);
  const since = new Date(until.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}
