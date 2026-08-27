/* Oakcraft Stock — domain model & business rules */
(function (w) {
  'use strict';
  const U = w.U, DB = w.DB;

  const DOC = {
    SALE: { key: 'SALE', label: 'Sale Invoice', short: 'Sale', prefix: 'INV', stock: 'OUT', party: 'Customer', pay: 'RECEIVE', route: 'sale-invoice', colour: 'green' },
    PURCHASE: { key: 'PURCHASE', label: 'Purchase Invoice', short: 'Purchase', prefix: 'PUR', stock: 'IN', party: 'Supplier', pay: 'PAY', route: 'purchase-invoice', colour: 'blue' },
    QUOTATION: { key: 'QUOTATION', label: 'Quotation', short: 'Quotation', prefix: 'QTN', stock: null, party: 'Customer', pay: null, route: 'quotation', colour: 'amber' },
    SALE_ORDER: { key: 'SALE_ORDER', label: 'Sale Order', short: 'Sale Order', prefix: 'SO', stock: null, party: 'Customer', pay: null, route: 'sale-order', colour: 'amber' },
    PURCHASE_ORDER: { key: 'PURCHASE_ORDER', label: 'Purchase Order', short: 'Purchase Order', prefix: 'PO', stock: null, party: 'Supplier', pay: null, route: 'purchase-order', colour: 'amber' },
    SALE_RETURN: { key: 'SALE_RETURN', label: 'Sale Return', short: 'Sale Return', prefix: 'SR', stock: 'IN', party: 'Customer', pay: 'PAY', route: 'sales-return', colour: 'red' },
    PURCHASE_RETURN: { key: 'PURCHASE_RETURN', label: 'Purchase Return', short: 'Purchase Return', prefix: 'PR', stock: 'OUT', party: 'Supplier', pay: 'RECEIVE', route: 'purchase-return', colour: 'red' }
  };

  const UNITS = ['Piece', 'Set', 'Pair', 'Box', 'BOXES', 'Packet', 'Pack', 'Bundle', 'Carton', 'Dozen', 'Bora', 'Bottle', 'Peti', 'Pouch',
    'KG', 'Gram', 'Ton', 'Litre', 'ML', 'Meter', 'CM', 'MM', 'KM', 'Sq.ft', 'Sq.Inch', 'Feet', 'Inch', 'Roll', 'Nos'];
  const GST_RATES = [0, 0.1, 0.25, 1.5, 3, 5, 6, 12, 13, 14, 18, 28, 40];
  const PAY_MODES = ['Cash', 'UPI', 'Online', 'Net Banking', 'Cheque', 'Card', 'Credit'];

  const DEFAULTS = {
    /* business */
    bizName: 'OAKCRAFT',
    legalName: 'M/s OAKCRAFT (Prop. Surender Mittal)',
    bizType: 'Manufacture',
    bizCategory: 'Furniture — Chairs & Tables',
    gstin: '07ABOPM2275Q1ZV',
    pan: 'ABOPM2275Q',
    udyam: 'UDYAM-DL-06-0171040',
    address: 'Plot No. 400, Khasra No. 154/400, Ground & First Floor, Poothkhurd, Near Petu Ram Hotel, North West Delhi – 110039',
    state: 'Delhi',
    pin: '110039',
    phone: '8800560284',
    email: 'mis@oakcraft.in',
    website: 'oakcraft.in',
    logo: '',
    signature: '',
    ownerName: 'Ankit',
    ownerRole: 'Owner / Admin',
    /* bill */
    billColour: '#a4801d',
    billTheme: 'modern',
    billTitle: 'TAX INVOICE',
    thermal: false,
    thermalWidth: '3',
    showMRP: false,
    showImage: false,
    showDesc: false,
    extraCols: ['colour'],
    customCols: [],
    terms: '1. Goods once sold will not be taken back.\n2. Warranty: 3 years against manufacturing defects.\n3. Interest @18% p.a. charged on overdue bills.\n4. Subject to Delhi jurisdiction.',
    slogan: '|| Shree Ganeshay Namah ||',
    showBank: true,
    showUpiQr: true,
    showSign: true,
    showCustomerSign: true,
    bankName: 'Kotak Mahindra Bank',
    bankAc: '8700545550',
    bankHolder: 'Oakcraft',
    bankIfsc: 'KKBK0000197',
    bankBranch: 'Rohini',
    upi: 'Oakcraft@kotak',
    /* defaults */
    defHsn: '9403',
    defGst: 18,
    defUnit: 'Piece',
    lowStock: 5,
    autoRound: true,
    priceIncludesGst: false,
    /* counters */
    counters: {}
  };

  const M = {
    DOC, UNITS, GST_RATES, PAY_MODES, DEFAULTS,

    /* ---------- settings ---------- */
    settings() {
      const row = DB.all('settings')[0];
      return Object.assign({}, DEFAULTS, row ? row.v : {});
    },
    saveSettings(patch) {
      const row = DB.all('settings')[0];
      const v = Object.assign({}, row ? row.v : {}, patch);
      return DB.put('settings', { id: (row && row.id) || 'settings_main', v });
    },

    /* ---------- store scope ---------- */
    stores() { return DB.all('stores'); },
    currentStoreId() {
      let id = DB.getMeta('storeId', '');
      const list = M.stores();
      if (!id || !list.some(s => s.id === id)) { id = list.length ? list[0].id : ''; DB.setMeta('storeId', id); }
      return id;
    },
    setStore(id) { DB.setMeta('storeId', id); },
    currentStore() { return DB.get('stores', M.currentStoreId()) || { id: '', name: 'Main Store' }; },
    scoped(rows) { const s = M.currentStoreId(); return rows.filter(r => !r.storeId || r.storeId === s); },

    /* ---------- categories / units ---------- */
    categories() { return U.sortBy(DB.all('categories'), c => U.deaccent(c.name)); },
    categoryName(id) { const c = DB.get('categories', id); return c ? c.name : ''; },
    units() {
      const custom = DB.all('units').map(u => u.name);
      return UNITS.concat(custom.filter(x => UNITS.indexOf(x) < 0));
    },

    /* ---------- products ---------- */
    products() { return M.scoped(DB.all('products')); },
    product(id) { return DB.get('products', id); },
    productByBarcode(code) {
      code = String(code || '').trim(); if (!code) return null;
      return M.products().find(p => String(p.barcode || '').trim() === code) || null;
    },

    /* ---------- stock maths ---------- */
    movesOf(productId) { return DB.all('moves').filter(m => m.productId === productId); },
    /**
     * Stock figures for a product, optionally within a date window.
     * opening = net qty before `from`; in/out = within window; available = net overall.
     */
    stock(productId, from, to) {
      const ms = M.movesOf(productId);
      let opening = 0, tin = 0, tout = 0, avail = 0;
      const f = from ? U.dayStart(from).getTime() : null;
      const t = to ? U.dayEnd(to).getTime() : null;
      ms.forEach(m => {
        const q = U.n(m.qty), at = U.dt(m.at).getTime();
        const signed = m.type === 'IN' ? q : -q;
        avail += signed;
        if (f !== null && at < f) { opening += signed; return; }
        if (t !== null && at > t) return;
        if (f === null && t === null) { /* all-time */ }
        if (m.type === 'IN') tin += q; else tout += q;
      });
      if (f === null) opening = 0;
      return { opening: U.round(opening), in: U.round(tin), out: U.round(tout), available: U.round(avail) };
    },
    available(productId) { return M.stock(productId).available; },
    stockValue() {
      let buy = 0, sale = 0, qty = 0;
      M.products().forEach(p => {
        const a = M.available(p.id); qty += a;
        buy += a * U.n(p.buyRate); sale += a * U.n(p.saleRate);
      });
      return { qty: U.round(qty), buy: U.round(buy), sale: U.round(sale) };
    },
    lowStockItems() {
      const s = M.settings();
      return M.products().filter(p => M.available(p.id) <= U.n(p.lowStock || s.lowStock));
    },
    expiredItems() {
      const today = U.dayStart(new Date()).getTime();
      return M.products().filter(p => p.expiryDate && U.dt(p.expiryDate).getTime() < today);
    },

    /* ---------- stock movement ---------- */
    addMove(mv) {
      return DB.put('moves', Object.assign({
        at: U.now(), type: 'IN', qty: 0, unit: '', rate: 0, partyId: '', storeRef: '',
        source: 'manual', refId: '', remark: '', by: M.settings().ownerName, storeId: M.currentStoreId()
      }, mv));
    },
    removeMovesFor(refId) {
      const ids = DB.all('moves').filter(m => m.refId === refId).map(m => m.id);
      if (ids.length) DB.removeMany('moves', ids);
    },

    /* ---------- parties ---------- */
    parties() { return M.scoped(DB.all('parties')); },
    party(id) { return DB.get('parties', id); },
    partyBalance(partyId) {
      const p = DB.get('parties', partyId);
      if (!p) return 0;
      let bal = U.n(p.opening) * (p.payType === 'pay' ? -1 : 1);
      DB.all('docs').filter(d => d.partyId === partyId).forEach(d => {
        const t = U.n(d.total);
        if (d.dtype === 'SALE') bal += t;
        else if (d.dtype === 'SALE_RETURN') bal -= t;
        else if (d.dtype === 'PURCHASE') bal -= t;
        else if (d.dtype === 'PURCHASE_RETURN') bal += t;
      });
      DB.all('payments').filter(x => x.partyId === partyId).forEach(x => {
        bal += (x.kind === 'RECEIVE' ? -1 : 1) * U.n(x.amount);
      });
      return U.round(bal);
    },
    partyTotals() {
      let recv = 0, pay = 0;
      M.parties().forEach(p => { const b = M.partyBalance(p.id); if (b > 0) recv += b; else pay += -b; });
      return { receive: U.round(recv), pay: U.round(pay) };
    },

    /* ---------- payments ---------- */
    addPayment(pm) {
      return DB.put('payments', Object.assign({
        at: U.now(), partyId: '', kind: 'RECEIVE', amount: 0, mode: 'Cash',
        remark: '', docId: '', by: M.settings().ownerName, storeId: M.currentStoreId()
      }, pm));
    },

    /* ---------- documents ---------- */
    docs(dtype) { const rows = M.scoped(DB.all('docs')); return dtype ? rows.filter(d => d.dtype === dtype) : rows; },
    doc(id) { return DB.get('docs', id); },
    docItems(docId) { return DB.all('docitems').filter(i => i.docId === docId); },

    nextNumber(dtype) {
      const s = M.settings(), cfg = DOC[dtype];
      const used = DB.all('docs').filter(d => d.dtype === dtype)
        .map(d => parseInt(String(d.number).replace(/\D+/g, ''), 10) || 0);
      const maxUsed = used.length ? Math.max.apply(null, used) : 0;
      const counter = Math.max(U.n((s.counters || {})[dtype]) || 0, maxUsed);
      return (cfg.prefix || 'DOC') + '-' + String(counter + 1).padStart(4, '0');
    },
    bumpCounter(dtype, number) {
      const s = M.settings(); const c = Object.assign({}, s.counters || {});
      const n = parseInt(String(number).replace(/\D+/g, ''), 10) || 0;
      if (n > (U.n(c[dtype]) || 0)) { c[dtype] = n; M.saveSettings({ counters: c }); }
    },

    /**
     * Compute all money figures for a document.
     * items: [{qty, price, gstMode:'ex'|'in', gstRate}]
     */
    calcDoc(d, items) {
      const s = M.settings();
      let sub = 0;
      items.forEach(it => { it.amount = U.round(U.n(it.qty) * U.n(it.price)); sub += it.amount; });
      sub = U.round(sub);

      /* discount */
      let disc = 0;
      const dv = U.n(d.discountValue);
      if (dv) disc = d.discountMode === 'pct' ? U.round(sub * dv / 100) : U.round(dv);
      if (disc > sub) disc = sub;
      const factor = sub > 0 ? (sub - disc) / sub : 1;

      /* per-item tax after proportional discount */
      let taxable = 0, tax = 0;
      items.forEach(it => {
        const gross = U.n(it.amount) * factor;
        const r = U.n(it.gstRate);
        let tx, tv;
        if (it.gstMode === 'in' && r) { tx = gross / (1 + r / 100); tv = gross - tx; }
        else { tx = gross; tv = gross * r / 100; }
        it._taxable = U.round(tx); it._tax = U.round(tv);
        taxable += it._taxable; tax += it._tax;
      });

      /* extra charges */
      let charges = 0;
      (d.charges || []).forEach(c => {
        const amt = U.n(c.amount), r = U.n(c.gst);
        charges += amt;
        taxable += amt;
        tax += amt * r / 100;
      });

      taxable = U.round(taxable); tax = U.round(tax);
      const inter = !!d.interState;
      const cgst = inter ? 0 : U.round(tax / 2), sgst = inter ? 0 : U.round(tax - tax / 2), igst = inter ? tax : 0;
      let total = U.round(taxable + tax);
      let roundOff = 0;
      if (s.autoRound) { const r = Math.round(total); roundOff = U.round(r - total); total = r; }
      const received = U.n(d.received);
      return {
        subTotal: sub, discount: disc, chargesTotal: U.round(charges),
        taxable, tax, cgst, sgst, igst, roundOff,
        total: U.round(total), received: U.round(received),
        due: U.round(total - received)
      };
    },

    /**
     * Persist a document + its items, its stock moves and its payment entry.
     * Fully replaces any previous version of the same document.
     */
    saveDoc(doc, items) {
      const cfg = DOC[doc.dtype];
      const calc = M.calcDoc(doc, items);
      const id = doc.id || U.uid('doc');
      const status = calc.due <= 0.009 ? 'PAID' : (calc.received > 0 ? 'PARTIAL' : 'UNPAID');
      const party = doc.partyId ? DB.get('parties', doc.partyId) : null;

      const rec = Object.assign({}, doc, calc, {
        id,
        status: cfg.pay ? status : (doc.status || 'OPEN'),
        partyName: doc.partyName || (party ? party.name : 'Cash / Walk-in'),
        partyPhone: party ? party.phone : (doc.partyPhone || ''),
        partyGst: party ? party.gst : (doc.partyGst || ''),
        partyAddr: party ? party.billAddr : (doc.partyAddr || ''),
        partyState: party ? party.state : (doc.partyState || ''),
        storeId: doc.storeId || M.currentStoreId(),
        by: doc.by || M.settings().ownerName
      });
      delete rec.items;
      DB.put('docs', rec);
      M.bumpCounter(doc.dtype, rec.number);

      /* items — wipe & rewrite */
      DB.all('docitems').filter(i => i.docId === id).forEach(i => DB.remove('docitems', i.id));
      items.forEach((it, ix) => {
        DB.put('docitems', Object.assign({}, it, { id: it.id && it.docId === id ? it.id : U.uid('itm'), docId: id, seq: ix + 1 }));
      });

      /* stock moves — wipe & rewrite */
      M.removeMovesFor(id);
      if (cfg.stock) {
        items.forEach(it => {
          if (!it.productId || !U.n(it.qty)) return;
          M.addMove({
            at: rec.at, productId: it.productId, type: cfg.stock, qty: U.n(it.qty), unit: it.unit,
            rate: U.n(it.price), partyId: rec.partyId || '', storeRef: 'party',
            source: cfg.key.toLowerCase(), refId: id,
            remark: cfg.label + ' ' + rec.number
          });
        });
      }

      /* payment entry — wipe & rewrite */
      DB.all('payments').filter(p => p.docId === id).forEach(p => DB.remove('payments', p.id));
      if (cfg.pay && U.n(rec.received) > 0 && rec.partyId) {
        M.addPayment({
          at: rec.at, partyId: rec.partyId, kind: cfg.pay, amount: U.n(rec.received),
          mode: rec.payMode || 'Cash', docId: id, remark: cfg.label + ' ' + rec.number
        });
      }
      return rec;
    },

    deleteDoc(id) {
      M.removeMovesFor(id);
      DB.all('docitems').filter(i => i.docId === id).forEach(i => DB.remove('docitems', i.id));
      DB.all('payments').filter(p => p.docId === id).forEach(p => DB.remove('payments', p.id));
      DB.remove('docs', id);
    },

    /* ---------- reporting helpers ---------- */
    profitOf(doc) {
      if (doc.dtype !== 'SALE') return 0;
      let cost = 0;
      M.docItems(doc.id).forEach(it => {
        const p = DB.get('products', it.productId);
        cost += U.n(p && p.buyRate) * U.n(it.qty);
      });
      return U.round(U.n(doc.taxable) - cost);
    },
    salesBetween(from, to, dtype) {
      return M.docs(dtype || 'SALE').filter(d => U.inRange(d.at, from, to));
    },
    /* combined "entry" feed used by All Entry & Bills */
    entries(from, to) {
      const out = [];
      M.docs().forEach(d => {
        if (from && !U.inRange(d.at, from, to)) return;
        out.push({ kind: d.dtype, at: d.at, ref: d, id: d.id });
      });
      DB.all('payments').forEach(p => {
        if (from && !U.inRange(p.at, from, to)) return;
        if (p.docId) return; /* already shown via its bill */
        out.push({ kind: p.kind === 'RECEIVE' ? 'PAY_IN' : 'PAY_OUT', at: p.at, ref: p, id: p.id });
      });
      DB.all('moves').forEach(m => {
        if (m.source !== 'manual' && m.source !== 'opening') return;
        if (from && !U.inRange(m.at, from, to)) return;
        out.push({ kind: m.type === 'IN' ? 'STORE_IN' : 'STORE_OUT', at: m.at, ref: m, id: m.id });
      });
      return U.sortBy(out, e => e.at, 'desc');
    }
  };

  w.M = M;
})(window);
