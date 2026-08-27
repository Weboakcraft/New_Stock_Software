/* Oakcraft Stock — shared UI kit */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T;

  const UI = {};

  /* ---------------- toast ---------------- */
  UI.toast = function (msg, kind, ms) {
    let host = U.$('#toasts');
    if (!host) { host = el('div', { id: 'toasts' }); document.body.appendChild(host); }
    const n = el('div', { class: 'toast ' + (kind || ''), text: msg });
    host.appendChild(n);
    setTimeout(() => { n.style.transition = 'opacity .25s,transform .25s'; n.style.opacity = 0; n.style.transform = 'translateY(8px)'; setTimeout(() => n.remove(), 260); }, ms || 2600);
  };

  /* ---------------- modal ---------------- */
  UI.modal = function (opts) {
    const ovl = el('div', { class: 'ovl' });
    const box = el('div', { class: 'modal ' + (opts.size || '') });
    const head = el('div', { class: 'modal__h' }, [
      el('h3', { text: opts.title || '' }),
      opts.headExtra || null,
      el('button', { class: 'x', html: '&times;', onclick: close, title: 'Close' })
    ]);
    const body = el('div', { class: 'modal__b' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    box.appendChild(head); box.appendChild(body);
    if (opts.footer !== false) {
      const foot = el('div', { class: 'modal__f' });
      (opts.buttons || [{ label: 'Close', cls: 'btn-ghost', onClick: close }]).forEach(b => {
        foot.appendChild(el('button', { class: 'btn ' + (b.cls || 'btn-ghost'), text: b.label, onclick: () => b.onClick ? b.onClick(api) : close() }));
      });
      box.appendChild(foot);
    }
    ovl.appendChild(box);
    ovl.addEventListener('mousedown', e => { if (e.target === ovl && opts.dismissable !== false) close(); });
    document.body.appendChild(ovl);
    document.body.style.overflow = 'hidden';
    const esc = e => { if (e.key === 'Escape' && opts.dismissable !== false) close(); };
    document.addEventListener('keydown', esc);
    function close() {
      document.removeEventListener('keydown', esc);
      ovl.remove(); if (!U.$('.ovl')) document.body.style.overflow = '';
      if (opts.onClose) opts.onClose();
    }
    const api = { el: ovl, body, close, box };
    setTimeout(() => { const f = body.querySelector('input:not([type=hidden]),select,textarea'); if (f && !UI.isTouch()) f.focus(); }, 60);
    return api;
  };

  UI.confirm = function (msg, opts) {
    opts = opts || {};
    return new Promise(res => {
      const m = UI.modal({
        title: opts.title || 'Please confirm',
        size: 'narrow',
        body: el('p', { style: { margin: '2px 0', fontSize: '14.5px', lineHeight: '1.6' }, text: msg }),
        buttons: [
          /* resolve BEFORE close(): close() fires onClose, and a promise keeps its first value */
          { label: opts.cancel || 'Cancel', cls: 'btn-ghost', onClick: () => { res(false); m.close(); } },
          { label: opts.ok || 'Yes, continue', cls: opts.danger ? 'btn-red' : 'btn-p', onClick: () => { res(true); m.close(); } }
        ],
        onClose: () => res(false)
      });
    });
  };

  UI.prompt = function (label, value, opts) {
    opts = opts || {};
    return new Promise(res => {
      const inp = el('input', { class: 'inp', value: value == null ? '' : value, type: opts.type || 'text', placeholder: opts.placeholder || '' });
      const m = UI.modal({
        title: opts.title || label, size: 'narrow',
        body: el('div', { class: 'f' }, [el('label', { text: label }), inp]),
        buttons: [
          { label: 'Cancel', cls: 'btn-ghost', onClick: () => { res(null); m.close(); } },
          { label: opts.ok || 'Save', cls: 'btn-p', onClick: () => { res(inp.value.trim()); m.close(); } }
        ],
        onClose: () => res(null)
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { res(inp.value.trim()); m.close(); } });
    });
  };

  UI.isTouch = () => matchMedia('(pointer:coarse)').matches;

  /* ---------------- field builders ---------------- */
  UI.field = function (label, control, opts) {
    opts = opts || {};
    const lab = el('label', {}, [label]);
    if (opts.req) lab.appendChild(el('span', { class: 'req', text: ' *' }));
    const f = el('div', { class: 'f' + (opts.cls ? ' ' + opts.cls : '') }, [lab, control]);
    if (opts.hint) f.appendChild(el('div', { class: 'hint', text: opts.hint }));
    return f;
  };
  UI.input = function (attrs) { return el('input', Object.assign({ class: 'inp', type: 'text' }, attrs)); };
  UI.textarea = function (attrs) { return el('textarea', Object.assign({ class: 'inp' }, attrs)); };
  UI.select = function (options, value, attrs) {
    const s = el('select', Object.assign({ class: 'inp' }, attrs || {}));
    (options || []).forEach(o => {
      const val = (o && typeof o === 'object') ? o.value : o;
      const txt = (o && typeof o === 'object') ? o.label : o;
      const op = el('option', { value: val, text: txt });
      if (String(val) === String(value)) op.selected = true;
      s.appendChild(op);
    });
    return s;
  };
  UI.row = function (n, kids) { return el('div', { class: 'row r' + n }, kids); };
  UI.sect = function (title) { return el('div', { class: 'sec-title' }, [title]); };
  UI.switchBox = function (label, checked, onchange) {
    const inp = el('input', { type: 'checkbox' });
    inp.checked = !!checked;
    if (onchange) inp.addEventListener('change', () => onchange(inp.checked));
    const l = el('label', { class: 'switch' }, [inp, el('i'), el('span', { text: label })]);
    l.input = inp; return l;
  };
  UI.checkBox = function (label, checked, onchange) {
    const inp = el('input', { type: 'checkbox' });
    inp.checked = !!checked;
    if (onchange) inp.addEventListener('change', () => onchange(inp.checked));
    const l = el('label', { class: 'check' }, [inp, el('span', { text: label })]);
    l.input = inp; return l;
  };

  /* ---------------- searchable picker ---------------- */
  /** items: [{id, label, sub, right}] */
  UI.picker = function (opts) {
    const wrap = el('div', { class: 'pick' });
    const inp = el('input', { class: 'inp', placeholder: opts.placeholder || 'Select here!', autocomplete: 'off' });
    const list = el('div', { class: 'pick__list' });
    wrap.appendChild(inp); wrap.appendChild(list);
    let items = [], value = null, hl = -1;

    function setItems(arr) { items = arr || []; }
    function render(q) {
      q = U.deaccent(q);
      const f = q ? items.filter(i => U.deaccent(i.label).indexOf(q) >= 0 || U.deaccent(i.sub || '').indexOf(q) >= 0) : items;
      list.innerHTML = '';
      const shown = f.slice(0, 60);
      if (!shown.length) {
        list.appendChild(el('button', { type: 'button', class: 'muted', text: opts.emptyText || 'No match' }));
      }
      shown.forEach((i, ix) => {
        const b = el('button', { type: 'button', class: ix === hl ? 'hl' : '' }, [
          el('div', {}, [el('b', { text: i.label }), i.sub ? el('div', { class: 'tiny muted', text: i.sub }) : null]),
          i.right ? el('div', { class: 'r', html: i.right }) : null
        ]);
        b.addEventListener('mousedown', e => { e.preventDefault(); pick(i); });
        list.appendChild(b);
      });
      if (opts.onCreate && q) {
        const b = el('button', { type: 'button' }, [el('b', { class: 'blue', text: '＋ Add “' + q + '”' })]);
        b.addEventListener('mousedown', e => { e.preventDefault(); list.classList.remove('on'); opts.onCreate(inp.value.trim(), pick); });
        list.appendChild(b);
      }
      list.classList.add('on');
    }
    function pick(i) {
      value = i; inp.value = i ? i.label : '';
      list.classList.remove('on');
      if (opts.onPick) opts.onPick(i);
      if (opts.clearAfterPick) { inp.value = ''; value = null; }
    }
    inp.addEventListener('focus', () => { hl = -1; render(opts.filterOnFocus === false ? '' : inp.value); });
    inp.addEventListener('input', () => { hl = -1; render(inp.value); if (opts.onType) opts.onType(inp.value); });
    inp.addEventListener('blur', () => setTimeout(() => list.classList.remove('on'), 130));
    inp.addEventListener('keydown', e => {
      const btns = U.$$('button', list);
      if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, btns.length - 1); paint(btns); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); paint(btns); e.preventDefault(); }
      else if (e.key === 'Enter') { if (btns[hl]) { e.preventDefault(); btns[hl].dispatchEvent(new MouseEvent('mousedown')); } else if (opts.onEnter) { e.preventDefault(); opts.onEnter(inp.value); } }
      else if (e.key === 'Escape') list.classList.remove('on');
    });
    function paint(btns) { btns.forEach((b, i) => b.classList.toggle('hl', i === hl)); if (btns[hl]) btns[hl].scrollIntoView({ block: 'nearest' }); }

    wrap.setItems = setItems;
    wrap.input = inp;
    wrap.getValue = () => value;
    wrap.setValue = v => { value = v; inp.value = v ? v.label : ''; };
    wrap.clear = () => { value = null; inp.value = ''; };
    if (opts.items) setItems(opts.items);
    return wrap;
  };

  /* ---------------- row action menu ---------------- */
  UI.rowMenu = function (actions) {
    const btn = el('button', { type: 'button', html: '⋮', title: 'Actions' });
    const holder = el('div', { class: 'rowmenu' }, [btn]);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      UI.closeMenus();
      const m = el('div', { class: 'menu' });
      actions.filter(Boolean).forEach(a => {
        m.appendChild(el('button', { type: 'button', class: a.danger ? 'danger' : '', html: '<span>' + (a.icon || '') + '</span><span>' + U.esc(a.label) + '</span>', onclick: ev => { ev.stopPropagation(); UI.closeMenus(); a.onClick(); } }));
      });
      document.body.appendChild(m);
      const r = btn.getBoundingClientRect();
      const mw = 178, mh = m.offsetHeight;
      let left = Math.min(r.right - mw, innerWidth - mw - 8); if (left < 8) left = 8;
      let top = r.bottom + 6; if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
      m.style.left = left + 'px'; m.style.top = top + 'px';
      setTimeout(() => document.addEventListener('click', UI.closeMenus, { once: true }), 0);
    });
    return holder;
  };
  UI.closeMenus = function () { U.$$('.menu').forEach(m => m.remove()); };
  addEventListener('scroll', () => UI.closeMenus(), true);
  addEventListener('resize', () => UI.closeMenus());

  /* ---------------- date range control ---------------- */
  UI.PRESETS = [
    { key: 'today', label: 'Today', calc: () => [new Date(), new Date()] },
    { key: 'yest', label: 'Yesterday', calc: () => [U.addDays(new Date(), -1), U.addDays(new Date(), -1)] },
    { key: 'w7', label: 'Last 7 days', calc: () => [U.addDays(new Date(), -6), new Date()] },
    { key: 'w30', label: 'Last 30 days', calc: () => [U.addDays(new Date(), -29), new Date()] },
    { key: 'month', label: 'This month', calc: () => [U.monthStart(), new Date()] },
    {
      key: 'lmonth', label: 'Last month', calc: () => {
        const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth() - 1, 1);
        return [s, new Date(n.getFullYear(), n.getMonth(), 0)];
      }
    },
    { key: 'year', label: 'This year', calc: () => [new Date(new Date().getFullYear(), 0, 1), new Date()] },
    {
      key: 'fy', label: 'This financial year', calc: () => {
        const n = new Date(); const y = n.getMonth() < 3 ? n.getFullYear() - 1 : n.getFullYear();
        return [new Date(y, 3, 1), new Date()];
      }
    },
    { key: 'all', label: 'All time', calc: () => [new Date(2000, 0, 1), U.addDays(new Date(), 3650)] }
  ];
  UI.dateRange = function (state, onChange) {
    const btn = el('button', { class: 'btn btn-ghost', style: { minWidth: '210px', justifyContent: 'flex-start' } });
    function paint() { btn.innerHTML = '<span style="opacity:.7">🗓</span> <span>' + U.esc(U.rangeLabel(state.from, state.to)) + '</span>'; }
    paint();
    btn.addEventListener('click', () => {
      const from = el('input', { class: 'inp', type: 'date', value: U.isoDate(state.from) });
      const to = el('input', { class: 'inp', type: 'date', value: U.isoDate(state.to) });
      const quick = el('div', { class: 'chips' });
      UI.PRESETS.forEach(p => quick.appendChild(el('button', {
        class: 'chip', text: p.label, onclick: () => { const r = p.calc(); from.value = U.isoDate(r[0]); to.value = U.isoDate(r[1]); }
      })));
      const m = UI.modal({
        title: 'Select date range', size: 'narrow',
        body: el('div', {}, [quick, UI.row(2, [UI.field('From', from), UI.field('To', to)])]),
        buttons: [
          { label: 'Cancel', cls: 'btn-ghost', onClick: () => m.close() },
          {
            label: 'Apply', cls: 'btn-p', onClick: () => {
              state.from = new Date(from.value + 'T00:00:00'); state.to = new Date(to.value + 'T00:00:00');
              if (state.to < state.from) { const t = state.from; state.from = state.to; state.to = t; }
              paint(); m.close(); onChange && onChange(state);
            }
          }
        ]
      });
    });
    btn.repaint = paint;
    return btn;
  };

  /* ---------------- table ---------------- */
  /** cols: [{h, cls, render(row,i), w}] */
  UI.table = function (cols, rows, opts) {
    opts = opts || {};
    const t = el('table', { class: 'tbl' + (opts.dense ? ' dense' : '') });
    const thead = el('thead'), tr = el('tr');
    cols.forEach(c => tr.appendChild(el('th', { class: c.cls || '', style: c.w ? { width: c.w } : null }, [c.h])));
    thead.appendChild(tr); t.appendChild(thead);
    const tb = el('tbody');
    rows.forEach((r, i) => {
      const row = el('tr');
      if (opts.onRowClick) { row.style.cursor = 'pointer'; row.addEventListener('click', e => { if (!e.target.closest('button,a,input,select')) opts.onRowClick(r, i); }); }
      cols.forEach(c => {
        const v = c.render ? c.render(r, i) : '';
        const td = el('td', { class: c.cls || '' });
        if (v instanceof Node) td.appendChild(v); else td.innerHTML = (v == null ? '' : v);
        row.appendChild(td);
      });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    const wrap = el('div', { class: 'tbl-wrap' }, [el('div', { class: 'tbl-scroll' }, [t])]);
    if (!rows.length) {
      wrap.innerHTML = '';
      wrap.appendChild(el('div', { class: 'empty' }, [
        el('span', { class: 'big', text: opts.emptyIcon || '🔍' }),
        el('div', { text: opts.empty || T('No record found') }),
        opts.emptyAction || null
      ]));
    }
    return wrap;
  };

  /* pagination helper */
  UI.paginate = function (rows, state, render) {
    const per = state.per || 25;
    const pages = Math.max(1, Math.ceil(rows.length / per));
    if (state.page > pages) state.page = pages;
    const slice = rows.slice((state.page - 1) * per, state.page * per);
    const holder = el('div');
    holder.appendChild(render(slice));
    if (pages > 1) {
      const p = el('div', { class: 'pager' });
      const mk = (lab, pg, on) => el('button', { text: lab, class: on ? 'on' : '', onclick: () => { state.page = pg; state.rerender(); } });
      p.appendChild(mk('‹', Math.max(1, state.page - 1)));
      const list = [];
      for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - state.page) <= 1) list.push(i);
      let last = 0;
      list.forEach(i => { if (i - last > 1) p.appendChild(el('span', { class: 'muted', text: '…' })); p.appendChild(mk(String(i), i, i === state.page)); last = i; });
      p.appendChild(mk('›', Math.min(pages, state.page + 1)));
      p.appendChild(el('span', { class: 'muted small', style: { marginLeft: '8px' }, text: rows.length + ' records' }));
      holder.appendChild(p);
    }
    return holder;
  };

  /* ---------------- KPI card ---------------- */
  UI.kpi = function (o) {
    return el('div', { class: 'kpi' }, [
      el('div', { class: 'kpi__top' }, [
        el('div', { class: 'kpi__ic ' + (o.bg || 'bg-oak'), html: o.icon || '📦' }),
        el('div', { class: 'kpi__t' }, [el('small', { text: o.label }), el('b', { html: o.value })])
      ]),
      o.foot ? el('div', { class: 'kpi__f', html: o.foot }) : null
    ]);
  };

  /* ---------------- page header ---------------- */
  UI.pageHead = function (title, crumb, right) {
    return el('div', { class: 'flex ac jb wrap gap10 mb16' }, [
      el('div', {}, [
        el('div', { class: 'crumb', text: crumb || 'Pages' }),
        el('div', { class: 'crumb' }, [el('b', { text: title })])
      ]),
      el('div', { class: 'flex ac gap10 wrap' }, right || [])
    ]);
  };

  /* ---------------- print ---------------- */
  UI.print = function (html, opts) {
    opts = opts || {};
    let area = U.$('#printarea');
    if (!area) { area = el('div', { id: 'printarea' }); document.body.appendChild(area); }
    area.innerHTML = html;
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); area.innerHTML = ''; };
    setTimeout(() => {
      try {
        if (w.AndroidBridge && w.AndroidBridge.printPage) { w.AndroidBridge.printPage(); }
        else w.print();
      } catch (e) { w.print(); }
      setTimeout(done, 900);
    }, 220);
  };

  w.UI = UI;
})(window);
