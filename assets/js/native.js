/* Oakcraft Stock — Android app glue.
 *
 * Loaded by every copy of the app, browser and APK alike, but everything below
 * the guard only runs when the page is inside the Android wrapper. In a normal
 * browser this file does nothing at all, so the website keeps behaving exactly
 * as before.
 *
 * What it adds inside the APK:
 *   · downloads and PDF sharing go through Android instead of the browser
 *   · a camera scan button on every product / barcode box
 *   · fingerprint or screen-lock protection for the app
 *   · over-the-air updates of the web files, with an "App" card in Sync & Backup
 */
(function (w) {
  'use strict';

  var B = w.AndroidBridge;
  var isApp = false;
  try { isApp = !!(B && B.isApp && B.isApp()); } catch (e) { isApp = false; }
  w.OAK_NATIVE = isApp;
  if (!isApp) return;

  var U = w.U, el = U.el, UI = w.UI, App = w.App, M = w.M, DB = w.DB;

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }
  function bridge(name) {
    return function () {
      try { return B[name].apply(B, arguments); } catch (e) { return null; }
    };
  }

  /* ============================================================ file channel */
  /* A JavaScript-interface call is a Binder transaction, so a whole backup will
     not fit in one string. Files travel in 192 KB slices instead. */
  var CHUNK = 192 * 1024;

  function sendBlob(blob, name, action, extra) {
    return new Promise(function (resolve, reject) {
      var id = safe(function () { return B.blobBegin(name || 'file', blob.type || 'application/octet-stream'); }, '');
      if (!id) { reject(new Error('The app is busy with another file')); return; }
      var off = 0;
      function step() {
        if (off >= blob.size) {
          var ok = safe(function () { return B.blobEnd(id, action, JSON.stringify(extra || {})); }, false);
          if (ok) resolve(true); else reject(new Error('Android could not take the file'));
          return;
        }
        var fr = new FileReader();
        fr.onload = function () {
          var b64 = String(fr.result || '');
          b64 = b64.slice(b64.indexOf(',') + 1);
          var ok = safe(function () { return B.blobChunk(id, b64); }, false);
          if (!ok) { bridge('blobAbort')(id); reject(new Error('Transfer failed')); return; }
          off += CHUNK;
          setTimeout(step, 0);
        };
        fr.onerror = function () { bridge('blobAbort')(id); reject(new Error('Could not read the file')); };
        fr.readAsDataURL(blob.slice(off, off + CHUNK));
      }
      step();
    });
  }

  /* ---- downloads: hand the bytes to Android, which puts them in Downloads ---- */
  var browserDownload = U.download;
  U.download = function (name, content, mime) {
    var blob = content instanceof Blob ? content
      : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    sendBlob(blob, name, 'save', {})['catch'](function (err) {
      UI.toast(err.message || 'Could not save the file', 'err');
      safe(function () { browserDownload(name, content, mime); });
    });
  };

  /* ============================================================ sharing bills */
  if (w.BillPrint && BillPrint.share) {
    var browserShare = BillPrint.share;
    BillPrint.share = function (docId) {
      try {
        var d = M.doc(docId);
        var cfg = (M.DOC && M.DOC[d.dtype]) || {};
        var label = ((cfg.label || 'Bill') + ' ' + (d.number || '')).trim();
        var html = BillPrint.html(docId, { forceA4: true });
        var text = BillPrint.textSummary(docId);
        var file = label.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'bill';
        UI.toast('Making the PDF…', 'ok', 1500);
        return sendBlob(new Blob([html], { type: 'text/html' }), file + '.pdf', 'pdfshare',
          { title: label, text: text })['catch'](function () { return browserShare(docId); });
      } catch (e) {
        return browserShare(docId);
      }
    };
  }

  /* ============================================================ barcode scan */
  var lastInput = null, scanTarget = null;

  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) lastInput = t;
    attachChipIfBarcode(t);
  });

  function startScan(input) {
    scanTarget = input || lastInput;
    if (!bridge('scan')()) { /* the bridge reports its own failure */ }
  }

  function scanChip(input) {
    var b = el('button', {
      type: 'button', class: 'oak-scan', title: 'Scan with the camera',
      html: '<span>▣</span>'
    });
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function (e) { e.preventDefault(); startScan(input); });
    return b;
  }

  /* product pickers that mention a barcode get the button inside the box */
  if (UI && UI.picker) {
    var basePicker = UI.picker;
    UI.picker = function (opts) {
      var wrap = basePicker.apply(this, arguments);
      var ph = (opts && opts.placeholder) || '';
      if (/barcode|scan/i.test(ph) && wrap && wrap.input) {
        wrap.classList.add('oak-has-scan');
        wrap.appendChild(scanChip(wrap.input));
      }
      return wrap;
    };
  }

  /* plain "Enter barcode" fields get one next to them the first time they focus */
  function attachChipIfBarcode(t) {
    if (!t || t.tagName !== 'INPUT' || t.__oakScan) return;
    if (!/barcode/i.test(t.placeholder || '')) return;
    if (t.closest && t.closest('.pick')) return;
    t.__oakScan = true;
    var holder = t.parentNode;
    if (!holder) return;
    var chip = scanChip(t);
    chip.classList.add('oak-scan--inline');
    if (holder.parentNode && holder.parentNode.classList.contains('flex')) {
      holder.parentNode.insertBefore(chip, holder.nextSibling);
    } else {
      holder.appendChild(chip);
    }
  }

  /* ============================================================ callbacks from Android */
  w.OakNative = {
    /* a scanned code is fed in exactly the way a USB / Bluetooth scanner would
       type it, so every screen that already handles a hardware scanner works */
    onScan: function (code) {
      var t = scanTarget || lastInput;
      scanTarget = null;
      if (!code) return;
      if (!t) { UI.toast('Scanned ' + code + ' — open a product box first', 'warn', 3200); return; }
      safe(function () { t.focus(); });
      t.value = code;
      t.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(function () {
        t.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
        }));
      }, 70);
      bridge('vibrate')(25);
    },

    onScanCancelled: function () { scanTarget = null; },

    onPullRefresh: function () {
      if (w.Sync && Sync.run) Sync.run();
      if (App && App.refresh) App.refresh();
    },

    onLockChanged: function (on) {
      var box = document.getElementById('oak-lock-switch');
      if (box) box.checked = on === '1';
    },

    onUpdateReady: function (version) {
      showUpdateBar(version);
    },

    /* safety net: a blob: download that slipped past U.download */
    captureBlobUrl: function (url, name, mime) {
      fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
        return sendBlob(blob, name || 'oakcraft-file', 'save', {});
      })['catch'](function () { UI.toast('Could not save that file', 'err'); });
    },

    /* the hardware back button asks here first */
    back: function () {
      if (document.body.classList.contains('drawer')) {
        document.body.classList.remove('drawer');
        return true;
      }
      if (document.querySelector('.menu')) { UI.closeMenus(); return true; }
      if (document.querySelector('.ovl')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      }
      return false;
    }
  };

  /* ============================================================ update banner */
  function showUpdateBar(version) {
    if (document.getElementById('oak-update-bar')) return;
    var bar = el('div', { id: 'oak-update-bar', class: 'oak-update-bar' }, [
      el('span', { text: 'A newer version is ready' + (version ? ' (' + version + ')' : '') }),
      el('button', { class: 'btn btn-p btn-sm', text: 'Reload now', onclick: function () { location.reload(); } }),
      el('button', { class: 'btn btn-ghost btn-sm', text: 'Later', onclick: function () { bar.remove(); } })
    ]);
    document.body.appendChild(bar);
  }

  /* the welcome modal asks the person to connect a Google Sheet, which makes no
     sense when the build already carries one */
  if (App && App.welcome) {
    var baseWelcome = App.welcome;
    App.welcome = function () { if (!readSyncConfig()) return baseWelcome.apply(this, arguments); };
  }

  /* ============================================================ theme colour */
  function pushTheme() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var meta = document.querySelector('meta[name=theme-color]');
    var hex = (meta && meta.getAttribute('content')) || (dark ? '#14100c' : '#241a13');
    bridge('setThemeColor')(hex, dark);
  }
  safe(function () {
    new MutationObserver(pushTheme).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });
  });

  /* ============================================================ boot hook */
  if (App && App.boot) {
    var baseBoot = App.boot;
    App.boot = function () {
      var r = baseBoot.apply(this, arguments);
      Promise.resolve(r)['catch'](function () { })['then'](function () {
        return applySyncConfig();
      })['catch'](function () { })['then'](function () {
        bridge('appReady')();
        pushTheme();
        dropServiceWorkers();
        if (LOCKED && App.el && App.route === 'sync') App.refresh();
      });
      return r;
    };
  }

  /* The APK serves the app from its own files, so a service worker left over
     from the website would only ever serve something staler. */
  function dropServiceWorkers() {
    safe(function () {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.getRegistrations().then(function (rs) {
        rs.forEach(function (r) { r.unregister(); });
      });
      if (w.caches && caches.keys) caches.keys().then(function (ks) { ks.forEach(function (k) { caches['delete'](k); }); });
    });
  }

  /* ============================================================ built-in sheet */
  /* When the APK was built with the company's sheet baked in, the app connects
     itself and the Sync & Backup screen stops asking for an address or a secret.
     Nothing is stored in the repository or on the website - the values live only
     inside this APK, injected from the build secrets. */
  var LOCKED = false;

  function readSyncConfig() {
    var raw = safe(function () { return B.syncConfig(); }, '');
    if (!raw) return null;
    var cfg = safe(function () { return JSON.parse(raw); }, null);
    if (!cfg || !cfg.url || !cfg.token) return null;
    return cfg;
  }

  async function applySyncConfig() {
    var cfg = readSyncConfig();
    if (!cfg) return false;
    LOCKED = !!cfg.locked;
    var changed = false;
    if (DB.getMeta('gasUrl', '') !== cfg.url) { await DB.setMeta('gasUrl', cfg.url); changed = true; }
    if (DB.getMeta('gasToken', '') !== cfg.token) { await DB.setMeta('gasToken', cfg.token); changed = true; }
    if (changed && w.Sync) Sync.run();
    return true;
  }

  /* replace the "Google Sheet backend" card with a short locked notice */
  function lockSyncCard(container) {
    if (!LOCKED || !container) return;
    var cards = container.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      if (!/Google Sheet backend/i.test(cards[i].textContent || '')) continue;
      var card = cards[i];
      card.innerHTML = '';

      var status = el('div', { class: 'small muted mt8' });
      function paint() {
        var last = DB.getMeta('lastSyncAt', '');
        var pend = w.Sync ? Sync.pendingCount() : 0;
        status.innerHTML = 'Last sync ' + (last ? U.esc(U.ago(last)) : 'never') +
          ' · <b>' + pend + '</b> record(s) waiting to upload' +
          (w.Sync && Sync.lastError ? '<br><span class="red">' + U.esc(Sync.lastError) + '</span>' : '');
      }
      paint();
      if (w.Sync) Sync.on(paint);

      card.appendChild(UI.sect('Company sheet'));
      card.appendChild(el('div', {
        class: 'small',
        html: 'This app is already connected to the company Google Sheet. There is nothing to set up here, and the address cannot be changed from the app.'
      }));
      card.appendChild(el('div', { class: 'flex gap10 wrap mt14' }, [
        el('button', {
          class: 'btn btn-p btn-sm', text: '⟳ Sync now',
          onclick: function () { if (w.Sync) Sync.run({ loud: true }); }
        }),
        el('button', {
          class: 'btn btn-ghost btn-sm', text: '⬇ Re-download everything',
          onclick: async function () {
            try { await Sync.pullAll(); UI.toast('Downloaded from the sheet', 'ok'); }
            catch (e) { UI.toast(e.message, 'err'); }
          }
        })
      ]));
      card.appendChild(status);
      break;
    }
  }

  /* ============================================================ Sync & Backup card */
  if (App && App.render) {
    var baseRender = App.render;
    App.render = function () {
      var r = baseRender.apply(this, arguments);
      if (App.route === 'sync') {
        try { lockSyncCard(App.el.pageEl); } catch (e) { }
        try { appCard(App.el.pageEl); } catch (e) { }
      }
      return r;
    };
  }

  function appCard(container) {
    if (!container) return;
    var info = safe(function () { return JSON.parse(B.updateInfo()); }, {}) || {};
    var lockOk = safe(function () { return B.lockAvailable(); }, false);
    var lockOn = safe(function () { return B.lockEnabled(); }, false);

    var urlInput = UI.input({ value: info.url || '', placeholder: 'https://your-name.github.io/your-repo' });

    var lockSwitch = el('input', { type: 'checkbox', id: 'oak-lock-switch' });
    lockSwitch.checked = !!lockOn;
    lockSwitch.disabled = !lockOk;
    lockSwitch.addEventListener('change', function () {
      bridge('setLockEnabled')(lockSwitch.checked);
    });

    var card = el('div', { class: 'card card-pad frm mt14' }, [
      UI.sect('Android app'),
      el('div', {
        class: 'small muted',
        html: 'App version <b>' + U.esc(info.appVersion || '?') + '</b> · screens version <b>' +
          U.esc(info.webVersion || '?') + '</b> · ' +
          (info.usingDownloaded ? 'using downloaded files' : 'using the files built into the app')
      }),

      el('label', { class: 'check mt14' }, [
        lockSwitch,
        el('span', { text: lockOk
          ? 'Lock the app with fingerprint, face or screen lock'
          : 'App lock needs a screen lock or fingerprint set up on this phone' })
      ]),

      UI.field('Where to look for updates', urlInput, {
        hint: 'Your GitHub Pages address. Leave it empty to switch automatic updates off.'
      }),
      el('div', { class: 'flex gap10 wrap' }, [
        el('button', {
          class: 'btn btn-ghost btn-sm', text: 'Save address',
          onclick: function () { bridge('setUpdateUrl')(urlInput.value.trim()); }
        }),
        el('button', {
          class: 'btn btn-p btn-sm', text: '⟳ Check for update',
          onclick: function () { bridge('checkForUpdate')(); }
        }),
        el('button', {
          class: 'btn btn-ghost btn-sm', text: 'Use built-in files',
          onclick: async function () {
            if (await UI.confirm('Throw away the downloaded screens and go back to the ones built into the app? Your stock and billing data is not touched.')) {
              bridge('resetWebFiles')();
            }
          }
        })
      ]),
      info.lastNote ? el('div', { class: 'small muted mt8', text: 'Last check: ' + info.lastNote }) : null
    ]);

    /* the web page's own "Check for update" button pokes the service worker,
       which the APK does not use - the Android card below replaces it */
    Array.prototype.slice.call(container.querySelectorAll('button')).forEach(function (b) {
      if (/check for update/i.test(b.textContent || '')) b.remove();
    });

    /* drop it beside the existing "App" card in the right-hand column */
    var cols = container.querySelectorAll('.grid.g2 > div');
    var host = cols.length > 1 ? cols[cols.length - 1] : container;
    host.appendChild(card);
  }

  /* ============================================================ styles */
  var css = document.createElement('style');
  css.textContent = [
    '.oak-scan{position:absolute;right:6px;top:50%;transform:translateY(-50%);z-index:3;',
    '  width:34px;height:34px;border:0;border-radius:9px;cursor:pointer;',
    '  background:var(--sunk);color:var(--gold-600);font-size:17px;line-height:1;',
    '  display:flex;align-items:center;justify-content:center}',
    '.oak-scan:active{background:var(--gold-200)}',
    '.oak-has-scan .inp{padding-right:46px}',
    '.oak-scan--inline{position:static;transform:none;width:44px;height:40px;',
    '  background:var(--sunk);border:1px solid var(--border)}',
    '.oak-update-bar{position:fixed;left:12px;right:12px;bottom:calc(12px + var(--safe-b));z-index:400;',
    '  display:flex;align-items:center;gap:10px;flex-wrap:wrap;',
    '  background:var(--card);border:1px solid var(--border);border-radius:14px;',
    '  box-shadow:var(--shadow-2);padding:12px 14px;font-size:13.5px;color:var(--fg)}',
    '.oak-update-bar span{flex:1;min-width:140px}',
    '@media(max-width:900px){.oak-update-bar{bottom:calc(70px + var(--safe-b))}}'
  ].join('\n');
  document.head.appendChild(css);

})(window);
