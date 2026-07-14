import React from 'react';
import { T } from '../lib/theme';

// Static world outline (public/world-map.svg) — each country is a <path> or
// <g> keyed by its lowercase ISO 3166-1 alpha-2 code, matching the country
// codes we already get from Vercel's x-vercel-ip-country header. Fetched
// once and injected as real DOM so we can recolor individual countries by
// id, rather than trying to reproduce ~180 country paths in JSX by hand.
// Source: github.com/flekschas/simple-world-map (CC BY-SA 3.0, Al MacDonald).

const DEFAULT_FILL = '#E4E1D8';
const STROKE = T.white;

let svgTextPromise = null;
function loadSvgText() {
  if (!svgTextPromise) {
    svgTextPromise = fetch('/world-map.svg').then((r) => r.text());
  }
  return svgTextPromise;
}

export default function WorldMap({ counts, onHoverCountry }) {
  const containerRef = React.useRef(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    loadSvgText().then((text) => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = text;
      const svg = containerRef.current.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.display = 'block';
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!loaded || !containerRef.current) return;
    const root = containerRef.current;
    const max = Math.max(1, ...Object.values(counts || {}));

    root.querySelectorAll('path[id], g[id]').forEach((el) => {
      const count = counts?.[el.id] || 0;
      el.style.stroke = STROKE;
      el.style.strokeWidth = '0.5';
      el.style.cursor = count > 0 ? 'pointer' : 'default';
      el.style.transition = 'fill 0.2s';
      if (count > 0) {
        const intensity = 0.35 + 0.65 * (count / max);
        el.style.fill = T.ink;
        el.style.fillOpacity = String(intensity);
      } else {
        el.style.fill = DEFAULT_FILL;
        el.style.fillOpacity = '1';
      }

      el.onmouseenter = () => onHoverCountry?.(count > 0 ? el.id : null);
      el.onmouseleave = () => onHoverCountry?.(null);
    });
  }, [loaded, counts, onHoverCountry]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}
