/* Oakcraft Stock — service worker (offline shell + auto update) */
const VERSION = 'oakcraft-stock-v1.1.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './offline.html',
  './assets/css/app.css',
  './assets/img/logo.svg', './assets/img/icon-192.png', './assets/img/icon-512.png', './assets/img/icon-maskable.png',
  './assets/js/util.js', './assets/js/i18n.js', './assets/js/db.js', './assets/js/api.js', './assets/js/sync.js',
  './assets/js/model.js', './assets/js/seed.js', './assets/js/ui.js', './assets/js/charts.js',
  './assets/js/barcode.js', './assets/js/qrcode.js', './assets/js/app.js', './assets/js/print.js',
  './assets/js/pages/dashboard.js', './assets/js/pages/party.js', './assets/js/pages/stock.js',
  './assets/js/pages/docs.js', './assets/js/pages/misc.js', './assets/js/pages/barcode.js',
  './assets/js/pages/reports.js', './assets/js/pages/settings.js',
  './assets/js/native.js',
  './gas/Code.gs'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never touch the Apps Script POSTs
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // let cross-origin through untouched

  /* navigations: network first so a new deploy shows up, cache as the safety net */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./offline.html')))
    );
    return;
  }

  /* assets: stale-while-revalidate */
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
