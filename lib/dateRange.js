// Shared "last N days" range used everywhere a lookback window is needed
// (cost-cap bidding, budget pacing is its own month-to-date range, winner
// detection, fatigue detection).

export function lookbackRange(lookbackDays) {
  const until = new Date();
  const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}

// The equal-length window immediately before the current lookback range —
// e.g. for a 7-day lookback ending today, this is the 7 days before that.
// Used to tell a real decline from a one-day blip: compare the current
// period's numbers against this one rather than judging a single day.
export function previousPeriodRange(lookbackDays) {
  const { since: currentSince } = lookbackRange(lookbackDays);
  const until = new Date(new Date(currentSince).getTime() - 24 * 60 * 60 * 1000);
  const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}
