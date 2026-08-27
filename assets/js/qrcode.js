/* Oakcraft Stock — minimal QR encoder (byte mode, versions 1-13, ECC L/M/Q/H) */
(function (w) {
  'use strict';
  /* [ecPerBlock, blocksG1, dataG1, blocksG2, dataG2] indexed [version][L,M,Q,H] */
  const RS = {
    1: [[7, 1, 19, 0, 0], [10, 1, 16, 0, 0], [13, 1, 13, 0, 0], [17, 1, 9, 0, 0]],
    2: [[10, 1, 34, 0, 0], [16, 1, 28, 0, 0], [22, 1, 22, 0, 0], [28, 1, 16, 0, 0]],
    3: [[15, 1, 55, 0, 0], [26, 1, 44, 0, 0], [18, 2, 17, 0, 0], [22, 2, 13, 0, 0]],
    4: [[20, 1, 80, 0, 0], [18, 2, 32, 0, 0], [26, 2, 24, 0, 0], [16, 4, 9, 0, 0]],
    5: [[26, 1, 108, 0, 0], [24, 2, 43, 0, 0], [18, 2, 15, 2, 16], [22, 2, 11, 2, 12]],
    6: [[18, 2, 68, 0, 0], [16, 4, 27, 0, 0], [24, 4, 19, 0, 0], [28, 4, 15, 0, 0]],
    7: [[20, 2, 78, 0, 0], [18, 4, 31, 0, 0], [18, 2, 14, 4, 15], [26, 4, 13, 1, 14]],
    8: [[24, 2, 97, 0, 0], [22, 2, 38, 2, 39], [22, 4, 18, 2, 19], [26, 4, 14, 2, 15]],
    9: [[30, 2, 116, 0, 0], [22, 3, 36, 2, 37], [20, 4, 16, 4, 17], [24, 4, 12, 4, 13]],
    10: [[18, 2, 68, 2, 69], [26, 4, 43, 1, 44], [24, 6, 19, 2, 20], [28, 6, 15, 2, 16]],
    11: [[20, 4, 81, 0, 0], [30, 1, 50, 4, 51], [28, 4, 22, 4, 23], [24, 3, 12, 8, 13]],
    12: [[24, 2, 92, 2, 93], [22, 6, 36, 2, 37], [26, 4, 20, 6, 21], [28, 7, 14, 4, 15]],
    13: [[26, 4, 107, 0, 0], [22, 8, 37, 1, 38], [24, 8, 20, 4, 21], [22, 12, 11, 4, 12]]
  };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50], 11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62] };
  const ECL = { L: 0, M: 1, Q: 2, H: 3 };
  const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* ---- GF(256) ---- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  function genPoly(n) {
    let p = [1];
    for (let i = 0; i < n; i++) {
      const q = [1, EXP[i]], r = new Array(p.length + 1).fill(0);
      for (let j = 0; j < p.length; j++) for (let k = 0; k < 2; k++) r[j + k] ^= mul(p[j], q[k]);
      p = r;
    }
    return p;
  }
  function ecc(data, n) {
    const g = genPoly(n), res = data.slice().concat(new Array(n).fill(0));
    for (let i = 0; i < data.length; i++) {
      const c = res[i]; if (!c) continue;
      for (let j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], c);
    }
    return res.slice(data.length);
  }

  /* ---- BCH ---- */
  function bch(v, g, len) { let d = v << (len - 1); while (bitLen(d) >= len) d ^= g << (bitLen(d) - len); return d; }
  function bitLen(x) { let n = 0; while (x) { n++; x >>>= 1; } return n; }

  function pickVersion(len, ec) {
    for (let v = 1; v <= 13; v++) {
      const t = RS[v][ECL[ec]];
      const dataCw = t[1] * t[2] + t[3] * t[4];
      const cci = v <= 9 ? 8 : 16;
      if (4 + cci + len * 8 <= dataCw * 8) return v;
    }
    throw new Error('QR: content too long');
  }

  function encodeBytes(str) {
    const utf = unescape(encodeURIComponent(str)), out = [];
    for (let i = 0; i < utf.length; i++) out.push(utf.charCodeAt(i) & 0xff);
    return out;
  }

  function build(text, ecLevel) {
    const ec = ECL[ecLevel] === undefined ? 'M' : ecLevel;
    const bytes = encodeBytes(text);
    const v = pickVersion(bytes.length, ec);
    const t = RS[v][ECL[ec]];
    const [ecPer, b1, d1, b2, d2] = t;
    const dataCw = b1 * d1 + b2 * d2;

    /* bit stream */
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(4, 4);
    push(bytes.length, v <= 9 ? 8 : 16);
    bytes.forEach(b => push(b, 8));
    const cap = dataCw * 8;
    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
    const PADS = [0xEC, 0x11];
    let pi = 0; while (cw.length < dataCw) cw.push(PADS[pi++ % 2]);

    /* blocks */
    const blocks = [], eccs = [];
    let p = 0;
    for (let i = 0; i < b1; i++) { blocks.push(cw.slice(p, p + d1)); p += d1; }
    for (let i = 0; i < b2; i++) { blocks.push(cw.slice(p, p + d2)); p += d2; }
    blocks.forEach(b => eccs.push(ecc(b, ecPer)));

    /* interleave */
    const out = [];
    const maxD = Math.max(d1, d2);
    for (let i = 0; i < maxD; i++) blocks.forEach(b => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < ecPer; i++) eccs.forEach(e => out.push(e[i]));

    /* matrix */
    const size = 17 + v * 4;
    const m = [], fn = [];
    for (let i = 0; i < size; i++) { m.push(new Array(size).fill(0)); fn.push(new Array(size).fill(0)); }
    const setF = (x, y, val) => { if (x < 0 || y < 0 || x >= size || y >= size) return; m[y][x] = val; fn[y][x] = 1; };

    function finder(cx, cy) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setF(x, y, (d === 0 || d === 2 || d === 4) && d !== 3 ? (d === 4 ? 0 : 1) : 0);
      }
      /* precise: rings at d<=1 -> dark(3x3), d==2 -> light, d==3 -> dark, d==4 -> light(separator) */
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setF(x, y, d <= 1 ? 1 : d === 2 ? 0 : d === 3 ? 1 : 0);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    /* timing */
    for (let i = 8; i < size - 8; i++) { setF(i, 6, i % 2 === 0 ? 1 : 0); setF(6, i, i % 2 === 0 ? 1 : 0); }

    /* alignment */
    const al = ALIGN[v];
    for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
      const cx = al[i], cy = al[j];
      if ((cx <= 8 && cy <= 8) || (cx <= 8 && cy >= size - 9) || (cx >= size - 9 && cy <= 8)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setF(cx + dx, cy + dy, d === 1 ? 0 : 1);
      }
    }

    /* reserve format areas */
    for (let i = 0; i <= 8; i++) { if (i !== 6) { fn[8][i] = 1; fn[i][8] = 1; } }
    fn[8][6] = 1; fn[6][8] = 1;
    for (let i = 0; i < 8; i++) { fn[size - 1 - i][8] = 1; fn[8][size - 1 - i] = 1; }
    setF(8, size - 8, 1); /* dark module */

    /* version info (v>=7) */
    if (v >= 7) {
      const vi = (v << 12) | bch(v, 0x1f25, 13);
      for (let i = 0; i < 18; i++) {
        const bit = (vi >> i) & 1;
        setF(Math.floor(i / 3), size - 11 + (i % 3), bit);
        setF(size - 11 + (i % 3), Math.floor(i / 3), bit);
      }
    }

    /* data placement */
    let bi = 0;
    const dataBits = [];
    out.forEach(b => { for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1); });
    let up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let r = 0; r < size; r++) {
        const y = up ? size - 1 - r : r;
        for (let c = 0; c < 2; c++) {
          const x = col - c;
          if (fn[y][x]) continue;
          m[y][x] = bi < dataBits.length ? dataBits[bi++] : 0;
        }
      }
      up = !up;
    }

    /* masks */
    const MASK = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x, y) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
      (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
      (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
    ];
    function applyMask(mat, k) {
      const o = mat.map(r => r.slice());
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASK[k](x, y)) o[y][x] ^= 1;
      return o;
    }
    function putFormat(mat, k) {
      const d = (ECL_BITS[ec] << 3) | k;
      const f = ((d << 10) | bch(d, 0x537, 11)) ^ 0x5412;
      /* first copy: (x=8, y=i) for i 0..5 ; then (8,7),(8,8),(7,8) ; then (14-i, 8) */
      for (let i = 0; i <= 5; i++) mat[i][8] = (f >> i) & 1;
      mat[7][8] = (f >> 6) & 1; mat[8][8] = (f >> 7) & 1; mat[8][7] = (f >> 8) & 1;
      for (let i = 9; i < 15; i++) mat[8][14 - i] = (f >> i) & 1;
      /* second copy */
      for (let i = 0; i < 8; i++) mat[8][size - 1 - i] = (f >> i) & 1;
      for (let i = 8; i < 15; i++) mat[size - 15 + i][8] = (f >> i) & 1;
      mat[size - 8][8] = 1;
      return mat;
    }
    function penalty(mat) {
      let p = 0, dark = 0;
      /* rule 1 */
      for (let i = 0; i < size; i++) {
        let rc = 1, cc = 1;
        for (let j = 1; j < size; j++) {
          if (mat[i][j] === mat[i][j - 1]) rc++; else { if (rc >= 5) p += 3 + rc - 5; rc = 1; }
          if (mat[j][i] === mat[j - 1][i]) cc++; else { if (cc >= 5) p += 3 + cc - 5; cc = 1; }
        }
        if (rc >= 5) p += 3 + rc - 5;
        if (cc >= 5) p += 3 + cc - 5;
      }
      /* rule 2 */
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        const a = mat[y][x];
        if (a === mat[y][x + 1] && a === mat[y + 1][x] && a === mat[y + 1][x + 1]) p += 3;
      }
      /* rule 3 */
      const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      function match(arr, i, pat) { for (let k = 0; k < 11; k++) if (arr[i + k] !== pat[k]) return false; return true; }
      for (let i = 0; i < size; i++) {
        const row = mat[i], col = mat.map(r => r[i]);
        for (let j = 0; j + 11 <= size; j++) {
          if (match(row, j, P1) || match(row, j, P2)) p += 40;
          if (match(col, j, P1) || match(col, j, P2)) p += 40;
        }
      }
      /* rule 4 */
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mat[y][x]) dark++;
      const pctv = dark * 100 / (size * size);
      p += Math.floor(Math.abs(pctv - 50) / 5) * 10;
      return p;
    }

    let best = null, bestP = Infinity;
    for (let k = 0; k < 8; k++) {
      const cand = putFormat(applyMask(m, k), k);
      const pen = penalty(cand);
      if (pen < bestP) { bestP = pen; best = cand; }
    }
    return { matrix: best, size, version: v };
  }

  function svg(text, opts) {
    opts = opts || {};
    const q = build(text, opts.ec || 'M');
    const quiet = opts.quiet == null ? 2 : opts.quiet;
    const n = q.size + quiet * 2;
    const scale = opts.scale || 4;
    let path = '';
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.matrix[y][x]) path += 'M' + (x + quiet) + ' ' + (y + quiet) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n * scale + '" height="' + n * scale +
      '" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + path + '" fill="#000"/></svg>';
  }
  function dataUrl(text, opts) { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg(text, opts)))); }
  function upi(vpa, name, amount, note) {
    let s = 'upi://pay?pa=' + encodeURIComponent(vpa) + '&pn=' + encodeURIComponent(name || '');
    if (amount) s += '&am=' + encodeURIComponent(Number(amount).toFixed(2));
    s += '&cu=INR';
    if (note) s += '&tn=' + encodeURIComponent(String(note).slice(0, 40));
    return s;
  }
  w.QR = { build, svg, dataUrl, upi };
})(window);
