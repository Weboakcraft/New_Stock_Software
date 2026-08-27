#!/usr/bin/env node
/*
 * Builds dist/oakcraft-stock-standalone.html — the whole app in one file.
 *
 * Useful as an emergency copy on a USB stick: double-click it on any computer
 * and it runs. It cannot reach the Google Sheet from a file:// address, so it is
 * a spare, not the main copy.
 *
 *   node tools/build-standalone.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('index.html');

/* CSS */
html = html.replace(
  /<link rel="stylesheet" href="\.\/assets\/css\/app\.css">/,
  () => '<style>\n' + read('assets/css/app.css') + '\n</style>'
);

/* the logo, so the file has no outside dependencies at all */
const logo = 'data:image/svg+xml;base64,' +
  Buffer.from(read('assets/img/logo.svg'), 'utf8').toString('base64');

/* icons that only matter to a real install */
html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');

/* every script, in the order index.html lists them */
const scripts = [...html.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!scripts.length) {
  console.error('build-standalone: no scripts found in index.html');
  process.exit(1);
}

const preamble =
  '<script>window.__OC_PREVIEW__ = true;\n' +
  'window.__OC_GAS_CODE__ = ' + JSON.stringify(read('gas/Code.gs')) + ';\n' +
  'window.__OC_LOGO__ = ' + JSON.stringify(logo) + ';</script>';

const bundle = scripts
  .map((src) => '<!-- ' + src + ' -->\n<script>\n' + read(src) + '\n</script>')
  .join('\n');

html = html.replace(/<script src="\.\/[^"]+"><\/script>\s*/g, '');
html = html.replace('</body>', preamble + '\n' + bundle + '\n</body>');

/* do this last so the inlined scripts get it too */
html = html.split('./assets/img/logo.svg').join(logo);

fs.mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, 'oakcraft-stock-standalone.html');
fs.writeFileSync(out, html);
console.log(
  `build-standalone: ${scripts.length} scripts inlined -> dist/oakcraft-stock-standalone.html ` +
  `(${(fs.statSync(out).size / 1024).toFixed(0)} KB)`
);
