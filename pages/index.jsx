import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T, S, badge, pastel } from '../lib/theme';
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
  testingCampaignPattern: '',
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

  const overPaceCount = brands.filter((b) => b.pacing?.status === 'over_pace').length;
  const underPaceCount = brands.filter((b) => b.pacing?.status === 'under_pace').length;
  const automatedCount = brands.filter((b) => b.autoAdjustEnabled || b.autoRefreshEnabled).length;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px 60px' }}>
      <Head><title>Prettys Brands Ads</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontFamily: T.sans, fontSize: 26 }}>Prettys Brands <span style={S.accent1}>Ads</span></span>
        <button onClick={handleLogout} style={S.btnOutline}>Sign out</button>
      </div>

      {!loading && connection && !connection.connected && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <p style={{ marginBottom: 12, fontSize: 14 }}>Not connected to Facebook Ads yet — this is a shared connection used across every brand below.</p>
          <a href="/api/meta-auth/connect" style={{ ...S.btnFill, textDecoration: 'none' }}>Connect Facebook Ads →</a>
        </div>
      )}
      {!loading && connection?.connected && (() => {
        const daysLeft = Math.round((connection.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
        const soon = daysLeft <= 7;
        return (
          <p style={{ fontSize: 13, color: soon ? T.warn : T.soft, marginBottom: 20 }}>
            Facebook Ads connected · expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}
            {soon && ' — re-authorize soon via /api/meta-auth/connect'}
          </p>
        );
      })()}

      {!loading && brands.length > 0 && (
        <div style={{ ...S.statGrid, marginBottom: 20 }}>
          <div style={{ ...S.statTile, background: pastel(0) }}><Stat label="Brands" value={brands.length} /></div>
          <div style={{ ...S.statTile, background: pastel(1) }}><Stat label="Over pace" value={overPaceCount} color={overPaceCount > 0 ? T.warn : T.accent} /></div>
          <div style={{ ...S.statTile, background: pastel(2) }}><Stat label="Under pace" value={underPaceCount} color={underPaceCount > 0 ? T.accent : T.soft} /></div>
          <div style={{ ...S.statTile, background: pastel(3) }}><Stat label="Automated" value={automatedCount} /></div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <p style={S.label}>Brands ({brands.length})</p>
        <button onClick={() => setShowForm((s) => !s)} style={S.btnOutline}>{showForm ? 'Cancel' : 'Add brand'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ ...S.card, ...S.formGrid, marginBottom: 20 }}>
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
          <div style={{ ...field, gridColumn: '1 / -1' }}>
            <label style={fieldLabel}>Testing campaign name pattern (optional)</label>
            <input style={S.input} value={form.testingCampaignPattern} onChange={(e) => setForm({ ...form, testingCampaignPattern: e.target.value })} placeholder="e.g. Test" />
          </div>
          {formError && <p style={{ color: T.warn, fontSize: 13, gridColumn: '1 / -1' }}>{formError}</p>}
          <button type="submit" disabled={creating} style={{ ...S.btnFill, gridColumn: '1 / -1', opacity: creating ? 0.6 : 1 }}>
            {creating ? 'Creating…' : 'Create brand →'}
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
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <Link href={`/brand/${b.id}`} style={{ fontWeight: 700, textDecoration: 'none', color: T.ink, fontSize: 15 }}>{b.name}</Link>
                <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>
                  {b.adAccountId} · target {b.targetRoas}x ROAS · cap {money(b.minCostCapCents)}–{money(b.maxCostCapCents)}
                </div>
                {b.pacing && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={badge(b.pacing.status === 'over_pace' ? T.warn : b.pacing.status === 'under_pace' ? T.accent : T.soft)}>
                      {b.pacing.status.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: 12, color: T.soft }}>
                      {money(b.pacing.spendThisMonthCents)} of {money(b.pacing.monthlyBudgetCents)} this month ({b.pacing.variancePct > 0 ? '+' : ''}{b.pacing.variancePct}%)
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={b.autoAdjustEnabled} onChange={(e) => handleToggle(b.id, e.target.checked)} />
                  Auto-adjust
                </label>
                <Link href={`/brand/${b.id}`} style={{ ...S.btnOutline, textDecoration: 'none' }}>Open →</Link>
                <button onClick={() => handleDelete(b.id, b.name)} style={{ ...S.btnOutline, color: T.warn, borderColor: T.warn }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
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
