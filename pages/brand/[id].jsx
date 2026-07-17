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

  const [file, setFile] = React.useState(null);
  const [asset, setAsset] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadError, setUploadError] = React.useState('');
  const [uploadForm, setUploadForm] = React.useState({
    adSetName: '', campaignId: '', costCapCents: '', dailyBudgetCents: '', link: '', ctaType: 'SHOP_NOW',
  });
  const [copyVersions, setCopyVersions] = React.useState([{ headline: '', body: '' }]);
  const [creatingAdSet, setCreatingAdSet] = React.useState(false);
  const [createError, setCreateError] = React.useState('');
  const [createResult, setCreateResult] = React.useState(null);
  const [publishingId, setPublishingId] = React.useState(null);
  const [publishMessages, setPublishMessages] = React.useState({});
  const [discardingId, setDiscardingId] = React.useState(null);

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
        pageId: d.brand.pageId || '', pixelId: d.brand.pixelId || '',
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

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setAsset(null);
    setUploadError('');
    setCreateResult(null);
  };

  // Images go up in one request (Meta's base64 `bytes` shortcut). Videos
  // routinely exceed the ~4.5MB request-body limit this app's API routes
  // run under, so they go through Meta's resumable upload protocol instead
  // — the browser slices the file and relays it a few MB at a time.
  const handleUploadAsset = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    try {
      if (file.type.startsWith('video/')) {
        const startRes = await fetch(`/api/brands/${id}/creatives/video/start`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileSizeBytes: file.size }),
        });
        const start = await startRes.json();
        if (!startRes.ok) throw new Error(start.error || 'Video upload failed to start.');

        let { startOffset, endOffset } = start;
        const { videoId, uploadSessionId } = start;
        while (startOffset < file.size) {
          const chunk = file.slice(startOffset, Math.max(endOffset, startOffset + 1));
          const res = await fetch(`/api/brands/${id}/creatives/video/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream', 'x-upload-session-id': uploadSessionId, 'x-start-offset': String(startOffset) },
            body: chunk,
          });
          const transferred = await res.json();
          if (!res.ok) throw new Error(transferred.error || 'Video chunk upload failed.');
          startOffset = transferred.startOffset;
          endOffset = transferred.endOffset;
          setUploadProgress(Math.min(100, Math.round((startOffset / file.size) * 100)));
        }

        const finishRes = await fetch(`/api/brands/${id}/creatives/video/finish`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadSessionId, videoId }),
        });
        const finish = await finishRes.json();
        if (!finishRes.ok) throw new Error(finish.error || 'Video upload failed to finish.');
        setAsset({ assetType: 'video', videoId, thumbnailUrl: finish.thumbnailUrl });
      } else {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await fetch(`/api/brands/${id}/creatives/upload-image`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64 }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Image upload failed.');
        setAsset({ assetType: 'image', imageHash: result.imageHash });
        setUploadProgress(100);
      }
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleVersionChange = (i, field, value) => {
    setCopyVersions((prev) => prev.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  };
  const handleAddVersion = () => setCopyVersions((prev) => [...prev, { headline: '', body: '' }]);
  const handleRemoveVersion = (i) => setCopyVersions((prev) => prev.filter((_, idx) => idx !== i));

  const handleCreateAdSet = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateResult(null);
    setCreatingAdSet(true);
    try {
      const res = await fetch(`/api/brands/${id}/creatives/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adSetName: uploadForm.adSetName,
          campaignId: uploadForm.campaignId,
          costCapCents: Math.round(Number(uploadForm.costCapCents) * 100),
          dailyBudgetCents: Math.round(Number(uploadForm.dailyBudgetCents) * 100),
          link: uploadForm.link,
          ctaType: uploadForm.ctaType,
          ...asset,
          copyVersions,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setCreateError(result.error || 'Failed to save draft.');
      } else {
        setCreateResult(result.draft);
        setFile(null);
        setAsset(null);
        setUploadForm({ adSetName: '', campaignId: '', costCapCents: '', dailyBudgetCents: '', link: '', ctaType: 'SHOP_NOW' });
        setCopyVersions([{ headline: '', body: '' }]);
      }
    } finally {
      setCreatingAdSet(false);
      load();
    }
  };

  const handlePublishDraft = async (draft) => {
    if (!confirm(`Publish "${draft.adSetName}"? This creates the ad set and ${draft.copyVersions.length} ad${draft.copyVersions.length === 1 ? '' : 's'} on Facebook right now.`)) return;
    setPublishingId(draft.id);
    setPublishMessages((prev) => ({ ...prev, [draft.id]: '' }));
    try {
      const res = await fetch(`/api/brands/${id}/creatives/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId: draft.id }),
      });
      const result = await res.json();
      setPublishMessages((prev) => ({
        ...prev,
        [draft.id]: res.ok ? `Published: new ad set ${result.result.newAdSetId}.` : (result.error || 'Publish failed.'),
      }));
    } finally {
      setPublishingId(null);
      load();
    }
  };

  const handleDiscardDraft = async (draft) => {
    if (!confirm(`Discard the draft "${draft.adSetName}"? This can't be undone.`)) return;
    setDiscardingId(draft.id);
    try {
      await fetch(`/api/brands/${id}/creatives/drafts/${draft.id}`, { method: 'DELETE' });
    } finally {
      setDiscardingId(null);
      load();
    }
  };

  if (loading || !data) {
    return <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}><p style={{ color: T.soft }}>Loading…</p></div>;
  }

  const { brand, connection, todayPerformance, recentRevivals, recentNewCreatives, drafts, error } = data;
  const revivalConfigured = brand.templateAdSetId && brand.scalingCampaignId && brand.costCapCents && brand.aboDailyBudgetCents;
  const uploadConfigured = brand.pageId && brand.pixelId;
  const canCreateAdSet = asset && uploadForm.campaignId && uploadForm.costCapCents && uploadForm.dailyBudgetCents && uploadForm.link && copyVersions.every((v) => v.headline.trim() && v.body.trim());

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
          <Field label="Facebook Page ID"><input style={S.input} value={settingsForm.pageId} onChange={(e) => setSettingsForm({ ...settingsForm, pageId: e.target.value })} placeholder="Runs every ad's identity" /></Field>
          <Field label="Pixel ID"><input style={S.input} value={settingsForm.pixelId} onChange={(e) => setSettingsForm({ ...settingsForm, pixelId: e.target.value })} placeholder="For purchase-goal optimization" /></Field>
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

      <div style={{ ...S.card, marginTop: 20 }}>
        <p style={{ ...S.label, marginBottom: 12 }}>Upload new creative</p>
        <p style={{ color: T.soft, fontSize: 13, marginBottom: 12 }}>
          Every version below reuses the same uploaded image/video — only the headline and body copy differ, each becoming its own ad in one new ad set. Targeting is fixed for now: United States, automatic placements, optimized for purchases via the brand's pixel. Saving here only creates a draft — nothing goes live on Facebook until you review it below and click Publish.
        </p>
        {!uploadConfigured && (
          <p style={{ color: T.warn, fontSize: 13, marginBottom: 12 }}>Set a Facebook Page ID and Pixel ID in Edit settings first.</p>
        )}

        <form onSubmit={handleCreateAdSet}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>Creative file (image or video)</label>
            <input type="file" accept="image/*,video/*" onChange={handleFileChange} style={{ fontSize: 13 }} />
            {file && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={handleUploadAsset} disabled={uploading || !!asset} style={{ ...S.btnOutline, height: 34, padding: '0 14px', fontSize: 12, opacity: (uploading || asset) ? 0.6 : 1 }}>
                  {asset ? 'Uploaded ✓' : uploading ? `Uploading… ${uploadProgress}%` : 'Upload asset →'}
                </button>
                <span style={{ fontSize: 12, color: T.soft }}>{file.name}</span>
              </div>
            )}
            {uploadError && <p style={{ color: T.warn, fontSize: 13, marginTop: 8 }}>{uploadError}</p>}
          </div>

          <div style={{ ...S.formGrid, marginBottom: 14 }}>
            <Field label="Ad set name"><input style={S.input} value={uploadForm.adSetName} onChange={(e) => setUploadForm({ ...uploadForm, adSetName: e.target.value })} placeholder="e.g. New Creative — Jan" /></Field>
            <Field label="Campaign ID"><input required style={S.input} value={uploadForm.campaignId} onChange={(e) => setUploadForm({ ...uploadForm, campaignId: e.target.value })} placeholder="Must not use CBO" /></Field>
            <Field label="Cost cap ($)"><input required type="number" min="0" step="0.01" style={S.input} value={uploadForm.costCapCents} onChange={(e) => setUploadForm({ ...uploadForm, costCapCents: e.target.value })} /></Field>
            <Field label="Daily budget ($)"><input required type="number" min="0" step="0.01" style={S.input} value={uploadForm.dailyBudgetCents} onChange={(e) => setUploadForm({ ...uploadForm, dailyBudgetCents: e.target.value })} /></Field>
            <Field label="Destination link"><input required type="url" style={S.input} value={uploadForm.link} onChange={(e) => setUploadForm({ ...uploadForm, link: e.target.value })} placeholder="https://..." /></Field>
            <Field label="Call to action">
              <select style={S.input} value={uploadForm.ctaType} onChange={(e) => setUploadForm({ ...uploadForm, ctaType: e.target.value })}>
                <option value="SHOP_NOW">Shop now</option>
                <option value="LEARN_MORE">Learn more</option>
                <option value="SIGN_UP">Sign up</option>
                <option value="DOWNLOAD">Download</option>
              </select>
            </Field>
          </div>

          <p style={{ ...S.label, marginBottom: 10 }}>Copy versions ({copyVersions.length})</p>
          {copyVersions.map((v, i) => (
            <div key={i} style={{ ...S.card, marginBottom: 10, background: T.bg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Version {i + 1}</span>
                {copyVersions.length > 1 && <button type="button" onClick={() => handleRemoveVersion(i)} style={{ ...S.btnOutline, height: 28, padding: '0 10px', fontSize: 11, color: T.warn, borderColor: T.warn }}>Remove</button>}
              </div>
              <div style={{ ...S.formGrid }}>
                <Field label="Headline"><input required style={S.input} placeholder="e.g. 20% off this week only" value={v.headline} onChange={(e) => handleVersionChange(i, 'headline', e.target.value)} /></Field>
                <Field label="Body copy"><textarea required rows={2} style={{ ...S.input, height: 'auto', borderRadius: 16, padding: '10px 18px' }} placeholder="Primary text shown above the creative" value={v.body} onChange={(e) => handleVersionChange(i, 'body', e.target.value)} /></Field>
              </div>
            </div>
          ))}
          <button type="button" onClick={handleAddVersion} style={{ ...S.btnOutline, marginBottom: 16 }}>+ Add another version</button>

          {createError && <p style={{ color: T.warn, fontSize: 13, marginBottom: 12 }}>{createError}</p>}
          <button type="submit" disabled={!canCreateAdSet || creatingAdSet} style={{ ...S.btnFill, opacity: (!canCreateAdSet || creatingAdSet) ? 0.6 : 1 }}>
            {creatingAdSet ? 'Saving…' : 'Save as draft →'}
          </button>
        </form>

        {createResult && (
          <div style={{ ...S.card, background: T.bg, marginTop: 16 }}>
            <p style={{ fontSize: 13 }}>
              Saved as a draft — review it below and publish when you're ready. Nothing has been created on Facebook yet.
            </p>
          </div>
        )}

        {drafts?.length > 0 && (
          <>
            <p style={{ ...S.label, margin: '20px 0 10px' }}>Drafts pending review ({drafts.length})</p>
            {drafts.map((d) => (
              <div key={d.id} style={{ ...S.card, background: T.bg, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{d.adSetName}</span>
                    {d.status === 'failed' && <span style={{ marginLeft: 8 }}><span style={badge(T.warn)}>Failed</span></span>}
                    <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>
                      {d.assetType === 'video' ? 'Video' : 'Image'} · Campaign {d.campaignId} · {money(d.costCapCents)} cost cap · {money(d.dailyBudgetCents)}/day
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => handlePublishDraft(d)} disabled={publishingId === d.id || discardingId === d.id} style={{ ...S.btnOutline, height: 32, padding: '0 14px', fontSize: 12, opacity: (publishingId === d.id) ? 0.6 : 1 }}>
                      {publishingId === d.id ? 'Publishing…' : 'Publish →'}
                    </button>
                    <button onClick={() => handleDiscardDraft(d)} disabled={publishingId === d.id || discardingId === d.id} style={{ ...S.btnOutline, height: 32, padding: '0 14px', fontSize: 12, color: T.warn, borderColor: T.warn, opacity: (discardingId === d.id) ? 0.6 : 1 }}>
                      {discardingId === d.id ? 'Discarding…' : 'Discard'}
                    </button>
                  </div>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: T.soft }}>
                  {d.copyVersions.map((v, i) => <li key={i}><strong style={{ color: T.ink }}>{v.headline}</strong> — {v.body}</li>)}
                </ul>
                {d.status === 'failed' && d.error && <p style={{ color: T.warn, fontSize: 12, marginTop: 8 }}>{d.error}</p>}
                {publishMessages[d.id] && <p style={{ fontSize: 12, color: T.soft, marginTop: 8 }}>{publishMessages[d.id]}</p>}
              </div>
            ))}
          </>
        )}

        {recentNewCreatives?.length > 0 && (
          <>
            <p style={{ ...S.label, margin: '20px 0 10px' }}>Recent uploads</p>
            <div className="table-wrap">
              <table className="responsive-table" style={table}>
                <thead><tr><th style={th}>Ad set</th><th style={th}>Date</th><th style={th}>Result</th></tr></thead>
                <tbody>
                  {recentNewCreatives.map((r, i) => (
                    <tr key={`${r.newAdSetId}-${r.appliedAt}-${i}`}>
                      <td style={td} data-primary="true">{r.adSetName}</td>
                      <td style={td} data-label="Date">{new Date(r.appliedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td style={td} data-label="Result">{r.adsCreated} ad{r.adsCreated === 1 ? '' : 's'} in {r.newAdSetId}{r.adsFailed > 0 ? `, ${r.adsFailed} failed` : ''}</td>
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
