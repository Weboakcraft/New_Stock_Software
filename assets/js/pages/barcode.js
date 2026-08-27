/* Page — Barcode generator & label printing */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI, App = w.App;

  const SHEETS = [
    { key: '65', label: '65 labels (38 × 21 mm)', cols: 5, rows: 13, wmm: 38, hmm: 21 },
    { key: '40', label: '40 labels (48.5 × 25.4 mm)', cols: 4, rows: 10, wmm: 48.5, hmm: 25.4 },
    { key: '24', label: '24 labels (63.5 × 33.9 mm)', cols: 3, rows: 8, wmm: 63.5, hmm: 33.9 },
    { key: '21', label: '21 labels (63.5 × 38.1 mm)', cols: 3, rows: 7, wmm: 63.5, hmm: 38.1 },
    { key: '14', label: '14 labels (99.1 × 38.1 mm)', cols: 2, rows: 7, wmm: 99.1, hmm: 38.1 },
    { key: '12', label: '12 labels (63.5 × 72 mm)', cols: 3, rows: 4, wmm: 63.5, hmm: 72 }
  ];
  const ROLLS = [
    { key: 'r50', label: 'Roll 50 × 25 mm', wmm: 50, hmm: 25 },
    { key: 'r38', label: 'Roll 38 × 25 mm', wmm: 38, hmm: 25 },
    { key: 'r75', label: 'Roll 75 × 50 mm', wmm: 75, hmm: 50 },
    { key: 'r100', label: 'Roll 100 × 50 mm', wmm: 100, hmm: 50 }
  ];
  const LINES = [
    { value: '', label: '— none —' }, { value: 'name', label: 'Product name' }, { value: 'saleRate', label: 'Sale price' },
    { value: 'mrp', label: 'MRP' }, { value: 'category', label: 'Category' }, { value: 'brand', label: 'Brand' },
    { value: 'size', label: 'Size' }, { value: 'colour', label: 'Colour' }, { value: 'unit', label: 'Unit' },
    { value: 'hsn', label: 'HSN code' }, { value: 'biz', label: 'Company name' }, { value: 'date', label: "Today's date" }
  ];

  function lineText(key, p) {
    const s = M.settings();
    switch (key) {
      case 'name': return p.name;
      case 'saleRate': return 'PRICE: ' + U.money(p.saleRate);
      case 'mrp': return 'MRP: ' + U.money(p.mrp);
      case 'category': return M.categoryName(p.categoryId);
      case 'brand': return p.brand || '';
      case 'size': return p.size || '';
      case 'colour': return p.colour || '';
      case 'unit': return p.unit || '';
      case 'hsn': return 'HSN: ' + (p.hsn || '');
      case 'biz': return s.bizName || 'OAKCRAFT';
      case 'date': return U.fmtDate(new Date());
      default: return '';
    }
  }

  App.page('barcode', {
    title: 'Add Barcode Labels', crumb: 'Pages / Barcode',
    render(c) {
      let queue = DB.all('labels');
      let current = null;

      const pick = UI.picker({
        placeholder: 'Search product here! (typing…)',
        items: M.products().map(p => ({ id: p.id, label: p.name, sub: (M.categoryName(p.categoryId) || '') + (p.barcode ? ' · ' + p.barcode : ''), right: U.money(p.saleRate) })),
        onPick: i => { current = DB.get('products', i.id); if (current) { if (!current.barcode) { current.barcode = w.Barcode.auto(); DB.put('products', { id: current.id, barcode: current.barcode }); } bcId.value = current.barcode; preview(); } }
      });
      const count = UI.input({ type: 'number', min: '1', value: '1', placeholder: 'Enter here' });
      const bcId = UI.input({ placeholder: 'Enter here' });
      const l1 = UI.select(LINES, 'name');
      const l2 = UI.select(LINES, 'saleRate');
      [bcId, l1, l2].forEach(x => x.addEventListener('input', U.debounce(preview, 200)));
      l1.addEventListener('change', preview); l2.addEventListener('change', preview);

      const prevBox = el('div', { class: 'center', style: { background: '#fff', borderRadius: '10px', padding: '14px', border: '1px solid var(--border)' } });
      function preview() {
        const p = current || { name: 'Item Name', saleRate: 0, mrp: 0, unit: '', hsn: '', brand: '', size: '', colour: '', categoryId: '' };
        const code = bcId.value.trim() || '1234567890';
        prevBox.innerHTML =
          '<div style="color:#000;font-weight:700;font-size:12px">' + U.esc(lineText(l1.value, p) || '') + '</div>' +
          '<div style="color:#000;font-size:11px">' + U.esc(lineText(l2.value, p) || '') + '</div>' +
          w.Barcode.svg(code, { unit: 1.7, height: 46 });
      }
      preview();

      if (App.params.p) { const p = DB.get('products', App.params.p); if (p) { pick.setValue({ id: p.id, label: p.name }); current = p; if (!p.barcode) { const b = w.Barcode.auto(); DB.put('products', { id: p.id, barcode: b }); current.barcode = b; } bcId.value = current.barcode; preview(); } }

      const printerSel = UI.select([{ value: 'a4', label: 'Regular printer (A4 sheet)' }, { value: 'roll', label: 'Label printer (roll)' }], 'a4');
      const sizeSel = UI.select(SHEETS.map(s => ({ value: s.key, label: s.label })), '65');
      printerSel.addEventListener('change', () => {
        const list = printerSel.value === 'a4' ? SHEETS : ROLLS;
        sizeSel.innerHTML = ''; list.forEach(s => sizeSel.appendChild(el('option', { value: s.key, text: s.label })));
      });

      const left = el('div', { class: 'card' }, [
        el('div', { class: 'card-h' }, [el('h3', { text: 'Items details for barcode' })]),
        el('div', { class: 'card-pad frm' }, [
          UI.row(2, [UI.field('Item name', pick, { req: true }), UI.field('No. of labels', count, { req: true })]),
          UI.row(3, [UI.field('Enter barcode ID', bcId, { req: true }), UI.field('Line 1', l1), UI.field('Line 2', l2)])
        ])
      ]);
      const right = el('div', { class: 'card' }, [
        el('div', { class: 'card-h' }, [el('h3', { class: 'red', text: 'Barcode preview' })]),
        el('div', { class: 'card-pad' }, [prevBox,
          el('button', {
            class: 'btn btn-blue btn-block mt14', text: 'ADD BARCODE LABELS', onclick: () => {
              if (!current) { UI.toast('Choose a product first', 'err'); return; }
              if (!bcId.value.trim()) { UI.toast('Barcode ID is required', 'err'); return; }
              DB.put('labels', { productId: current.id, barcode: bcId.value.trim(), count: Math.max(1, parseInt(count.value, 10) || 1), line1: l1.value, line2: l2.value });
              DB.put('products', { id: current.id, barcode: bcId.value.trim() });
              UI.toast('Added to the label sheet', 'ok'); App.refresh();
            }
          })])
      ]);
      c.appendChild(el('div', { class: 'grid g2 mb16' }, [left, right]));

      c.appendChild(el('div', { class: 'card card-pad mb16 flex ac gap10 wrap' }, [
        el('div', { class: 'fld' }, [el('label', { class: 'small muted', text: 'Printer type' }), printerSel]),
        el('div', { class: 'fld' }, [el('label', { class: 'small muted', text: 'Labels size' }), sizeSel]),
        el('span', { class: 'sp' }),
        el('button', { class: 'btn btn-ghost', text: 'PREVIEW', onclick: () => sheet(true) }),
        el('button', { class: 'btn btn-ghost', text: 'DOWNLOAD LABEL PDF', onclick: () => sheet(false) }),
        el('button', { class: 'btn btn-p', text: 'PRINT LABELS', onclick: () => sheet(false) })
      ]));

      c.appendChild(UI.table([
        { h: 'Item', render: r => U.esc((DB.get('products', r.productId) || {}).name || '—') },
        { h: 'Barcode', render: r => '<code>' + U.esc(r.barcode) + '</code>' },
        { h: 'No. of labels', cls: 'num', render: r => String(r.count) },
        { h: 'Line 1', render: r => U.esc((LINES.find(x => x.value === r.line1) || {}).label || '—') },
        { h: 'Line 2', render: r => U.esc((LINES.find(x => x.value === r.line2) || {}).label || '—') },
        { h: T('Action'), cls: 'center', render: r => el('button', { class: 'btn btn-xs btn-ghost', style: { color: 'var(--red)' }, html: '🗑', onclick: () => { DB.remove('labels', r.id); App.refresh(); } }) }
      ], queue, { dense: true, empty: 'No labels queued yet — add one above.' }));

      function buildSheet() {
        const isA4 = printerSel.value === 'a4';
        const spec = (isA4 ? SHEETS : ROLLS).find(s => s.key === sizeSel.value) || SHEETS[0];
        const cells = [];
        queue.forEach(q => {
          const p = DB.get('products', q.productId); if (!p) return;
          for (let i = 0; i < q.count; i++) cells.push({ p, q });
        });
        if (!cells.length) return null;
        const cellHtml = cells.map(({ p, q }) => {
          const t1 = lineText(q.line1, p), t2 = lineText(q.line2, p);
          return '<div class="lc">' +
            (t1 ? '<div class="l1">' + U.esc(t1) + '</div>' : '') +
            (t2 ? '<div class="l2">' + U.esc(t2) + '</div>' : '') +
            w.Barcode.svg(q.barcode, { unit: Math.max(0.9, spec.wmm / 42), height: Math.max(22, spec.hmm * 0.9), quiet: 6, showText: true }) +
            '</div>';
        }).join('');
        const css = isA4
          ? '@page{size:A4;margin:5mm} .sheet{display:grid;grid-template-columns:repeat(' + spec.cols + ',' + spec.wmm + 'mm);gap:2mm;}'
          : '@page{size:' + spec.wmm + 'mm ' + spec.hmm + 'mm;margin:1mm} .sheet{display:block}';
        return '<style>' + css +
          'body{margin:0;background:#fff}.lc{width:' + spec.wmm + 'mm;height:' + spec.hmm + 'mm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;page-break-inside:avoid;border:0;padding:1mm;box-sizing:border-box}' +
          '.lc .l1{font:700 8pt/1.05 Arial;text-align:center;color:#000;max-width:100%;overflow:hidden}' +
          '.lc .l2{font:7pt/1.05 Arial;text-align:center;color:#000}' +
          '.lc svg{max-width:100%;height:auto}</style><div class="sheet">' + cellHtml + '</div>';
      }
      function sheet(isPreview) {
        queue = DB.all('labels');
        const html = buildSheet();
        if (!html) { UI.toast('Add at least one label first', 'err'); return; }
        if (isPreview) {
          UI.modal({
            title: 'Label sheet preview', size: 'wide',
            body: el('div', { style: { background: '#fff', padding: '10px', borderRadius: '10px', overflow: 'auto', maxHeight: '64vh' }, html }),
            buttons: [{ label: '🖨 Print', cls: 'btn-p', onClick: () => UI.print(html) }, { label: 'Close', cls: 'btn-ghost', onClick: m => m.close() }]
          });
        } else UI.print(html);
      }
    }
  });
})(window);
