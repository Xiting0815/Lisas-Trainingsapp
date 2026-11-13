// Small SVG charts. The string builders are pure (Node-safe); colors come from CSS classes in css/components.css,
// so the charts follow light/dark themes. Font sizes are chosen for a viewBox that is scaled up to ~1.2× on a phone,
// so labels stay ≥ 18 px.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const dm = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; };

/**
 * Neck pain before/after training as two lines on a 0–10 scale with soft traffic-light zones.
 * @param {{date: string, before: number|null, after: number|null}[]} points  oldest first
 * @param {{max?: number, width?: number, height?: number}} [opts]  `max` = number of newest points shown (default 14)
 * @returns {string}
 */
export function painChartSvg(points, opts = {}) {
  const W = opts.width ?? 300, H = opts.height ?? 200;
  const P = { l: 26, r: 10, t: 12, b: 28 };
  const pts = (points || []).filter((p) => p && (p.before != null || p.after != null)).slice(-(opts.max ?? 14));
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const Y = (v) => P.t + ih - (Math.max(0, Math.min(10, v)) / 10) * ih;
  const label = 'Nackenschmerz vor und nach dem Training';
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg"><title>${esc(label)}</title>`;
  out += `<rect class="band-green" x="${P.l}" y="${f1(Y(3.5))}" width="${iw}" height="${f1(Y(0) - Y(3.5))}"/>`;
  out += `<rect class="band-yellow" x="${P.l}" y="${f1(Y(6.5))}" width="${iw}" height="${f1(Y(3.5) - Y(6.5))}"/>`;
  out += `<rect class="band-red" x="${P.l}" y="${f1(Y(10))}" width="${iw}" height="${f1(Y(6.5) - Y(10))}"/>`;
  out += '<g class="grid">';
  for (const t of [0, 5, 10]) out += `<line x1="${P.l}" x2="${W - P.r}" y1="${f1(Y(t))}" y2="${f1(Y(t))}"/><text x="${P.l - 5}" y="${f1(Y(t) + 5)}" text-anchor="end">${t}</text>`;
  out += '</g>';
  if (!pts.length) return `${out}<text class="empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">Noch keine Werte</text></svg>`;
  const X = (i) => P.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const line = (key, cls) => {
    const seg = pts.map((p, i) => ({ i, v: p[key] })).filter((p) => p.v != null);
    if (!seg.length) return '';
    let s = seg.length > 1 ? `<path class="line ${cls}" d="${seg.map((p, k) => `${k ? 'L' : 'M'}${f1(X(p.i))},${f1(Y(p.v))}`).join('')}"/>` : '';
    for (const p of seg) s += `<circle class="dot ${cls}" cx="${f1(X(p.i))}" cy="${f1(Y(p.v))}" r="4.5"><title>${cls === 'before' ? 'Vorher' : 'Nachher'} ${dm(pts[p.i].date)}: ${p.v}</title></circle>`;
    return s;
  };
  out += line('before', 'before') + line('after', 'after');
  out += `<text x="${P.l}" y="${H - 6}" text-anchor="start">${dm(pts[0].date)}</text>`;
  if (pts.length > 1) out += `<text x="${W - P.r}" y="${H - 6}" text-anchor="end">${dm(pts.at(-1).date)}</text>`;
  return `${out}</svg>`;
}

/** DOM wrapper: renders the pain chart into `container`. */
export function painChart(container, points, opts) {
  container.innerHTML = painChartSvg(points, opts);
  return container.firstElementChild;
}
