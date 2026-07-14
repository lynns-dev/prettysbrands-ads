// Requests from these IPs don't count toward site analytics (live visitors,
// funnel counters, recent-activity feed) or server-side Meta ad events --
// this is the store owner's own testing/QA traffic, not real customers.
// Comma-separated so more IPs can be added later via the env var alone.

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || null;
}

export function isExcludedIp(req) {
  const list = (process.env.EXCLUDED_ANALYTICS_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (list.length === 0) return false;

  const ip = getClientIp(req);
  return ip ? list.includes(ip) : false;
}
