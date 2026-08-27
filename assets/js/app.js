/* Oakcraft Stock — application shell, router and boot */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI;

  const App = {
    pages: {},
    route: '',
    params: {},
    el: {},
    page(name, def) { App.pages[name] = def; return App; },

    NAV: [
      { r: 'dashboard', label: 'Dashboard', ic: '🏠' },
      { r: 'party', label: 'Party', ic: '👥' },
      { r: 'stock', label: 'Stock', ic: '🗄️' },
      { r: 'entries', label: 'All Entry & Bills', ic: '🧾' },
      {
        group: 'Sale', ic: '💹', items: [
          { r: 'sale-invoice', label: 'Sale Invoice' },
          { r: 'quotation', label: 'Quotation' },
          { r: 'sale-order', label: 'Sale Order' },
          { r: 'sales-return', label: 'Sales Return' }
        ]
      },
      {
        group: 'Purchase', ic: '🛍️', items: [
          { r: 'purchase-invoice', label: 'Purchase Invoice' },
          { r: 'purchase-order', label: 'Purchase Order' },
          { r: 'purchase-return', label: 'Purchase Return' }
        ]
      },
      { r: 'transaction', label: 'Transaction', ic: '🔁' },
      { r: 'ratelist', label: 'Rate List', ic: '📋' },
      { r: 'barcode', label: 'Barcode Generator', ic: '📼' },
      { r: 'reports', label: 'All Reports', ic: '📊' },
      { sep: 'Settings' },
      { r: 'members', label: 'Member management', ic: '👤' },
      { r: 'categories', label: 'Category management', ic: '🏷️' },
      { r: 'stores', label: 'Store management', ic: '🏬' },
      { r: 'billsetting', label: 'Bill / Invoice Setting', ic: '🧮' },
      { r: 'profile', label: 'Profile', ic: '🪪' },
      { r: 'sync', label: 'Sync & Backup', ic: '☁️' }
    ],
    TABS: [
      { r: 'dashboard', label: 'Home', ic: '🏠' },
      { r: 'stock', label: 'Stock', ic: '🗄️' },
      { r: 'sale-invoice', label: 'Sale', ic: '🧾' },
      { r: 'party', label: 'Party', ic: '👥' },
      { r: 'reports', label: 'More', ic: '☰' }
    ],

    /* ---------------- chrome ---------------- */
    buildChrome() {
      const s = M.settings();
      const root = U.$('#app');
      root.innerHTML = '';

      /* sidebar */
      const nav = el('nav', { class: 'nav' });
      App.NAV.forEach(item => {
        if (item.sep) { nav.appendChild(el('div', { class: 'nav__label', text: T(item.sep) })); return; }
        if (item.group) {
          const chev = el('span', { class: 'chev', text: '›' });
          const sub = el('div', { class: 'sub' });
          item.items.forEach(x => sub.appendChild(el('a', { href: '#/' + x.r, 'data-r': x.r }, [el('span', { class: 'ic', text: '·' }), T(x.label)])));
          const btn = el('button', { class: 'navitem', type: 'button' }, [el('span', { class: 'ic', text: item.ic }), el('span', { text: T(item.group) }), chev]);
          btn.addEventListener('click', () => { sub.classList.toggle('open'); chev.classList.toggle('open'); });
          item._sub = sub; item._chev = chev;
          nav.appendChild(btn); nav.appendChild(sub);
          return;
        }
        nav.appendChild(el('a', { href: '#/' + item.r, 'data-r': item.r }, [el('span', { class: 'ic', text: item.ic }), T(item.label)]));
      });

      const storeSel = el('select');
      const syncPill = el('button', { class: 'sync-pill' }, [el('i', { class: 'sync-dot' }), el('span', { text: 'Sync' })]);
      syncPill.addEventListener('click', () => App.go('sync'));

      const side = el('aside', { class: 'sidebar' }, [
        el('div', { class: 'sidebar__brand' }, [
          el('img', { src: s.logo || './assets/img/logo.svg', alt: 'Oakcraft', onerror: function () { this.src = './assets/img/logo.svg'; } }),
          el('div', {}, [el('b', { text: s.bizName || 'OAKCRAFT' }), el('span', { text: 'Stock & Billing' })])
        ]),
        el('div', { class: 'store-pick' }, [storeSel]),
        nav,
        el('div', { class: 'sidebar__foot' }, [syncPill])
      ]);

      /* topbar */
      const crumb = el('div', { class: 'crumb' }, [el('span', { text: 'Pages' }), el('b', { text: '' })]);
      const burger = el('button', { class: 'burger', html: '☰', onclick: () => document.body.classList.toggle('drawer') });
      const themeBtn = el('button', { class: 'icon-btn', title: 'Light / dark', html: '◐', onclick: App.toggleTheme });
      const langBtn = el('button', { class: 'icon-btn', title: 'English / Hinglish', text: T.get() === 'hi' ? 'हि' : 'EN', onclick: () => { T.set(T.get() === 'hi' ? 'en' : 'hi'); location.reload(); } });
      const top = el('header', { class: 'topbar' }, [
        burger, crumb, el('div', { class: 'topbar__sp' }),
        langBtn, themeBtn,
        el('div', { class: 'who' }, [el('div', { class: 'av', text: U.initials(s.ownerName) }), el('span', { class: 'mobile-hide', text: s.ownerName || 'Admin' })])
      ]);

      const pageEl = el('main', { class: 'page' });
      const main = el('div', { class: 'main' }, [top, pageEl]);

      const tabs = el('nav', { class: 'tabbar' });
      App.TABS.forEach(t => tabs.appendChild(el('a', { href: '#/' + t.r, 'data-t': t.r }, [el('span', { class: 'ic', text: t.ic }), el('span', { text: t.label })])));

      root.appendChild(side); root.appendChild(main);
      document.body.appendChild(tabs);

      App.el = { side, nav, pageEl, crumb, storeSel, syncPill, tabs };
      App.paintStores();
      storeSel.addEventListener('change', () => { M.setStore(storeSel.value); App.refresh(); UI.toast('Switched to ' + (M.currentStore().name || 'store')); });

      U.on(document, 'click', 'a[href^="#/"]', () => document.body.classList.remove('drawer'));
      w.Sync && Sync.on(App.paintSync);
      App.paintSync();
    },

    paintStores() {
      const sel = App.el.storeSel; if (!sel) return;
      const list = M.stores(), cur = M.currentStoreId();
      sel.innerHTML = '';
      list.forEach(s => { const o = el('option', { value: s.id, text: s.name }); if (s.id === cur) o.selected = true; sel.appendChild(o); });
      if (!list.length) sel.appendChild(el('option', { text: 'Main Store' }));
    },

    paintSync() {
      const p = App.el.syncPill; if (!p || !w.Sync) return;
      const dot = p.querySelector('.sync-dot'), lab = p.querySelector('span');
      const pend = Sync.pendingCount();
      const map = {
        ok: ['ok', pend ? pend + ' to sync' : T('Synced')],
        syncing: ['busy', T('Syncing…')],
        error: ['err', 'Sync error'],
        offline: ['off', T('Offline')],
        off: ['off', 'Connect Google Sheet'],
        idle: ['off', pend ? pend + ' unsynced' : 'Not synced yet']
      };
      const [cls, text] = map[Sync.state] || map.idle;
      dot.className = 'sync-dot ' + cls;
      lab.textContent = text;
    },

    toggleTheme() {
      const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', cur);
      try { localStorage.setItem('oc_theme', cur); } catch (e) { }
      const mt = document.querySelector('meta[name=theme-color]');
      if (mt) mt.setAttribute('content', cur === 'dark' ? '#14100c' : '#241a13');
    },

    /* ---------------- routing ---------------- */
    parse() {
      const h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
      const [path, qs] = h.split('?');
      const parts = path.split('/').filter(Boolean);
      App.route = parts[0] || 'dashboard';
      App.params = { id: parts[1] || '' };
      if (qs) new URLSearchParams(qs).forEach((v, k) => App.params[k] = v);
    },

    go(route, params) {
      let h = '#/' + route;
      if (params && params.id) h += '/' + params.id;
      const q = Object.keys(params || {}).filter(k => k !== 'id');
      if (q.length) h += '?' + q.map(k => k + '=' + encodeURIComponent(params[k])).join('&');
      if (location.hash === h) App.render(); else location.hash = h;
    },

    render() {
      App.parse();
      const def = App.pages[App.route] || App.pages.dashboard;
      const c = App.el.pageEl;
      c.innerHTML = '';
      U.$$('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('data-r') === App.route));
      U.$$('.tabbar a').forEach(a => a.classList.toggle('active', a.getAttribute('data-t') === App.route));
      App.NAV.forEach(g => { if (g.group && g.items.some(i => i.r === App.route)) { g._sub.classList.add('open'); g._chev.classList.add('open'); } });
      App.el.crumb.querySelector('b').textContent = T(def.title || '');
      App.el.crumb.querySelector('span').textContent = def.crumb || 'Pages';
      document.title = (def.title ? T(def.title) + ' · ' : '') + 'Oakcraft Stock';
      try { def.render(c); } catch (e) { console.error(e); c.appendChild(el('div', { class: 'card card-pad' }, ['Something went wrong on this screen: ' + e.message])); }
      w.scrollTo(0, 0);
      UI.closeMenus();
    },

    refresh: U.debounce(function () {
      App.paintStores(); App.paintSync();
      if (App.el.pageEl) App.render();
    }, 120),

    /* ---------------- boot ---------------- */
    async boot() {
      /* Theme order of precedence: what the person chose here > what the host page
         already stamped on <html> > the operating system's own setting. */
      try {
        const saved = localStorage.getItem('oc_theme');
        const stamped = document.documentElement.getAttribute('data-theme');
        const sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', saved || stamped || sys);
      } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
      T.init();
      await DB.init();
      w.Seed && Seed.ensure();
      App.buildChrome();
      addEventListener('hashchange', App.render);
      App.render();
      DB.on('change', () => { App.paintSync(); });
      w.Sync && Sync.start();
      /* service worker */
      if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
        navigator.serviceWorker.register('./sw.js').catch(() => { });
      }
      /* first run helper */
      if (!DB.getMeta('seenWelcome')) { DB.setMeta('seenWelcome', 1); setTimeout(App.welcome, 700); }
    },

    welcome() {
      UI.modal({
        title: 'Welcome to Oakcraft Stock', size: 'narrow',
        body: el('div', {}, [
          el('p', { html: 'Everything works right now and is saved on this device.' }),
          el('p', { class: 'small muted', html: 'To keep the same data on your phone, laptop and staff devices, connect your <b>Google Sheet</b> once from <b>Sync &amp; Backup</b>. Setup takes about 3 minutes and is free.' })
        ]),
        buttons: [
          { label: 'Later', cls: 'btn-ghost', onClick: m => m.close() },
          { label: 'Connect Google Sheet', cls: 'btn-p', onClick: m => { m.close(); App.go('sync'); } }
        ]
      });
    }
  };

  w.App = App;
  document.addEventListener('DOMContentLoaded', () => App.boot());
})(window);
