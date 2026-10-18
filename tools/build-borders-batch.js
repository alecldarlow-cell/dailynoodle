#!/usr/bin/env node
/* tools/build-borders-batch.js — build-time Borders generator (typespec v2).

   Rebuilt 18 Oct 2026 from the typespec and proved against the live run: it
   reproduces all 365 days of batch 1 (DP·BORD·0001–0365) exactly, countries,
   order and options. Each day is a pure function of its date:
     - outlines come byte-for-byte from Borderline's `const DATA=` line in
       reports/2026-10-05-quiz-borderline.html (read by anchor);
     - tiers 1/2/3 are seeded shuffled decks, `borders-deck-<tier>-<n>`, used
       3/5/2 a day for 15/18/15 days; deck n's first 3 days swap out anything
       deck n-1 used in its last 3 days, so no country returns inside 4 days;
     - wrong options are 3 of the answer's 8 nearest countries (great-circle on
       centroid), seeded `borders-opts-<date>-<q>`, option order seeded too.
   Hash and RNG are Borderline's own hashStr (FNV-1a) and rng (mulberry32).

   Usage:
     node tools/build-borders-batch.js --verify                 # rebuild every live day in memory, compare byte for byte
     node tools/build-borders-batch.js --through 2028-08-16 [--dry]
   New days are stamped from the newest Borders page; only the dn:headline,
   dn:date and the DN_PUZZLE line change. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const args = process.argv.slice(2), has = k => args.includes(k);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

/* ---- atlas, by anchor ---- */
function loadData() {
  const s = fs.readFileSync(path.join(REPORTS, '2026-10-05-quiz-borderline.html'), 'utf8');
  const i = s.indexOf('const DATA=');
  if (i < 0) throw new Error('const DATA= not found in Borderline');
  let j = s.indexOf('{', i), d = 0, k = j, str = false;
  for (; k < s.length; k++) {
    const ch = s[k];
    if (str) { if (ch === '\\') { k++; continue; } if (ch === '"') str = false; continue; }
    if (ch === '"') { str = true; continue; }
    if (ch === '{') d++; else if (ch === '}') { d--; if (!d) break; }
  }
  return JSON.parse(s.slice(j, k + 1));
}
const DATA = loadData();
// DATA.c row: [n, t, lo, la, km, x, y, d, K, tx, ty]
const C = DATA.c.map((r, i) => ({ i, n: r[0], t: r[1], lo: r[2], la: r[3], row: r }));

/* ---- Borderline's own hash / RNG / shuffle / distance ---- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function gdist(a, b) { const r = Math.PI / 180, s1 = Math.sin((b.la - a.la) * r / 2), s2 = Math.sin((b.lo - a.lo) * r / 2); return 2 * Math.asin(Math.min(1, Math.sqrt(s1 * s1 + Math.cos(a.la * r) * Math.cos(b.la * r) * s2 * s2))); }
const near8 = c => C.filter(o => o.i !== c.i).map(o => [gdist(c, o), o.i]).sort((a, b) => a[0] - b[0]).slice(0, 8).map(x => x[1]);

/* ---- the schedule ---- */
const PLAN = [1, 1, 1, 2, 2, 2, 2, 2, 3, 3];
const PER = { 1: 3, 2: 5, 3: 2 }, CYCLE = { 1: 15, 2: 18, 3: 15 };
const DAY0 = Date.UTC(2026, 9, 5); // serial 0001
const dayIdx = date => Math.round((Date.parse(date + 'T00:00:00Z') - DAY0) / 864e5);
const dateOf = idx => new Date(DAY0 + idx * 864e5).toISOString().slice(0, 10);
const decks = {};
function deck(t, n) {
  const key = t + '-' + n; if (decks[key]) return decks[key];
  const d = shuffle(C.filter(c => c.t === t).map(c => c.i), rng(hashStr(`borders-deck-${t}-${n}`)));
  if (n > 0) {
    const prev = deck(t, n - 1), M = 3 * PER[t];
    const ban = new Set(prev.slice((CYCLE[t] - 3) * PER[t], CYCLE[t] * PER[t]));
    let j = M;
    for (let k = 0; k < M; k++) if (ban.has(d[k])) {
      while (j < d.length && ban.has(d[j])) j++;
      if (j >= d.length) throw new Error('deck swap ran out');
      [d[k], d[j]] = [d[j], d[k]]; j++;
    }
  }
  return decks[key] = d;
}
function day(date) {
  const di = dayIdx(date), ids = [];
  for (const t of [1, 2, 3]) { const n = Math.floor(di / CYCLE[t]), p = di % CYCLE[t]; ids.push(...deck(t, n).slice(p * PER[t], (p + 1) * PER[t])); }
  const qs = ids.map((i, q) => {
    const c = C[i], r = rng(hashStr(`borders-opts-${date}-${q}`));
    const opts = shuffle([c.i, ...shuffle(near8(c), r).slice(0, 3)], r);
    const [n, t, lo, la, km, x, y, d, K, tx, ty] = c.row;
    return { n, i, t, lo, la, km, x, y, d, K, tx, ty, o: opts.map(k => C[k].n) };
  });
  const serial = di + 1;
  return { id: 'DP·BORD·' + String(serial).padStart(4, '0'), date, serial, qs };
}

/* ---- stamping ---- */
const pzLine = p => `window.DN_PUZZLE={id:${JSON.stringify(p.id)},date:${JSON.stringify(p.date)},band:"standard",qs:${JSON.stringify(p.qs)}};`;
const PZ_RE = /window\.DN_PUZZLE=\{id:.*\};/;
function stamp(tpl, p) {
  let s = tpl;
  s = s.replace(/(name="dn:headline"\s+content=")[^"]*(")/, `$1Borders ${String(p.serial).padStart(4, '0')}$2`);
  s = s.replace(/(name="dn:date"\s+content=")[^"]*(")/, `$1${p.date}$2`);
  if (!PZ_RE.test(s)) throw new Error('DN_PUZZLE line not found in template');
  return s.replace(PZ_RE, () => pzLine(p));
}
const fileOf = p => `${p.date}-geo-borders-${String(p.serial).padStart(4, '0')}.html`;
const live = () => fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-geo-borders-\d{4}\.html$/.test(f)).sort();

module.exports = { DATA, C, day, stamp, pzLine, near8, dayIdx, dateOf, PLAN, live, fileOf };
if (require.main === module) main();

function main() {
  const files = live(), last = files.at(-1);
  const tpl = fs.readFileSync(path.join(REPORTS, last), 'utf8');
  if (has('--verify')) {
    let same = 0, pzSame = 0; const bad = [];
    for (const f of files) {
      const s = fs.readFileSync(path.join(REPORTS, f), 'utf8'), p = day(f.slice(0, 10));
      if (f !== fileOf(p)) { bad.push(f + ' (name)'); continue; }
      // shell v1 (0001–0002) is self-contained and carries `const PUZZLE=`; same payload
      const got = (s.match(PZ_RE) || [])[0] || ((s.match(/const PUZZLE=\{id:.*\};/) || [])[0] || '').replace(/^const PUZZLE=/, 'window.DN_PUZZLE=');
      if (got === pzLine(p)) pzSame++; else bad.push(f);
      if (stamp(tpl, p) === s) same++;
    }
    console.log(JSON.stringify({ live: files.length, puzzleLineIdentical: pzSame, wholeFileIdenticalFromNewestTemplate: same, mismatches: bad.slice(0, 10) }));
    process.exit(bad.length ? 1 : 0);
  }
  const through = arg('--through');
  if (!through) { console.error('need --through YYYY-MM-DD (or --verify)'); process.exit(1); }
  const out = [];
  for (let di = dayIdx(last.slice(0, 10)) + 1; dateOf(di) <= through; di++) {
    const p = day(dateOf(di)), f = fileOf(p);
    if (!has('--dry')) fs.writeFileSync(path.join(REPORTS, f), stamp(tpl, p));
    out.push(f);
  }
  console.log(JSON.stringify({ written: out.length, first: out[0], last: out.at(-1), dry: has('--dry') }));
}
