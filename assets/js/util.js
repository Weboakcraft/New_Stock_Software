/* Oakcraft Stock — utilities */
(function (w) {
  'use strict';
  const U = {};

  /* ---- DOM ---- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  U.el = function (tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(n.style, attrs[k]);
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(c => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  };
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.on = (root, evt, sel, fn) => root.addEventListener(evt, e => {
    const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t);
  });

  /* ---- ids / misc ---- */
  U.uid = function (p) {
    const r = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    return (p || 'x') + '_' + r;
  };
  U.debounce = function (fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 250); }; };
  U.clone = o => JSON.parse(JSON.stringify(o));
  U.sum = (arr, f) => arr.reduce((a, b) => a + (Number(f ? f(b) : b) || 0), 0);
  U.groupBy = function (arr, f) { const m = {}; arr.forEach(x => { const k = f(x); (m[k] = m[k] || []).push(x); }); return m; };
  U.sortBy = (arr, f, dir) => arr.slice().sort((a, b) => {
    const A = f(a), B = f(b); return (A < B ? -1 : A > B ? 1 : 0) * (dir === 'desc' ? -1 : 1);
  });
  U.deaccent = s => String(s || '').toLowerCase().trim();

  /* ---- numbers / money ---- */
  U.n = v => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
  U.round = (v, d) => { const p = Math.pow(10, d == null ? 2 : d); return Math.round((U.n(v) + Number.EPSILON) * p) / p; };
  U.money = function (v, noSym) {
    const x = U.round(v, 2);
    const neg = x < 0, a = Math.abs(x).toFixed(2);
    let [i, f] = a.split('.');
    // Indian grouping: last 3, then pairs
    let last3 = i.slice(-3), rest = i.slice(0, -3);
    if (rest) last3 = ',' + last3;
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    const s = rest + last3 + '.' + f;
    return (neg ? '-' : '') + (noSym ? '' : '₹') + s;
  };
  U.qty = function (v, unit) {
    const x = U.round(v, 2);
    const s = (Math.abs(x % 1) < 1e-9) ? x.toFixed(2) : String(x);
    return s + (unit ? ' ' + unit : '');
  };
  U.pct = (a, b) => b ? U.round(a * 100 / b, 1) : 0;

  /* ---- dates ---- */
  U.pad = n => (n < 10 ? '0' : '') + n;
  U.MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.now = () => new Date().toISOString();
  U.dt = v => (v instanceof Date ? v : new Date(v));
  U.isoDate = function (d) { d = U.dt(d || new Date()); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); };
  U.isoLocal = function (d) { d = U.dt(d || new Date()); return U.isoDate(d) + 'T' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };
  U.fmtDate = function (v) { if (!v) return '—'; const d = U.dt(v); if (isNaN(d)) return '—'; return U.pad(d.getDate()) + ' ' + U.MON[d.getMonth()] + ' ' + d.getFullYear(); };
  U.fmtDT = function (v) {
    if (!v) return '—'; const d = U.dt(v); if (isNaN(d)) return '—';
    let h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return U.MON[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear() + ' ' + h + ':' + U.pad(d.getMinutes()) + ap;
  };
  U.fmtTime = function (v) { const d = U.dt(v); let h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + U.pad(d.getMinutes()) + ' ' + ap; };
  U.dayStart = d => { const x = U.dt(d); x.setHours(0, 0, 0, 0); return x; };
  U.dayEnd = d => { const x = U.dt(d); x.setHours(23, 59, 59, 999); return x; };
  U.addDays = (d, n) => { const x = U.dt(d); x.setDate(x.getDate() + n); return x; };
  U.monthStart = d => { const x = U.dt(d || new Date()); return new Date(x.getFullYear(), x.getMonth(), 1); };
  U.inRange = function (v, from, to) { const t = U.dt(v).getTime(); return t >= U.dayStart(from).getTime() && t <= U.dayEnd(to).getTime(); };
  U.rangeLabel = (a, b) => U.fmtDate(a) + '  →  ' + U.fmtDate(b);
  U.ago = function (v) {
    const s = (Date.now() - U.dt(v).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 604800) return Math.floor(s / 86400) + ' d ago';
    return U.fmtDate(v);
  };

  /* ---- files ---- */
  U.download = function (name, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 900);
  };
  U.csvCell = v => {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  U.toCSV = (rows) => rows.map(r => r.map(U.csvCell).join(',')).join('\r\n');
  U.exportCSV = function (name, headers, rows) {
    U.download(name.replace(/\.\w+$/, '') + '.csv', '﻿' + U.toCSV([headers].concat(rows)), 'text/csv;charset=utf-8');
  };
  /* Excel-compatible single-sheet XML (opens natively in Excel / Google Sheets) */
  U.exportXLS = function (name, sheetName, headers, rows) {
    const th = headers.map(h => '<th>' + U.esc(h) + '</th>').join('');
    const tr = rows.map(r => '<tr>' + r.map(c => {
      const isNum = typeof c === 'number';
      return '<td' + (isNum ? ' style="mso-number-format:\'0.00\'"' : '') + '>' + U.esc(c) + '</td>';
    }).join('') + '</tr>').join('');
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
      '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
      '<x:Name>' + U.esc(sheetName || 'Sheet1') + '</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>' +
      '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>' +
      '<table border="1"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></body></html>';
    U.download(name.replace(/\.\w+$/, '') + '.xls', html, 'application/vnd.ms-excel');
  };
  U.parseCSV = function (text) {
    const rows = []; let row = [], cur = '', q = false;
    text = String(text).replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (c === '\r') { /* skip */ }
        else cur += c;
      }
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  };
  U.readFile = (file, as) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result); fr.onerror = rej;
    if (as === 'dataurl') fr.readAsDataURL(file); else fr.readAsText(file);
  });

  /* ---- image resize (for product photos / logo) ---- */
  U.shrinkImage = function (file, max, quality) {
    return U.readFile(file, 'dataurl').then(src => new Promise(res => {
      const img = new Image();
      img.onload = function () {
        const m = max || 420;
        let w = img.width, h = img.height;
        if (w > m || h > m) { const r = Math.min(m / w, m / h); w = Math.round(w * r); h = Math.round(h * r); }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        res(cv.toDataURL('image/jpeg', quality || 0.78));
      };
      img.onerror = () => res('');
      img.src = src;
    }));
  };

  /* ---- misc ---- */
  U.initials = s => String(s || '?').trim().slice(0, 2).toUpperCase();
  U.colorFor = function (s) {
    let h = 0; s = String(s || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',42%,38%)';
  };
  U.numToWords = function (num) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function two(n) { return n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : ''); }
    function three(n) { return (n > 99 ? a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : ''); }
    num = Math.floor(Math.abs(U.n(num)));
    if (!num) return 'Zero';
    const cr = Math.floor(num / 10000000); num %= 10000000;
    const la = Math.floor(num / 100000); num %= 100000;
    const th = Math.floor(num / 1000); num %= 1000;
    let out = '';
    if (cr) out += three(cr) + ' Crore ';
    if (la) out += three(la) + ' Lakh ';
    if (th) out += three(th) + ' Thousand ';
    if (num) out += three(num);
    return out.trim();
  };
  U.qs = function () { const o = {}; new URLSearchParams(location.search).forEach((v, k) => o[k] = v); return o; };

  w.U = U;
})(window);
