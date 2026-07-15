// A standalone "Live ad spend" card, not a stat tile buried in a grid —
// polls /api/live-spend every 30s so the number itself stays current, and
// separately ticks its "updated Xs ago" caption every second so the card
// visibly feels alive between polls even though the underlying number only
// changes every 30s. Pass brandId to scope it to one brand; omit it for the
// dashboard's cross-brand total (with a per-brand breakdown underneath).
import React from 'react';
import { S, T } from '../lib/theme';

const POLL_MS = 30000;
const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export default function LiveSpendTicker({ brandId, title = 'Live ad spend' }) {
  const [data, setData] = React.useState(null);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    let cancelled = false;
    const poll = () => {
      const url = brandId ? `/api/live-spend?brandId=${brandId}` : '/api/live-spend';
      fetch(url).then((r) => r.json()).then((d) => {
        if (!cancelled) setData(d);
      }).catch(() => {});
    };
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [brandId]);

  React.useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  if (!data || !data.connected) return null;

  const amount = brandId ? (data.brands[0]?.spendCents ?? 0) : data.totalCents;
  const secondsAgo = data.updatedAt ? Math.max(0, Math.round((now - new Date(data.updatedAt).getTime()) / 1000)) : null;
  const otherBrands = !brandId ? data.brands.filter((b) => !b.error) : [];

  return (
    <div style={{ ...S.card, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, flexShrink: 0, animation: 'pbLivePulse 1.6s ease-in-out infinite' }} />
            <span style={S.label}>{title} · today</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>{money(amount)}</div>
        </div>
        {secondsAgo != null && (
          <span style={{ fontSize: 12, color: T.soft, whiteSpace: 'nowrap' }}>Updated {secondsAgo}s ago</span>
        )}
      </div>

      {otherBrands.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
          {otherBrands.map((b) => (
            <span key={b.id} style={{ fontSize: 12, color: T.soft }}>
              {b.name}: <strong style={{ color: T.ink }}>{money(b.spendCents)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
