<div align="center">

<img src="assets/img/icon-192.png" width="88" alt="Oakcraft Stock">

# Oakcraft Stock

**Inventory, stock flow, GST billing, barcode labels and reports — for OAKCRAFT.**

Runs as a website on GitHub Pages · installs as an Android APK · works offline · keeps its data in *your own* Google Sheet.

</div>

---

## What is in this repository

| Folder | What it is |
|---|---|
| `index.html`, `assets/`, `sw.js` | The web app itself. Plain HTML/CSS/JavaScript — no build step, no npm install. |
| `gas/Code.gs` | The Google Apps Script that turns one Google Spreadsheet into the database. |
| `android/` | The Android project that wraps the site into an installable APK. |
| `.github/workflows/` | Two GitHub Actions: one publishes the website, one builds the APK. |
| `tools/build-standalone.js` | Builds `dist/oakcraft-stock-standalone.html` — the whole app in a single file. |

**Start here → [DEPLOY.md](DEPLOY.md)** has the three set-up steps in order.

---

## Every screen

**Dashboard** — total products, total quantity, low stock, expired items; weekly sale bar chart, stock donut, monthly sale line chart; the last 100 stock movements.

**Party** — customers and suppliers with opening balance, GST/PAN, billing and shipping address and bank details. Amount to receive / amount to pay across the whole business, per-party ledger with running balance, and one-tap Receive / Pay entries.

**Stock** — every product with opening stock, total IN, total OUT and available stock for any date range. Add product (name, photo, unit, category, low-stock warning, brand, colour, size, opening quantity, barcode, remark). IN and OUT entries against a party or the store, by quantity. Full movement history per item. CSV bulk upload. Search, category filter and seven sort orders.

**All Entry & Bills** — one feed of everything that happened, filtered by Sale, Purchase, To receive, To pay, Store in, Store out, Pay in, Pay out, Quotation, Sale order, Purchase order — with month sale and month profit on top.

**Sale** — Sale Invoice, Quotation, Sale Order, Sales Return.
**Purchase** — Purchase Invoice, Purchase Order, Purchase Return.
Each has its own list with Paid / Unpaid / Partially-paid tabs, and a shared bill builder: party picker, auto bill number, barcode-scan product search, editable line items, extra columns, discount (flat or %), extra charges with their own GST, CGST/SGST or IGST, round-off, received amount with payment mode, due amount, remark and terms. Quotations and orders convert into a real bill in one click.

**Transaction** — every stock movement ever, filterable by date and IN/OUT, exportable to Excel.

**Rate List** — buy rate, sale rate, MRP and available quantity for every item; printable.

**Barcode Generator** — Code 128 barcodes, two configurable text lines, six A4 label-sheet layouts and four label-roll sizes, preview and print.

**All Reports** — Low Stock, Expired Stock, Item Sale Price, Item Purchase Price, Item Details, Item Wise Stock Summary, Item Wise Sale & Purchase, Party Wise Sales & Purchase, Day Book, GST Summary (HSN wise), Profit & Loss, Stock Valuation, Outstanding Balances. Every one exports to Excel and PDF.

**Settings** — members with roles (Store Admin / Sale & Purchase Operator / View only), categories, multiple stores, and a full Bill / Invoice designer with nine themes, custom colour, logo, signature, bank details, UPI QR code, thermal printing (2″/3″/4″) and a live preview.

**Sync & Backup** — connect your Google Sheet, download a full `.json` backup, restore, export products / parties / bills to Excel.

---

## How the data works

The app is **local-first**. Everything you type is saved into the browser's own database (IndexedDB) straight away, so it is instant and works with no signal at all.

When a Google Sheet is connected, a background sync pushes anything new and pulls anything other devices changed — on start-up, after each edit, when the phone comes back online, and every 90 seconds. Conflicts resolve by "most recently edited wins". If the sheet cannot be reached the changes simply stay queued and go up later.

Your Google Sheet stays readable: one tab per table (`products`, `parties`, `docs`, `docitems`, `moves`, `payments`, …) with a proper header row, so you can filter, chart and print it like any other spreadsheet — and edit a cell by hand if you want to.

---

## Language

The whole interface is English, with a Hinglish toggle in the top bar (**EN / हि**). Light and dark themes are both included.

---

## Local development

```bash
python3 -m http.server 8000      # then open http://localhost:8000
node tools/build-standalone.js   # optional: one-file build in dist/
```

No dependencies, no build step. Edit a file, refresh the page.

---

<div align="center"><sub>M/s OAKCRAFT · GSTIN 07ABOPM2275Q1ZV · Udyam UDYAM-DL-06-0171040</sub></div>
