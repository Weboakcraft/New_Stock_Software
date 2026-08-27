/**
 * ============================================================================
 *  OAKCRAFT STOCK  —  Google Sheets backend  (Google Apps Script Web App)
 * ============================================================================
 *
 *  WHAT THIS DOES
 *  --------------
 *  Turns one ordinary Google Spreadsheet into the database for the Oakcraft
 *  Stock web app / APK. Every table (products, parties, bills, stock moves …)
 *  becomes a normal, readable sheet tab that you can open, filter and print
 *  like any other spreadsheet.
 *
 *  HOW TO INSTALL  (about 3 minutes, one time)
 *  -------------------------------------------
 *   1. Go to https://sheets.new and make a blank spreadsheet.
 *      Rename it to:  Oakcraft Stock Data
 *   2. Menu:  Extensions  ->  Apps Script
 *   3. Delete the sample code, paste THIS whole file, press the save icon.
 *   4. Change TOKEN below to a secret word of your own (any letters/numbers).
 *   5. Menu:  Deploy  ->  New deployment  ->  gear icon  ->  Web app
 *         Description   : Oakcraft Stock API
 *         Execute as    : Me
 *         Who has access: Anyone            <-- important
 *      Press Deploy, then Authorize access and allow the permissions.
 *      (Google shows an "unverified app" screen because the script is yours —
 *       click Advanced -> Go to <project name> (unsafe) -> Allow.)
 *   6. Copy the Web app URL. It looks like
 *         https://script.google.com/macros/s/AKfycb..../exec
 *   7. In the Oakcraft Stock app open  Sync & Backup , paste that URL and the
 *      same secret word, and press "Connect & test".
 *
 *  Whenever you change this file, press  Deploy -> Manage deployments ->
 *  pencil icon -> Version: New version -> Deploy, so the /exec URL stays the same.
 * ============================================================================
 */

/** Secret word. Must match the one entered in the app. CHANGE THIS. */
var TOKEN = 'SET-YOUR-OWN-SECRET-HERE';

/** Optional: paste a spreadsheet ID to target a specific file.
 *  Leave '' when the script is bound to the sheet (the normal case). */
var SPREADSHEET_ID = '';

/** Google Sheets refuses cell contents longer than 50,000 characters. */
var MAX_CELL = 45000;

/* ---------------------------------------------------------------- schema -- */
var SCHEMA = {
  stores: ['id', 'name', 'address', 'createdBy', 'storeId', 'createdAt', 'updatedAt', 'deleted'],

  members: ['id', 'name', 'email', 'phone', 'storeId', 'role', 'createdAt', 'updatedAt', 'deleted'],

  categories: ['id', 'name', 'storeId', 'createdAt', 'updatedAt', 'deleted'],

  units: ['id', 'name', 'storeId', 'createdAt', 'updatedAt', 'deleted'],

  parties: ['id', 'name', 'phone', 'ptype', 'payType', 'opening', 'gst', 'pan',
    'billAddr', 'pin', 'state', 'shipSame', 'shipAddr', 'shipPin', 'shipState',
    'acNo', 'acName', 'ifsc', 'bank', 'branch',
    'storeId', 'createdAt', 'updatedAt', 'deleted'],

  products: ['id', 'name', 'buyRate', 'buyGstMode', 'mrp', 'saleRate', 'saleGstMode',
    'unit', 'categoryId', 'lowStock', 'hsn', 'gstRate', 'expiryDate', 'barcode',
    'brand', 'colour', 'size', 'remark', 'image',
    'storeId', 'createdAt', 'updatedAt', 'deleted'],

  moves: ['id', 'at', 'productId', 'type', 'qty', 'unit', 'rate', 'partyId',
    'storeRef', 'source', 'refId', 'remark', 'by',
    'storeId', 'createdAt', 'updatedAt', 'deleted'],

  docs: ['id', 'dtype', 'number', 'at', 'partyId', 'partyName', 'partyPhone', 'partyGst',
    'partyAddr', 'partyState', 'subTotal', 'discountMode', 'discountValue', 'discount',
    'chargesTotal', 'charges', 'taxable', 'tax', 'cgst', 'sgst', 'igst', 'roundOff',
    'total', 'received', 'due', 'payMode', 'status', 'remark', 'terms', 'interState',
    'linkedDocId', 'by', 'storeId', 'createdAt', 'updatedAt', 'deleted'],

  docitems: ['id', 'docId', 'seq', 'productId', 'name', 'hsn', 'qty', 'unit', 'price',
    'gstMode', 'gstRate', 'amount', 'mrp', 'brand', 'size', 'colour', 'serialNo',
    'batchNo', 'mfgDate', 'expDate', 'desc', 'createdAt', 'updatedAt', 'deleted'],

  payments: ['id', 'at', 'partyId', 'kind', 'amount', 'mode', 'remark', 'docId', 'by',
    'storeId', 'createdAt', 'updatedAt', 'deleted'],

  labels: ['id', 'productId', 'barcode', 'count', 'line1', 'line2',
    'storeId', 'createdAt', 'updatedAt', 'deleted'],

  settings: ['id', 'v', 'logo', 'signature', 'createdAt', 'updatedAt', 'deleted']
};

/** Fields kept as JSON text inside a single cell. */
var JSON_FIELDS = { charges: 1, v: 1 };
/** Fields that are true numbers in the sheet. */
var NUM_FIELDS = {
  opening: 1, buyRate: 1, mrp: 1, saleRate: 1, lowStock: 1, gstRate: 1, qty: 1, rate: 1,
  subTotal: 1, discountValue: 1, discount: 1, chargesTotal: 1, taxable: 1, tax: 1,
  cgst: 1, sgst: 1, igst: 1, roundOff: 1, total: 1, received: 1, due: 1,
  seq: 1, price: 1, amount: 1, count: 1
};

/* ------------------------------------------------------------- entrypoints -- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'ping') return json({ ok: true, pong: true, time: nowIso(), sheet: ss().getName() });
  return json({
    ok: true,
    message: 'Oakcraft Stock API is running. The app talks to this URL with POST requests.',
    time: nowIso()
  });
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json({ ok: false, error: 'Bad request body' }); }

  if (body.action !== 'ping' && String(body.token || '') !== String(TOKEN)) {
    return json({ ok: false, error: 'Wrong secret word (TOKEN). Check Sync & Backup in the app.' });
  }
  try {
    switch (body.action) {
      case 'ping': return json({ ok: true, pong: true, time: nowIso(), sheet: ss().getName(), tokenOk: String(body.token || '') === String(TOKEN) });
      case 'setup': return json(setup());
      case 'info': return json(info());
      case 'bootstrap': return json(readAll(''));
      case 'pull': return json(readAll(body.since || ''));
      case 'push': return json(writeAll(body.changes || {}));
      case 'reset': return json(reset());
      default: return json({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ------------------------------------------------------------------ core -- */
function ss() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function nowIso() { return new Date().toISOString(); }

function sheetFor(table, create) {
  var book = ss(), sh = book.getSheetByName(table);
  if (!sh && create) {
    sh = book.insertSheet(table);
    var head = SCHEMA[table];
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#241a13').setFontColor('#f0dfa8');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    if (head.indexOf('name') >= 0) sh.setColumnWidth(head.indexOf('name') + 1, 230);
  }
  return sh;
}

/** Create every tab with its header row. Safe to run many times. */
function setup() {
  var made = [], book = ss();
  for (var t in SCHEMA) {
    var existed = !!book.getSheetByName(t);
    var sh = sheetFor(t, true);
    if (!existed) made.push(t);
    /* keep the header row in step with the schema */
    var head = SCHEMA[t];
    var cur = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    if (cur.join('|') !== head.join('|')) {
      sh.getRange(1, 1, 1, head.length).setValues([head])
        .setFontWeight('bold').setBackground('#241a13').setFontColor('#f0dfa8');
      sh.setFrozenRows(1);
    }
  }
  /* a friendly first tab */
  var about = book.getSheetByName('README');
  if (!about) {
    about = book.insertSheet('README', 0);
    about.getRange(1, 1, 8, 1).setValues([
      ['OAKCRAFT STOCK — data file'],
      [''],
      ['Every tab in this file is a table used by the Oakcraft Stock app and APK.'],
      ['You can read, filter, chart and print these tabs freely.'],
      ['Editing a cell by hand also works — the app picks the change up on its next sync.'],
      ['Do not rename the tabs or the header row, and never delete the "id" column.'],
      [''],
      ['Created ' + nowIso()]
    ]);
    about.getRange(1, 1).setFontSize(15).setFontWeight('bold');
    about.setColumnWidth(1, 720);
  }
  var sheet1 = book.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0 && book.getSheets().length > 1) book.deleteSheet(sheet1);
  return { ok: true, created: made, tables: Object.keys(SCHEMA), serverTime: nowIso() };
}

function info() {
  var out = {};
  for (var t in SCHEMA) {
    var sh = sheetFor(t, false);
    out[t] = sh ? Math.max(0, sh.getLastRow() - 1) : -1;
  }
  return { ok: true, counts: out, sheet: ss().getName(), url: ss().getUrl(), serverTime: nowIso() };
}

/* ------------------------------------------------------------------ read -- */
function readAll(since) {
  var tables = {}, sinceStr = String(since || '');
  for (var t in SCHEMA) {
    var sh = sheetFor(t, false);
    if (!sh || sh.getLastRow() < 2) { tables[t] = []; continue; }
    var head = SCHEMA[t];
    var values = sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues();
    var rows = [];
    for (var i = 0; i < values.length; i++) {
      var rec = rowToRecord(head, values[i]);
      if (!rec || !rec.id) continue;
      if (sinceStr && String(rec.updatedAt || '') <= sinceStr) continue;
      rows.push(rec);
    }
    tables[t] = rows;
  }
  return { ok: true, tables: tables, serverTime: nowIso() };
}

function rowToRecord(head, row) {
  var rec = {};
  for (var c = 0; c < head.length; c++) {
    var key = head[c], v = row[c];
    if (v === '' || v === null || v === undefined) continue;
    if (v instanceof Date) v = v.toISOString();
    if (JSON_FIELDS[key]) { try { v = JSON.parse(v); } catch (e) { } }
    else if (NUM_FIELDS[key]) v = Number(v) || 0;
    else if (key === 'deleted' || key === 'shipSame' || key === 'interState') v = (v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1') ? 1 : 0;
    rec[key] = v;
  }
  if (!rec.deleted) delete rec.deleted;
  return rec;
}

function recordToRow(head, rec) {
  var row = [];
  for (var c = 0; c < head.length; c++) {
    var key = head[c], v = rec[key];
    if (v === undefined || v === null) { row.push(''); continue; }
    if (JSON_FIELDS[key]) v = (typeof v === 'string') ? v : JSON.stringify(v);
    else if (NUM_FIELDS[key]) v = Number(v) || 0;
    else if (key === 'deleted' || key === 'shipSame' || key === 'interState') v = v ? 1 : 0;
    if (typeof v === 'string' && v.length > MAX_CELL) v = v.slice(0, MAX_CELL);
    row.push(v);
  }
  return row;
}

/* ----------------------------------------------------------------- write -- */
function writeAll(changes) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return { ok: false, error: 'The sheet is busy, try again in a moment' }; }
  try {
    var accepted = {}, counts = {};
    for (var t in changes) {
      if (!SCHEMA[t]) continue;
      var rows = changes[t] || [];
      if (!rows.length) { accepted[t] = []; continue; }
      var sh = sheetFor(t, true), head = SCHEMA[t];

      /* id -> sheet row */
      var map = {}, last = sh.getLastRow();
      if (last > 1) {
        var ids = sh.getRange(2, 1, last - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) { var id = String(ids[i][0] || ''); if (id) map[id] = i + 2; }
      }
      var appends = [], ok = [];
      for (var r = 0; r < rows.length; r++) {
        var rec = rows[r];
        if (!rec || !rec.id) continue;
        var line = recordToRow(head, rec);
        var at = map[String(rec.id)];
        if (at) sh.getRange(at, 1, 1, head.length).setValues([line]);
        else appends.push(line);
        ok.push(rec.id);
      }
      if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, head.length).setValues(appends);
      accepted[t] = ok;
      counts[t] = ok.length;
    }
    SpreadsheetApp.flush();
    return { ok: true, accepted: accepted, counts: counts, serverTime: nowIso() };
  } finally {
    try { lock.releaseLock(); } catch (e) { }
  }
}

/** Danger: empties every table but keeps the headers. */
function reset() {
  for (var t in SCHEMA) {
    var sh = sheetFor(t, false);
    if (sh && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  }
  return { ok: true, reset: true, serverTime: nowIso() };
}

/* ------------------------------------------------- run once from the editor -- */
/** Select this function in the Apps Script toolbar and press Run to
 *  build all the tabs without touching the app. */
function installOakcraftStock() {
  var r = setup();
  Logger.log(JSON.stringify(r, null, 2));
  SpreadsheetApp.getActive().toast('Oakcraft Stock tables are ready', 'Setup complete', 5);
}
