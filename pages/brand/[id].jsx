import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T, S, badge } from '../../lib/theme';
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
  const [scanning, setScanning] = React.useState(false);
  const [scanError, setScanError] = React.useState('');
  const [revivable, setRevivable] = React.useState(null);
  const [revivingId, setRevivingId] = React.useState(null);
  const [reviveMessages, setReviveMessages] = React.useState({});

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/brands/${id}/overview`).then((r) => r.json()).then((d) => {
      setData(d);
      setSettingsForm({
        name: d.brand.name, adAccountId: d.brand.adAccountId,
        targetRoas: d.brand.targetRoas, winnersLookbackDays: d.brand.winnersLookbackDays,
        minSpendCents: d.brand.minSpendCents,
        templateAdSetId: d.brand.templateAdSetId || '', scalingCampaignId: d.brand.scalingCampaignId || '',
        costCapCents: d.brand.costCapCents ?? '', aboDailyBudgetCents: d.brand.aboDailyBudgetCents ?? '',
      });
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
        body: JSON.stringify({
          ...settingsForm,
          costCapCents: settingsForm.costCapCents === '' ? null : Number(settingsForm.costCapCents),
          aboDailyBudgetCents: settingsForm.aboDailyBudgetCents === '' ? null : Number(settingsForm.aboDailyBudgetCents),
        }),
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

  const handleScan = async () => {
    setScanning(true);
    setScanError('');
    setRevivable(null);
    try {
      const res = await fetch(`/api/brands/${id}/revivable`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        setScanError(result.error || 'Scan failed.');
      } else {
        setRevivable(result.results);
      }
    } finally {
      setScanning(false);
    }
  };

  const handleRevive = async (ad) => {
    if (!confirm(`Duplicate "${ad.adName}" into a fresh ad set in the scaling campaign?`)) return;
    setRevivingId(ad.adId);
    setReviveMessages((prev) => ({ ...prev, [ad.adId]: '' }));
    try {
      const res = await fetch(`/api/brands/${id}/revive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: ad.adId, adName: ad.adName, creativeId: ad.creativeId }),
      });
      const result = await res.json();
      setReviveMessages((prev) => ({
        ...prev,
        [ad.adId]: res.ok ? `Revived into new ad set ${result.newAdSetId}.` : (result.error || 'Duplicate failed.'),
      }));
    } finally {
      setRevivingId(null);
      load();
    }
  };

  if (loading || !data) {
    return <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}><p style={{ color: T.soft }}>Loading…</p></div>;
  }

  const { brand, connection, todayPerformance, recentRevivals, error } = data;
  const revivalConfigured = brand.templateAdSetId && brand.scalingCampaignId && brand.costCapCents && brand.aboDailyBudgetCents;

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
          <Field label="Brand name"><input required style={S.input} value={settingsForm.name} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} /></Field>
          <Field label="Ad account ID"><input required style={S.input} value={settingsForm.adAccountId} onChange={(e) => setSettingsForm({ ...settingsForm, adAccountId: e.target.value })} /></Field>
          <Field label="Target ROAS (past winner bar)"><input required type="number" step="0.1" min="0.1" style={S.input} value={settingsForm.targetRoas} onChange={(e) => setSettingsForm({ ...settingsForm, targetRoas: e.target.value })} /></Field>
          <Field label="Lookback window (days)"><input required type="number" min="1" max="365" style={S.input} value={settingsForm.winnersLookbackDays} onChange={(e) => setSettingsForm({ ...settingsForm, winnersLookbackDays: e.target.value })} /></Field>
          <Field label="Min historical spend ($)"><input required type="number" min="0" step="0.01" style={S.input} value={settingsForm.minSpendCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, minSpendCents: Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="Template ad set ID"><input style={S.input} value={settingsForm.templateAdSetId} onChange={(e) => setSettingsForm({ ...settingsForm, templateAdSetId: e.target.value })} placeholder="Supplies targeting/placements" /></Field>
          <Field label="Scaling campaign ID"><input style={S.input} value={settingsForm.scalingCampaignId} onChange={(e) => setSettingsForm({ ...settingsForm, scalingCampaignId: e.target.value })} placeholder="Must not use CBO" /></Field>
          <Field label="Cost cap ($)"><input type="number" min="0" step="0.01" style={S.input} value={settingsForm.costCapCents === '' ? '' : settingsForm.costCapCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, costCapCents: e.target.value === '' ? '' : Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="ABO daily budget ($)"><input type="number" min="0" step="0.01" style={S.input} value={settingsForm.aboDailyBudgetCents === '' ? '' : settingsForm.aboDailyBudgetCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, aboDailyBudgetCents: e.target.value === '' ? '' : Math.round(Number(e.target.value) * 100) })} /></Field>
          {settingsError && <p style={{ color: T.warn, fontSize: 13, gridColumn: '1 / -1' }}>{settingsError}</p>}
          <button type="submit" disabled={saving} style={{ ...S.btnFill, gridColumn: '1 / -1', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save settings →'}</button>
        </form>
      )}

      <div style={{ ...S.card, marginBottom: 20 }}>
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

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <p style={{ ...S.label, marginBottom: 0 }}>Revive winning creatives</p>
          <button onClick={handleScan} disabled={scanning || !connection.connected} style={{ ...S.btnOutline, opacity: scanning ? 0.6 : 1 }}>
            {scanning ? 'Scanning…' : 'Scan for revivable creatives →'}
          </button>
        </div>
        <p style={{ color: T.soft, fontSize: 13, marginBottom: 12 }}>
          Scans every paused/inactive ad for a historical ROAS at or above {brand.targetRoas}x over the last {brand.winnersLookbackDays} days, with at least {money(brand.minSpendCents)} of spend to trust the number. Duplicating one copies the template ad set's targeting into a fresh ad set in the scaling campaign, on COST_CAP bidding with its own ABO daily budget, and creates a new ad there using the same creative.
        </p>
        {!revivalConfigured && (
          <p style={{ color: T.warn, fontSize: 13, marginBottom: 12 }}>Set a template ad set, scaling campaign, cost cap, and ABO daily budget in Edit settings before duplicating (scanning still works without them).</p>
        )}
        {scanError && <p style={{ color: T.warn, fontSize: 13, marginBottom: 12 }}>{scanError}</p>}
        {revivable && (
          revivable.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14, marginBottom: 12 }}>No revivable creatives found — nothing paused/inactive clears the ROAS bar yet.</p>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table className="responsive-table" style={table}>
                <thead><tr><th style={th}>Ad</th><th style={th}>Historical spend</th><th style={th}>Historical ROAS</th><th style={th}>Status</th><th style={th}></th></tr></thead>
                <tbody>
                  {revivable.map((r) => (
                    <tr key={r.adId}>
                      <td style={td} data-primary="true">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" width={32} height={32} style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                          <span>{r.adName}</span>
                        </div>
                      </td>
                      <td style={td} data-label="Historical spend">{money(r.spend)}</td>
                      <td style={td} data-label="Historical ROAS">{roas(r.roas)}</td>
                      <td style={td} data-label="Status"><span style={badge(T.soft)}>{r.status}</span></td>
                      <td style={td} data-label="Actions">
                        <button
                          onClick={() => handleRevive(r)}
                          disabled={revivingId === r.adId || !revivalConfigured}
                          style={{ ...S.btnOutline, height: 32, padding: '0 14px', fontSize: 12, opacity: (revivingId === r.adId || !revivalConfigured) ? 0.6 : 1 }}
                        >
                          {revivingId === r.adId ? 'Duplicating…' : 'Duplicate →'}
                        </button>
                        {reviveMessages[r.adId] && <div style={{ fontSize: 11, color: T.soft, marginTop: 4 }}>{reviveMessages[r.adId]}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {recentRevivals?.length > 0 && (
          <>
            <p style={{ ...S.label, margin: '20px 0 10px' }}>Recent revivals</p>
            <div className="table-wrap">
              <table className="responsive-table" style={table}>
                <thead><tr><th style={th}>Ad</th><th style={th}>Date</th><th style={th}>Result</th></tr></thead>
                <tbody>
                  {recentRevivals.map((r, i) => (
                    <tr key={`${r.adId}-${r.appliedAt}-${i}`}>
                      <td style={td} data-primary="true">{r.adName}</td>
                      <td style={td} data-label="Date">{new Date(r.appliedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td style={td} data-label="Result">{r.action === 'failed' ? `Failed: ${r.reason}` : `New ad set ${r.newAdSetId}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
