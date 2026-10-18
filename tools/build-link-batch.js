#!/usr/bin/env node
/* tools/build-link-batch.js — stamp and gate hand-authored Link puzzles.

   Link has no generator: puzzles are authored. This tool turns an authored
   JSON batch into thin pages and gates them first, mechanically:
     - the engine's own validateLink(), read out of engines/link.js (so the
       two cannot drift), run with the BLOCKED/SENSITIVE lists widened to the
       union with 6_blocklist.json (the documented spec gap: gate on both);
     - against every live Link: no repeated category name, no group sharing 3+
       members with an earlier group, no repeated four-group partition;
     - inside the batch: the same, plus a cap on any one tile's reuse;
     - band follows the trap ledger (easy 1, medium 2–3, hard 4+), and the
       standfirst states the trap count, as every live Link does.

   Batch JSON: [{band, groups:[{rank,name,members:[4]}×4], traps:[{tile,not}]}, ...]
   Dates and serials continue from the newest live Link.

   Usage:
     node tools/build-link-batch.js --verify               # re-stamp every live Link from its own data, compare bytes
     node tools/build-link-batch.js --batch b.json --check # gate only
     node tools/build-link-batch.js --batch b.json         # gate, then write reports/
   After writing, run `node tools/og-tags.js` so each new page's link-preview
   block names its own headline and URL (the template's block is copied as is). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const args = process.argv.slice(2), has = k => args.includes(k);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

/* 6_blocklist.json (project knowledge), carried here so the gate is self-contained */
const FILE_BLOCKED = ["anal","anus","arse","bastard","bitch","boob","boobs","cunt","cunts","dick","dicks","dildo","fuck","fucks","heroin","homo","jihad","meth","nazi","nazis","negro","nude","nudes","opium","orgy","penis","pimp","porn","porno","pussy","rape","raped","rapes","semen","sex","sexy","sperm","twat","whore"];
const FILE_SENSITIVE = ["ass","bra","coke","crack","damn","hell","jew","jews","slave","suck","sucks","tit","tits"];

function loadGate() {
  const src = fs.readFileSync(path.join(ROOT, 'engines/link.js'), 'utf8');
  const a = src.indexOf('const BLOCKED='), b = src.indexOf('const gate=validateLink(SAMPLE)');
  if (a < 0 || b < 0) throw new Error('gate anchors not found in engines/link.js');
  const ctx = { FILE_BLOCKED, FILE_SENSITIVE };
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b).replace('const BLOCKED=', 'let BLOCKED=').replace('const SENSITIVE=', 'let SENSITIVE=') +
    '\nBLOCKED=[...new Set([...BLOCKED,...FILE_BLOCKED])];SENSITIVE=[...new Set([...SENSITIVE,...FILE_SENSITIVE])];' +
    '\nthis.G={validateLink,BLOCKED,SENSITIVE};', ctx);
  return ctx.G;
}
const G = loadGate();

/* ---- live Links ---- */
const live = () => fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-word-link-\d{4}\.html$/.test(f)).sort();
const PZ_RE = /window\.DN_PUZZLE=\{[\s\S]*?\n\};/;
function parse(s) { return Function('return ' + s.match(PZ_RE)[0].replace(/^window\.DN_PUZZLE=/, '').replace(/;$/, ''))(); }

/* ---- formatting, matched to the live pages ---- */
const WORD = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
function standfirst(n) {
  return 'Sixteen tiles, four hidden groups, four mistakes. ' +
    (n === 1 ? 'One of them is lying to you about which group it\'s in.' : `${WORD[n]} of them are lying to you about which group they're in.`);
}
function block(p) {
  const nw = Math.max(...p.groups.map(g => JSON.stringify(g.name).length + 1));
  const gl = p.groups.map(g => `    {rank:${g.rank}, name:${(JSON.stringify(g.name) + ',').padEnd(nw)} members:[${g.members.map(m => JSON.stringify(m)).join(',')}]}`);
  const tw = Math.max(0, ...(p.traps || []).map(t => JSON.stringify(t.tile).length + 1));
  const tl = (p.traps || []).map(t => `    {tile:${(JSON.stringify(t.tile) + ',').padEnd(tw)} not:${JSON.stringify(t.not)}}`);
  return 'window.DN_PUZZLE={\n' +
    `  type:"link", id:${JSON.stringify(p.id)}, band:${JSON.stringify(p.band)},\n` +
    '  groups:[\n' + gl.join(',\n') + '\n  ],\n' +
    '  /* The trap ledger: every tile the author knows reads as a member of another\n' +
    '     group, and the group it must NOT land in. Gated, so a trap can\'t silently\n' +
    '     rot into a genuine ambiguity. The rule the ledger enforces: a trap is only\n' +
    '     fair if the group it\'s tempting you away from is full of members at least\n' +
    '     as well known as the trap itself. */\n' +
    '  traps:[\n' + tl.join(',\n') + '\n  ]\n};';
}
function stamp(tpl, p, serial, date) {
  const ser = String(serial).padStart(4, '0');
  let s = tpl;
  s = s.replace(/(name="dn:headline"\s+content=")[^"]*(")/, `$1Link ${ser}$2`);
  s = s.replace(/(name="dn:standfirst"\s+content=")[^"]*(")/, `$1${standfirst((p.traps || []).length)}$2`);
  s = s.replace(/(name="dn:date"\s+content=")[^"]*(")/, `$1${date}$2`);
  s = s.replace(/(<span id="pid">)[^<]*(<\/span>)/, `$1DP·LINK·${ser}$2`);
  s = s.replace(/(<span class="tag" id="pband">)[^<]*(<\/span>)/, `$1${p.band}$2`);
  return s.replace(PZ_RE, () => block({ ...p, id: 'DP·LINK·' + ser }));
}

/* ---- gate ---- */
const norm = t => String(t).trim().toUpperCase();
const nameKey = n => String(n).toLowerCase().replace(/[^a-z_ ]/g, '').replace(/\s+/g, ' ').trim();
const partKey = p => p.groups.map(g => g.members.map(norm).sort().join('+')).sort().join('|');
function bandOk(p) { const n = (p.traps || []).length; return p.band === 'easy' ? n <= 1 : p.band === 'medium' ? (n >= 2 && n <= 3) : p.band === 'hard' ? n >= 4 : false; }
function gateBatch(batch, liveP) {
  const errs = [], warns = [];
  const seenNames = new Map(), seenGroups = [], seenParts = new Set(), tileUse = new Map();
  liveP.forEach(({ f, P }) => { P.groups.forEach(g => { seenNames.set(nameKey(g.name), f); seenGroups.push({ f, name: g.name, m: new Set(g.members.map(norm)) }); }); seenParts.add(partKey(P)); });
  batch.forEach((p, k) => {
    const tag = `#${k} (${p.groups.map(g => g.name).join(' / ')})`;
    const v = G.validateLink(p);
    if (!v.pass) errs.push(`${tag}: ${Object.keys(v.checks).filter(c => !v.checks[c]).join(', ')}`);
    if (!bandOk(p)) errs.push(`${tag}: band ${p.band} with ${(p.traps || []).length} traps`);
    if (!(p.traps || []).length) errs.push(`${tag}: no trap ledger`);
    if (seenParts.has(partKey(p))) errs.push(`${tag}: same partition as an earlier Link`);
    seenParts.add(partKey(p));
    p.groups.forEach(g => {
      const nk = nameKey(g.name);
      if (seenNames.has(nk)) errs.push(`${tag}: category name "${g.name}" already used (${seenNames.get(nk)})`);
      const m = new Set(g.members.map(norm));
      for (const o of seenGroups) { const sh = [...m].filter(x => o.m.has(x)).length; if (sh >= 3) errs.push(`${tag}: "${g.name}" shares ${sh} members with "${o.name}" (${o.f})`); }
      seenNames.set(nk, `batch #${k}`); seenGroups.push({ f: `batch #${k}`, name: g.name, m });
      g.members.forEach(t => tileUse.set(norm(t), (tileUse.get(norm(t)) || 0) + 1));
    });
  });
  for (const [t, n] of tileUse) if (n > 2) warns.push(`tile ${t} used ${n}× in this batch`);
  return { errs, warns };
}
const addDay = (d, k) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };

module.exports = { G, stamp, block, standfirst, gateBatch, parse, live };
if (require.main === module) main();

function main() {
  const files = live(), lastF = files.at(-1);
  const read = f => fs.readFileSync(path.join(REPORTS, f), 'utf8');
  const tpl = read(lastF);
  const liveP = files.map(f => ({ f, P: parse(read(f)) }));
  if (has('--verify')) {
    let same = 0; const diff = [];
    const OG = /<!-- og:start[^>]*-->[\s\S]*?<!-- og:end -->\n?/;   // written per file by tools/og-tags.js
    for (const { f, P } of liveP) { const s = read(f); const out = stamp(tpl, P, parseInt(f.slice(-9, -5), 10), f.slice(0, 10)); if (out.replace(OG, '') === s.replace(OG, '')) same++; else diff.push(f); }
    const gateFails = liveP.filter(({ P }) => !G.validateLink(P).pass).map(x => x.f);
    console.log(JSON.stringify({ live: files.length, byteIdentical: same, differ: diff.length, firstDiffs: diff.slice(0, 5), failUnionGate: gateFails }));
    return;
  }
  const bf = arg('--batch'); if (!bf) { console.error('need --batch file.json (or --verify)'); process.exit(1); }
  const batch = JSON.parse(fs.readFileSync(bf, 'utf8'));
  const { errs, warns } = gateBatch(batch, liveP);
  warns.forEach(w => console.log('WARN ' + w));
  errs.forEach(e => console.log('ERROR ' + e));
  const lastSerial = parseInt(lastF.slice(-9, -5), 10), lastDate = lastF.slice(0, 10);
  const bands = batch.reduce((a, p) => (a[p.band] = (a[p.band] || 0) + 1, a), {});
  console.log(JSON.stringify({ puzzles: batch.length, bands, errors: errs.length, warnings: warns.length,
    from: `${addDay(lastDate, 1)} #${lastSerial + 1}`, to: `${addDay(lastDate, batch.length)} #${lastSerial + batch.length}` }));
  if (errs.length || has('--check')) process.exit(errs.length ? 1 : 0);
  batch.forEach((p, k) => {
    const serial = lastSerial + 1 + k, date = addDay(lastDate, 1 + k);
    fs.writeFileSync(path.join(REPORTS, `${date}-word-link-${String(serial).padStart(4, '0')}.html`), stamp(tpl, p, serial, date));
  });
  console.log(`wrote ${batch.length} files`);
}
