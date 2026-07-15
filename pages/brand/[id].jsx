import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T, S } from '../../lib/theme';
import { verifySession, SESSION_COOKIE } from '../../lib/adminAuth';

export async function getServerSideProps({ req }) {
  const valid = await verifySession(req.cookies?.[SESSION_COOKIE]).catch(() => false);
  if (!valid) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const roas = (n) => `${Number(n || 0).toFixed(2)}x`;
const th = { textAlign: 'left', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.soft, padding: '0 10px 8px', borderBottom: `1px solid ${T.line}` };
const td = { padding: '8px 10px', borderBottom: `1px solid ${T.line}`, fontSize: 13 };
const table = { width: '100%', borderCollapse: 'collapse' };

const PACING_LABEL = { over_pace: 'Over pace', under_pace: 'Under pace', on_pace: 'On pace' };
const PACING_COLOR = { over_pace: T.warn, under_pace: T.accent, on_pace: T.soft };

export default function BrandDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [runMessage, setRunMessage] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [settingsForm, setSettingsForm] = React.useState(null);
  const [settingsError, setSettingsError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/brands/${id}/overview`).then((r) => r.json()).then((d) => {
      setData(d);
      setSettingsForm({
        name: d.brand.name, adAccountId: d.brand.adAccountId, targetRoas: d.brand.targetRoas,
        minCostCapCents: d.brand.minCostCapCents, maxCostCapCents: d.brand.maxCostCapCents,
        monthlyBudgetCents: d.brand.monthlyBudgetCents ?? '', maxAdjustmentPct: d.brand.maxAdjustmentPct,
        minSpendMultiplier: d.brand.minSpendMultiplier, lookbackDays: d.brand.lookbackDays,
      });
    }).finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const handleToggle = async (enabled) => {
    setData((prev) => ({ ...prev, brand: { ...prev.brand, autoAdjustEnabled: enabled } }));
    await fetch(`/api/brands/${id}/toggle`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
    });
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunMessage('');
    try {
      const res = await fetch(`/api/brands/${id}/auto-adjust`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        setRunMessage(result.error || 'Run failed.');
      } else {
        const applied = (result.applied || []).filter((a) => a.action === 'adjust');
        const failed = (result.applied || []).filter((a) => a.action === 'failed');
        setRunMessage(applied.length === 0 && failed.length === 0 ? 'Ran now — no ad set needed a change.' : `Adjusted ${applied.length} ad set${applied.length === 1 ? '' : 's'}${failed.length ? `, ${failed.length} failed.` : '.'}`);
      }
    } finally {
      setRunning(false);
      load();
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settingsForm, monthlyBudgetCents: settingsForm.monthlyBudgetCents === '' ? null : Number(settingsForm.monthlyBudgetCents) }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSettingsError(result.error);
        return;
      }
      setEditing(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove brand "${data.brand.name}"? This only removes it from this app, not from Facebook.`)) return;
    await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    router.push('/');
  };

  if (loading || !data) {
    return <div style={{ maxWidth: 1000, margin: '0 auto', padding: 32 }}><p style={{ color: T.soft }}>Loading…</p></div>;
  }

  const { brand, connection, campaigns, creatives, costCap, pacing, recentAdjustments, error } = data;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>
      <Head><title>{brand.name} — Prettys Brands Ads</title></Head>

      <Link href="/" style={{ fontSize: 12, color: T.soft, textDecoration: 'none' }}>&larr; All brands</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 24px' }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{brand.name}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setEditing((s) => !s)} style={S.btnOutline}>{editing ? 'Cancel' : 'Edit settings'}</button>
          <button onClick={handleDelete} style={{ ...S.btnOutline, color: T.warn, borderColor: T.warn }}>Remove brand</button>
        </div>
      </div>

      {!connection.connected && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <p style={{ marginBottom: 12, fontSize: 14 }}>Facebook Ads isn't connected yet.</p>
          <a href="/api/meta-auth/connect" style={{ ...S.btnFill, textDecoration: 'none' }}>Connect Facebook Ads</a>
        </div>
      )}
      {error && <p style={{ color: T.warn, fontSize: 13, marginBottom: 24 }}>{error}</p>}

      {editing && (
        <form onSubmit={handleSaveSettings} style={{ ...S.card, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Brand name"><input required style={S.input} value={settingsForm.name} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} /></Field>
          <Field label="Ad account ID"><input required style={S.input} value={settingsForm.adAccountId} onChange={(e) => setSettingsForm({ ...settingsForm, adAccountId: e.target.value })} /></Field>
          <Field label="Target ROAS"><input required type="number" step="0.1" style={S.input} value={settingsForm.targetRoas} onChange={(e) => setSettingsForm({ ...settingsForm, targetRoas: e.target.value })} /></Field>
          <Field label="Monthly budget ($, optional)"><input type="number" min="0" style={S.input} value={settingsForm.monthlyBudgetCents === '' ? '' : settingsForm.monthlyBudgetCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, monthlyBudgetCents: e.target.value === '' ? '' : Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="Min cost cap ($)"><input required type="number" step="0.01" style={S.input} value={settingsForm.minCostCapCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, minCostCapCents: Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="Max cost cap ($)"><input required type="number" step="0.01" style={S.input} value={settingsForm.maxCostCapCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, maxCostCapCents: Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="Max adjustment per run (%)"><input type="number" min="1" max="100" style={S.input} value={settingsForm.maxAdjustmentPct} onChange={(e) => setSettingsForm({ ...settingsForm, maxAdjustmentPct: e.target.value })} /></Field>
          <Field label="Min spend multiplier"><input type="number" min="1" style={S.input} value={settingsForm.minSpendMultiplier} onChange={(e) => setSettingsForm({ ...settingsForm, minSpendMultiplier: e.target.value })} /></Field>
          <Field label="Lookback window (days)"><input type="number" min="1" max="90" style={S.input} value={settingsForm.lookbackDays} onChange={(e) => setSettingsForm({ ...settingsForm, lookbackDays: e.target.value })} /></Field>
          {settingsError && <p style={{ color: T.warn, fontSize: 13, gridColumn: '1 / -1' }}>{settingsError}</p>}
          <button type="submit" disabled={saving} style={{ ...S.btnFill, gridColumn: '1 / -1', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save settings'}</button>
        </form>
      )}

      {pacing && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <p style={{ ...S.label, marginBottom: 12 }}>Budget pacing this month</p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <Stat label="Spent so far" value={money(pacing.spendThisMonthCents)} />
            <Stat label="Monthly budget" value={money(pacing.monthlyBudgetCents)} />
            <Stat label="Projected month-end" value={money(pacing.projectedEndOfMonthCents)} />
            <Stat label="vs. expected pace" value={`${pacing.variancePct > 0 ? '+' : ''}${pacing.variancePct}%`} color={PACING_COLOR[pacing.status]} />
            <Stat label="Status" value={PACING_LABEL[pacing.status]} color={PACING_COLOR[pacing.status]} />
          </div>
        </div>
      )}

      <div style={{ ...S.card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <p style={S.label}>Cost-cap bidding</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={brand.autoAdjustEnabled} onChange={(e) => handleToggle(e.target.checked)} />
              Daily auto-adjust
            </label>
            <button onClick={handleRunNow} disabled={running || !connection.connected} style={{ ...S.btnOutline, opacity: running ? 0.6 : 1 }}>
              {running ? 'Running…' : 'Run adjustment now'}
            </button>
          </div>
        </div>
        {runMessage && <p style={{ fontSize: 12, marginBottom: 12 }}>{runMessage}</p>}
        {!costCap || costCap.results.length === 0 ? (
          <p style={{ color: T.soft, fontSize: 14 }}>No active COST_CAP ad sets found.</p>
        ) : (
          <table style={table}>
            <thead><tr>
              <th style={th}>Ad set</th><th style={th}>Spend</th><th style={th}>Revenue</th><th style={th}>ROAS</th><th style={th}>Cap / action</th>
            </tr></thead>
            <tbody>
              {costCap.results.map((r) => (
                <tr key={r.adSetId}>
                  <td style={td} title={r.reason}>{r.adSetName}</td>
                  <td style={td}>{money(r.spend)}</td>
                  <td style={td}>{money(r.revenue)}</td>
                  <td style={td}>{roas(r.actualRoas)}</td>
                  <td style={{ ...td, color: r.action === 'adjust' ? T.ink : T.soft }}>
                    {r.action === 'adjust' ? `${money(r.currentBidAmount)} → ${money(r.newBidAmount)}` : `${money(r.currentBidAmount)} (${r.action})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {recentAdjustments.length > 0 && (
          <>
            <p style={{ ...S.label, margin: '20px 0 10px' }}>Recent adjustments</p>
            <table style={table}>
              <thead><tr><th style={th}>Date</th><th style={th}>Ad set</th><th style={th}>Change</th></tr></thead>
              <tbody>
                {recentAdjustments.map((a, i) => (
                  <tr key={`${a.adSetId}-${a.appliedAt}-${i}`}>
                    <td style={td}>{new Date(a.appliedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td style={td}>{a.adSetName}</td>
                    <td style={td}>{a.action === 'failed' ? `Failed: ${a.reason}` : `${money(a.currentBidAmount)} → ${money(a.newBidAmount)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div style={{ ...S.card, marginBottom: 24 }}>
        <p style={{ ...S.label, marginBottom: 16 }}>Campaigns & ad sets ({campaigns.length})</p>
        {campaigns.length === 0 ? (
          <p style={{ color: T.soft, fontSize: 14 }}>No campaigns found.</p>
        ) : (
          <table style={table}>
            <thead><tr><th style={th}>Name</th><th style={th}>Status</th><th style={th}>Bid strategy</th><th style={th}>Spend</th><th style={th}>Revenue</th><th style={th}>ROAS</th></tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <React.Fragment key={c.id}>
                  <tr>
                    <td style={{ ...td, fontWeight: 700 }}>{c.name}</td>
                    <td style={td}>{c.effective_status}</td>
                    <td style={td}>—</td>
                    <td style={td}>{money(c.spend)}</td>
                    <td style={td}>{money(c.revenue)}</td>
                    <td style={td}>{roas(c.roas)}</td>
                  </tr>
                  {c.adSets.map((a) => (
                    <tr key={a.id}>
                      <td style={{ ...td, paddingLeft: 26, color: T.soft }}>{a.name}</td>
                      <td style={{ ...td, color: T.soft }}>{a.effective_status}</td>
                      <td style={{ ...td, color: T.soft }}>{a.bid_strategy || '—'}</td>
                      <td style={{ ...td, color: T.soft }}>{money(a.spend)}</td>
                      <td style={{ ...td, color: T.soft }}>{money(a.revenue)}</td>
                      <td style={{ ...td, color: T.soft }}>{roas(a.roas)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={S.card}>
        <p style={{ ...S.label, marginBottom: 16 }}>Creative performance ({creatives.length})</p>
        {creatives.length === 0 ? (
          <p style={{ color: T.soft, fontSize: 14 }}>No ads found.</p>
        ) : (
          <table style={table}>
            <thead><tr><th style={th}></th><th style={th}>Ad</th><th style={th}>Status</th><th style={th}>Spend</th><th style={th}>Revenue</th><th style={th}>ROAS</th></tr></thead>
            <tbody>
              {creatives.map((ad) => (
                <tr key={ad.id}>
                  <td style={td}>
                    {ad.creative?.thumbnail_url ? <img src={ad.creative.thumbnail_url} alt="" width={40} height={40} style={{ borderRadius: 4, objectFit: 'cover' }} /> : null}
                  </td>
                  <td style={td}>{ad.name}</td>
                  <td style={td}>{ad.effective_status}</td>
                  <td style={td}>{money(ad.spend)}</td>
                  <td style={td}>{money(ad.revenue)}</td>
                  <td style={td}>{roas(ad.roas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{ ...S.label, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || T.ink }}>{value}</div>
      <div style={{ fontSize: 11, color: T.soft, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}
