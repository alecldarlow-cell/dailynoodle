#!/usr/bin/env node
/* tools/build-sweep-batch.js — build-time Sweep generator (typespec v3.1).

   The player cannot mint a puzzle; this can. It scans seeded random 6x6
   boards with seven mines, keeps those that pass the SAME ship gate the
   player runs at load (the gate code is read out of engines/sweep.js, not
   copied, so the two cannot drift), scores them, dedupes under D4 against
   every Sweep already in reports/ and against each other, and stamps the
   chosen grids into thin pages cloned from the newest existing Sweep.

   Usage:
     node tools/build-sweep-batch.js --report               # score the existing 6x6 Sweeps
     node tools/build-sweep-batch.js --through 2028-08-16 [--seeds 2000000] [--seed 1] [--dry]

   New days run from the day after the last Sweep in reports/ through
   --through. Serials continue the headline count ("Sweep 0397", ...).
   Ids stay dated (DP·SWEEP·YYYY-MM-DD) and files stay
   YYYY-MM-DD-logic-sweep.html, as every Sweep before them.

   Selection: score = rounds*10 + subsetUses*25 + hidden (typespec). Passing
   grids are drawn so the new run's score distribution matches the existing
   6x6 run's (quantile matching), so difficulty doesn't jump at the seam.
   Then the chosen set is shuffled deterministically across the dates. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = k => args.includes(k);

/* ---- the gate, read verbatim from the engine ---- */
function loadGate() {
  const src = fs.readFileSync(path.join(ROOT, 'engines/sweep.js'), 'utf8');
  const a = src.indexOf('const N=6'), b = src.indexOf('/* ================= The shipped puzzle');
  if (a < 0 || b < 0) throw new Error('gate anchors not found in engines/sweep.js');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) +
    '\nthis.G={N,CELLS,ix,rc,NB,BAND,counts,cascade,deduceStep,solveNoGuess,countSolutions,validateSweep};', ctx);
  return ctx.G;
}
const G = loadGate();
const { N, CELLS, NB } = G;

/* ---- scoring: an instrumented replay of the prover (score only, not gate) ---- */
function score(ms, opening, n) {
  const revealed = new Set(opening), flagged = new Set(), total = ms.size, safeCount = CELLS - total;
  let rounds = 0, subsetUses = 0, progress = true;
  while (progress) {
    progress = false; rounds++;
    const d = G.deduceStep(revealed, flagged, n, total, true);
    if (d.usedSubset) subsetUses++;
    for (const x of d.mine) if (!flagged.has(x)) { flagged.add(x); progress = true; }
    for (const x of d.safe) {
      if (revealed.has(x) || flagged.has(x)) continue;
      if (ms.has(x)) return null;
      for (const y of G.cascade(x, n)) revealed.add(y);
      progress = true;
    }
    if (revealed.size === safeCount) break;
  }
  if (revealed.size !== safeCount) return null;
  const hidden = CELLS - opening.size;
  return { rounds, subsetUses, hidden, opening: opening.size, score: rounds * 10 + subsetUses * 25 + hidden };
}

/* ---- D4 key on the mine set (6: namespaced by board size, per typespec) ---- */
const SYM = [
  (r, c) => [r, c], (r, c) => [c, N - 1 - r], (r, c) => [N - 1 - r, N - 1 - c], (r, c) => [N - 1 - c, r],
  (r, c) => [r, N - 1 - c], (r, c) => [N - 1 - r, c], (r, c) => [c, r], (r, c) => [N - 1 - c, N - 1 - r]];
function d4key(mines0) { // 0-indexed [r,c]
  let best = null;
  for (const f of SYM) {
    const k = mines0.map(([r, c]) => f(r, c)).map(([r, c]) => r * N + c).sort((x, y) => x - y).join(',');
    if (best === null || k < best) best = k;
  }
  return N + ':' + best;
}

/* ---- existing Sweeps ---- */
function grabArr(s, i) { let j = s.indexOf('[', i), d = 0, k = j; for (; k < s.length; k++) { if (s[k] === '[') d++; else if (s[k] === ']') { d--; if (!d) break; } } return JSON.parse(s.slice(j, k + 1)); }
function readExisting() {
  return fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-logic-sweep\.html$/.test(f)).sort().map(f => {
    const s = fs.readFileSync(path.join(REPORTS, f), 'utf8');
    const grid = grabArr(s, s.search(/\bgrid\s*:\s*\[/));
    return { f, s, date: f.slice(0, 10), N: grid.length,
      headline: (s.match(/name="dn:headline"\s+content="([^"]*)"/) || [])[1],
      mines: grabArr(s, s.search(/\bmines\s*:\s*\[/)), start: grabArr(s, s.search(/\bstart\s*:\s*\[/)) };
  });
}
function evalPuzzle(mines1, start1) {
  const mines = mines1.map(([r, c]) => [r - 1, c - 1]), start = [start1[0] - 1, start1[1] - 1];
  const v = G.validateSweep(mines, start);
  const ms = new Set(mines.map(([r, c]) => G.ix(r, c)));
  return { v, sc: v.pass ? score(ms, v.opening, v.n) : null, key: d4key(mines) };
}

/* ---- seeded RNG (mulberry32) ---- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Build-time screen only (typespec: a pruned enumerator may be used to scan,
   never in the player). Counts mine placements consistent with the opening
   view: backtrack over frontier cells, count interior cells combinatorially.
   Every grid that ships is still re-proved by the engine's brute-force
   countSolutions() via validateSweep(). */
const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); };
function fastCount(opening, n, total, cap = 2) {
  const cons = [];
  for (const i of opening) { const hid = NB[i].filter(j => !opening.has(j)); if (hid.length) cons.push({ hid, need: n[i] }); }
  const front = [...new Set(cons.flatMap(c => c.hid))];
  const interior = CELLS - opening.size - front.length;
  const pos = new Map(front.map((c, k) => [c, k]));
  const cl = cons.map(c => c.hid.map(h => pos.get(h)));
  const byCell = front.map(() => []); cl.forEach((c, ci) => c.forEach(k => byCell[k].push(ci)));
  const val = new Int8Array(front.length).fill(-1), mines = new Int32Array(cl.length), unk = cl.map(c => c.length);
  let found = 0;
  (function rec(k, m) {
    if (found >= cap || m > total) return;
    if (k === front.length) { found += C(interior, total - m); return; }
    for (const v of [0, 1]) {
      let ok = true; val[k] = v;
      for (const ci of byCell[k]) { mines[ci] += v; unk[ci]--; const need = cons[ci].need; if (mines[ci] > need || mines[ci] + unk[ci] < need) ok = false; }
      if (ok) rec(k + 1, m + v);
      for (const ci of byCell[k]) { mines[ci] -= v; unk[ci]++; }
      val[k] = -1; if (found >= cap) return;
    }
  })(0, 0);
  return found;
}

/* One candidate per seed: random mine set; for each zero cell (in a seeded
   order) try it as the opening; keep the best-scoring passing opening. */
function candidate(seed) {
  const R = rng(seed), cells = [...Array(CELLS).keys()];
  for (let i = CELLS - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const ms = new Set(cells.slice(0, G.BAND.mines)), n = G.counts(ms);
  const zeros = []; for (let i = 0; i < CELLS; i++) if (n[i] === 0) zeros.push(i);
  if (!zeros.length) return null;
  const seenOpen = new Set(); let best = null;
  for (const z of zeros) {
    const opening = G.cascade(z, n), okey = [...opening].sort((a, b) => a - b).join(',');
    if (seenOpen.has(okey)) continue; seenOpen.add(okey);
    const safe = CELLS - ms.size;
    if (safe - opening.size < Math.ceil(safe * 0.4)) continue;
    if (fastCount(opening, n, ms.size) !== 1) continue;
    if (!G.solveNoGuess(ms, opening, n, true).ok) continue;
    const sc = score(ms, opening, n);
    // start = the opening's zero cell nearest the opening's centroid (stable, readable)
    const zs = [...opening].filter(i => n[i] === 0);
    const cr = zs.reduce((a, i) => a + G.rc(i)[0], 0) / zs.length, cc = zs.reduce((a, i) => a + G.rc(i)[1], 0) / zs.length;
    zs.sort((a, b) => { const [ar, ac] = G.rc(a), [br, bc] = G.rc(b); return ((ar - cr) ** 2 + (ac - cc) ** 2) - ((br - cr) ** 2 + (bc - cc) ** 2) || a - b; });
    const st = zs[0];
    if (!best || sc.score > best.sc.score) best = { ms, st, sc };
  }
  if (!best) return null;
  const mines1 = [...best.ms].sort((a, b) => a - b).map(i => { const [r, c] = G.rc(i); return [r + 1, c + 1]; });
  const [sr, scc] = G.rc(best.st);
  return { seed, mines: mines1, start: [sr + 1, scc + 1], sc: best.sc };
}

/* ---- stamping: clone the newest Sweep, replace only the permitted regions ---- */
function fmtPuzzle(p) {
  const ind = (v, d) => JSON.stringify(v, null, 2).replace(/\n/g, '\n' + '  '.repeat(d));
  return 'window.DN_PUZZLE={\n' +
    '  type: ' + JSON.stringify(p.type) + ',\n' +
    '  id: ' + JSON.stringify(p.id) + ',\n' +
    '  band: ' + JSON.stringify(p.band) + ',\n' +
    '  grid: ' + ind(p.grid, 1) + ',\n' +
    '  mines: ' + ind(p.mines, 1) + ',\n' +
    '  start: ' + ind(p.start, 1) + '\n};';
}
const PZ_RE = /window\.DN_PUZZLE=\{[\s\S]*?\n\};/;
function stamp(tpl, { date, serial, mines, start }) {
  const grid = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (r === start[0] - 1 && c === start[1] - 1) ? 'o' : '.'));
  let s = tpl;
  const o1 = s;
  s = s.replace(/(name="dn:headline"\s+content=")[^"]*(")/, `$1Sweep ${String(serial).padStart(4, '0')}$2`);
  s = s.replace(/(name="dn:date"\s+content=")[^"]*(")/, `$1${date}$2`);
  if (!PZ_RE.test(s)) throw new Error('DN_PUZZLE block not found in template');
  s = s.replace(PZ_RE, fmtPuzzle({ type: 'sweep', id: 'DP·SWEEP·' + date, band: 'medium', grid, mines, start }));
  if (s === o1) throw new Error('stamp was a no-op');
  return s;
}
const addDay = (d, k) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };

module.exports = { G, stamp, fmtPuzzle, d4key, evalPuzzle, readExisting, score, candidate, fastCount };
if (require.main === module) main();

/* ================= main ================= */
function main() {
const existing = readExisting();
const six = existing.filter(e => e.N === 6);
const exScored = six.map(e => ({ e, ...evalPuzzle(e.mines, e.start) }));
const failing = exScored.filter(x => !x.v.pass);
if (failing.length) console.warn('WARNING existing 6x6 Sweeps failing the gate:', failing.map(x => x.e.f));
const exScores = exScored.filter(x => x.sc).map(x => x.sc.score).sort((a, b) => a - b);
const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];

if (has('--report')) {
  const keys = new Map(); let dupes = 0;
  for (const x of exScored) { if (keys.has(x.key)) { dupes++; console.log('D4 duplicate:', keys.get(x.key), x.e.f); } else keys.set(x.key, x.e.f); }
  const m = k => (exScored.reduce((a, x) => a + (x.sc ? x.sc[k] : 0), 0) / exScored.length).toFixed(2);
  console.log(JSON.stringify({ sweeps: existing.length, sixBySix: six.length, gateFails: failing.length, d4dupes: dupes,
    score: { min: exScores[0], p10: q(exScores, .1), p50: q(exScores, .5), p90: q(exScores, .9), max: exScores.at(-1) },
    mean: { rounds: m('rounds'), subsetUses: m('subsetUses'), hidden: m('hidden'), opening: m('opening') } }, null, 1));
  process.exit(0);
}

const through = arg('--through');
if (!through) { console.error('need --through YYYY-MM-DD (or --report)'); process.exit(1); }
const last = existing.at(-1);
const lastSerial = parseInt(last.headline.match(/(\d+)\s*$/)[1], 10);
const days = []; for (let d = addDay(last.date, 1); d <= through; d = addDay(d, 1)) days.push(d);
if (!days.length) { console.log('nothing to build'); process.exit(0); }

const usedKeys = new Set(existing.map(e => d4key(e.mines.map(([r, c]) => [r - 1, c - 1]))));
const SEEDS = +arg('--seeds', 2000000), BASE = +arg('--seed', 1);
const pool = new Map(); // d4key -> best candidate
const t0 = Date.now(); let passes = 0;
for (let s = 0; s < SEEDS; s++) {
  const c = candidate(BASE * 1e7 + s);
  if (!c) continue;
  passes++;
  const key = d4key(c.mines.map(([r, cc]) => [r - 1, cc - 1]));
  if (usedKeys.has(key)) continue;
  const prev = pool.get(key);
  if (!prev || c.sc.score > prev.sc.score) pool.set(key, { ...c, key });
  if (s % 250000 === 0 && s) console.error(`  ${s} seeds, ${passes} prover-passes, ${pool.size} distinct new, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.error(`scan: ${SEEDS} seeds, ${passes} prover-passes, ${pool.size} D4-distinct new grids, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

/* full ship gate (incl. brute-force uniqueness) on the pool, best first */
const ranked = [...pool.values()].sort((a, b) => b.sc.score - a.sc.score || a.seed - b.seed);
/* quantile-match: for each target quantile of the existing run, take the
   closest-scoring unused gate-passing grid */
const targets = days.map((_, i) => q(exScores, (i + 0.5) / days.length));
const byScore = new Map(); for (const c of ranked) { if (!byScore.has(c.sc.score)) byScore.set(c.sc.score, []); byScore.get(c.sc.score).push(c); }
const scoresAvail = [...byScore.keys()].sort((a, b) => a - b);
const chosen = []; let gateRejects = 0;
for (const t of targets.slice().reverse()) {          // hardest targets first, so the top of the pool isn't spent low
  let pick = null;
  const order = scoresAvail.slice().sort((a, b) => Math.abs(a - t) - Math.abs(b - t) || b - a);
  for (const sc of order) {
    const list = byScore.get(sc);
    while (list.length) {
      const c = list.shift();
      const v = G.validateSweep(c.mines.map(([r, cc]) => [r - 1, cc - 1]), [c.start[0] - 1, c.start[1] - 1]);
      if (v.pass) { pick = c; break; } gateRejects++;
    }
    if (pick) break;
  }
  if (!pick) { console.error('pool exhausted — raise --seeds'); process.exit(2); }
  chosen.push(pick);
}
/* deterministic shuffle across dates, so hard days don't cluster */
const R = rng(BASE * 7919 + days.length);
for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }

const tpl = fs.readFileSync(path.join(REPORTS, last.f), 'utf8');
const manifest = ['date,serial,file,id,score,rounds,subsetUses,hidden,opening,seed,d4key'];
days.forEach((date, i) => {
  const c = chosen[i], serial = lastSerial + 1 + i, file = `${date}-logic-sweep.html`;
  const html = stamp(tpl, { date, serial, mines: c.mines, start: c.start });
  if (!has('--dry')) fs.writeFileSync(path.join(REPORTS, file), html);
  manifest.push([date, serial, file, 'DP·SWEEP·' + date, c.sc.score, c.sc.rounds, c.sc.subsetUses, c.sc.hidden, c.sc.opening, c.seed, '"' + c.key + '"'].join(','));
});
const mf = arg('--manifest');
if (mf) fs.writeFileSync(mf, manifest.join('\n') + '\n');
const ns = chosen.map(c => c.sc.score).sort((a, b) => a - b);
console.log(JSON.stringify({ days: days.length, from: days[0], to: days.at(-1), serials: [lastSerial + 1, lastSerial + days.length],
  gateRejects, newScore: { min: ns[0], p10: q(ns, .1), p50: q(ns, .5), p90: q(ns, .9), max: ns.at(-1) },
  existingScore: { min: exScores[0], p10: q(exScores, .1), p50: q(exScores, .5), p90: q(exScores, .9), max: exScores.at(-1) },
  dry: has('--dry') }, null, 1));
}
