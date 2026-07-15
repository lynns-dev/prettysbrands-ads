// Design tokens — plain, neutral dashboard look (this is an internal ops
// tool, not a storefront).
export const T = {
  bg: '#F6F7F5',
  panel: '#FFFFFF',
  ink: '#161A17',
  soft: '#6B7570',
  line: 'rgba(22,26,23,0.12)',
  accent: '#1F5B4C',
  warn: '#A13D2B',
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

export const S = {
  label: {
    fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: T.soft, fontWeight: 600,
  },
  btnFill: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 40, padding: '0 20px',
    background: T.ink, color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 6,
    fontFamily: T.sans, fontSize: 13, fontWeight: 600,
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 40, padding: '0 20px',
    background: 'transparent', color: T.ink, border: `1px solid ${T.line}`, cursor: 'pointer', borderRadius: 6,
    fontFamily: T.sans, fontSize: 13, fontWeight: 600,
  },
  input: {
    width: '100%', height: 40, padding: '0 12px', border: `1px solid ${T.line}`, background: T.panel,
    fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 6,
  },
  card: {
    background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: '20px 16px',
  },
  // Responsive out of the box — CSS grid auto-fit collapses to fewer columns
  // as the container narrows, no media query needed.
  statGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
  },
  statTile: {
    background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: '14px 16px',
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14,
  },
};

// Small colored pill for a verdict/status word — reads at a glance in a way
// plain colored text doesn't, especially scanning a table on a phone.
export function badge(color) {
  return {
    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'capitalize',
    color, background: `${color}1F`, whiteSpace: 'nowrap',
  };
}
