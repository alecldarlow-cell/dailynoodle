#!/usr/bin/env node
/* tools/apply-ballpark-fixes.js — apply checked fact fixes to Ballpark's bank (which Reckon shares).
     node tools/apply-ballpark-fixes.js FIXES.json [--dry]
   FIXES.json: { fixes: { "<pack>:<index>": { q?, u?, a?, n? } } }. Each fact is one line of the
   `const PACKS=` block; the line is re-read, rewritten with only the listed fields changed, and the
   whole bank is re-parsed afterwards to prove every other fact is untouched. Flags never change.
   Facts are only ever edited in place: indexes are ids that the game's saves depend on. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILE = path.join(__dirname, '..', 'reports', '2026-10-15-quiz-ballpark.html');
const [fixFile] = process.argv.slice(2).filter(a => !a.startsWith('--')), DRY = process.argv.includes('--dry');
if (!fixFile) { console.error('usage: node tools/apply-ballpark-fixes.js FIXES.json [--dry]'); process.exit(2); }
const FIX = JSON.parse(fs.readFileSync(fixFile, 'utf8')).fixes;
const src = fs.readFileSync(FILE, 'utf8');
const a = src.indexOf('const PACKS=['), b = src.indexOf('const TOUR=');
const bankOf = s => vm.runInNewContext('(' + s.slice(s.indexOf('const PACKS=[') + 12, s.indexOf('const TOUR=')).trim().replace(/;$/, '') + ')', {});
const before = bankOf(src);
const lines = src.slice(a, b).split('\n');
// which line holds pack k, fact i
const at = {}; let pack = null, n = 0;
lines.forEach((l, j) => { const m = l.match(/^\{k:'(\w+)'/); if (m) { pack = m[1]; n = 0; return; } if (pack && /^\[/.test(l)) at[pack + ':' + n++] = j; });
const q1 = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
let changed = 0;
for (const [id, f] of Object.entries(FIX)) {
  const j = at[id]; if (j == null) throw new Error(id + ': not in the bank');
  const cur = vm.runInNewContext('(' + lines[j].replace(/,\s*$/, '') + ')', {});
  const [pk, i] = id.split(':'), want = before.find(p => p.k === pk).q[+i];
  if (JSON.stringify(cur) !== JSON.stringify(want)) throw new Error(id + ': line does not match the parsed bank');
  const next = [f.q ?? cur[0], f.u ?? cur[1], f.a ?? cur[2], f.n ?? cur[3], cur[4]];
  if (typeof next[2] !== 'number' || !(next[2] > 0)) throw new Error(id + ': answer must be a positive number');
  const line = '[' + q1(next[0]) + ',' + q1(next[1]) + ',' + next[2] + ',' + q1(next[3]) + ',' + next[4] + ']' + (lines[j].trimEnd().endsWith(',') ? ',' : '');
  if (line !== lines[j]) { lines[j] = line; changed++; }
}
const out = src.slice(0, a) + lines.join('\n') + src.slice(b);
const after = bankOf(out);
// prove it: only the listed facts changed, and only in the listed fields
before.forEach((p, k) => p.q.forEach((f, i) => {
  const id = p.k + ':' + i, g = after[k].q[i], fx = FIX[id];
  const want = fx ? [fx.q ?? f[0], fx.u ?? f[1], fx.a ?? f[2], fx.n ?? f[3], f[4]] : f;
  if (JSON.stringify(g) !== JSON.stringify(want)) throw new Error(id + ': unexpected result after rewrite');
}));
if (after.reduce((s, p) => s + p.q.length, 0) !== before.reduce((s, p) => s + p.q.length, 0)) throw new Error('fact count changed');
if (!DRY) fs.writeFileSync(FILE, out.replace(/(<meta name="dn:updated"\s+content=")[^"]*(")/, '$1' + new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()) + '$2'));
console.log(JSON.stringify({ facts: Object.keys(FIX).length, linesChanged: changed, dry: DRY }));
