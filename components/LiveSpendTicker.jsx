// Polls /api/live-spend every 30s so today's spend reads as "live" without
// needing a websocket — Meta's Insights numbers for today update
// continuously anyway, so a short poll interval is what actually makes this
// feel real-time. Pass brandId to scope it to one brand; omit it for the
// dashboard's cross-brand total.
import React from 'react';
import { S, T } from '../lib/theme';

const POLL_MS = 30000;
const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export default function LiveSpendTicker({ brandId, label = "Today's spend" }) {
  const [data, setData] = React.useState(null);

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

  if (!data || !data.connected) return null;

  const amount = brandId ? (data.brands[0]?.spendCents ?? 0) : data.totalCents;

  return (
    <div style={{ ...S.statTile, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, flexShrink: 0, animation: 'pbLivePulse 1.6s ease-in-out infinite' }} />
      <div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{money(amount)}</div>
        <div style={{ fontSize: 11, color: T.soft, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label} · live</div>
      </div>
    </div>
  );
}
