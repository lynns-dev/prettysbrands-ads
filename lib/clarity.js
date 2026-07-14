// Microsoft Clarity — session recording + heatmaps. Just loads their tag;
// recordings/playback live entirely in Clarity's own dashboard
// (clarity.microsoft.com), nothing stored on our side.

export function loadClarity(projectId) {
  if (typeof window === 'undefined' || !projectId || window.clarity) return;

  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', projectId);
}
