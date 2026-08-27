/* Page — Dashboard */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI, App = w.App, C = w.Charts;

  App.page('dashboard', {
    title: 'Dashboard Details', crumb: 'Pages / Dashboard',
    render(c) {
      const prods = M.products();
      const sv = M.stockValue();
      const low = M.lowStockItems(), exp = M.expiredItems();

      c.appendChild(el('div', { class: 'flex ac jb wrap gap10 mb16' }, [
        el('div', {}, [el('h2', { style: { fontSize: '17px' }, text: 'Welcome, ' + (M.settings().ownerName || 'Admin') }),
          el('div', { class: 'small muted', text: U.fmtDate(new Date()) + ' · ' + M.currentStore().name })]),
        el('div', { class: 'flex ac gap10 wrap' }, [
        el('button', { class: 'btn btn-ghost btn-sm', html: '＋ ' + T('Add Product'), onclick: () => w.StockPage.productModal() }),
        el('button', { class: 'btn btn-p btn-sm', html: '🧾 ' + T('Create Sale / Bill'), onclick: () => App.go('doc', { id: 'new', type: 'SALE' }) })
        ])
      ]));

      /* KPIs */
      const kpis = el('div', { class: 'grid g4 mb16' }, [
        UI.kpi({ label: T('Total Product'), value: String(prods.length), icon: '📦', bg: 'bg-oak', foot: '<em class="green">+' + prods.length + '</em> ' + T('Available Product') }),
        UI.kpi({ label: T('Total Quantity'), value: U.qty(sv.qty), icon: '📊', bg: 'bg-green', foot: '<em class="green">' + U.money(sv.sale) + '</em> stock value at sale rate' }),
        UI.kpi({ label: T('Total Low Stock'), value: String(low.length), icon: '📥', bg: 'bg-amber', foot: '<em class="amber">' + low.length + '</em> ' + T('Total Low Product') }),
        UI.kpi({ label: T('Total Expired'), value: String(exp.length), icon: '⏳', bg: 'bg-red', foot: '<em class="red">' + exp.length + '</em> ' + T('Total Expired Product') })
      ]);
      c.appendChild(kpis);

      /* charts */
      const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const today = new Date(), dow = (today.getDay() + 6) % 7;
      const weekQty = [], weekAmt = [];
      for (let i = 0; i < 7; i++) {
        const d = U.addDays(today, i - dow);
        const sales = M.docs('SALE').filter(x => U.isoDate(x.at) === U.isoDate(d));
        let q = 0; sales.forEach(s => M.docItems(s.id).forEach(it => q += U.n(it.qty)));
        weekQty.push(U.round(q)); weekAmt.push(U.sum(sales, s => s.total));
      }
      let inStock = 0, outStock = 0, availStock = 0;
      prods.forEach(p => {
        const st = M.stock(p.id);
        inStock += st.in; outStock += st.out; availStock += Math.max(0, st.available);
      });
      const months = U.MON.slice();
      const yr = today.getFullYear();
      const monthQty = months.map((mn, i) => {
        const rows = M.docs('SALE').filter(x => { const d = U.dt(x.at); return d.getFullYear() === yr && d.getMonth() === i; });
        let q = 0; rows.forEach(s => M.docItems(s.id).forEach(it => q += U.n(it.qty)));
        return U.round(q);
      });

      function chartCard(topBg, svg, title, sub, legend) {
        const b = el('div', { class: 'chart-b' }, [
          el('h4', { text: title }), el('p', { text: sub }), legend || null,
          el('div', { class: 'upd', html: '🕘 just updated' })
        ]);
        const t = el('div', { class: 'chart-top', style: { background: topBg } });
        t.appendChild(svg);
        return el('div', { class: 'chart-card' }, [t, b]);
      }
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      c.appendChild(el('div', { class: 'grid g3 mb16' }, [
        chartCard('linear-gradient(135deg,#4a3425,#241a13)', C.bar(days, weekQty, { colour: '#e8d8b6' }), T('Weekly Sale Qty'), 'Weekly sale performance (qty)'),
        chartCard('linear-gradient(135deg,#25a06a,#12724a)',
          C.donut([
            { value: availStock, colour: '#f5d67b' },
            { value: inStock, colour: '#7cc8ff' },
            { value: outStock, colour: '#ff9aa8' }
          ], { centre: U.qty(sv.qty), centreSub: 'in hand' }),
          T('All Item Stock details'), 'Stock performance details',
          el('div', { class: 'legend' }, [
            el('span', { html: '<i style="background:#f5d67b"></i>Avail stock' }),
            el('span', { html: '<i style="background:#7cc8ff"></i>In Stock' }),
            el('span', { html: '<i style="background:#ff9aa8"></i>Out Stock' })
          ])),
        chartCard('linear-gradient(135deg,#2b2018,#14100c)', C.line(months, monthQty, { colour: '#c9a227' }), T('Monthly Sale Qty'), 'Quarterly / monthly sale performance')
      ]));

      /* recent transactions */
      const moves = U.sortBy(DB.all('moves'), m => m.at, 'desc').slice(0, 100);
      const card = el('div', { class: 'card' }, [
        el('div', { class: 'card-h' }, [
          el('h3', { text: T('Transaction') }),
          el('span', { class: 'sp' }),
          el('button', { class: 'linkbtn', text: 'See full transaction ›', onclick: () => App.go('transaction') })
        ])
      ]);
      card.appendChild(UI.table([
        {
          h: T('Product Name'), render: m => {
            const p = DB.get('products', m.productId);
            return el('div', { class: 'cellname' }, [
              el('div', { class: 'thumb', style: { background: U.colorFor(p ? p.name : '?') }, text: U.initials(p ? p.name : '?') }),
              el('div', {}, [el('b', { text: p ? p.name : 'Deleted item' }), el('small', { text: U.fmtDT(m.at) })])
            ]);
          }
        },
        { h: 'Type', cls: 'center', render: m => m.type === 'IN' ? '<span class="green b">↑ IN</span>' : '<span class="red b">↓ OUT</span>' },
        { h: T('Quantity'), cls: 'num', render: m => U.qty(m.qty, m.unit || 'Piece') },
        { h: 'Trans', render: m => m.partyId ? U.esc((M.party(m.partyId) || {}).name || '--') : (m.storeRef === 'store' ? M.currentStore().name : '--') },
        { h: 'Entry by', render: m => U.esc(m.by || 'Admin') }
      ], moves, { empty: 'No stock movement yet — add a product or make a sale.', dense: true }));
      c.appendChild(card);
    }
  });
})(window);
