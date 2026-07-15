import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T, S } from '../lib/theme';
import { verifySession, SESSION_COOKIE } from '../lib/adminAuth';

export async function getServerSideProps({ req }) {
  const valid = await verifySession(req.cookies?.[SESSION_COOKIE]).catch(() => false);
  if (!valid) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const DEFAULT_FORM = {
  name: '', adAccountId: '', targetRoas: 3, minCostCapCents: 100, maxCostCapCents: 500,
  monthlyBudgetCents: '', maxAdjustmentPct: 20, minSpendMultiplier: 10, lookbackDays: 7,
};

const fieldLabel = { ...S.label, display: 'block', marginBottom: 6 };
const field = { display: 'flex', flexDirection: 'column' };

export default function Dashboard() {
  const router = useRouter();
  const [connection, setConnection] = React.useState(null);
  const [brands, setBrands] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState(DEFAULT_FORM);
  const [formError, setFormError] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/meta-status').then((r) => r.json()),
      fetch('/api/brands').then((r) => r.json()),
    ])
      .then(([conn, br]) => {
        setConnection(conn);
        setBrands(br.brands || []);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monthlyBudgetCents: form.monthlyBudgetCents === '' ? null : Number(form.monthlyBudgetCents) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error);
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove brand "${name}"? This only removes it from this app, not from Facebook.`)) return;
    await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    load();
  };

  const handleToggle = async (id, enabled) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, autoAdjustEnabled: enabled } : b)));
    await fetch(`/api/brands/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 80px' }}>
      <Head><title>Prettys Brands Ads</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>Prettys Brands Ads</span>
        <button onClick={handleLogout} style={S.btnOutline}>Sign out</button>
      </div>

      {!loading && connection && !connection.connected && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <p style={{ marginBottom: 12, fontSize: 14 }}>Not connected to Facebook Ads yet — this is a shared connection used across every brand below.</p>
          <a href="/api/meta-auth/connect" style={{ ...S.btnFill, textDecoration: 'none' }}>Connect Facebook Ads</a>
        </div>
      )}
      {!loading && connection?.connected && (() => {
        const daysLeft = Math.round((connection.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
        const soon = daysLeft <= 7;
        return (
          <p style={{ fontSize: 13, color: soon ? T.warn : T.soft, marginBottom: 24 }}>
            Facebook Ads connected · expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}
            {soon && ' — re-authorize soon via /api/meta-auth/connect'}
          </p>
        );
      })()}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={S.label}>Brands ({brands.length})</p>
        <button onClick={() => setShowForm((s) => !s)} style={S.btnOutline}>{showForm ? 'Cancel' : 'Add brand'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ ...S.card, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={field}>
            <label style={fieldLabel}>Brand name</label>
            <input required style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Smells Iconic" />
          </div>
          <div style={field}>
            <label style={fieldLabel}>Ad account ID</label>
            <input required style={S.input} value={form.adAccountId} onChange={(e) => setForm({ ...form, adAccountId: e.target.value })} placeholder="act_1234567890" />
          </div>
          <div style={field}>
            <label style={fieldLabel}>Target ROAS</label>
            <input required type="number" step="0.1" min="0.1" style={S.input} value={form.targetRoas} onChange={(e) => setForm({ ...form, targetRoas: e.target.value })} />
          </div>
          <div style={field}>
            <label style={fieldLabel}>Monthly budget ($, optional)</label>
            <input type="number" min="0" style={S.input} value={form.monthlyBudgetCents === '' ? '' : form.monthlyBudgetCents / 100} onChange={(e) => setForm({ ...form, monthlyBudgetCents: e.target.value === '' ? '' : Math.round(Number(e.target.value) * 100) })} placeholder="5000" />
          </div>
          <div style={field}>
            <label style={fieldLabel}>Min cost cap ($)</label>
            <input required type="number" step="0.01" min="0.01" style={S.input} value={form.minCostCapCents / 100} onChange={(e) => setForm({ ...form, minCostCapCents: Math.round(Number(e.target.value) * 100) })} />
          </div>
          <div style={field}>
            <label style={fieldLabel}>Max cost cap ($)</label>
            <input required type="number" step="0.01" min="0.01" style={S.input} value={form.maxCostCapCents / 100} onChange={(e) => setForm({ ...form, maxCostCapCents: Math.round(Number(e.target.value) * 100) })} />
          </div>
          <div style={field}>
            <label style={fieldLabel}>Max adjustment per run (%)</label>
            <input type="number" min="1" max="100" style={S.input} value={form.maxAdjustmentPct} onChange={(e) => setForm({ ...form, maxAdjustmentPct: e.target.value })} />
          </div>
          <div style={field}>
            <label style={fieldLabel}>Min spend multiplier</label>
            <input type="number" min="1" style={S.input} value={form.minSpendMultiplier} onChange={(e) => setForm({ ...form, minSpendMultiplier: e.target.value })} />
          </div>
          <div style={field}>
            <label style={fieldLabel}>Lookback window (days)</label>
            <input type="number" min="1" max="90" style={S.input} value={form.lookbackDays} onChange={(e) => setForm({ ...form, lookbackDays: e.target.value })} />
          </div>
          {formError && <p style={{ color: T.warn, fontSize: 13, gridColumn: '1 / -1' }}>{formError}</p>}
          <button type="submit" disabled={creating} style={{ ...S.btnFill, gridColumn: '1 / -1', opacity: creating ? 0.6 : 1 }}>
            {creating ? 'Creating…' : 'Create brand'}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: T.soft }}>Loading…</p>
      ) : brands.length === 0 ? (
        <p style={{ color: T.soft }}>No brands yet — add one above.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {brands.map((b) => (
            <div key={b.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <Link href={`/brand/${b.id}`} style={{ fontWeight: 700, textDecoration: 'none', color: T.ink, fontSize: 15 }}>{b.name}</Link>
                <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>
                  {b.adAccountId} · target {b.targetRoas}x ROAS · cap {money(b.minCostCapCents)}–{money(b.maxCostCapCents)}
                </div>
                {b.pacing && (
                  <div style={{ fontSize: 12, marginTop: 6, color: b.pacing.status === 'over_pace' ? T.warn : b.pacing.status === 'under_pace' ? T.accent : T.soft }}>
                    {money(b.pacing.spendThisMonthCents)} of {money(b.pacing.monthlyBudgetCents)} this month
                    {' '}({b.pacing.variancePct > 0 ? '+' : ''}{b.pacing.variancePct}% vs pace)
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={b.autoAdjustEnabled} onChange={(e) => handleToggle(b.id, e.target.checked)} />
                  Auto-adjust
                </label>
                <Link href={`/brand/${b.id}`} style={{ ...S.btnOutline, textDecoration: 'none' }}>Open</Link>
                <button onClick={() => handleDelete(b.id, b.name)} style={{ ...S.btnOutline, color: T.warn, borderColor: T.warn }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
