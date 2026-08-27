/* Pages — Sale / Purchase documents: lists + the bill builder */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI, App = w.App;

  const EXTRA_COLS = [
    { key: 'brand', label: 'Brand' }, { key: 'size', label: 'Size' }, { key: 'colour', label: 'Colour' },
    { key: 'serialNo', label: 'Serial No' }, { key: 'batchNo', label: 'Batch No' },
    { key: 'mfgDate', label: 'Mfg Date' }, { key: 'expDate', label: 'Exp Date' }
  ];

  /* ================================================================ list page */
  function listPage(dtype) {
    const cfg = M.DOC[dtype];
    const state = { q: '', tab: 'all', page: 1, per: 25, from: U.addDays(new Date(), -30), to: new Date() };
    return {
      title: cfg.label + ' Details', crumb: 'Pages / ' + cfg.label,
      render(c) {
        const rangeBtn = UI.dateRange(state, () => App.refresh());
        const search = UI.input({ placeholder: 'Search by party / bill no / product', value: state.q });
        search.addEventListener('input', U.debounce(() => { state.q = search.value; state.page = 1; paint(); }, 200));

        c.appendChild(el('div', { class: 'card card-pad mb16 flex ac gap10 wrap' }, [
          rangeBtn,
          el('div', { class: 'sp', style: { minWidth: '180px' } }, [search]),
          el('button', { class: 'btn btn-ghost', html: '⚙ ' + T('Settings'), onclick: () => App.go('billsetting') }),
          el('button', { class: 'btn btn-green', html: '＋ Create ' + cfg.short, onclick: () => App.go('doc', { id: 'new', type: dtype }) })
        ]));

        const rows0 = () => {
          let r = M.docs(dtype).filter(d => U.inRange(d.at, state.from, state.to));
          if (state.q) {
            const q = U.deaccent(state.q);
            r = r.filter(d => U.deaccent(d.partyName).indexOf(q) >= 0 || U.deaccent(d.number).indexOf(q) >= 0 ||
              M.docItems(d.id).some(i => U.deaccent(i.name).indexOf(q) >= 0));
          }
          return U.sortBy(r, d => d.at, 'desc');
        };
        const all = rows0();
        const totAmt = U.sum(all, d => d.total), totDue = U.sum(all, d => d.due), totRec = U.sum(all, d => d.received);
        if (cfg.pay) c.appendChild(el('div', { class: 'grid g3 mb16' }, [
          el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: 'Total ' + cfg.short }), el('div', { class: 'b', style: { fontSize: '21px' }, text: U.money(totAmt) })]),
          el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: T('Total Due Amount') }), el('div', { class: 'b red', style: { fontSize: '21px' }, text: U.money(totDue) })]),
          el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: dtype === 'PURCHASE' ? 'Total Paid Amount' : T('Total Received Amount') }), el('div', { class: 'b green', style: { fontSize: '21px' }, text: U.money(totRec) })])
        ]));

        const tabs = el('div', { class: 'chips' });
        const TABS = cfg.pay
          ? [{ k: 'all', l: 'All ' + cfg.short }, { k: 'due', l: 'Unpaid & partially paid' }, { k: 'paid', l: 'Paid' }]
          : [{ k: 'all', l: 'All ' + cfg.short }, { k: 'open', l: 'Open' }, { k: 'done', l: 'Completed' }];
        TABS.forEach(t => tabs.appendChild(el('button', {
          class: 'chip' + (state.tab === t.k ? ' on' : ''), text: t.l,
          onclick: () => { state.tab = t.k; state.page = 1; App.refresh(); }
        })));
        c.appendChild(tabs);

        const host = el('div'); c.appendChild(host);
        state.rerender = paint; paint();

        function paint() {
          let rows = rows0();
          if (state.tab === 'due') rows = rows.filter(d => U.n(d.due) > 0.009);
          if (state.tab === 'paid') rows = rows.filter(d => U.n(d.due) <= 0.009);
          if (state.tab === 'open') rows = rows.filter(d => d.status !== 'DONE');
          if (state.tab === 'done') rows = rows.filter(d => d.status === 'DONE');
          host.innerHTML = '';
          host.appendChild(UI.paginate(rows, state, slice => UI.table([
            { h: 'Date & time', render: d => U.fmtDT(d.at) },
            { h: cfg.short + ' number', render: d => '<b>' + U.esc(d.number) + '</b>' },
            { h: 'Party / customer', render: d => U.esc(d.partyName || 'Cash') },
            { h: T('Total Amount'), cls: 'num', render: d => U.money(d.total) },
            cfg.pay ? { h: T('Due Amount'), cls: 'num', render: d => U.n(d.due) > 0.009 ? '<span class="red b">' + U.money(d.due) + '</span>' : '—' } : null,
            {
              h: 'Status', render: d => {
                if (!cfg.pay) return '<span class="badge b-blue">' + U.esc(d.status || 'OPEN') + '</span>';
                const map = { PAID: 'b-green', PARTIAL: 'b-amber', UNPAID: 'b-red' };
                return '<span class="badge ' + (map[d.status] || 'b-grey') + '">' + U.esc(d.status) + '</span>';
              }
            },
            {
              h: T('Action'), cls: 'center', render: d => UI.rowMenu([
                { label: 'View / print', icon: '🖨', onClick: () => w.BillPrint.preview(d.id) },
                { label: T('Edit'), icon: '✏️', onClick: () => App.go('doc', { id: d.id }) },
                { label: 'Share', icon: '📤', onClick: () => w.BillPrint.share(d.id) },
                cfg.pay ? { label: 'Add payment', icon: '💰', onClick: () => w.PartyPage.payModal(cfg.pay, d.partyId) } : null,
                dtype === 'QUOTATION' || dtype === 'SALE_ORDER' ? { label: 'Convert to sale bill', icon: '➡️', onClick: () => convert(d, 'SALE') } : null,
                dtype === 'PURCHASE_ORDER' ? { label: 'Convert to purchase bill', icon: '➡️', onClick: () => convert(d, 'PURCHASE') } : null,
                {
                  label: T('Delete'), icon: '🗑', danger: true, onClick: async () => {
                    if (await UI.confirm('Delete ' + cfg.short + ' ' + d.number + '? Stock and payments from it are reversed.', { danger: true, ok: 'Delete' })) { M.deleteDoc(d.id); UI.toast(T('Deleted'), 'ok'); App.refresh(); }
                  }
                }
              ])
            }
          ].filter(Boolean), slice, {
            empty: 'No ' + cfg.short.toLowerCase() + ' in this period.',
            emptyAction: el('button', { class: 'btn btn-p mt14', text: '＋ Create ' + cfg.short, onclick: () => App.go('doc', { id: 'new', type: dtype }) })
          })));
        }
      }
    };
  }

  function convert(d, toType) {
    const items = M.docItems(d.id).map(i => Object.assign({}, i, { id: undefined, docId: undefined }));
    const nd = Object.assign({}, d, { id: undefined, dtype: toType, number: M.nextNumber(toType), at: U.now(), linkedDocId: d.id, received: 0, payMode: 'Cash' });
    const saved = M.saveDoc(nd, items);
    DB.put('docs', { id: d.id, status: 'DONE' });
    UI.toast('Converted to ' + M.DOC[toType].label + ' ' + saved.number, 'ok');
    App.go('doc', { id: saved.id });
  }

  Object.keys(M.DOC).forEach(k => App.page(M.DOC[k].route, listPage(k)));

  /* ================================================================ builder */
  App.page('doc', {
    title: 'Create bill', crumb: 'Pages / Billing',
    render(c) {
      const isNew = App.params.id === 'new' || !App.params.id;
      const existing = isNew ? null : M.doc(App.params.id);
      const dtype = existing ? existing.dtype : (App.params.type || 'SALE');
      const cfg = M.DOC[dtype];
      const s = M.settings();
      App.el.crumb.querySelector('b').textContent = (existing ? 'Edit ' : 'Create ') + cfg.label;

      const doc = existing ? U.clone(existing) : {
        dtype, number: M.nextNumber(dtype), at: U.now(), partyId: App.params.party || '',
        discountMode: 'flat', discountValue: 0, charges: [], received: 0, payMode: 'Cash',
        remark: '', terms: s.terms, interState: false
      };
      let items = existing ? M.docItems(existing.id).map(i => U.clone(i)) : [];

      /* ---- header controls ---- */
      const partyPick = UI.picker({
        placeholder: 'Select party (optional)',
        items: M.parties().filter(p => !cfg.party || p.ptype === cfg.party || true).map(p => ({ id: p.id, label: p.name, sub: p.ptype + (p.phone ? ' · ' + p.phone : ''), right: U.money(Math.abs(M.partyBalance(p.id))) })),
        onCreate: (name, pick) => w.PartyPage.partyModal(null, rec => { partyPick.setItems(M.parties().map(p => ({ id: p.id, label: p.name, sub: p.ptype }))); pick({ id: rec.id, label: rec.name }); doc.partyId = rec.id; recalc(); }),
        onPick: i => { doc.partyId = i.id; const p = DB.get('parties', i.id); doc.interState = !!(p && p.state && s.state && U.deaccent(p.state) !== U.deaccent(s.state)); recalc(); }
      });
      if (doc.partyId) { const p = DB.get('parties', doc.partyId); if (p) partyPick.setValue({ id: p.id, label: p.name }); }
      const dtInput = UI.input({ type: 'datetime-local', value: U.isoLocal(doc.at) });
      dtInput.addEventListener('change', () => doc.at = new Date(dtInput.value).toISOString());
      const numInput = UI.input({ value: doc.number });
      numInput.addEventListener('input', () => doc.number = numInput.value);

      const catSel = UI.select([{ value: '', label: 'All categories' }].concat(M.categories().map(x => ({ value: x.id, label: x.name }))), '');
      const prodPick = UI.picker({
        placeholder: '🔍  Search product & barcode', clearAfterPick: true,
        items: productItems(''),
        onPick: i => addItem(i.id),
        onEnter: v => { const p = M.productByBarcode(v); if (p) addItem(p.id); }
      });
      catSel.addEventListener('change', () => prodPick.setItems(productItems(catSel.value)));
      function productItems(cat) {
        return M.products().filter(p => !cat || p.categoryId === cat).map(p => ({
          id: p.id, label: p.name, sub: (M.categoryName(p.categoryId) || '') + (p.barcode ? ' · ' + p.barcode : ''),
          right: '<b>' + U.money(cfg.stock === 'IN' ? p.buyRate : p.saleRate) + '</b><br>' + U.qty(M.available(p.id), p.unit)
        }));
      }

      /* ---- items table ---- */
      const cols = () => (s.extraCols || []).map(k => EXTRA_COLS.find(x => x.key === k)).filter(Boolean).concat((s.customCols || []).map(n => ({ key: 'c_' + n, label: n, custom: true })));
      const itemsHost = el('div', { class: 'tbl-scroll' });

      function addItem(productId) {
        const p = DB.get('products', productId); if (!p) return;
        const exist = items.find(i => i.productId === productId);
        if (exist) { exist.qty = U.n(exist.qty) + 1; }
        else items.push({
          productId: p.id, name: p.name, hsn: p.hsn || s.defHsn, qty: 1, unit: p.unit || 'Piece',
          price: U.n(cfg.stock === 'IN' ? p.buyRate : p.saleRate), gstMode: (cfg.stock === 'IN' ? p.buyGstMode : p.saleGstMode) || 'ex',
          gstRate: U.n(p.gstRate == null ? s.defGst : p.gstRate), mrp: U.n(p.mrp),
          brand: p.brand || '', size: p.size || '', colour: p.colour || '', serialNo: '', batchNo: '', mfgDate: '', expDate: p.expiryDate || '', desc: ''
        });
        paintItems(); recalc();
      }

      function paintItems() {
        const extra = cols();
        const t = el('table', { class: 'items-tbl' });
        const hr = el('tr');
        ['#', 'Product name', 'HSN', 'Quantity'].forEach(h => hr.appendChild(el('th', { text: h })));
        extra.forEach(x => hr.appendChild(el('th', { text: x.label })));
        if (s.showMRP) hr.appendChild(el('th', { text: 'MRP' }));
        hr.appendChild(el('th', {}, [el('span', { text: 'Price ' }), gstModeToggle()]));
        hr.appendChild(el('th', { text: 'GST (%) / unit' }));
        hr.appendChild(el('th', { class: 'num', text: 'Amount' }));
        hr.appendChild(el('th', { text: '' }));
        t.appendChild(el('thead', {}, [hr]));
        const tb = el('tbody');
        items.forEach((it, ix) => {
          const tr = el('tr');
          tr.appendChild(el('td', { text: String(ix + 1) }));
          const nameI = el('input', { value: it.name }); nameI.addEventListener('input', () => it.name = nameI.value);
          tr.appendChild(el('td', {}, [nameI]));
          const hsnI = el('input', { value: it.hsn || '', style: { width: '78px' } }); hsnI.addEventListener('input', () => it.hsn = hsnI.value);
          tr.appendChild(el('td', {}, [hsnI]));
          const qtyI = el('input', { type: 'number', step: '0.01', value: it.qty, class: 'w-qty num' });
          qtyI.addEventListener('input', () => { it.qty = U.n(qtyI.value); recalc(); });
          const unitS = el('select', { style: { width: '84px' } });
          M.units().forEach(u => { const o = el('option', { value: u, text: u }); if (u === it.unit) o.selected = true; unitS.appendChild(o); });
          unitS.addEventListener('change', () => it.unit = unitS.value);
          tr.appendChild(el('td', {}, [el('div', { class: 'flex gap6' }, [qtyI, unitS])]));
          extra.forEach(x => {
            const key = x.key;
            const inp = el('input', { value: it[key] || '', type: /Date$/.test(key) ? 'date' : 'text' });
            inp.addEventListener('input', () => it[key] = inp.value);
            tr.appendChild(el('td', {}, [inp]));
          });
          if (s.showMRP) { const mI = el('input', { type: 'number', value: it.mrp || '', class: 'w-rate num' }); mI.addEventListener('input', () => it.mrp = U.n(mI.value)); tr.appendChild(el('td', {}, [mI])); }
          const priceI = el('input', { type: 'number', step: '0.01', value: it.price, class: 'w-rate num' });
          priceI.addEventListener('input', () => { it.price = U.n(priceI.value); recalc(); });
          tr.appendChild(el('td', {}, [priceI]));
          const gstS = el('select', { class: 'w-gst' });
          M.GST_RATES.forEach(r => { const o = el('option', { value: r, text: r === 0 ? 'No tax' : r + '%' }); if (U.n(it.gstRate) === r) o.selected = true; gstS.appendChild(o); });
          gstS.addEventListener('change', () => { it.gstRate = U.n(gstS.value); recalc(); });
          tr.appendChild(el('td', {}, [gstS]));
          const amtTd = el('td', { class: 'num b', text: U.money(U.n(it.qty) * U.n(it.price)) });
          it._amtTd = amtTd;
          tr.appendChild(amtTd);
          tr.appendChild(el('td', {}, [el('button', { class: 'btn btn-xs btn-ghost', html: '✕', title: 'Remove', onclick: () => { items.splice(ix, 1); paintItems(); recalc(); } })]));
          tb.appendChild(tr);
        });
        if (!items.length) {
          tb.appendChild(el('tr', {}, [el('td', { colspan: 20, class: 'muted', style: { padding: '22px', textAlign: 'center' } }, ['Search a product above (or scan a barcode) to add the first line.'])]));
        }
        t.appendChild(tb);
        itemsHost.innerHTML = ''; itemsHost.appendChild(t);
      }
      function gstModeToggle() {
        const sel = el('select', { style: { width: 'auto', display: 'inline-block', fontSize: '10.5px' } });
        [['ex', 'Without GST'], ['in', 'With GST']].forEach(([v, l]) => { const o = el('option', { value: v, text: l }); if ((items[0] ? items[0].gstMode : 'ex') === v) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', () => { items.forEach(i => i.gstMode = sel.value); recalc(); });
        return sel;
      }

      /* ---- totals ---- */
      const remarkI = UI.textarea({ placeholder: 'Add remark…', value: doc.remark });
      remarkI.addEventListener('input', () => doc.remark = remarkI.value);
      const termsI = UI.textarea({ placeholder: 'Enter terms & conditions here!', value: doc.terms });
      termsI.addEventListener('input', () => doc.terms = termsI.value);
      const totBox = el('div', { class: 'totbox' });
      const recvChk = el('input', { type: 'checkbox' }); recvChk.checked = U.n(doc.received) > 0 || isNew;
      const recvI = UI.input({ type: 'number', step: '0.01', value: doc.received || 0 });
      const modeS = UI.select(M.PAY_MODES, doc.payMode || 'Cash');
      recvI.addEventListener('input', () => { doc.received = U.n(recvI.value); recalc(); });
      modeS.addEventListener('change', () => doc.payMode = modeS.value);
      recvChk.addEventListener('change', () => { if (!recvChk.checked) { recvI.value = 0; doc.received = 0; } recalc(); });

      function recalc() {
        const calc = M.calcDoc(doc, items);
        items.forEach(it => { if (it._amtTd) it._amtTd.textContent = U.money(it.amount); });
        totBox.innerHTML = '';
        const r = (a, b, cls) => el('div', { class: 'r ' + (cls || '') }, [el('span', { text: a }), el('b', { html: b })]);
        totBox.appendChild(r(T('Sub total') + ' (' + items.length + ' items)', U.money(calc.subTotal)));
        totBox.appendChild(el('div', { class: 'r' }, [
          el('button', { class: 'linkbtn', html: '➕ ' + T('Add Extra Charges'), onclick: chargesModal }),
          el('button', { class: 'linkbtn', html: '➕ ' + T('Add Discount'), onclick: discountModal })
        ]));
        if (calc.discount) totBox.appendChild(r('Discount' + (doc.discountMode === 'pct' ? ' (' + doc.discountValue + '%)' : ''), '- ' + U.money(calc.discount), 'red'));
        (doc.charges || []).forEach(ch => totBox.appendChild(r(ch.name + (ch.gst ? ' (GST ' + ch.gst + '%)' : ''), U.money(ch.amount))));
        totBox.appendChild(r(T('Taxable Amount'), U.money(calc.taxable)));
        if (calc.igst) totBox.appendChild(r('IGST', U.money(calc.igst)));
        else { if (calc.cgst) totBox.appendChild(r('CGST', U.money(calc.cgst))); if (calc.sgst) totBox.appendChild(r('SGST', U.money(calc.sgst))); }
        if (calc.roundOff) totBox.appendChild(r('Round off', U.money(calc.roundOff)));
        totBox.appendChild(r(T('Total Amount'), U.money(calc.total), 'grand'));
        if (cfg.pay) {
          totBox.appendChild(el('div', { class: 'r' }, [
            el('label', { class: 'check' }, [recvChk, el('span', { text: dtype === 'PURCHASE' ? 'Paid amount' : T('Received Amount') })]),
            el('div', { class: 'flex gap6', style: { maxWidth: '260px' } }, [el('div', { class: 'pfx' }, [el('span', { class: 'lab', text: '₹' }), recvI]), modeS])
          ]));
          totBox.appendChild(r(T('Due Amount'), '<span class="' + (calc.due > 0 ? 'red' : 'green') + '">' + U.money(calc.due) + '</span>'));
        }
        recvI.disabled = !recvChk.checked;
      }

      function discountModal() {
        const mode = UI.select([{ value: 'flat', label: '₹ Flat amount' }, { value: 'pct', label: '% Percent' }], doc.discountMode);
        const val = UI.input({ type: 'number', step: '0.01', value: doc.discountValue || '' });
        const m = UI.modal({
          title: T('Add Discount'), size: 'narrow',
          body: UI.row(2, [UI.field('Type', mode), UI.field('Value', val)]),
          buttons: [{ label: 'Apply', cls: 'btn-p', onClick: () => { doc.discountMode = mode.value; doc.discountValue = U.n(val.value); m.close(); recalc(); } }]
        });
      }
      function chargesModal() {
        const list = el('div');
        function paint() {
          list.innerHTML = '';
          (doc.charges || []).forEach((ch, i) => list.appendChild(el('div', { class: 'flex gap6 ac mb10' }, [
            el('div', { class: 'sp', text: ch.name }), el('b', { text: U.money(ch.amount) }),
            el('button', { class: 'btn btn-xs btn-ghost', html: '✕', onclick: () => { doc.charges.splice(i, 1); paint(); recalc(); } })
          ])));
          if (!(doc.charges || []).length) list.appendChild(el('p', { class: 'muted small', text: 'No extra charges added.' }));
        }
        paint();
        const nm = UI.input({ placeholder: 'e.g. Freight / Packing / Installation' });
        const am = UI.input({ type: 'number', step: '0.01', placeholder: '0.00' });
        const gs = UI.select(M.GST_RATES.map(r => ({ value: r, label: r === 0 ? 'No tax' : r + '%' })), 0);
        const m = UI.modal({
          title: T('Add Extra Charges'), size: 'narrow',
          body: el('div', { class: 'frm' }, [
            list, UI.sect('Add a charge'),
            UI.field('Charge name', nm), UI.row(2, [UI.field('Amount', am), UI.field('GST on charge', gs)])
          ]),
          buttons: [
            { label: T('Close'), cls: 'btn-ghost', onClick: () => m.close() },
            { label: 'Add', cls: 'btn-p', onClick: () => { if (!nm.value.trim() || !U.n(am.value)) return; doc.charges = doc.charges || []; doc.charges.push({ name: nm.value.trim(), amount: U.n(am.value), gst: U.n(gs.value) }); nm.value = ''; am.value = ''; paint(); recalc(); } }
          ]
        });
      }

      function save(preview) {
        if (!items.length) { UI.toast('Add at least one product', 'err'); return; }
        if (!doc.number.trim()) { UI.toast('Bill number is required', 'err'); return; }
        doc.at = new Date(dtInput.value || Date.now()).toISOString();
        doc.received = recvChk.checked ? U.n(recvI.value) : 0;
        doc.payMode = modeS.value;
        const saved = M.saveDoc(doc, items);
        UI.toast(cfg.label + ' ' + saved.number + ' saved', 'ok');
        if (preview) w.BillPrint.preview(saved.id);
        else App.go(cfg.route);
      }

      /* ---- layout ---- */
      c.appendChild(el('div', { class: 'card card-pad' }, [
        el('div', { class: 'doc-head' }, [
          el('button', { class: 'icon-btn', html: '←', title: 'Back', onclick: () => history.back() }),
          el('h2', { text: (existing ? 'Edit ' : 'Create ') + cfg.label }),
          el('button', { class: 'btn btn-blue', text: T('Save'), onclick: () => save(false) }),
          el('button', { class: 'btn btn-p', text: 'Save & preview', onclick: () => save(true) })
        ]),
        el('div', { class: 'row r3' }, [
          UI.field(el('span', {}, [T('Party') + '  ', el('button', { class: 'linkbtn', text: '＋ ' + T('Add Party'), onclick: () => w.PartyPage.partyModal(null, rec => { partyPick.setItems(M.parties().map(p => ({ id: p.id, label: p.name, sub: p.ptype }))); partyPick.setValue({ id: rec.id, label: rec.name }); doc.partyId = rec.id; recalc(); }) })]), partyPick),
          UI.field(T('Billing Date/Time'), dtInput),
          UI.field(cfg.short + ' number', numInput)
        ]),
        el('div', { class: 'row r2 mt14' }, [
          UI.field(T('Category'), catSel),
          UI.field(el('span', {}, ['Select product   ', el('button', { class: 'linkbtn', text: '👁 View products', onclick: () => App.go('stock') })]), prodPick)
        ]),
        el('div', { class: 'flex jb ac mt14' }, [
          el('span', { class: 'small muted', text: items.length + ' line item(s)' }),
          el('button', { class: 'linkbtn', html: '⚙ customize column', onclick: () => App.go('billsetting') })
        ]),
        itemsHost,
        el('div', { class: 'grid g2 mt20' }, [
          el('div', {}, [UI.field(T('Remark'), remarkI), el('div', { class: 'mt14' }, [UI.field(T('Term & Condition'), termsI)])]),
          el('div', { class: 'card card-pad' }, [totBox])
        ])
      ]));
      paintItems(); recalc();
    }
  });

  w.DocPages = { EXTRA_COLS, convert };
})(window);
