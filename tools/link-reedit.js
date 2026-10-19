#!/usr/bin/env node
/* tools/link-reedit.js — re-edit forthcoming Links IN PLACE (added 19 Oct 2026).

   Same file, URL, id, serial and date, so links and saved progress survive; only
   the puzzle block, band and standfirst change. Gates each puzzle with the same
   checks as build-link-batch.js (engine gate with the union blocklist, no repeated
   category name or partition, no group sharing 3+ members with any other Link),
   compared against every live Link EXCEPT the ones being replaced, plus the
   editing rules agreed on 19 Oct 2026:
     R1 the hardest group (rank 4) is wordplay or a decoy set, never a synonym set
        ("Ways to ...", "Words for/meaning ...")
     R2 at most one synonym group per puzzle, and only at rank 1 or 2
     R4 no "Kinds of X" / "Types of X" groups where X is a tile in the puzzle
     R6 the same rank-4 kind at most twice in any 7 consecutive days of the batch
        (each batch item carries r4kind: hidden|homophone|fill|anagram|decoy|reversal|letter|other)
   Rules 3, 5 and 7 (tile-by-label check, knowledge floor, cold solve) are editorial.

   Batch JSON: [{serial, band, r4kind, groups:[{rank,name,members:[4]}×4], traps:[{tile,not}]}, ...]

   Usage (repo root):
     node tools/link-reedit.js --batch b.json --check   # gate only
     node tools/link-reedit.js --batch b.json           # gate, then rewrite the pages
   Then run `node tools/og-tags.js` so the link-preview blocks pick up the new standfirsts. */
'use strict';
const fs = require('fs'), path = require('path');
const { G, stamp, gateBatch, parse, live } = require('./build-link-batch.js');
const REPORTS = path.join(__dirname, '..', 'reports');
const args = process.argv.slice(2), has = k => args.includes(k);
const arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

const SYN = /^(ways to|words for|words meaning|other words for)\b/i;
function rules(batch) {
  const errs = [];
  batch.forEach(p => {
    const tag = `Link ${p.serial}`, tiles = new Set(p.groups.flatMap(g => g.members.map(m => m.toUpperCase())));
    const r4 = p.groups.find(g => g.rank === 4);
    if (!r4 || SYN.test(r4.name)) errs.push(`${tag}: R1 rank 4 must be wordplay or a decoy set (${r4 && r4.name})`);
    const syn = p.groups.filter(g => SYN.test(g.name));
    if (syn.length > 1) errs.push(`${tag}: R2 ${syn.length} synonym groups`);
    syn.forEach(g => { if (g.rank > 2) errs.push(`${tag}: R2 synonym group "${g.name}" at rank ${g.rank}`); });
    p.groups.forEach(g => { const m = g.name.match(/^(kinds|types) of (.+)$/i); if (m && tiles.has(m[2].toUpperCase())) errs.push(`${tag}: R4 "${g.name}" names a tile`); });
    if (!p.r4kind) errs.push(`${tag}: no r4kind`);
  });
  const sorted = batch.slice().sort((a, b) => a.serial - b.serial);
  for (let i = 0; i < sorted.length; i++) {
    const win = sorted.filter(q => q.serial >= sorted[i].serial && q.serial < sorted[i].serial + 7), n = {};
    win.forEach(q => n[q.r4kind] = (n[q.r4kind] || 0) + 1);
    for (const k in n) if (n[k] > 2) errs.push(`R6 rank-4 kind "${k}" ${n[k]} times in the 7 days from Link ${sorted[i].serial}`);
  }
  return [...new Set(errs)];
}

const bf = arg('--batch'); if (!bf) { console.error('need --batch file.json'); process.exit(2); }
const batch = JSON.parse(fs.readFileSync(bf, 'utf8'));
const files = live(), bySerial = new Map(files.map(f => [parseInt(f.slice(-9, -5), 10), f]));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const errs = [];
for (const p of batch) {
  const f = bySerial.get(p.serial);
  if (!f) errs.push(`Link ${p.serial}: no such live file`);
  else if (f.slice(0, 10) <= today) errs.push(`Link ${p.serial}: dated ${f.slice(0, 10)}, not forthcoming; never re-edit a released puzzle`);
}
const replaced = new Set(batch.map(p => bySerial.get(p.serial)));
const read = f => fs.readFileSync(path.join(REPORTS, f), 'utf8');
const liveP = files.filter(f => !replaced.has(f)).map(f => ({ f, P: parse(read(f)) }));
const g = gateBatch(batch.map(({ serial, r4kind, ...p }) => p), liveP);
errs.push(...g.errs, ...rules(batch));
g.warns.forEach(w => console.log('WARN ' + w));
errs.forEach(e => console.log('ERROR ' + e));
console.log(JSON.stringify({ puzzles: batch.length, serials: batch.map(p => p.serial), errors: errs.length, warnings: g.warns.length }));
if (errs.length || has('--check')) process.exit(errs.length ? 1 : 0);

const PZ = /window\.DN_PUZZLE=\{[\s\S]*?\n\};/;
const mask = s => s.replace(PZ, 'PZ').replace(/(name="dn:standfirst"\s+content=")[^"]*"/, '$1"').replace(/(<span class="tag" id="pband">)[^<]*/, '$1')
  .replace(/(property="og:description"\s+content=")[^"]*"/, '$1"').replace(/(name="twitter:description"\s+content=")[^"]*"/, '$1"');
for (const p of batch) {
  const f = bySerial.get(p.serial), before = read(f);
  const { serial, r4kind, ...pz } = p;
  const out = stamp(before, pz, serial, f.slice(0, 10));
  if (mask(out) !== mask(before)) throw new Error(`${f}: masked diff — unexpected change outside the puzzle block, band and standfirst`);
  fs.writeFileSync(path.join(REPORTS, f), out);
  const back = parse(read(f)), v = G.validateLink(back);           // re-parse from disk, re-run the engine gate
  if (!v.pass || JSON.stringify(back.groups) !== JSON.stringify(pz.groups)) throw new Error(`${f}: re-parse/gate failed ${JSON.stringify(v.checks)}`);
  console.log('rewrote', f);
}
