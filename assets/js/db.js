/* Oakcraft Stock — local-first data store (IndexedDB backed, in-memory working set) */
(function (w) {
  'use strict';
  const U = w.U;

  const TABLES = [
    'stores', 'members', 'categories', 'units', 'parties', 'products',
    'moves', 'docs', 'docitems', 'payments', 'labels', 'settings'
  ];

  const DB_NAME = 'oakcraft_stock', DB_VER = 1, KV = 'kv';
  let idb = null;
  const data = {};
  TABLES.forEach(t => data[t] = []);
  const idx = {};                       // table -> {id: obj}
  const listeners = { change: [], ready: [] };
  let dirtyTables = {};

  function openDB() {
    return new Promise((res) => {
      if (!w.indexedDB) return res(null);
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { return res(null); }
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(KV)) d.createObjectStore(KV);
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => res(null);
      req.onblocked = () => res(null);
    });
  }
  function kvGet(key) {
    return new Promise(res => {
      if (!idb) { try { const v = localStorage.getItem('oc_' + key); return res(v ? JSON.parse(v) : null); } catch (e) { return res(null); } }
      try {
        const tx = idb.transaction(KV, 'readonly').objectStore(KV).get(key);
        tx.onsuccess = () => res(tx.result || null); tx.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  function kvPut(key, val) {
    return new Promise(res => {
      if (!idb) { try { localStorage.setItem('oc_' + key, JSON.stringify(val)); } catch (e) { } return res(); }
      try {
        const tx = idb.transaction(KV, 'readwrite').objectStore(KV).put(val, key);
        tx.onsuccess = () => res(); tx.onerror = () => res();
      } catch (e) { res(); }
    });
  }

  function reindex(t) {
    const m = {}; data[t].forEach(r => m[r.id] = r); idx[t] = m;
  }
  function emit(evt, arg) { (listeners[evt] || []).forEach(f => { try { f(arg); } catch (e) { console.error(e); } }); }

  const persist = U.debounce(function () {
    const ts = Object.keys(dirtyTables); dirtyTables = {};
    ts.forEach(t => kvPut('tbl_' + t, data[t]));
  }, 350);

  const DB = {
    TABLES,
    data,
    ready: false,
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return DB; },

    async init() {
      idb = await openDB();
      for (const t of TABLES) {
        const rows = await kvGet('tbl_' + t);
        data[t] = Array.isArray(rows) ? rows : [];
        reindex(t);
      }
      DB.meta = (await kvGet('meta')) || {};
      DB.ready = true;
      emit('ready');
      return DB;
    },

    async setMeta(k, v) { DB.meta[k] = v; await kvPut('meta', DB.meta); },
    getMeta(k, d) { return DB.meta && DB.meta[k] !== undefined ? DB.meta[k] : d; },

    /* --- reads --- */
    all(t, includeDeleted) {
      const rows = data[t] || [];
      return includeDeleted ? rows.slice() : rows.filter(r => !r.deleted);
    },
    get(t, id) { const r = (idx[t] || {})[id]; return r && !r.deleted ? r : null; },
    raw(t, id) { return (idx[t] || {})[id] || null; },
    find(t, fn) { return DB.all(t).filter(fn); },
    first(t, fn) { return DB.all(t).find(fn) || null; },
    count(t, fn) { return fn ? DB.all(t).filter(fn).length : DB.all(t).length; },

    /* --- writes --- */
    put(t, obj, opts) {
      opts = opts || {};
      const now = U.now();
      let rec = obj.id ? (idx[t] || {})[obj.id] : null;
      if (rec) {
        Object.assign(rec, obj);
        rec.updatedAt = now;
        if (!opts.clean) rec._dirty = 1;
      } else {
        rec = Object.assign({}, obj);
        rec.id = rec.id || U.uid(t.slice(0, 3));
        rec.createdAt = rec.createdAt || now;
        rec.updatedAt = now;
        if (!opts.clean) rec._dirty = 1;
        data[t].push(rec);
        (idx[t] = idx[t] || {})[rec.id] = rec;
      }
      dirtyTables[t] = 1; persist();
      if (!opts.silent) { emit('change', { table: t, id: rec.id, op: 'put' }); }
      return rec;
    },
    putMany(t, arr, opts) { const out = arr.map(o => DB.put(t, o, Object.assign({ silent: true }, opts))); emit('change', { table: t, op: 'bulk' }); return out; },

    remove(t, id) {
      const rec = (idx[t] || {})[id];
      if (!rec) return false;
      rec.deleted = 1; rec.updatedAt = U.now(); rec._dirty = 1;
      dirtyTables[t] = 1; persist();
      emit('change', { table: t, id, op: 'del' });
      return true;
    },
    removeMany(t, ids) { ids.forEach(id => { const r = (idx[t] || {})[id]; if (r) { r.deleted = 1; r.updatedAt = U.now(); r._dirty = 1; } }); dirtyTables[t] = 1; persist(); emit('change', { table: t, op: 'bulk' }); },

    /* --- sync helpers --- */
    dirty() {
      const out = {};
      TABLES.forEach(t => { const rows = data[t].filter(r => r._dirty); if (rows.length) out[t] = rows.map(stripLocal); });
      return out;
    },
    clearDirty(map) {
      Object.keys(map || {}).forEach(t => {
        (map[t] || []).forEach(id => { const r = (idx[t] || {})[id]; if (r) delete r._dirty; });
        dirtyTables[t] = 1;
      });
      persist();
    },
    mergeRemote(t, rows) {
      if (!rows || !rows.length) return 0;
      let n = 0;
      rows.forEach(r => {
        if (!r || !r.id) return;
        const cur = (idx[t] || {})[r.id];
        if (!cur) {
          data[t].push(r); (idx[t] = idx[t] || {})[r.id] = r; n++;
        } else if (!cur._dirty && (!cur.updatedAt || String(r.updatedAt || '') >= String(cur.updatedAt))) {
          Object.assign(cur, r); delete cur._dirty; n++;
        }
      });
      if (n) { dirtyTables[t] = 1; persist(); }
      return n;
    },
    replaceAll(t, rows) {
      data[t] = (rows || []).slice(); reindex(t); dirtyTables[t] = 1; persist();
    },

    /* --- backup --- */
    exportAll() {
      const out = { app: 'oakcraft-stock', version: 1, exportedAt: U.now(), tables: {} };
      TABLES.forEach(t => out.tables[t] = data[t]);
      return out;
    },
    async importAll(obj, mode) {
      if (!obj || !obj.tables) throw new Error('Not an Oakcraft backup file');
      TABLES.forEach(t => {
        const rows = obj.tables[t] || [];
        if (mode === 'merge') { DB.mergeRemote(t, rows); }
        else { data[t] = rows.slice(); reindex(t); }
        data[t].forEach(r => r._dirty = 1);
        dirtyTables[t] = 1;
      });
      persist();
      emit('change', { table: '*', op: 'import' });
    },
    async wipe() {
      TABLES.forEach(t => { data[t] = []; reindex(t); dirtyTables[t] = 1; });
      persist(); emit('change', { table: '*', op: 'wipe' });
    }
  };

  function stripLocal(r) { const o = Object.assign({}, r); delete o._dirty; return o; }

  w.DB = DB;
})(window);
