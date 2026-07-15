// Design tokens — warm, editorial-playful look borrowed from Bobbi Home's
// onboarding flow: bold ink outlines on fully-rounded ("pill") shapes, a
// mixed sans + italic-serif headline treatment, tracked monospace
// micro-labels, and a rotating set of soft pastel tile tints. Applied with
// restraint here since this is a data-dense ops dashboard, not a linear
// onboarding flow — the pastels tint small tiles/accents rather than whole
// pages, so tables stay legible.
export const T = {
  bg: '#FBF3E4',
  panel: '#FFFFFF',
  ink: '#161A17',
  soft: '#6B7570',
  line: 'rgba(22,26,23,0.14)',
  accent: '#1F5B4C',
  warn: '#A13D2B',
  // Rotates across stat tiles for a bit of the same color-blocked personality
  // as Bobbi's per-step backgrounds, without tinting the whole page.
  pastels: ['#D6E8F7', '#F5E7A8', '#EAD6F5', '#E3EFE1'],
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

export const S = {
  label: {
    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: T.soft, fontWeight: 600, fontFamily: T.mono,
  },
  btnFill: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, padding: '0 22px',
    background: T.ink, color: '#fff', border: `2px solid ${T.ink}`, cursor: 'pointer', borderRadius: 999,
    fontFamily: T.sans, fontSize: 13, fontWeight: 600,
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, padding: '0 22px',
    background: 'transparent', color: T.ink, border: `2px solid ${T.ink}`, cursor: 'pointer', borderRadius: 999,
    fontFamily: T.sans, fontSize: 13, fontWeight: 600,
  },
  input: {
    width: '100%', height: 44, padding: '0 18px', border: `2px solid ${T.ink}`, background: T.panel,
    fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 999,
  },
  card: {
    background: T.panel, border: `2px solid ${T.ink}`, borderRadius: 24, padding: '20px 20px',
  },
  // Responsive out of the box — CSS grid auto-fit collapses to fewer columns
  // as the container narrows, no media query needed.
  statGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
  },
  statTile: {
    background: T.panel, border: `2px solid ${T.ink}`, borderRadius: 18, padding: '14px 16px',
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14,
  },
  // The "A number to ring." treatment: plain sans around an italic-serif
  // accent phrase. Use sparingly — masthead/page titles, not every heading.
  accent1: { fontFamily: T.serif, fontStyle: 'italic', fontWeight: 400 },
};

// Cycles the pastel set by index — pass the row/tile index so a row of
// stat tiles reads as a little color-blocked strip like Bobbi's step cards.
export function pastel(index) {
  return T.pastels[index % T.pastels.length];
}

// Small colored pill for a verdict/status word — reads at a glance in a way
// plain colored text doesn't, especially scanning a table on a phone.
export function badge(color) {
  return {
    display: 'inline-block', padding: '4px 12px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'capitalize',
    color, background: `${color}1F`, border: `1.5px solid ${color}66`, whiteSpace: 'nowrap',
  };
}
