/* Page — Stock (products, IN / OUT, history, bulk upload) */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI, App = w.App;

  const state = { q: '', cat: '', sort: 'recent', page: 1, per: 25, slide: 0, from: new Date(), to: new Date() };

  const SORTS = [
    { value: 'recent', label: 'Most recent' }, { value: 'old', label: 'Oldest' },
    { value: 'az', label: 'By Name (A-Z)' }, { value: 'za', label: 'By Name (Z-A)' },
    { value: 'qhigh', label: 'Highest Quantity' }, { value: 'qlow', label: 'Least Quantity' },
    { value: 'low', label: 'Low stock first' }
  ];

  /* ---------------------------------------------------------------- product form */
  function productModal(id) {
    const p = id ? DB.get('products', id) : null;
    const s = M.settings();
    const f = {};
    f.name = UI.input({ placeholder: 'e.g. OC-511 High Back — Black', value: p ? p.name : '' });
    f.unit = UI.select(M.units(), p ? p.unit : s.defUnit);
    f.cat = UI.select([{ value: '', label: 'Select category' }].concat(M.categories().map(x => ({ value: x.id, label: x.name }))), p ? p.categoryId : '');
    f.low = UI.input({ type: 'number', value: p ? p.lowStock : s.lowStock });
    f.qty = UI.input({ type: 'number', step: '0.01', value: p ? '' : '0', placeholder: '0' });
    f.barcode = UI.input({ value: p ? p.barcode : '', placeholder: 'Enter barcode' });
    f.brand = UI.input({ value: p ? p.brand : 'OAKCRAFT' });
    f.colour = UI.input({ value: p ? p.colour : '' });
    f.size = UI.input({ value: p ? p.size : '' });
    f.remark = UI.textarea({ value: p ? p.remark : '' });

    let photo = p ? (p.image || '') : '';
    const photoBox = el('div', {
      style: {
        width: '78px', height: '78px', border: '1px dashed var(--border-2)', borderRadius: '12px',
        display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden', background: 'var(--sunk)', flex: '0 0 78px'
      }
    });
    function paintPhoto() { photoBox.innerHTML = photo ? '<img src="' + photo + '" style="width:100%;height:100%;object-fit:cover">' : '<span style="font-size:22px;opacity:.5">📷</span>'; }
    paintPhoto();
    const file = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    photoBox.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => { if (file.files[0]) { photo = await U.shrinkImage(file.files[0], 420); paintPhoto(); } });

    const autoBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: T('Auto Barcode'), onclick: () => { f.barcode.value = w.Barcode.auto(); preview(); } });
    const bcPrev = el('div', { class: 'mt8', style: { textAlign: 'center' } });
    function preview() {
      const v = f.barcode.value.trim();
      bcPrev.innerHTML = v ? w.Barcode.svg(v, { unit: 1.4, height: 38 }) : '';
    }
    f.barcode.addEventListener('input', U.debounce(preview, 300)); preview();

    const body = el('div', { class: 'frm' }, [
      el('div', { class: 'flex gap14', style: { alignItems: 'flex-start' } }, [
        el('div', { class: 'sp' }, [UI.field(T('Product Name'), f.name, { req: true })]),
        el('div', {}, [el('div', { class: 'tiny muted mb10', text: 'Photo' }), photoBox, file])
      ]),
      UI.row(3, [
        UI.field(T('Unit'), f.unit, { req: true }),
        UI.field(T('Category'), f.cat),
        UI.field(T('Low Stock Warning'), f.low)
      ]),
      UI.row(3, [UI.field('Brand', f.brand), UI.field('Colour', f.colour), UI.field('Size', f.size)]),
      p ? null : UI.field(T('Enter Quantity') + ' (opening stock)', f.qty, { req: true }),
      UI.field(T('Barcode (Item Code)'), el('div', { class: 'flex gap10' }, [el('div', { class: 'sp' }, [f.barcode]), autoBtn])),
      bcPrev,
      UI.field(T('Remark'), f.remark)
    ]);

    const m = UI.modal({
      title: p ? 'Edit product' : 'Fill the product details', size: 'wide', body,
      buttons: [
        { label: T('Cancel'), cls: 'btn-ghost', onClick: () => m.close() },
        { label: T('Save'), cls: 'btn-p', onClick: save }
      ]
    });

    function save() {
      const name = f.name.value.trim();
      if (!name) { UI.toast('Product name is required', 'err'); f.name.focus(); return; }
      const dup = M.products().find(x => U.deaccent(x.name) === U.deaccent(name) && (!p || x.id !== p.id));
      if (dup) { UI.toast('A product with this name already exists', 'err'); return; }
      /* Rates, MRP, HSN, GST and expiry are not asked for on this form. Editing a
         product therefore leaves whatever those already hold untouched (DB.put
         merges), and a brand new product starts from the business defaults. */
      const rec = {
        id: p ? p.id : undefined, name, image: photo,
        unit: f.unit.value, categoryId: f.cat.value, lowStock: U.n(f.low.value),
        barcode: f.barcode.value.trim(), brand: f.brand.value.trim(), colour: f.colour.value.trim(),
        size: f.size.value.trim(), remark: f.remark.value.trim(), storeId: M.currentStoreId()
      };
      if (!p) Object.assign(rec, {
        buyRate: 0, saleRate: 0, mrp: 0, buyGstMode: 'ex', saleGstMode: 'ex',
        hsn: s.defHsn, gstRate: U.n(s.defGst), expiryDate: ''
      });
      const saved = DB.put('products', rec);
      if (!p) {
        const q = U.n(f.qty.value);
        if (q) M.addMove({ productId: saved.id, type: 'IN', qty: q, unit: saved.unit, rate: U.n(saved.buyRate), source: 'opening', remark: 'Opening stock', storeRef: 'store' });
      }
      m.close(); UI.toast(T('Saved'), 'ok'); App.refresh();
    }
    return m;
  }

  /* ---------------------------------------------------------------- IN / OUT */
  function moveModal(kind, productId) {
    const isIn = kind === 'IN';
    const dt = UI.input({ type: 'datetime-local', value: U.isoLocal() });
    let fill;                                   /* defined once the fields exist */
    const prodPick = UI.picker({
      placeholder: 'Select product / scan barcode',
      items: M.products().map(p => ({ id: p.id, label: p.name, sub: M.categoryName(p.categoryId), right: '<b>' + U.qty(M.available(p.id)) + '</b><br>' + (p.unit || '') })),
      onPick: i => { const p = DB.get('products', i.id); if (p) fill(p); }
    });
    if (productId) { const p = DB.get('products', productId); if (p) prodPick.setValue({ id: p.id, label: p.name }); }
    const partyPick = UI.picker({
      placeholder: 'Select party (optional)',
      items: M.parties().map(p => ({ id: p.id, label: p.name, sub: p.ptype }))
    });
    const qty = UI.input({ type: 'number', step: '0.01', placeholder: '0' });
    const unit = el('span', { class: 'sfx', text: 'Piece' });
    const avail = el('div', { class: 'hint' });
    const remark = UI.textarea({});
    let target = 'party';
    const rP = el('input', { type: 'radio', name: 'tgt', checked: true }), rS = el('input', { type: 'radio', name: 'tgt' });
    rP.addEventListener('change', () => { target = 'party'; partyWrap.classList.remove('hide'); });
    rS.addEventListener('change', () => { target = 'store'; partyWrap.classList.add('hide'); });
    const partyWrap = UI.field('Party (optional)', partyPick);

    fill = function (p) {
      unit.textContent = p.unit || 'Piece';
      avail.textContent = 'In hand: ' + U.qty(M.available(p.id), p.unit);
    };
    if (productId) { const p = DB.get('products', productId); if (p) fill(p); }

    const body = el('div', { class: 'frm' }, [
      el('div', { class: 'radio-grp', style: { justifyContent: 'center' } }, [
        el('label', { class: 'check' }, [rP, el('span', { text: 'Party' })]),
        el('label', { class: 'check' }, [rS, el('span', { text: 'Store' })])
      ]),
      UI.field(T('Product Name'), prodPick, { req: true }),
      partyWrap,
      UI.field(T('Quantity'), el('div', {}, [el('div', { class: 'inp-grp' }, [qty, unit]), avail]), { req: true }),
      UI.field(T('Remark'), remark),
      UI.field('Date & time', dt)
    ]);

    const m = UI.modal({
      title: isIn ? T('In Stock') : T('Out Stock'), size: 'narrow', body,
      buttons: [{ label: isIn ? 'IN STOCK' : 'OUT STOCK', cls: isIn ? 'btn-green' : 'btn-red', onClick: save }]
    });

    function save() {
      const sel = prodPick.getValue();
      if (!sel) { UI.toast('Choose a product first', 'err'); return; }
      const q = U.n(qty.value);
      if (q <= 0) { UI.toast('Enter a quantity', 'err'); return; }
      const p = DB.get('products', sel.id);
      if (!isIn && q > M.available(p.id)) {
        UI.confirm('Only ' + U.qty(M.available(p.id), p.unit) + ' in hand. Take out ' + U.qty(q, p.unit) + ' anyway?', { danger: true }).then(ok => { if (ok) commit(p, q); });
        return;
      }
      commit(p, q);
    }
    function commit(p, q) {
      /* No rate is asked for here, so the entry is valued at the product's own
         rate and the product record itself is left alone. */
      M.addMove({
        at: new Date(dt.value || Date.now()).toISOString(), productId: p.id, type: kind, qty: q,
        unit: p.unit, rate: isIn ? U.n(p.buyRate) : U.n(p.saleRate),
        partyId: target === 'party' && partyPick.getValue() ? partyPick.getValue().id : '',
        storeRef: target, source: 'manual', remark: remark.value.trim()
      });
      m.close(); UI.toast(isIn ? 'Stock added' : 'Stock taken out', 'ok'); App.refresh();
    }
    return m;
  }

  /* ---------------------------------------------------------------- history */
  function historyModal(id) {
    const p = DB.get('products', id); if (!p) return;
    const st = M.stock(id);
    const moves = U.sortBy(M.movesOf(id), m => m.at, 'desc');
    const totBuy = U.sum(moves.filter(m => m.type === 'IN'), m => U.n(m.qty) * U.n(m.rate));
    const totSale = U.sum(moves.filter(m => m.type === 'OUT'), m => U.n(m.qty) * U.n(m.rate));

    const head = el('div', { class: 'card-pad', style: { background: 'linear-gradient(135deg,#4a3425,#241a13)', color: '#fff', borderRadius: '14px' } }, [
      el('div', { class: 'grid g4', style: { gap: '12px', alignItems: 'center' } }, [
        el('div', {}, [
          el('div', { class: 'thumb', style: { width: '58px', height: '58px', fontSize: '20px', background: 'rgba(255,255,255,.14)' }, html: p.image ? '<img src="' + p.image + '">' : U.initials(p.name) }),
          el('b', { class: 'mt8', style: { display: 'block' }, text: p.name })
        ]),
        el('div', { style: { background: 'rgba(255,255,255,.95)', color: 'var(--ink)', padding: '12px', borderRadius: '11px' } }, [
          el('div', { class: 'flex jb small' }, [el('span', { text: T('Buy Rate') }), el('b', { text: U.money(p.buyRate) })]),
          el('div', { class: 'flex jb small mt8' }, [el('span', { text: T('Sale Rate') }), el('b', { text: U.money(p.saleRate) })]),
          el('div', { class: 'flex jb small mt8' }, [el('span', { text: 'In Hand' }), el('b', { text: U.qty(st.available, p.unit) })])
        ]),
        el('div', { style: { background: 'rgba(255,255,255,.95)', color: 'var(--ink)', padding: '12px', borderRadius: '11px' } }, [
          el('div', { class: 'flex jb small' }, [el('span', { text: 'Total In' }), el('b', { class: 'green', text: U.qty(st.in, p.unit) })]),
          el('div', { class: 'flex jb small mt8' }, [el('span', { text: 'Total Out' }), el('b', { class: 'red', text: U.qty(st.out, p.unit) })]),
          el('div', { class: 'flex jb small mt8' }, [el('span', { text: 'Total Profit' }), el('b', { text: U.money(totSale - totBuy) })])
        ]),
        el('div', { style: { background: 'rgba(255,255,255,.95)', color: 'var(--ink)', padding: '12px', borderRadius: '11px' } }, [
          el('div', { class: 'flex jb small' }, [el('span', { text: 'Total Buy' }), el('b', { text: U.money(totBuy) })]),
          el('div', { class: 'flex jb small mt8' }, [el('span', { text: 'Total Sale' }), el('b', { text: U.money(totSale) })]),
          el('div', { class: 'flex jb small mt8' }, [el('span', { text: 'Barcode' }), el('b', { text: p.barcode || '—' })])
        ])
      ])
    ]);

    const tbl = UI.table([
      { h: 'Type / Time', render: m => (m.type === 'IN' ? '<span class="green b">↑</span> ' : '<span class="red b">↓</span> ') + U.fmtDT(m.at) },
      { h: T('Quantity'), cls: 'num', render: m => U.qty(m.qty, m.unit || p.unit) },
      { h: 'Store / Party', render: m => m.partyId ? U.esc((M.party(m.partyId) || {}).name || '—') : (m.storeRef === 'store' ? M.currentStore().name : '—') },
      { h: 'Amount', cls: 'num', render: m => U.money(U.n(m.qty) * U.n(m.rate)) },
      { h: 'Entry by', render: m => U.esc(m.by || 'Admin') },
      { h: T('Remark'), render: m => U.esc(m.remark || '') }
    ], moves, { dense: true, empty: 'No movement recorded for this item yet.' });

    UI.modal({
      title: 'Product details history', size: 'wide',
      headExtra: el('span', { class: 'badge b-grey', text: 'Total transactions: ' + moves.length }),
      body: el('div', {}, [head, el('div', { class: 'mt14' }, [tbl])]),
      buttons: [
        { label: 'Print label', cls: 'btn-ghost', onClick: () => App.go('barcode', { p: p.id }) },
        { label: T('Close'), cls: 'btn-oak', onClick: m => m.close() }
      ]
    });
  }

  /* ---------------------------------------------------------------- bulk upload */
  function bulkModal() {
    const file = el('input', { type: 'file', accept: '.csv,text/csv', class: 'inp' });
    const out = el('div', { class: 'mt14' });
    const HEAD = ['Product Name', 'Category', 'Unit', 'Opening Qty', 'Buy Rate', 'Sale Rate', 'MRP', 'HSN', 'GST %', 'Low Stock', 'Barcode', 'Brand', 'Colour', 'Size', 'Remark'];
    let rows = [];
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      const txt = await U.readFile(file.files[0]);
      const parsed = U.parseCSV(txt);
      if (!parsed.length) { out.innerHTML = '<p class="red">That file looks empty.</p>'; return; }
      const head = parsed[0].map(h => U.deaccent(h));
      const col = n => head.findIndex(h => h.indexOf(U.deaccent(n)) >= 0);
      const ix = { name: col('product name') >= 0 ? col('product name') : col('name'), cat: col('categ'), unit: col('unit'), qty: col('qty') >= 0 ? col('qty') : col('quantity'), buy: col('buy'), sale: col('sale'), mrp: col('mrp'), hsn: col('hsn'), gst: col('gst'), low: col('low'), bar: col('barcode'), brand: col('brand'), colour: col('colour'), size: col('size'), remark: col('remark') };
      if (ix.name < 0) { out.innerHTML = '<p class="red">Could not find a “Product Name” column.</p>'; return; }
      rows = parsed.slice(1).map(r => ({
        name: (r[ix.name] || '').trim(), cat: ix.cat >= 0 ? (r[ix.cat] || '').trim() : '',
        unit: ix.unit >= 0 ? (r[ix.unit] || '').trim() : 'Piece', qty: ix.qty >= 0 ? U.n(r[ix.qty]) : 0,
        buy: ix.buy >= 0 ? U.n(r[ix.buy]) : 0, sale: ix.sale >= 0 ? U.n(r[ix.sale]) : 0, mrp: ix.mrp >= 0 ? U.n(r[ix.mrp]) : 0,
        hsn: ix.hsn >= 0 ? (r[ix.hsn] || '').trim() : '', gst: ix.gst >= 0 ? U.n(r[ix.gst]) : M.settings().defGst,
        low: ix.low >= 0 ? U.n(r[ix.low]) : M.settings().lowStock, bar: ix.bar >= 0 ? (r[ix.bar] || '').trim() : '',
        brand: ix.brand >= 0 ? (r[ix.brand] || '').trim() : '', colour: ix.colour >= 0 ? (r[ix.colour] || '').trim() : '',
        size: ix.size >= 0 ? (r[ix.size] || '').trim() : '', remark: ix.remark >= 0 ? (r[ix.remark] || '').trim() : ''
      })).filter(r => r.name);
      out.innerHTML = '';
      out.appendChild(el('p', { class: 'green b', text: '✓ ' + rows.length + ' products ready to import.' }));
      out.appendChild(UI.table([
        { h: 'Name', render: r => U.esc(r.name) }, { h: 'Category', render: r => U.esc(r.cat) },
        { h: 'Qty', cls: 'num', render: r => U.qty(r.qty) }, { h: 'Buy', cls: 'num', render: r => U.money(r.buy) },
        { h: 'Sale', cls: 'num', render: r => U.money(r.sale) }
      ], rows.slice(0, 8), { dense: true }));
    });

    const m = UI.modal({
      title: 'Bulk upload products (CSV)', size: 'wide',
      body: el('div', { class: 'frm' }, [
        el('p', { class: 'small muted', html: 'Upload a CSV whose first row is a header. Recognised columns: <b>' + HEAD.join(', ') + '</b>. Only <b>Product Name</b> is required.' }),
        el('button', { class: 'btn btn-ghost btn-sm', text: '⬇ Download the sample CSV', onclick: () => U.exportCSV('oakcraft-products-template', HEAD, [['OC-511 High Back Black', 'Highback', 'Piece', 10, 3200, 4250, 4999, '9403', 18, 5, '8901234500011', 'OAKCRAFT', 'Black', 'High Back', '']]) }),
        UI.field('CSV file', file), out
      ]),
      buttons: [
        { label: T('Cancel'), cls: 'btn-ghost', onClick: () => m.close() },
        {
          label: 'Import products', cls: 'btn-p', onClick: () => {
            if (!rows.length) { UI.toast('Choose a CSV file first', 'err'); return; }
            let added = 0, skipped = 0;
            rows.forEach(r => {
              if (M.products().some(p => U.deaccent(p.name) === U.deaccent(r.name))) { skipped++; return; }
              let catId = '';
              if (r.cat) {
                const c = M.categories().find(x => U.deaccent(x.name) === U.deaccent(r.cat));
                catId = c ? c.id : DB.put('categories', { name: r.cat }).id;
              }
              const p = DB.put('products', {
                name: r.name, categoryId: catId, unit: r.unit || 'Piece', buyRate: r.buy, saleRate: r.sale, mrp: r.mrp,
                buyGstMode: 'ex', saleGstMode: 'ex', hsn: r.hsn, gstRate: r.gst, lowStock: r.low, barcode: r.bar,
                brand: r.brand, colour: r.colour, size: r.size, remark: r.remark, storeId: M.currentStoreId()
              });
              if (r.qty) M.addMove({ productId: p.id, type: 'IN', qty: r.qty, unit: p.unit, rate: r.buy, source: 'opening', remark: 'Bulk upload opening stock', storeRef: 'store' });
              added++;
            });
            m.close(); UI.toast(added + ' products imported' + (skipped ? ', ' + skipped + ' duplicates skipped' : ''), 'ok'); App.refresh();
          }
        }
      ]
    });
  }

  /* ---------------------------------------------------------------- page */
  App.page('stock', {
    title: 'Stock Flow Report', crumb: 'Pages / Stock',
    render(c) {
      const s = M.settings();
      const rangeBtn = UI.dateRange(state, () => App.refresh());

      c.appendChild(el('div', { class: 'card card-pad mb16 flex ac gap10 wrap' }, [
        rangeBtn,
        el('span', { class: 'sp' }),
        el('button', { class: 'btn btn-ghost', html: '⬆ ' + T('Bulk Upload'), onclick: bulkModal }),
        el('button', { class: 'btn btn-ghost', html: '📄 ' + T('Report'), onclick: () => App.go('reports', { r: 'item-summary' }) })
      ]));

      /* rotating KPI slides */
      const sv = M.stockValue();
      const today = new Date();
      const todaySales = M.docs('SALE').filter(d => U.isoDate(d.at) === U.isoDate(today));
      const todayPur = M.docs('PURCHASE').filter(d => U.isoDate(d.at) === U.isoDate(today));
      const rangeMoves = DB.all('moves').filter(m => U.inRange(m.at, state.from, state.to));
      const slides = [
        [
          { label: 'Total Product :', value: String(M.products().length), cls: 'green', foot: 'All' },
          { label: 'Selling Product Price :', value: U.money(sv.sale), cls: 'red', foot: 'All' },
          { label: 'Purchased Product Price :', value: U.money(sv.buy), cls: '', foot: 'All' }
        ],
        [
          { label: 'Total Stock Qty :', value: U.qty(sv.qty), cls: 'green', foot: 'All (at present)' },
          { label: 'Total Out :', value: U.qty(U.sum(rangeMoves.filter(m => m.type === 'OUT'), m => m.qty)), cls: 'red', foot: U.rangeLabel(state.from, state.to) },
          { label: 'Total In :', value: U.qty(U.sum(rangeMoves.filter(m => m.type === 'IN'), m => m.qty)), cls: '', foot: U.rangeLabel(state.from, state.to) }
        ],
        [
          { label: "Today's Profit :", value: U.money(U.sum(todaySales, d => M.profitOf(d))), cls: 'green', foot: U.fmtDate(today) },
          { label: 'Sale :', value: U.money(U.sum(todaySales, d => d.total)), cls: 'red', foot: U.fmtDate(today) },
          { label: 'Purchase :', value: U.money(U.sum(todayPur, d => d.total)), cls: '', foot: U.fmtDate(today) }
        ]
      ];
      const slideBox = el('div', { class: matchMedia('(max-width:860px)').matches ? 'kpi-slide' : 'grid g3' });
      const dots = el('div', { class: 'flex jc gap6', style: { margin: '10px 0 16px' } });
      function paintSlide() {
        slideBox.innerHTML = '';
        slides[state.slide].forEach(k => slideBox.appendChild(el('div', { class: 'card card-pad' }, [
          el('div', { class: 'small muted', text: k.label }),
          el('div', { class: 'b ' + k.cls, style: { fontSize: '23px', margin: '4px 0 6px' }, text: k.value }),
          el('div', { class: 'small blue', text: k.foot })
        ])));
        dots.innerHTML = '';
        slides.forEach((_, i) => dots.appendChild(el('button', {
          style: { width: i === state.slide ? '20px' : '7px', height: '7px', borderRadius: '9px', border: 0, cursor: 'pointer', background: i === state.slide ? 'var(--gold-500)' : 'var(--border-2)' },
          onclick: () => { state.slide = i; paintSlide(); }
        })));
      }
      paintSlide();
      c.appendChild(slideBox); c.appendChild(dots);

      /* toolbar */
      const search = UI.input({ placeholder: T('Search product here!') + ' 🔍', value: state.q });
      search.addEventListener('input', U.debounce(() => { state.q = search.value; state.page = 1; paint(); }, 200));
      const catSel = UI.select([{ value: '', label: 'All' }].concat(M.categories().map(x => ({ value: x.id, label: x.name }))), state.cat);
      catSel.addEventListener('change', () => { state.cat = catSel.value; state.page = 1; paint(); });
      const sortSel = UI.select(SORTS, state.sort);
      sortSel.addEventListener('change', () => { state.sort = sortSel.value; paint(); });

      c.appendChild(el('div', { class: 'toolbar mb16' }, [
        el('div', { class: 'fld grow' }, [search]),
        el('button', { class: 'btn btn-blue', html: '＋ ' + T('Add Product').toUpperCase(), onclick: () => productModal() }),
        el('button', { class: 'btn btn-green', text: 'IN', onclick: () => moveModal('IN') }),
        el('button', { class: 'btn btn-red', text: 'OUT', onclick: () => moveModal('OUT') }),
        el('div', { class: 'fld' }, [el('label', { text: T('Category') }), catSel]),
        el('div', { class: 'fld' }, [el('label', { text: T('Filter By') }), sortSel])
      ]));

      const host = el('div');
      c.appendChild(host);
      state.rerender = paint;
      paint();

      function paint() {
        let rows = M.products();
        if (state.q) { const q = U.deaccent(state.q); rows = rows.filter(p => U.deaccent(p.name).indexOf(q) >= 0 || U.deaccent(p.barcode).indexOf(q) >= 0 || U.deaccent(M.categoryName(p.categoryId)).indexOf(q) >= 0); }
        if (state.cat) rows = rows.filter(p => p.categoryId === state.cat);
        const cmp = {
          recent: r => U.sortBy(r, p => p.createdAt || '', 'desc'),
          old: r => U.sortBy(r, p => p.createdAt || ''),
          az: r => U.sortBy(r, p => U.deaccent(p.name)),
          za: r => U.sortBy(r, p => U.deaccent(p.name), 'desc'),
          qhigh: r => U.sortBy(r, p => M.available(p.id), 'desc'),
          qlow: r => U.sortBy(r, p => M.available(p.id)),
          low: r => U.sortBy(r, p => M.available(p.id) - U.n(p.lowStock || s.lowStock))
        };
        rows = (cmp[state.sort] || cmp.recent)(rows);

        host.innerHTML = '';
        host.appendChild(UI.paginate(rows, state, slice => UI.table([
          {
            h: T('Product Name'), render: p => {
              const st = M.stock(p.id);
              const lowFlag = st.available <= U.n(p.lowStock || s.lowStock);
              return el('div', { class: 'cellname' }, [
                el('div', { class: 'thumb', style: { background: p.image ? 'none' : U.colorFor(p.name) }, html: p.image ? '<img src="' + p.image + '">' : U.initials(p.name) }),
                el('div', {}, [
                  el('b', { text: p.name }),
                  el('small', { html: (M.categoryName(p.categoryId) ? U.esc(M.categoryName(p.categoryId)) + ' · ' : '') + 'Today stock (' + U.fmtDate(new Date()) + ')' + (lowFlag ? ' <span class="badge b-amber">LOW</span>' : '') })
                ])
              ]);
            }
          },
          { h: T('Opening Stock'), cls: 'num', render: p => U.qty(M.stock(p.id, state.from, state.to).opening, p.unit) },
          { h: T('Total IN'), cls: 'num', render: p => '<span class="green">' + U.qty(M.stock(p.id, state.from, state.to).in, p.unit) + '</span>' },
          { h: T('Total Out'), cls: 'num', render: p => '<span class="red">' + U.qty(M.stock(p.id, state.from, state.to).out, p.unit) + '</span>' },
          { h: T('Available Stock'), cls: 'num', render: p => '<b>' + U.qty(M.available(p.id), p.unit) + '</b>' },
          {
            h: 'IN/OUT', cls: 'center', render: p => el('div', { class: 'flex gap6' }, [
              el('button', { class: 'btn btn-xs', style: { border: '1px solid var(--green)', color: 'var(--green)' }, text: 'IN', onclick: () => moveModal('IN', p.id) }),
              el('button', { class: 'btn btn-xs', style: { border: '1px solid var(--red)', color: 'var(--red)' }, text: 'OUT', onclick: () => moveModal('OUT', p.id) })
            ])
          },
          {
            h: T('Action'), cls: 'center', render: p => UI.rowMenu([
              { label: T('View Details'), icon: '👁', onClick: () => historyModal(p.id) },
              { label: T('Edit'), icon: '✏️', onClick: () => productModal(p.id) },
              { label: 'Print barcode', icon: '📼', onClick: () => App.go('barcode', { p: p.id }) },
              {
                label: T('Delete'), icon: '🗑', danger: true, onClick: async () => {
                  if (await UI.confirm('Delete “' + p.name + '” and all of its stock history?', { danger: true, ok: 'Delete' })) {
                    M.movesOf(p.id).forEach(m => DB.remove('moves', m.id));
                    DB.remove('products', p.id); UI.toast(T('Deleted'), 'ok'); App.refresh();
                  }
                }
              }
            ])
          }
        ], slice, {
          empty: state.q || state.cat ? 'No product matches this filter.' : 'No products yet — add your first one.',
          emptyAction: el('button', { class: 'btn btn-p mt14', text: '＋ ' + T('Add Product'), onclick: () => productModal() })
        })));
      }
    }
  });

  w.StockPage = { productModal, moveModal, historyModal, bulkModal };
})(window);
