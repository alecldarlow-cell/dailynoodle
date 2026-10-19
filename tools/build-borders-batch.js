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

   Schedule v2 (19 Oct 2026, Alec's call: wider easy and medium pools, the same
   ten for everyone): from V2_FROM, the countries in V2_MOVES change tier (only
   here: Borderline's own tiers are untouched) and each tier gets fresh decks,
   `borders-v2-deck-<tier>-<n>`, with cycles of floor(pool / per-day) days.
   Deck 0 swaps out anything shown on the 3 days before V2_FROM, so the 4-day
   rule holds across the change. Days before V2_FROM are built exactly as before.

   Usage:
     node tools/build-borders-batch.js --verify                 # rebuild every live day in memory, compare byte for byte
     node tools/build-borders-batch.js --through 2028-08-16 [--dry]
     node tools/build-borders-batch.js --stats                  # pool sizes, cycles, smallest gap between repeats
     node tools/build-borders-batch.js --restamp [--dry]        # rewrite forthcoming days from V2_FROM in place
                                                                # (only the DN_PUZZLE line may change; refuses released days)
   New days are stamped from the newest Borders page; only the dn:headline,
   dn:date and the DN_PUZZLE line change.
   After writing, run `node tools/og-tags.js` so each new page's link-preview
   block names its own headline and URL (the template's block is copied as is). */
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
/* ---- schedule v2 ---- */
const V2_FROM = '2026-10-21';
const V2_MOVES = {
  // medium -> easy
  'Netherlands': 1, 'Switzerland': 1, 'Austria': 1, 'Denmark': 1, 'Croatia': 1, 'Israel': 1,
  // hard -> medium
  'Gambia': 2, 'Azerbaijan': 2, "Côte d'Ivoire": 2, 'Sierra Leone': 2, 'Bahamas': 2, 'Belize': 2,
};
for (const k in V2_MOVES) if (!C.some(c => c.n === k)) throw new Error('V2_MOVES: not in the atlas: ' + k);
const V2_DI = dayIdx(V2_FROM);
const tier2 = c => V2_MOVES[c.n] || c.t;
const POOL2 = { 1: [], 2: [], 3: [] }; C.forEach(c => POOL2[tier2(c)].push(c.i));
const CYCLE2 = { 1: Math.floor(POOL2[1].length / PER[1]), 2: Math.floor(POOL2[2].length / PER[2]), 3: Math.floor(POOL2[3].length / PER[3]) };
function ids1(di) { const ids = []; for (const t of [1, 2, 3]) { const n = Math.floor(di / CYCLE[t]), p = di % CYCLE[t]; ids.push(...deck(t, n).slice(p * PER[t], (p + 1) * PER[t])); } return ids; }
function deck2(t, n) {
  const key = 'v2-' + t + '-' + n; if (decks[key]) return decks[key];
  const d = shuffle(POOL2[t].slice(), rng(hashStr(`borders-v2-deck-${t}-${n}`)));
  const M = 3 * PER[t];
  const ban = new Set(n > 0 ? deck2(t, n - 1).slice((CYCLE2[t] - 3) * PER[t], CYCLE2[t] * PER[t])
                            : [1, 2, 3].flatMap(k => ids1(V2_DI - k)));
  let j = M;
  for (let k = 0; k < M; k++) if (ban.has(d[k])) {
    while (j < d.length && ban.has(d[j])) j++;
    if (j >= d.length) throw new Error('v2 deck swap ran out');
    [d[k], d[j]] = [d[j], d[k]]; j++;
  }
  return decks[key] = d;
}
function ids2(di) { const e = di - V2_DI, ids = []; for (const t of [1, 2, 3]) { const n = Math.floor(e / CYCLE2[t]), p = e % CYCLE2[t]; ids.push(...deck2(t, n).slice(p * PER[t], (p + 1) * PER[t])); } return ids; }
function day(date) {
  const di = dayIdx(date), v2 = di >= V2_DI, ids = v2 ? ids2(di) : ids1(di);
  const qs = ids.map((i, q) => {
    const c = C[i], r = rng(hashStr(`borders-opts-${date}-${q}`));
    const opts = shuffle([c.i, ...shuffle(near8(c), r).slice(0, 3)], r);
    const [n, t0, lo, la, km, x, y, d, K, tx, ty] = c.row, t = v2 ? tier2(c) : t0;
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

module.exports = { DATA, C, day, stamp, pzLine, near8, dayIdx, dateOf, PLAN, live, fileOf, V2_FROM, V2_MOVES, POOL2, CYCLE2 };
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
  if (has('--stats')) {
    // smallest gap between two showings of the same country, and mean gap per tier, over a window
    const from = arg('--from', V2_FROM), days = +arg('--days', 365), seen = new Map(), gaps = { 1: [], 2: [], 3: [] }; let minGap = 1e9, where = '';
    for (let di = dayIdx(from) - 20; di < dayIdx(from) + days; di++) {
      const p = day(dateOf(di));
      p.qs.forEach(q => { const last = seen.get(q.i); if (last != null && di >= dayIdx(from)) { gaps[q.t].push(di - last); if (di - last < minGap) { minGap = di - last; where = q.n + ' ' + dateOf(di); } } seen.set(q.i, di); });
    }
    const mean = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
    console.log(JSON.stringify({ from, days, pools: { 1: POOL2[1].length, 2: POOL2[2].length, 3: POOL2[3].length }, cycles: CYCLE2,
      meanGapDays: { easy: mean(gaps[1]), medium: mean(gaps[2]), hard: mean(gaps[3]) }, minGap, minGapAt: where }));
    return;
  }
  if (has('--restamp')) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
    const PZ_ONLY = t => t.replace(PZ_RE, 'PZ');
    let n = 0, same = 0;
    for (const f of files) {
      const date = f.slice(0, 10); if (date < V2_FROM) continue;
      if (date <= today) throw new Error(`${f}: released; never re-edit a released Borders`);
      const before = fs.readFileSync(path.join(REPORTS, f), 'utf8'), p = day(date);
      if (f !== fileOf(p)) throw new Error(`${f}: name does not match ${fileOf(p)}`);
      const out = before.replace(PZ_RE, () => pzLine(p));
      if (PZ_ONLY(out) !== PZ_ONLY(before)) throw new Error(`${f}: masked diff`);
      if (out === before) { same++; continue; }
      if (!has('--dry')) {
        fs.writeFileSync(path.join(REPORTS, f), out);
        if ((fs.readFileSync(path.join(REPORTS, f), 'utf8').match(PZ_RE) || [])[0] !== pzLine(p)) throw new Error(`${f}: re-read mismatch`);
      }
      n++;
    }
    console.log(JSON.stringify({ restamped: n, unchanged: same, from: V2_FROM, dry: has('--dry') }));
    return;
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
