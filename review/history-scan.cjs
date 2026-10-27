'use strict';
// Offline pattern scan. Reports locations/categories, never matched values.
const cp = require('node:child_process');
const fs = require('node:fs');
const git = (args, input) => cp.execFileSync('git', args, { input, maxBuffer: 512 * 1024 * 1024 });
const objects = git(['rev-list', '--objects', '--all']).toString().trim().split('\n').map(line => ({ oid: line.slice(0,40), path: line.slice(41) })).filter(x => x.path && !/\.(png|jpg|jpeg|gif|webp|ico|mp4|woff2?|ttf|zip|pdf)$/i.test(x.path));
const info = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], objects.map(x => x.oid).join('\n') + '\n').toString().trim().split('\n');
const selected = objects.filter((x,i) => { const [, type, size] = info[i].split(' '); return type === 'blob' && +size < 2 * 1024 * 1024; });
const batch = git(['cat-file', '--batch'], selected.map(x => x.oid).join('\n') + '\n');
const headObjects = new Set(git(['ls-tree', '-r', 'HEAD']).toString().split('\n').map(line => line.split(/\s+/)[2]));
const addedObjects = new Set(git(['diff', '--raw', '--no-abbrev', 'HEAD^', 'HEAD']).toString().split('\n').map(line => line.split(/\s+/)[3]));
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['provider-token', /\b(?:sk-proj-[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9]{32,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sb_secret_[A-Za-z0-9_-]{20,})\b/g],
  ['literal-sensitive-setting', /\b(?:JWT_SECRET|SUPABASE_SERVICE_KEY|RAZORPAY_KEY_SECRET|GROQ_API_KEY|GEMINI_API_KEY)\s*[:=]\s*(['"])([^'"\r\n]{8,})\1/g],
  ['hardcoded-jwt-fallback', /process\.env\.JWT_SECRET\s*\|\|\s*(['"])([^'"\r\n]+)\1/g],
  ['embedded-jwt', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g]
];
let offset = 0, scanned = 0; const findings = [], fixtures = [];
for (const object of selected) {
  const eol = batch.indexOf(10, offset); const size = +batch.toString('ascii', offset, eol).split(' ')[2];
  const bytes = batch.subarray(eol + 1, eol + 1 + size); offset = eol + 1 + size + 1;
  if (bytes.includes(0)) continue; scanned++;
  const source = bytes.toString('utf8');
  for (const [rule, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const value = match[2] || match[0];
      let fixture = /(?:fixture|test-|example|placeholder|your[_ -]|PRIVATE_|another-secret)/i.test(value);
      if (rule === 'embedded-jwt') { try { const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url')); if (payload.role === 'anon') fixture = true; } catch {} }
      const item = { rule, path: object.path, line: source.slice(0, match.index).split('\n').length, blob: object.oid, inHEAD: headObjects.has(object.oid), inSecurityCommit: addedObjects.has(object.oid) };
      (fixture ? fixtures : findings).push(item);
    }
  }
}
const report = { method: 'offline regex scan; no credential validity checks; binary and >2MiB blobs excluded', commits: +git(['rev-list', '--all', '--count']).toString(), textBlobs: scanned, findings, fixtureOrPublicAnonMatches: fixtures.length };
fs.writeFileSync('review/history-scan.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
