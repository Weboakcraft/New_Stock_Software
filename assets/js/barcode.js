/* Oakcraft Stock — Code 128 barcode renderer (no dependencies) */
(function (w) {
  'use strict';
  const PAT = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
'221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
'221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
'212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
'231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
'231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
'314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
'112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
'111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
'214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
'114131','311141','411131','211412','211214','211232','2331112'];
  const START_B = 104, START_C = 105, STOP = 106, CODE_B = 100, CODE_C = 99;

  function isDigits(s, i, n) {
    if (i + n > s.length) return false;
    for (let k = 0; k < n; k++) if (s[i + k] < '0' || s[i + k] > '9') return false;
    return true;
  }
  /** Encode to an array of Code128 values, auto-switching B <-> C. */
  function encode(text) {
    const s = String(text);
    const out = [];
    let i = 0, mode;
    // choose start
    if (isDigits(s, 0, s.length >= 4 ? 4 : s.length) && (s.length >= 4 || s.length % 2 === 0) && s.length >= 2 && isDigits(s, 0, 2) && (s.length === 2 || isDigits(s, 0, 4))) {
      mode = 'C'; out.push(START_C);
    } else { mode = 'B'; out.push(START_B); }
    while (i < s.length) {
      if (mode === 'C') {
        if (isDigits(s, i, 2)) { out.push(parseInt(s.substr(i, 2), 10)); i += 2; }
        else { out.push(CODE_B); mode = 'B'; }
      } else {
        const rest = s.length - i;
        if (isDigits(s, i, 6) || (isDigits(s, i, rest) && rest >= 4 && rest % 2 === 0)) { out.push(CODE_C); mode = 'C'; }
        else {
          let c = s.charCodeAt(i);
          if (c < 32) c = c + 64; else if (c >= 32 && c < 127) c = c - 32; else c = 'X'.charCodeAt(0) - 32;
          out.push(c); i++;
        }
      }
    }
    let sum = out[0];
    for (let k = 1; k < out.length; k++) sum += out[k] * k;
    out.push(sum % 103);
    out.push(STOP);
    return out;
  }

  /** Returns array of {w, bar:bool} modules */
  function modules(text) {
    const vals = encode(text), mods = [];
    vals.forEach(v => {
      const p = PAT[v];
      for (let i = 0; i < p.length; i++) mods.push({ w: +p[i], bar: i % 2 === 0 });
    });
    return mods;
  }

  /** SVG string. opts: {height, unit(px per module), showText, text, quiet} */
  function svg(code, opts) {
    opts = opts || {};
    const unit = opts.unit || 1.6, h = opts.height || 46, quiet = opts.quiet == null ? 10 : opts.quiet;
    const mods = modules(code);
    let total = 0; mods.forEach(m => total += m.w);
    const W = (total + quiet * 2) * unit;
    const textH = opts.showText === false ? 0 : 13;
    const H = h + textH + 2;
    let x = quiet * unit, rects = '';
    mods.forEach(m => {
      const wpx = m.w * unit;
      if (m.bar) rects += '<rect x="' + (Math.round(x * 100) / 100) + '" y="0" width="' + (Math.round(wpx * 100) / 100) + '" height="' + h + '"/>';
      x += wpx;
    });
    const label = opts.showText === false ? '' :
      '<text x="' + (W / 2) + '" y="' + (h + 11) + '" text-anchor="middle" font-family="monospace" font-size="11" fill="#000">' +
      String(opts.text || code).replace(/[<>&]/g, '') + '</text>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(W) + '" height="' + Math.round(H) +
      '" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">' +
      rects + '</g>' + label + '</svg>';
  }
  function dataUrl(code, opts) { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg(code, opts)))); }

  /** Random-ish but readable auto code: 13 digits */
  function auto(seed) {
    const t = Date.now().toString().slice(-9);
    const r = Math.floor(Math.random() * 9000 + 1000);
    return String(seed || '') ? String(seed).replace(/\D/g, '').slice(0, 4).padEnd(4, '0') + t : t + r;
  }

  w.Barcode = { encode, modules, svg, dataUrl, auto, PAT };
})(window);
