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
const td = { padding: '8px 10px', borderBottom: `1px solid ${T.line}`, fontSize: 13, verticalAlign: 'top' };
const table = { width: '100%', borderCollapse: 'collapse' };

export default function BrandDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [settingsForm, setSettingsForm] = React.useState(null);
  const [settingsError, setSettingsError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/brands/${id}/overview`).then((r) => r.json()).then((d) => {
      setData(d);
      setSettingsForm({ name: d.brand.name, adAccountId: d.brand.adAccountId });
    }).finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
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
    return <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}><p style={{ color: T.soft }}>Loading…</p></div>;
  }

  const { brand, connection, todayPerformance, error } = data;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>
      <Head><title>{brand.name} — Prettys Brands Ads</title></Head>

      <Link href="/" style={{ fontSize: 12, color: T.soft, textDecoration: 'none' }}>&larr; All brands</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 20px', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>{brand.name}</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setEditing((s) => !s)} style={S.btnOutline}>{editing ? 'Cancel' : 'Edit settings'}</button>
          <button onClick={handleDelete} style={{ ...S.btnOutline, color: T.warn, borderColor: T.warn }}>Remove brand</button>
        </div>
      </div>

      {!connection.connected && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <p style={{ marginBottom: 12, fontSize: 14 }}>Facebook Ads isn't connected yet.</p>
          <a href="/api/meta-auth/connect" style={{ ...S.btnFill, textDecoration: 'none' }}>Connect Facebook Ads →</a>
        </div>
      )}
      {error && <p style={{ color: T.warn, fontSize: 13, marginBottom: 20 }}>{error}</p>}

      {editing && (
        <form onSubmit={handleSaveSettings} style={{ ...S.card, ...S.formGrid, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ ...S.label, marginBottom: 6 }}>Brand name</label>
            <input required style={S.input} value={settingsForm.name} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ ...S.label, marginBottom: 6 }}>Ad account ID</label>
            <input required style={S.input} value={settingsForm.adAccountId} onChange={(e) => setSettingsForm({ ...settingsForm, adAccountId: e.target.value })} />
          </div>
          {settingsError && <p style={{ color: T.warn, fontSize: 13, gridColumn: '1 / -1' }}>{settingsError}</p>}
          <button type="submit" disabled={saving} style={{ ...S.btnFill, gridColumn: '1 / -1', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save settings →'}</button>
        </form>
      )}

      <div style={S.card}>
        <p style={{ ...S.label, marginBottom: 12 }}>Today's performance</p>
        {!connection.connected ? null : todayPerformance.length === 0 ? (
          <p style={{ color: T.soft, fontSize: 14 }}>No active ad sets found.</p>
        ) : (
          <div className="table-wrap">
            <table className="responsive-table" style={table}>
              <thead><tr><th style={th}>Ad set</th><th style={th}>Spend</th><th style={th}>ROAS</th><th style={th}>CPA</th></tr></thead>
              <tbody>
                {todayPerformance.map((r) => (
                  <tr key={r.adSetId}>
                    <td style={td} data-primary="true">{r.adSetName}</td>
                    <td style={td} data-label="Spend">{money(r.spendCents)}</td>
                    <td style={td} data-label="ROAS">{roas(r.roas)}</td>
                    <td style={td} data-label="CPA">{r.cpaCents != null ? money(r.cpaCents) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
