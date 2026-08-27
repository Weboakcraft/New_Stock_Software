#!/usr/bin/env node
/*
 * Writes version.json at the repository root.
 *
 * The Android app downloads this file to find out whether the website has newer
 * screens than the ones it is running, and checks every file it fetches against
 * the SHA-256 recorded here. android/app/build.gradle writes the same shape into
 * the APK, so the two can be compared directly.
 *
 *   node tools/make-version.js [--version 2026.08.27-abc1234]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['index.html', 'offline.html', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['assets', 'gas'];
const SKIP = new Set(['.DS_Store', 'Thumbs.db', 'version.json']);

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}

function defaultVersion() {
  const sha = (process.env.GITHUB_SHA || '').slice(0, 7);
  const run = process.env.GITHUB_RUN_NUMBER || '0';
  const d = new Date();
  const stamp = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0')
  ].join('.');
  return sha ? `${stamp}-${run}-${sha}` : `${stamp}-local`;
}

const found = [];
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) found.push(p);
}
for (const d of DIRS) {
  const p = path.join(ROOT, d);
  if (fs.existsSync(p)) walk(p, found);
}

const entries = found
  .map((full) => ({
    path: path.relative(ROOT, full).split(path.sep).join('/'),
    bytes: fs.statSync(full).size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
  }))
  .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

if (!entries.some((e) => e.path === 'index.html')) {
  console.error('make-version: index.html not found — run this from the repository root.');
  process.exit(1);
}

const payload = {
  app: 'oakcraft-stock',
  version: arg('--version') || defaultVersion(),
  source: 'web',
  builtAt: Date.now(),
  files: entries
};

fs.writeFileSync(path.join(ROOT, 'version.json'), JSON.stringify(payload, null, 2) + '\n');
console.log(`make-version: ${entries.length} files, version ${payload.version}`);
