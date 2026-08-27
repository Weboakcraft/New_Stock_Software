/* Page — All Reports */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI, App = w.App;
  const state = { r: 'low-stock', from: U.addDays(new Date(), -30), to: new Date() };

  const GROUPS = [
    {
      name: 'Items reports', items: [
        { k: 'low-stock', l: 'Low Stock Item' }, { k: 'expired', l: 'Expired Stock Item' },
        { k: 'sale-price', l: 'Item Sale Price' }, { k: 'purchase-price', l: 'Item Purchase Price' },
        { k: 'item-details', l: 'Item Details' }, { k: 'item-summary', l: 'Item Wise Stock Summary' }
      ]
    },
    {
      name: 'Sale & purchase', items: [
        { k: 'sp-summary', l: 'Item Wise Sale & Purchase' }, { k: 'party-summary', l: 'Party Wise Sales & Purchase' },
        { k: 'daybook', l: 'Day Book' }, { k: 'gst', l: 'GST Summary (GSTR-1 style)' },
        { k: 'profit', l: 'Profit & Loss' }, { k: 'valuation', l: 'Stock Valuation' },
        { k: 'outstanding', l: 'Outstanding Balances' }
      ]
    }
  ];

  function build(k) {
    const s = M.settings();
    const inR = d => U.inRange(d, state.from, state.to);
    switch (k) {
      case 'low-stock': {
        const rows = M.lowStockItems().map(p => [p.name, M.categoryName(p.categoryId), M.available(p.id) + ' ' + (p.unit || ''), U.n(p.buyRate), U.n(p.saleRate), U.n(p.lowStock || s.lowStock)]);
        return { title: 'Low Stock Report', head: ['Product name', 'Category', 'Avail stock', 'Buy rate', 'Sale price', 'Low-stock level'], rows, nums: [3, 4, 5] };
      }
      case 'expired': {
        const rows = M.expiredItems().map(p => [p.name, M.categoryName(p.categoryId), U.fmtDate(p.expiryDate), M.available(p.id) + ' ' + (p.unit || ''), U.n(p.buyRate) * M.available(p.id)]);
        return { title: 'Expired Stock Report', head: ['Product name', 'Category', 'Expired on', 'Avail stock', 'Value at buy rate'], rows, nums: [4] };
      }
      case 'sale-price': {
        const rows = M.products().map(p => [p.name, M.categoryName(p.categoryId), U.n(p.saleRate), U.n(p.mrp), p.saleGstMode === 'in' ? 'Incl. GST' : 'Excl. GST', U.n(p.gstRate)]);
        return { title: 'Item Sale Price', head: ['Product name', 'Category', 'Sale rate', 'MRP', 'GST mode', 'GST %'], rows, nums: [2, 3, 5] };
      }
      case 'purchase-price': {
        const rows = M.products().map(p => [p.name, M.categoryName(p.categoryId), U.n(p.buyRate), p.buyGstMode === 'in' ? 'Incl. GST' : 'Excl. GST', U.n(p.gstRate), U.n(p.hsn)]);
        return { title: 'Item Purchase Price', head: ['Product name', 'Category', 'Buy rate', 'GST mode', 'GST %', 'HSN'], rows, nums: [2, 4] };
      }
      case 'item-details': {
        const rows = M.products().map(p => [p.name, M.categoryName(p.categoryId), p.unit || '', p.hsn || '', U.n(p.gstRate), p.barcode || '', p.brand || '', p.colour || '', p.size || '', M.available(p.id)]);
        return { title: 'Item Details', head: ['Product name', 'Category', 'Unit', 'HSN', 'GST %', 'Barcode', 'Brand', 'Colour', 'Size', 'Available'], rows, nums: [4, 9] };
      }
      case 'item-summary': {
        const rows = M.products().map(p => {
          const st = M.stock(p.id, state.from, state.to);
          return [p.name, M.categoryName(p.categoryId), st.opening, st.in, st.out, M.available(p.id), U.round(M.available(p.id) * U.n(p.buyRate))];
        });
        return { title: 'Item Wise Stock Summary', head: ['Product name', 'Category', 'Opening', 'Total IN', 'Total OUT', 'Closing', 'Closing value'], rows, nums: [2, 3, 4, 5, 6] };
      }
      case 'sp-summary': {
        const map = {};
        M.docs().forEach(d => {
          if (!inR(d.at)) return;
          const cfg = M.DOC[d.dtype]; if (!cfg.stock) return;
          M.docItems(d.id).forEach(it => {
            const r = map[it.productId] = map[it.productId] || { name: it.name, sq: 0, sa: 0, pq: 0, pa: 0 };
            const amt = U.n(it.qty) * U.n(it.price);
            if (d.dtype === 'SALE') { r.sq += U.n(it.qty); r.sa += amt; }
            if (d.dtype === 'SALE_RETURN') { r.sq -= U.n(it.qty); r.sa -= amt; }
            if (d.dtype === 'PURCHASE') { r.pq += U.n(it.qty); r.pa += amt; }
            if (d.dtype === 'PURCHASE_RETURN') { r.pq -= U.n(it.qty); r.pa -= amt; }
          });
        });
        const rows = Object.keys(map).map(id => { const r = map[id]; return [r.name, U.round(r.sq), U.round(r.sa), U.round(r.pq), U.round(r.pa), U.round(r.sa - r.pa)]; });
        return { title: 'Item Wise Sale & Purchase', head: ['Product name', 'Sale qty', 'Sale amount', 'Purchase qty', 'Purchase amount', 'Difference'], rows, nums: [1, 2, 3, 4, 5] };
      }
      case 'party-summary': {
        const rows = M.parties().map(p => {
          const ds = DB.all('docs').filter(d => d.partyId === p.id && inR(d.at));
          const sale = U.sum(ds.filter(d => d.dtype === 'SALE'), d => d.total);
          const pur = U.sum(ds.filter(d => d.dtype === 'PURCHASE'), d => d.total);
          const pay = DB.all('payments').filter(x => x.partyId === p.id && inR(x.at));
          return [p.name, p.ptype, U.round(sale), U.round(pur), U.sum(pay.filter(x => x.kind === 'RECEIVE'), x => x.amount), U.sum(pay.filter(x => x.kind === 'PAY'), x => x.amount), M.partyBalance(p.id)];
        });
        return { title: 'Party Wise Sales & Purchase', head: ['Party', 'Type', 'Sales', 'Purchases', 'Received', 'Paid', 'Balance'], rows, nums: [2, 3, 4, 5, 6] };
      }
      case 'daybook': {
        const rows = [];
        M.docs().filter(d => inR(d.at)).forEach(d => rows.push([U.fmtDT(d.at), M.DOC[d.dtype].short, d.number, d.partyName || 'Cash', U.n(d.total), U.n(d.received), U.n(d.due)]));
        DB.all('payments').filter(p => inR(p.at) && !p.docId).forEach(p => rows.push([U.fmtDT(p.at), p.kind === 'RECEIVE' ? 'Receipt' : 'Payment', p.mode, (M.party(p.partyId) || {}).name || '—', U.n(p.amount), U.n(p.amount), 0]));
        return { title: 'Day Book', head: ['Date', 'Type', 'Number / mode', 'Party', 'Amount', 'Received / paid', 'Due'], rows: U.sortBy(rows, r => r[0]), nums: [4, 5, 6] };
      }
      case 'gst': {
        const map = {};
        M.docs('SALE').filter(d => inR(d.at)).forEach(d => {
          M.docItems(d.id).forEach(it => {
            const key = (it.hsn || '—') + '|' + U.n(it.gstRate);
            const r = map[key] = map[key] || { hsn: it.hsn || '—', rate: U.n(it.gstRate), taxable: 0, cgst: 0, sgst: 0, igst: 0, qty: 0 };
            const gross = U.n(it.qty) * U.n(it.price);
            const taxable = it.gstMode === 'in' ? gross / (1 + U.n(it.gstRate) / 100) : gross;
            const tax = taxable * U.n(it.gstRate) / 100;
            r.taxable += taxable; r.qty += U.n(it.qty);
            if (d.igst) r.igst += tax; else { r.cgst += tax / 2; r.sgst += tax / 2; }
          });
        });
        const rows = Object.keys(map).map(k2 => { const r = map[k2]; return [r.hsn, r.rate, U.round(r.qty), U.round(r.taxable), U.round(r.cgst), U.round(r.sgst), U.round(r.igst), U.round(r.taxable + r.cgst + r.sgst + r.igst)]; });
        return { title: 'GST Summary (HSN wise)', head: ['HSN', 'GST %', 'Qty', 'Taxable value', 'CGST', 'SGST', 'IGST', 'Total'], rows, nums: [1, 2, 3, 4, 5, 6, 7] };
      }
      case 'profit': {
        const sales = M.docs('SALE').filter(d => inR(d.at));
        const rows = sales.map(d => [U.fmtDate(d.at), d.number, d.partyName || 'Cash', U.n(d.taxable), U.round(U.n(d.taxable) - M.profitOf(d)), M.profitOf(d)]);
        return { title: 'Profit & Loss (sale wise)', head: ['Date', 'Bill no', 'Party', 'Sale value', 'Cost of goods', 'Profit'], rows, nums: [3, 4, 5] };
      }
      case 'valuation': {
        const rows = M.products().map(p => {
          const a = M.available(p.id);
          return [p.name, M.categoryName(p.categoryId), a, U.n(p.buyRate), U.round(a * U.n(p.buyRate)), U.n(p.saleRate), U.round(a * U.n(p.saleRate)), U.round(a * (U.n(p.saleRate) - U.n(p.buyRate)))];
        });
        return { title: 'Stock Valuation', head: ['Product', 'Category', 'Qty', 'Buy rate', 'Value at cost', 'Sale rate', 'Value at sale', 'Potential margin'], rows, nums: [2, 3, 4, 5, 6, 7] };
      }
      case 'outstanding': {
        const rows = M.parties().map(p => ({ p, b: M.partyBalance(p.id) })).filter(x => Math.abs(x.b) > 0.009)
          .map(x => [x.p.name, x.p.ptype, x.p.phone || '', Math.abs(x.b), x.b > 0 ? 'To receive' : 'To pay']);
        return { title: 'Outstanding Balances', head: ['Party', 'Type', 'Phone', 'Amount', 'Direction'], rows, nums: [3] };
      }
    }
    return { title: 'Report', head: [], rows: [] };
  }

  App.page('reports', {
    title: 'Report Details', crumb: 'Pages / Report',
    render(c) {
      if (App.params.r) state.r = App.params.r;
      const menu = el('div', { class: 'card', style: { alignSelf: 'flex-start' } });
      GROUPS.forEach(g => {
        menu.appendChild(el('div', { style: { background: 'var(--oak-700)', color: '#fff', padding: '11px 14px', fontWeight: 700, fontSize: '13px' }, text: g.name + ' ▾' }));
        g.items.forEach(it => menu.appendChild(el('button', {
          class: 'btn btn-block', style: {
            justifyContent: 'flex-start', borderRadius: 0, borderBottom: '1px solid var(--border)',
            background: state.r === it.k ? 'var(--sunk)' : 'transparent', fontWeight: state.r === it.k ? 700 : 500
          }, text: it.l, onclick: () => { state.r = it.k; App.go('reports', { r: it.k }); }
        })));
      });

      const rep = build(state.r);
      const right = el('div', { class: 'card' }, [
        el('div', { class: 'card-h' }, [
          el('h3', { text: rep.title }), el('span', { class: 'sp' }),
          UI.dateRange(state, () => App.refresh()),
          el('button', { class: 'btn btn-ghost btn-sm', html: '⬇ EXCEL', onclick: () => U.exportXLS('oakcraft-' + state.r, rep.title, rep.head, rep.rows) }),
          el('button', { class: 'btn btn-ghost btn-sm', html: '⬇ PDF', onclick: printIt })
        ])
      ]);
      right.appendChild(UI.table(rep.head.map((h, i) => ({
        h, cls: (rep.nums || []).indexOf(i) >= 0 ? 'num' : '',
        render: r => { const v = r[i]; return typeof v === 'number' ? (i && /amount|value|rate|price|balance|profit|cost|cgst|sgst|igst|taxable|margin|total/i.test(h) ? U.money(v) : U.round(v, 2)) : U.esc(v); }
      })), rep.rows, { dense: true, empty: 'Nothing to show for this report / period.' }));

      c.appendChild(el('div', { class: 'split' }, [menu, right]));

      function printIt() {
        const s = M.settings();
        const body = rep.rows.map((r, i) => '<tr><td>' + (i + 1) + '</td>' + r.map((v, j) => '<td' + ((rep.nums || []).indexOf(j) >= 0 ? ' class="num"' : '') + '>' + U.esc(typeof v === 'number' ? U.round(v, 2) : v) + '</td>').join('') + '</tr>').join('');
        UI.print('<style>' + w.BillPrint.css(s.billColour, 'basic') + '</style><div class="ocbill"><div class="hd">' +
          (s.logo ? '<img src="' + s.logo + '">' : '') +
          '<div class="biz"><h1>' + U.esc(s.bizName) + '</h1><div class="l">' + U.esc(s.address) + '<br>GSTIN: ' + U.esc(s.gstin || '') + '</div></div></div>' +
          '<div class="title">' + U.esc(rep.title.toUpperCase()) + '</div>' +
          '<div style="text-align:center;font-size:10.5px;margin-bottom:8px">' + U.rangeLabel(state.from, state.to) + '</div>' +
          '<table><thead><tr><th>#</th>' + rep.head.map(h => '<th>' + U.esc(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>' +
          '<div class="ft">Generated by Oakcraft Stock on ' + U.fmtDT(new Date()) + '</div></div>');
      }
    }
  });
})(window);
