import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T, S, badge, pastel } from '../../lib/theme';
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
const statusColor = (s) => (s === 'ACTIVE' ? T.accent : T.soft);

const PACING_LABEL = { over_pace: 'Over pace', under_pace: 'Under pace', on_pace: 'On pace' };
const PACING_COLOR = { over_pace: T.warn, under_pace: T.accent, on_pace: T.soft };
const FATIGUE_COLOR = { fatigued: T.warn, failed: T.warn, ok: T.accent, skipped: T.soft };
const VERDICT_COLOR = { winner: T.accent, promising: T.ink, not_yet: T.soft, underperforming: T.warn };

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
  const [winnerLoading, setWinnerLoading] = React.useState(false);
  const [winnerResult, setWinnerResult] = React.useState(null);
  const [winnerError, setWinnerError] = React.useState('');
  const [fatigueRunning, setFatigueRunning] = React.useState(false);
  const [fatigueMessage, setFatigueMessage] = React.useState('');
  const [showCampaigns, setShowCampaigns] = React.useState(false);
  const [showCreatives, setShowCreatives] = React.useState(false);

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
        testingCampaignPattern: d.brand.testingCampaignPattern || '',
        fatigueCostCapMarginPct: d.brand.fatigueCostCapMarginPct, fatigueMinSpendVsBudgetPct: d.brand.fatigueMinSpendVsBudgetPct,
        fatigueLookbackDays: d.brand.fatigueLookbackDays,
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

  const handleToggleRefresh = async (enabled) => {
    setData((prev) => ({ ...prev, brand: { ...prev.brand, autoRefreshEnabled: enabled } }));
    await fetch(`/api/brands/${id}/toggle-refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
    });
  };

  const handleRunFatigueNow = async () => {
    setFatigueRunning(true);
    setFatigueMessage('');
    try {
      const res = await fetch(`/api/brands/${id}/fatigue-refresh`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        setFatigueMessage(result.error || 'Run failed.');
      } else {
        const applied = (result.applied || []).filter((a) => a.action === 'refreshed');
        const failed = (result.applied || []).filter((a) => a.action === 'failed');
        setFatigueMessage(applied.length === 0 && failed.length === 0 ? 'Ran now — no fatigued ads found.' : `Refreshed ${applied.length} ad${applied.length === 1 ? '' : 's'}${failed.length ? `, ${failed.length} failed.` : '.'}`);
      }
    } finally {
      setFatigueRunning(false);
      load();
    }
  };

  const handleRunWinners = async () => {
    setWinnerLoading(true);
    setWinnerError('');
    setWinnerResult(null);
    try {
      const res = await fetch(`/api/brands/${id}/winners`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        setWinnerError(result.error || 'Analysis failed.');
      } else {
        setWinnerResult(result);
      }
    } finally {
      setWinnerLoading(false);
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

  const { brand, connection, campaigns, creatives, costCap, fatigue, pacing, recentAdjustments, recentRefreshes, error } = data;

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const fatiguedCount = (fatigue?.results || []).filter((r) => r.action === 'fatigued').length;
  const adjustCount = (costCap?.results || []).filter((r) => r.action === 'adjust').length;
  const needsAttention = fatiguedCount + adjustCount;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px' }}>
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

      {connection.connected && !error && (
        <div style={{ ...S.statGrid, marginBottom: 20 }}>
          <div style={{ ...S.statTile, background: pastel(0) }}><Stat label={`Spend (${brand.lookbackDays}d)`} value={money(totalSpend)} /></div>
          <div style={{ ...S.statTile, background: pastel(1) }}><Stat label={`Revenue (${brand.lookbackDays}d)`} value={money(totalRevenue)} /></div>
          <div style={{ ...S.statTile, background: pastel(2) }}><Stat label="Blended ROAS" value={roas(blendedRoas)} /></div>
          <div style={{ ...S.statTile, background: pastel(3) }}><Stat label="Needs attention" value={needsAttention} color={needsAttention > 0 ? T.warn : T.accent} /></div>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSaveSettings} style={{ ...S.card, ...S.formGrid, marginBottom: 20 }}>
          <Field label="Brand name"><input required style={S.input} value={settingsForm.name} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} /></Field>
          <Field label="Ad account ID"><input required style={S.input} value={settingsForm.adAccountId} onChange={(e) => setSettingsForm({ ...settingsForm, adAccountId: e.target.value })} /></Field>
          <Field label="Target ROAS"><input required type="number" step="0.1" style={S.input} value={settingsForm.targetRoas} onChange={(e) => setSettingsForm({ ...settingsForm, targetRoas: e.target.value })} /></Field>
          <Field label="Monthly budget ($, optional)"><input type="number" min="0" style={S.input} value={settingsForm.monthlyBudgetCents === '' ? '' : settingsForm.monthlyBudgetCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, monthlyBudgetCents: e.target.value === '' ? '' : Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="Min cost cap ($)"><input required type="number" step="0.01" style={S.input} value={settingsForm.minCostCapCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, minCostCapCents: Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="Max cost cap ($)"><input required type="number" step="0.01" style={S.input} value={settingsForm.maxCostCapCents / 100} onChange={(e) => setSettingsForm({ ...settingsForm, maxCostCapCents: Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="Max adjustment per run (%)"><input type="number" min="1" max="100" style={S.input} value={settingsForm.maxAdjustmentPct} onChange={(e) => setSettingsForm({ ...settingsForm, maxAdjustmentPct: e.target.value })} /></Field>
          <Field label="Min spend multiplier"><input type="number" min="1" style={S.input} value={settingsForm.minSpendMultiplier} onChange={(e) => setSettingsForm({ ...settingsForm, minSpendMultiplier: e.target.value })} /></Field>
          <Field label="Lookback window (days)"><input type="number" min="1" max="90" style={S.input} value={settingsForm.lookbackDays} onChange={(e) => setSettingsForm({ ...settingsForm, lookbackDays: e.target.value })} /></Field>
          <Field label="Testing campaign name pattern"><input style={S.input} value={settingsForm.testingCampaignPattern} onChange={(e) => setSettingsForm({ ...settingsForm, testingCampaignPattern: e.target.value })} placeholder="e.g. Test" /></Field>
          <Field label="Fatigue: cost cap margin (%)"><input type="number" min="1" max="200" style={S.input} value={settingsForm.fatigueCostCapMarginPct} onChange={(e) => setSettingsForm({ ...settingsForm, fatigueCostCapMarginPct: e.target.value })} /></Field>
          <Field label="Fatigue: min spend vs budget (%)"><input type="number" min="1" max="100" style={S.input} value={settingsForm.fatigueMinSpendVsBudgetPct} onChange={(e) => setSettingsForm({ ...settingsForm, fatigueMinSpendVsBudgetPct: e.target.value })} /></Field>
          <Field label="Fatigue: lookback window (days)"><input type="number" min="1" max="30" style={S.input} value={settingsForm.fatigueLookbackDays} onChange={(e) => setSettingsForm({ ...settingsForm, fatigueLookbackDays: e.target.value })} /></Field>
          {settingsError && <p style={{ color: T.warn, fontSize: 13, gridColumn: '1 / -1' }}>{settingsError}</p>}
          <button type="submit" disabled={saving} style={{ ...S.btnFill, gridColumn: '1 / -1', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save settings →'}</button>
        </form>
      )}

      {pacing && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <p style={{ ...S.label, marginBottom: 12 }}>Budget pacing this month</p>
          <div style={S.statGrid}>
            <Stat label="Spent so far" value={money(pacing.spendThisMonthCents)} />
            <Stat label="Monthly budget" value={money(pacing.monthlyBudgetCents)} />
            <Stat label="Projected month-end" value={money(pacing.projectedEndOfMonthCents)} />
            <Stat label="vs. expected pace" value={`${pacing.variancePct > 0 ? '+' : ''}${pacing.variancePct}%`} color={PACING_COLOR[pacing.status]} />
            <Stat label="Status" value={PACING_LABEL[pacing.status]} color={PACING_COLOR[pacing.status]} />
          </div>
        </div>
      )}

      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <p style={S.label}>Cost-cap bidding</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={brand.autoAdjustEnabled} onChange={(e) => handleToggle(e.target.checked)} />
              Daily auto-adjust
            </label>
            <button onClick={handleRunNow} disabled={running || !connection.connected} style={{ ...S.btnOutline, opacity: running ? 0.6 : 1 }}>
              {running ? 'Running…' : 'Run adjustment now →'}
            </button>
          </div>
        </div>
        {runMessage && <p style={{ fontSize: 12, marginBottom: 12 }}>{runMessage}</p>}
        {!costCap || costCap.results.length === 0 ? (
          <p style={{ color: T.soft, fontSize: 14 }}>No active COST_CAP ad sets found.</p>
        ) : (
          <div className="table-wrap">
            <table className="responsive-table" style={table}>
              <thead><tr>
                <th style={th}>Ad set</th><th style={th}>Spend</th><th style={th}>Revenue</th><th style={th}>ROAS</th><th style={th}>Cap / action</th>
              </tr></thead>
              <tbody>
                {costCap.results.map((r) => (
                  <tr key={r.adSetId}>
                    <td style={td} data-primary="true" title={r.reason}>{r.adSetName}</td>
                    <td style={td} data-label="Spend">{money(r.spend)}</td>
                    <td style={td} data-label="Revenue">{money(r.revenue)}</td>
                    <td style={td} data-label="ROAS">{roas(r.actualRoas)}</td>
                    <td style={{ ...td, color: r.action === 'adjust' ? T.ink : T.soft }} data-label="Cap / action">
                      {r.action === 'adjust' ? `${money(r.currentBidAmount)} → ${money(r.newBidAmount)}` : `${money(r.currentBidAmount)} (${r.action})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recentAdjustments.length > 0 && (
          <>
            <p style={{ ...S.label, margin: '20px 0 10px' }}>Recent adjustments</p>
            <div className="table-wrap">
              <table className="responsive-table" style={table}>
                <thead><tr><th style={th}>Ad set</th><th style={th}>Date</th><th style={th}>Change</th></tr></thead>
                <tbody>
                  {recentAdjustments.map((a, i) => (
                    <tr key={`${a.adSetId}-${a.appliedAt}-${i}`}>
                      <td style={td} data-primary="true">{a.adSetName}</td>
                      <td style={td} data-label="Date">{new Date(a.appliedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td style={td} data-label="Change">{a.action === 'failed' ? `Failed: ${a.reason}` : `${money(a.currentBidAmount)} → ${money(a.newBidAmount)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <p style={S.label}>Winner detection</p>
          <button onClick={handleRunWinners} disabled={winnerLoading || !connection.connected} style={{ ...S.btnOutline, opacity: winnerLoading ? 0.6 : 1 }}>
            {winnerLoading ? 'Analyzing…' : 'Analyze test ads now →'}
          </button>
        </div>
        {!brand.testingCampaignPattern ? (
          <p style={{ color: T.soft, fontSize: 14 }}>Set a "testing campaign name pattern" in Edit settings to enable this — it's how Claude knows which campaigns are still in testing.</p>
        ) : (
          <p style={{ color: T.soft, fontSize: 13, marginBottom: 12 }}>Scans campaigns matching "{brand.testingCampaignPattern}" (active or paused) and asks Claude to judge which ads are winners worth promoting into their own scaling campaign. Read-only — nothing is changed automatically.</p>
        )}
        {winnerError && <p style={{ color: T.warn, fontSize: 13, marginBottom: 12 }}>{winnerError}</p>}
        {winnerResult && (
          winnerResult.message ? (
            <p style={{ color: T.soft, fontSize: 14 }}>{winnerResult.message}</p>
          ) : (
            <div className="table-wrap">
              <table className="responsive-table" style={table}>
                <thead><tr><th style={th}>Ad</th><th style={th}>Spend</th><th style={th}>ROAS</th><th style={th}>Verdict</th><th style={th}>Reasoning</th></tr></thead>
                <tbody>
                  {winnerResult.ads.map((a) => (
                    <tr key={a.adId}>
                      <td style={td} data-primary="true">
                        {a.adName}
                        {a.adStatus && a.adStatus !== 'ACTIVE' && <span style={{ color: T.soft }}> ({a.adStatus})</span>}
                        <div style={{ color: T.soft, fontSize: 11, fontWeight: 400 }}>{a.campaignName}</div>
                      </td>
                      <td style={td} data-label="Spend">{money(a.spendCents)}</td>
                      <td style={td} data-label="ROAS">{roas(a.roas)}</td>
                      <td style={td} data-label="Verdict"><span style={badge(VERDICT_COLOR[a.verdict])}>{a.verdict?.replace('_', ' ')}</span></td>
                      <td style={{ ...td, color: T.soft }} data-label="Reasoning">{a.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <p style={S.label}>Ad refresh (fatigue)</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={brand.autoRefreshEnabled} onChange={(e) => handleToggleRefresh(e.target.checked)} />
              Daily auto-refresh
            </label>
            <button onClick={handleRunFatigueNow} disabled={fatigueRunning || !connection.connected} style={{ ...S.btnOutline, opacity: fatigueRunning ? 0.6 : 1 }}>
              {fatigueRunning ? 'Checking…' : 'Check for fatigued ads now →'}
            </button>
          </div>
        </div>
        <p style={{ color: T.soft, fontSize: 13, marginBottom: 12 }}>
          When an ad's cost per result drifts well over its cost cap but spend hasn't dropped off, that ad is likely coasting on stale relevance. When enabled, it's duplicated into a fresh ad set and the original is paused.
        </p>
        {fatigueMessage && <p style={{ fontSize: 12, marginBottom: 12 }}>{fatigueMessage}</p>}
        {!fatigue || fatigue.results.length === 0 ? (
          <p style={{ color: T.soft, fontSize: 14 }}>No single-ad COST_CAP ad sets to evaluate.</p>
        ) : (
          <div className="table-wrap">
            <table className="responsive-table" style={table}>
              <thead><tr><th style={th}>Ad set</th><th style={th}>Spend</th><th style={th}>Cost/result</th><th style={th}>Cap</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {fatigue.results.map((r) => (
                  <tr key={r.adSetId}>
                    <td style={td} data-primary="true" title={r.reason}>{r.adSetName}<div style={{ color: T.soft, fontSize: 11, fontWeight: 400 }}>{r.adName}</div></td>
                    <td style={td} data-label="Spend">{money(r.spend)}</td>
                    <td style={td} data-label="Cost/result">{r.actualCostPerResult ? money(r.actualCostPerResult) : '—'}</td>
                    <td style={td} data-label="Cap">{money(r.costCap)}</td>
                    <td style={td} data-label="Status"><span style={badge(FATIGUE_COLOR[r.action] || T.soft)}>{r.action}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recentRefreshes.length > 0 && (
          <>
            <p style={{ ...S.label, margin: '20px 0 10px' }}>Recent refreshes</p>
            <div className="table-wrap">
              <table className="responsive-table" style={table}>
                <thead><tr><th style={th}>Ad set</th><th style={th}>Date</th><th style={th}>Result</th></tr></thead>
                <tbody>
                  {recentRefreshes.map((r, i) => (
                    <tr key={`${r.adSetId}-${r.appliedAt}-${i}`}>
                      <td style={td} data-primary="true">{r.adSetName}</td>
                      <td style={td} data-label="Date">{new Date(r.appliedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td style={td} data-label="Result">{r.action === 'failed' ? `Failed: ${r.reason}` : `Duplicated into new ad set ${r.newAdSetId}, original paused`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ ...S.label, marginBottom: 0 }}>Campaigns & ad sets ({campaigns.length})</p>
          <button onClick={() => setShowCampaigns((s) => !s)} style={S.btnOutline}>{showCampaigns ? 'Hide' : 'Show'}</button>
        </div>
        {showCampaigns && (
          campaigns.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14, marginTop: 16 }}>No campaigns found.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="responsive-table" style={table}>
                <thead><tr><th style={th}>Name</th><th style={th}>Status</th><th style={th}>Bid strategy</th><th style={th}>Spend</th><th style={th}>Revenue</th><th style={th}>ROAS</th></tr></thead>
                <tbody>
                  {campaigns.map((c) => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td style={{ ...td, fontWeight: 700 }} data-primary="true">{c.name}</td>
                        <td style={td} data-label="Status"><span style={badge(statusColor(c.effective_status))}>{c.effective_status}</span></td>
                        <td style={td} data-label="Bid strategy">—</td>
                        <td style={td} data-label="Spend">{money(c.spend)}</td>
                        <td style={td} data-label="Revenue">{money(c.revenue)}</td>
                        <td style={td} data-label="ROAS">{roas(c.roas)}</td>
                      </tr>
                      {c.adSets.map((a) => (
                        <tr key={a.id}>
                          <td style={{ ...td, paddingLeft: 26, color: T.soft }} data-primary="true">{a.name}</td>
                          <td style={td} data-label="Status"><span style={badge(statusColor(a.effective_status))}>{a.effective_status}</span></td>
                          <td style={{ ...td, color: T.soft }} data-label="Bid strategy">{a.bid_strategy || '—'}</td>
                          <td style={{ ...td, color: T.soft }} data-label="Spend">{money(a.spend)}</td>
                          <td style={{ ...td, color: T.soft }} data-label="Revenue">{money(a.revenue)}</td>
                          <td style={{ ...td, color: T.soft }} data-label="ROAS">{roas(a.roas)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ ...S.label, marginBottom: 0 }}>Creative performance ({creatives.length})</p>
          <button onClick={() => setShowCreatives((s) => !s)} style={S.btnOutline}>{showCreatives ? 'Hide' : 'Show'}</button>
        </div>
        {showCreatives && (
          creatives.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14, marginTop: 16 }}>No ads found.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="responsive-table" style={table}>
                <thead><tr><th style={th}>Ad</th><th style={th}>Status</th><th style={th}>Spend</th><th style={th}>Revenue</th><th style={th}>ROAS</th></tr></thead>
                <tbody>
                  {creatives.map((ad) => (
                    <tr key={ad.id}>
                      <td style={td} data-primary="true">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {ad.creative?.thumbnail_url && <img src={ad.creative.thumbnail_url} alt="" width={32} height={32} style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                          <span>{ad.name}</span>
                        </div>
                      </td>
                      <td style={td} data-label="Status"><span style={badge(statusColor(ad.effective_status))}>{ad.effective_status}</span></td>
                      <td style={td} data-label="Spend">{money(ad.spend)}</td>
                      <td style={td} data-label="Revenue">{money(ad.revenue)}</td>
                      <td style={td} data-label="ROAS">{roas(ad.roas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
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
