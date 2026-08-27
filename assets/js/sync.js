/* Oakcraft Stock — background sync engine (local-first, last-write-wins) */
(function (w) {
  'use strict';
  const U = w.U, DB = w.DB, API = w.API;

  const Sync = {
    state: 'idle',      // idle | syncing | ok | error | offline | off
    lastError: '',
    lastAt: null,
    listeners: [],
    running: false,
    queued: false,

    on(fn) { Sync.listeners.push(fn); return Sync; },
    emit() { Sync.listeners.forEach(f => { try { f(Sync); } catch (e) { } }); },
    set(state, err) { Sync.state = state; Sync.lastError = err || ''; Sync.emit(); },

    pendingCount() {
      let n = 0; DB.TABLES.forEach(t => n += DB.data[t].filter(r => r._dirty).length); return n;
    },

    async run(opts) {
      opts = opts || {};
      if (!API.configured()) { Sync.set('off'); return { skipped: true }; }
      if (!navigator.onLine) { Sync.set('offline'); return { skipped: true }; }
      if (Sync.running) { Sync.queued = true; return { queued: true }; }
      Sync.running = true; Sync.set('syncing');
      try {
        /* 1 — push local changes */
        const dirty = DB.dirty();
        const hasDirty = Object.keys(dirty).length > 0;
        if (hasDirty) {
          const r = await API.push(dirty);
          const done = {};
          Object.keys(dirty).forEach(t => done[t] = dirty[t].map(x => x.id));
          DB.clearDirty(r && r.accepted ? r.accepted : done);
        }
        /* 2 — pull remote changes */
        const since = DB.getMeta('lastPull', '');
        const res = await API.pull(since);
        let merged = 0;
        if (res && res.tables) {
          Object.keys(res.tables).forEach(t => {
            if (DB.TABLES.indexOf(t) >= 0) merged += DB.mergeRemote(t, res.tables[t]);
          });
        }
        await DB.setMeta('lastPull', (res && res.serverTime) || U.now());
        Sync.lastAt = new Date();
        await DB.setMeta('lastSyncAt', Sync.lastAt.toISOString());
        Sync.set('ok');
        if (merged && w.App && App.refresh) App.refresh();
        return { pushed: hasDirty, merged };
      } catch (e) {
        Sync.set('error', e.message || String(e));
        if (opts.loud && w.UI) UI.toast(e.message || 'Sync failed', 'err');
        return { error: e.message };
      } finally {
        Sync.running = false;
        if (Sync.queued) { Sync.queued = false; setTimeout(() => Sync.run(), 800); }
      }
    },

    /* full re-download (used after connecting a sheet) */
    async pullAll() {
      const res = await API.bootstrap();
      if (res && res.tables) Object.keys(res.tables).forEach(t => {
        if (DB.TABLES.indexOf(t) >= 0) DB.mergeRemote(t, res.tables[t]);
      });
      await DB.setMeta('lastPull', (res && res.serverTime) || U.now());
      if (w.App && App.refresh) App.refresh();
      return res;
    },

    start() {
      const soon = U.debounce(() => Sync.run(), 4000);
      DB.on('change', () => { if (API.configured()) { Sync.emit(); soon(); } });
      w.addEventListener('online', () => Sync.run());
      w.addEventListener('offline', () => Sync.set('offline'));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) Sync.run(); });
      setInterval(() => Sync.run(), 90000);
      setTimeout(() => Sync.run(), 1200);
    }
  };
  w.Sync = Sync;
})(window);
