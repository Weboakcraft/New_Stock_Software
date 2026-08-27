/* Oakcraft Stock — dependency-free SVG charts */
(function (w) {
  'use strict';
  const U = w.U;
  const NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, kids) {
    const n = document.createElementNS(NS, tag);
    for (const k in (attrs || {})) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(c => n.appendChild(c));
    return n;
  }
  function txt(x, y, t, attrs) { const n = s('text', Object.assign({ x, y }, attrs || {})); n.textContent = t; return n; }
  const C = {};
  function tick(max, i) {
    const v = max - max * i / 3;
    if (max >= 1000) return Math.round(v / 1000) + 'k';
    if (max >= 10) return String(Math.round(v));
    return String(U.round(v, 1));
  }

  C.bar = function (labels, values, opts) {
    opts = opts || {};
    const W = 340, H = 168, pl = 34, pr = 8, pt = 10, pb = 24;
    const max = Math.max(1, Math.max.apply(null, values.concat([0])));
    const iw = W - pl - pr, ih = H - pt - pb;
    const g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, preserveAspectRatio: 'none', style: 'overflow:visible' });
    const grid = opts.grid || 'rgba(255,255,255,.18)', fg = opts.fg || 'rgba(255,255,255,.72)';
    for (let i = 0; i <= 3; i++) {
      const y = pt + ih * i / 3;
      g.appendChild(s('line', { x1: pl, x2: W - pr, y1: y, y2: y, stroke: grid, 'stroke-dasharray': '3 4', 'stroke-width': 1 }));
      g.appendChild(txt(pl - 6, y + 3.5, tick(max, i), { fill: fg, 'font-size': 9, 'text-anchor': 'end' }));
    }
    const bw = Math.max(4, Math.min(26, iw / labels.length * 0.5));
    labels.forEach((lb, i) => {
      const x = pl + iw * (i + 0.5) / labels.length;
      const h = Math.max(values[i] > 0 ? 3 : 0, ih * (values[i] / max));
      g.appendChild(s('rect', { x: x - bw / 2, y: pt + ih - h, width: bw, height: h, rx: Math.min(4, bw / 2), fill: opts.colour || '#ffffff', opacity: .92 }));
      g.appendChild(txt(x, H - 8, lb, { fill: fg, 'font-size': 9.5, 'text-anchor': 'middle' }));
    });
    return g;
  };

  C.line = function (labels, values, opts) {
    opts = opts || {};
    const W = 340, H = 168, pl = 34, pr = 8, pt = 12, pb = 24;
    const max = Math.max(1, Math.max.apply(null, values.concat([0])));
    const iw = W - pl - pr, ih = H - pt - pb;
    const g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, style: 'overflow:visible' });
    const grid = opts.grid || 'rgba(255,255,255,.18)', fg = opts.fg || 'rgba(255,255,255,.72)';
    for (let i = 0; i <= 3; i++) {
      const y = pt + ih * i / 3;
      g.appendChild(s('line', { x1: pl, x2: W - pr, y1: y, y2: y, stroke: grid, 'stroke-dasharray': '3 4', 'stroke-width': 1 }));
      g.appendChild(txt(pl - 6, y + 3.5, tick(max, i), { fill: fg, 'font-size': 9, 'text-anchor': 'end' }));
    }
    const pts = values.map((v, i) => [pl + (labels.length > 1 ? iw * i / (labels.length - 1) : iw / 2), pt + ih - ih * (v / max)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + U.round(p[0], 1) + ' ' + U.round(p[1], 1)).join(' ');
    const area = d + ' L' + pts[pts.length - 1][0] + ' ' + (pt + ih) + ' L' + pts[0][0] + ' ' + (pt + ih) + ' Z';
    const id = 'grad' + Math.random().toString(36).slice(2, 7);
    const defs = s('defs', {}, [s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, [
      s('stop', { offset: '0%', 'stop-color': opts.colour || '#fff', 'stop-opacity': .38 }),
      s('stop', { offset: '100%', 'stop-color': opts.colour || '#fff', 'stop-opacity': 0 })
    ])]);
    g.appendChild(defs);
    g.appendChild(s('path', { d: area, fill: 'url(#' + id + ')' }));
    g.appendChild(s('path', { d, fill: 'none', stroke: opts.colour || '#fff', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    pts.forEach(p => g.appendChild(s('circle', { cx: p[0], cy: p[1], r: 2.6, fill: opts.colour || '#fff' })));
    labels.forEach((lb, i) => { if (labels.length <= 12 || i % 2 === 0) g.appendChild(txt(pts[i][0], H - 8, lb, { fill: fg, 'font-size': 9, 'text-anchor': 'middle' })); });
    return g;
  };

  C.donut = function (parts, opts) {
    opts = opts || {};
    const size = 168, r = 62, rin = 38, cx = size / 2, cy = size / 2;
    const total = U.sum(parts, p => Math.max(0, p.value)) || 1;
    const g = s('svg', { viewBox: '0 0 ' + size + ' ' + size, width: '100%', height: size });
    let a0 = -Math.PI / 2;
    if (!parts.some(p => p.value > 0)) {
      g.appendChild(s('circle', { cx, cy, r: (r + rin) / 2, fill: 'none', stroke: opts.emptyColour || 'rgba(255,255,255,.25)', 'stroke-width': r - rin }));
    } else parts.forEach(p => {
      const frac = Math.max(0, p.value) / total;
      if (frac <= 0) return;
      const a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      if (frac >= 0.9999) {
        g.appendChild(s('circle', { cx, cy, r: (r + rin) / 2, fill: 'none', stroke: p.colour, 'stroke-width': r - rin }));
      } else {
        const d = ['M', cx + r * Math.cos(a0), cy + r * Math.sin(a0),
          'A', r, r, 0, large, 1, cx + r * Math.cos(a1), cy + r * Math.sin(a1),
          'L', cx + rin * Math.cos(a1), cy + rin * Math.sin(a1),
          'A', rin, rin, 0, large, 0, cx + rin * Math.cos(a0), cy + rin * Math.sin(a0), 'Z'].join(' ');
        g.appendChild(s('path', { d, fill: p.colour }));
      }
      a0 = a1;
    });
    if (opts.centre) {
      g.appendChild(txt(cx, cy - 1, opts.centre, { 'text-anchor': 'middle', fill: opts.fg || '#fff', 'font-size': 17, 'font-weight': 700 }));
      if (opts.centreSub) g.appendChild(txt(cx, cy + 14, opts.centreSub, { 'text-anchor': 'middle', fill: opts.fg || '#fff', 'font-size': 9.5, opacity: .8 }));
    }
    return g;
  };

  C.spark = function (values, colour) {
    const W = 90, H = 26;
    const max = Math.max(1, Math.max.apply(null, values.concat([0])));
    const g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H });
    const pts = values.map((v, i) => [W * i / Math.max(1, values.length - 1), H - 2 - (H - 4) * (v / max)]);
    g.appendChild(s('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + U.round(p[0], 1) + ' ' + U.round(p[1], 1)).join(' '), fill: 'none', stroke: colour || 'var(--gold-500)', 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
    return g;
  };

  w.Charts = C;
})(window);
