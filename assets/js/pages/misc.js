/* Pages — All Entry & Bills, Transaction history, Rate List */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI, App = w.App;

  /* ================================================================ All Entry & Bills */
  const CHIPS = [
    { k: 'ALL', l: 'All' }, { k: 'SALE', l: 'Sale' }, { k: 'PURCHASE', l: 'Purchase' },
    { k: 'TO_RECEIVE', l: 'To receive' }, { k: 'TO_PAY', l: 'To pay' },
    { k: 'STORE_IN', l: 'Store in' }, { k: 'STORE_OUT', l: 'Store out' },
    { k: 'PAY_IN', l: 'Pay in' }, { k: 'PAY_OUT', l: 'Pay out' },
    { k: 'QUOTATION', l: 'Quotation' }, { k: 'SALE_ORDER', l: 'Sale order' }, { k: 'PURCHASE_ORDER', l: 'Purchase order' }
  ];
  const eState = { chip: 'ALL', q: '', from: U.addDays(new Date(), -6), to: new Date(), page: 1, per: 20 };

  App.page('entries', {
    title: 'Full Entry Details', crumb: 'Pages / All Entry & Bills',
    render(c) {
      const mStart = U.monthStart(), mNow = new Date();
      const monthSales = M.docs('SALE').filter(d => U.inRange(d.at, mStart, mNow));
      const monthProfit = U.sum(monthSales, d => M.profitOf(d));
      let profitShown = false;
      const profitEl = el('div', { class: 'b', style: { fontSize: '20px' } }, [
        el('button', { class: 'linkbtn', html: 'View profit 👁', onclick: e => { profitShown = !profitShown; e.target.closest('div').innerHTML = profitShown ? '<span class="green">' + U.money(monthProfit) + '</span>' : ''; if (!profitShown) e.target.closest('div').appendChild(el('button', { class: 'linkbtn', html: 'View profit 👁' })); } })
      ]);
      profitEl.addEventListener('click', () => { profitShown = true; profitEl.innerHTML = '<span class="green">' + U.money(monthProfit) + '</span>'; });

      c.appendChild(el('div', { class: 'grid g2 mb16' }, [
        el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: U.MON[mNow.getMonth()] + ' month sale' }), el('div', { class: 'b', style: { fontSize: '22px' }, text: U.money(U.sum(monthSales, d => d.total)) })]),
        el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: U.MON[mNow.getMonth()] + ' month profit' }), profitEl])
      ]));

      const search = UI.input({ placeholder: '🔍 ' + T('Search') + ' (party / bill / product)', value: eState.q });
      search.addEventListener('input', U.debounce(() => { eState.q = search.value; eState.page = 1; paint(); }, 220));
      c.appendChild(el('div', { class: 'card card-pad mb16 flex ac gap10 wrap' }, [
        el('div', { class: 'sp', style: { minWidth: '190px' } }, [search]),
        UI.dateRange(eState, () => App.refresh()),
        el('button', { class: 'btn btn-red', text: 'PURCHASE', onclick: () => App.go('doc', { id: 'new', type: 'PURCHASE' }) }),
        el('button', { class: 'btn btn-green', text: 'SALE / BILL', onclick: () => App.go('doc', { id: 'new', type: 'SALE' }) })
      ]));

      const chips = el('div', { class: 'chips' });
      CHIPS.forEach(x => chips.appendChild(el('button', { class: 'chip' + (eState.chip === x.k ? ' on' : ''), text: x.l, onclick: () => { eState.chip = x.k; eState.page = 1; App.refresh(); } })));
      c.appendChild(chips);

      const host = el('div', { class: 'grid g2' }); c.appendChild(host);
      eState.rerender = paint; paint();

      function paint() {
        let list = M.entries(eState.from, eState.to);
        if (eState.chip !== 'ALL') {
          list = list.filter(e => {
            if (eState.chip === 'TO_RECEIVE') return e.ref.due > 0 && (e.kind === 'SALE' || e.kind === 'PURCHASE_RETURN');
            if (eState.chip === 'TO_PAY') return e.ref.due > 0 && (e.kind === 'PURCHASE' || e.kind === 'SALE_RETURN');
            return e.kind === eState.chip;
          });
        }
        if (eState.q) {
          const q = U.deaccent(eState.q);
          list = list.filter(e => U.deaccent(JSON.stringify(e.ref)).indexOf(q) >= 0);
        }
        host.innerHTML = '';

        /* left — billing information cards */
        const left = el('div', { class: 'card' }, [el('div', { class: 'card-h' }, [el('h3', { text: 'Billing information' }), el('span', { class: 'sp' }), el('span', { class: 'small muted', text: list.length + ' entries' })])]);
        const body = el('div', { class: 'card-pad', style: { display: 'grid', gap: '12px' } });
        const slice = list.slice((eState.page - 1) * eState.per, eState.page * eState.per);
        if (!slice.length) body.appendChild(el('div', { class: 'empty' }, [el('span', { class: 'big', text: '🧾' }), 'No entries in this period.']));
        slice.forEach(e => body.appendChild(entryCard(e)));
        left.appendChild(body);
        if (list.length > eState.per) {
          const pg = el('div', { class: 'pager' });
          const pages = Math.ceil(list.length / eState.per);
          pg.appendChild(el('button', { text: '‹ Prev', onclick: () => { eState.page = Math.max(1, eState.page - 1); paint(); } }));
          pg.appendChild(el('span', { class: 'small muted', text: 'Page ' + eState.page + ' / ' + pages }));
          pg.appendChild(el('button', { text: 'Next ›', onclick: () => { eState.page = Math.min(pages, eState.page + 1); paint(); } }));
          left.appendChild(pg);
        }
        host.appendChild(left);

        /* right — all transactions feed */
        const moves = DB.all('moves').filter(m => U.inRange(m.at, eState.from, eState.to));
        const right = el('div', { class: 'card' }, [el('div', { class: 'card-h' }, [el('h3', { text: "All transaction's" }), el('span', { class: 'sp' }), el('span', { class: 'small muted', text: U.rangeLabel(eState.from, eState.to) })])]);
        const rb = el('div', { class: 'card-pad', style: { maxHeight: '620px', overflowY: 'auto', display: 'grid', gap: '10px' } });
        if (!moves.length) rb.appendChild(el('div', { class: 'empty' }, ['No stock movement in this period.']));
        U.sortBy(moves, m => m.at, 'desc').slice(0, 200).forEach(m => {
          const p = DB.get('products', m.productId);
          rb.appendChild(el('div', { class: 'flex ac gap10' }, [
            el('div', { class: 'thumb', style: { background: m.type === 'IN' ? 'var(--green-bg)' : 'var(--red-bg)', color: m.type === 'IN' ? 'var(--green)' : 'var(--red)' }, text: m.type === 'IN' ? '↓' : '↑' }),
            el('div', { class: 'sp' }, [el('b', { text: p ? p.name : 'Deleted item' }), el('div', { class: 'tiny muted', text: U.fmtDT(m.at) })]),
            el('b', { class: m.type === 'IN' ? 'green' : 'red', text: (m.type === 'IN' ? '+ ' : '- ') + U.qty(m.qty, m.unit || 'Piece') })
          ]));
        });
        right.appendChild(rb);
        host.appendChild(right);
      }

      function entryCard(e) {
        const r = e.ref;
        if (e.kind === 'PAY_IN' || e.kind === 'PAY_OUT') {
          const isIn = e.kind === 'PAY_IN';
          return el('div', { class: 'card card-pad' }, [
            el('div', { class: 'flex jb ac wrap gap6' }, [
              el('b', { class: isIn ? 'green' : 'red', text: '[ ' + (isIn ? 'Payment in' : 'Payment out') + ' ]' }),
              el('span', { class: 'small muted', text: 'By ' + (r.by || 'Admin') + ' · ' + U.fmtDT(r.at) })
            ]),
            el('div', { class: 'small mt8' }, ['Party: ', el('b', { text: (M.party(r.partyId) || {}).name || '—' })]),
            el('div', { class: 'small' }, ['Mode: ', el('b', { text: r.mode })]),
            el('div', { class: 'small' }, ['Amount: ', el('b', { text: U.money(r.amount) })]),
            r.remark ? el('div', { class: 'tiny muted', text: r.remark }) : null
          ]);
        }
        if (e.kind === 'STORE_IN' || e.kind === 'STORE_OUT') {
          const p = DB.get('products', r.productId);
          return el('div', { class: 'card card-pad' }, [
            el('div', { class: 'flex jb ac wrap gap6' }, [
              el('b', { class: e.kind === 'STORE_IN' ? 'green' : 'red', text: '[ ' + (e.kind === 'STORE_IN' ? 'Stock IN' : 'Stock OUT') + ' ]' }),
              el('span', { class: 'small muted', text: 'By ' + (r.by || 'Admin') + ' · ' + U.fmtDT(r.at) })
            ]),
            el('div', { class: 'small mt8' }, ['Product: ', el('b', { text: p ? p.name : '—' })]),
            el('div', { class: 'small' }, ['Quantity: ', el('b', { text: U.qty(r.qty, r.unit) })]),
            r.remark ? el('div', { class: 'tiny muted', text: r.remark }) : null
          ]);
        }
        const cfg = M.DOC[e.kind] || M.DOC.SALE;
        const items = M.docItems(r.id);
        const open = { v: false };
        const detail = el('div', { class: 'hide mt8' }, [
          UI.table([
            { h: '#', render: (x, i) => String(i + 1) },
            { h: 'Product', render: x => U.esc(x.name) },
            { h: 'Qty', cls: 'num', render: x => U.qty(x.qty, x.unit) },
            { h: 'Price', cls: 'num', render: x => U.money(x.price) },
            { h: 'Amount', cls: 'num', render: x => U.money(U.n(x.qty) * U.n(x.price)) }
          ], items, { dense: true })
        ]);
        const toggle = el('button', { class: 'btn btn-xs btn-ghost', text: '⌄ More details', onclick: () => { open.v = !open.v; detail.classList.toggle('hide', !open.v); toggle.textContent = open.v ? '⌃ Less details' : '⌄ More details'; } });
        return el('div', { class: 'card card-pad' }, [
          el('div', { class: 'flex jb ac wrap gap6' }, [
            el('b', { class: cfg.colour === 'green' ? 'green' : cfg.colour === 'red' ? 'red' : 'amber', text: '[ ' + cfg.short + ' ] · ' + r.number }),
            el('span', { class: 'small muted', text: 'By ' + (r.by || 'Admin') + ' · ' + U.fmtDT(r.at) })
          ]),
          el('div', { class: 'small mt8' }, ['Party: ', el('b', { text: r.partyName || 'No party' })]),
          cfg.pay ? el('div', { class: 'small' }, ['Status: ', el('span', { class: 'badge ' + (r.status === 'PAID' ? 'b-green' : r.status === 'PARTIAL' ? 'b-amber' : 'b-red'), text: r.status })]) : null,
          el('div', { class: 'small' }, ['Total products: ', el('b', { text: String(items.length) })]),
          el('div', { class: 'small' }, ['Total amount: ', el('b', { text: U.money(r.total) })]),
          e.kind === 'SALE' ? el('div', { class: 'small' }, ['Profit: ', el('b', { class: 'green', text: U.money(M.profitOf(r)) })]) : null,
          el('div', { class: 'flex gap6 mt8 wrap' }, [
            toggle,
            el('button', { class: 'btn btn-xs btn-ghost', html: '🖨 Print', onclick: () => w.BillPrint.preview(r.id) }),
            el('button', { class: 'btn btn-xs btn-ghost', html: '✏️ Edit', onclick: () => App.go('doc', { id: r.id }) }),
            el('button', { class: 'btn btn-xs btn-ghost', style: { color: 'var(--red)' }, html: '🗑 Delete', onclick: async () => { if (await UI.confirm('Delete ' + cfg.short + ' ' + r.number + '?', { danger: true, ok: 'Delete' })) { M.deleteDoc(r.id); UI.toast(T('Deleted'), 'ok'); App.refresh(); } } })
          ]),
          detail
        ]);
      }
    }
  });

  /* ================================================================ Transaction history */
  const tState = { q: '', type: 'all', from: U.addDays(new Date(), -30), to: new Date(), page: 1, per: 40 };
  App.page('transaction', {
    title: 'Transaction History', crumb: 'All product transaction history!',
    render(c) {
      const search = UI.input({ placeholder: T('Search product here!') + ' 🔍', value: tState.q });
      search.addEventListener('input', U.debounce(() => { tState.q = search.value; tState.page = 1; paint(); }, 200));
      const typeSel = UI.select([{ value: 'all', label: 'All' }, { value: 'IN', label: 'Only IN' }, { value: 'OUT', label: 'Only OUT' }], tState.type);
      typeSel.addEventListener('change', () => { tState.type = typeSel.value; tState.page = 1; paint(); });

      c.appendChild(el('div', { class: 'card card-pad mb16 flex ac gap10 wrap' }, [
        el('div', { class: 'sp', style: { minWidth: '190px' } }, [search]),
        typeSel,
        UI.dateRange(tState, () => App.refresh()),
        el('button', {
          class: 'btn btn-ghost', html: '⬇ Excel', onclick: () => {
            const rows = filtered().map(m => { const p = DB.get('products', m.productId); return [U.fmtDT(m.at), p ? p.name : '', m.type, U.n(m.qty), m.unit || '', U.n(m.rate), (M.party(m.partyId) || {}).name || '', m.source, m.remark || '', m.by || '']; });
            U.exportXLS('oakcraft-transactions', 'Transactions', ['Date', 'Product', 'Type', 'Qty', 'Unit', 'Rate', 'Party', 'Source', 'Remark', 'By'], rows);
          }
        })
      ]));
      const host = el('div'); c.appendChild(host);
      tState.rerender = paint; paint();

      function filtered() {
        let rows = DB.all('moves').filter(m => U.inRange(m.at, tState.from, tState.to));
        if (tState.type !== 'all') rows = rows.filter(m => m.type === tState.type);
        if (tState.q) {
          const q = U.deaccent(tState.q);
          rows = rows.filter(m => { const p = DB.get('products', m.productId); return p && U.deaccent(p.name).indexOf(q) >= 0; });
        }
        return U.sortBy(rows, m => m.at, 'desc');
      }
      function paint() {
        const rows = filtered();
        host.innerHTML = '';
        host.appendChild(UI.paginate(rows, tState, slice => UI.table([
          {
            h: 'Transaction', render: m => {
              const p = DB.get('products', m.productId);
              return el('div', { class: 'cellname' }, [
                el('div', { class: 'thumb', style: { background: U.colorFor(p ? p.name : '?') }, text: U.initials(p ? p.name : '?') }),
                el('div', {}, [el('b', { text: p ? p.name : 'Deleted item' }), el('small', { text: U.fmtDT(m.at) + (m.remark ? ' · ' + m.remark : '') })])
              ]);
            }
          },
          { h: 'Entry by', render: m => U.esc(m.by || 'Admin') },
          { h: T('Quantity'), cls: 'num', render: m => U.qty(m.qty, m.unit || 'Piece') },
          { h: 'Trans', render: m => m.partyId ? U.esc((M.party(m.partyId) || {}).name || '—') : (m.storeRef === 'store' ? M.currentStore().name : '—') },
          { h: 'Type', cls: 'center', render: m => m.type === 'IN' ? '<span class="green b">↑ IN</span>' : '<span class="red b">↓ OUT</span>' },
          {
            h: T('Action'), cls: 'center', render: m => UI.rowMenu([
              { label: 'Open product', icon: '👁', onClick: () => w.StockPage.historyModal(m.productId) },
              m.source === 'manual' || m.source === 'opening' ? {
                label: T('Delete'), icon: '🗑', danger: true, onClick: async () => {
                  if (await UI.confirm('Remove this stock entry? Product stock will be recalculated.', { danger: true, ok: 'Delete' })) { DB.remove('moves', m.id); UI.toast(T('Deleted'), 'ok'); App.refresh(); }
                }
              } : { label: 'Open bill', icon: '🧾', onClick: () => m.refId && w.BillPrint.preview(m.refId) }
            ])
          }
        ], slice, { dense: true, empty: 'No transactions in this period.' })));
      }
    }
  });

  /* ================================================================ Rate list */
  const rState = { q: '', page: 1, per: 30 };
  App.page('ratelist', {
    title: 'Rate List Details', crumb: 'Pages / Rate List',
    render(c) {
      const search = UI.input({ placeholder: T('Search product here!') + ' 🔍', value: rState.q });
      search.addEventListener('input', U.debounce(() => { rState.q = search.value; rState.page = 1; paint(); }, 200));
      c.appendChild(el('div', { class: 'card card-pad mb16 flex ac gap10 wrap' }, [
        el('div', { class: 'sp', style: { minWidth: '200px' } }, [search]),
        el('button', { class: 'btn btn-ghost', html: '🖨 Print rate list', onclick: printRates }),
        el('button', {
          class: 'btn btn-ghost', html: '⬇ Excel', onclick: () => U.exportXLS('oakcraft-rate-list', 'Rate list',
            ['Item', 'Category', 'Buy rate', 'Sale rate', 'MRP', 'Available qty', 'Unit'],
            list().map(p => [p.name, M.categoryName(p.categoryId), U.n(p.buyRate), U.n(p.saleRate), U.n(p.mrp), M.available(p.id), p.unit || '']))
        })
      ]));
      const host = el('div'); c.appendChild(host);
      rState.rerender = paint; paint();

      function list() {
        let rows = M.products();
        if (rState.q) { const q = U.deaccent(rState.q); rows = rows.filter(p => U.deaccent(p.name).indexOf(q) >= 0); }
        return U.sortBy(rows, p => U.deaccent(p.name));
      }
      function printRates() {
        const s = M.settings();
        const body = list().map((p, i) => '<tr><td>' + (i + 1) + '</td><td>' + U.esc(p.name) + '</td><td>' + U.esc(M.categoryName(p.categoryId)) + '</td><td style="text-align:right">' + U.money(p.saleRate) + '</td><td style="text-align:right">' + U.money(p.mrp) + '</td><td style="text-align:right">' + U.qty(M.available(p.id), p.unit) + '</td></tr>').join('');
        UI.print('<style>' + w.BillPrint.css(s.billColour, 'basic') + '</style><div class="ocbill"><div class="hd">' +
          (s.logo ? '<img src="' + s.logo + '">' : '') + '<div class="biz"><h1>' + U.esc(s.bizName) + '</h1><div class="l">' + U.esc(s.address) + '<br>' + U.esc(s.phone) + '</div></div></div>' +
          '<div class="title">RATE LIST · ' + U.fmtDate(new Date()) + '</div><table><thead><tr><th>#</th><th>Item</th><th>Category</th><th class="num">Sale rate</th><th class="num">MRP</th><th class="num">Available</th></tr></thead><tbody>' + body + '</tbody></table></div>');
      }
      function paint() {
        const rows = list();
        host.innerHTML = '';
        host.appendChild(UI.paginate(rows, rState, slice => UI.table([
          {
            h: 'Items', render: p => el('div', { class: 'cellname' }, [
              el('div', { class: 'thumb', style: { background: p.image ? 'none' : U.colorFor(p.name) }, html: p.image ? '<img src="' + p.image + '">' : U.initials(p.name) }),
              el('div', {}, [el('b', { text: p.name }), el('small', { text: M.categoryName(p.categoryId) || '' })])
            ])
          },
          { h: T('Buy Rate'), cls: 'num', render: p => U.money(p.buyRate) },
          { h: T('Sale Rate'), cls: 'num', render: p => '<b>' + U.money(p.saleRate) + '</b>' },
          { h: 'MRP', cls: 'num', render: p => U.money(p.mrp) },
          { h: 'Available quantity', cls: 'num', render: p => U.qty(M.available(p.id), p.unit) },
          {
            h: T('Action'), cls: 'center', render: p => el('button', { class: 'btn btn-xs btn-ghost', html: '👁 ' + T('View Details'), onclick: () => w.StockPage.historyModal(p.id) })
          }
        ], slice, { dense: true, empty: 'No products yet.' })));
      }
    }
  });
})(window);
