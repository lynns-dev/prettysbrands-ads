// Shared "last N days" range used wherever a lookback window is needed
// (currently: the creative-revival scan's historical-performance check).

export function lookbackRange(lookbackDays) {
  const until = new Date();
  const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}
