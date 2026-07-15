// Shared "last N days" range used everywhere a lookback window is needed
// (cost-cap bidding, budget pacing is its own month-to-date range, winner
// detection, fatigue detection).

export function lookbackRange(lookbackDays) {
  const until = new Date();
  const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}
