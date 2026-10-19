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
     node tools/build-sweep-batch.js --floor --check [--from YYYY-MM-DD]      # exit 1 if a forthcoming Sweep is below the floor
     node tools/build-sweep-batch.js --floor [--from YYYY-MM-DD] [--seeds 4000000] [--seed 2] [--dry] [--manifest out.csv]

   The floor (19 Oct 2026, Alec: one steady difficulty, seven mines, no harder
   days): every Sweep needs at least one two-square (subset) step between two
   numbers, i.e. it can't be finished with single-number logic plus the mine
   count, and its 3BV (fewest clicks: one per opening, plus one per number not
   on an opening's edge) is at least 8. --floor re-checks every Sweep dated
   --from on (default three days ahead, London; never today or earlier) and
   replaces IN PLACE only those below it: same file, id, date, band and
   headline; only `mines`, `start` and the grid's "o" (the start) change, which
   a masked line diff enforces. Replacements keep seven mines and the start
   convention, pass the engine's gate, are D4-distinct from every Sweep in
   reports/ (including the ones they replace) and from each other, and are
   the passing grids whose score is closest to the median score of the
   forthcoming Sweeps that already meet the floor, not the hardest. Every
   written file is re-parsed from disk and re-gated. --through applies the
   same floor to new days.

   New days run from the day after the last Sweep in reports/ through
   --through. Serials continue the headline count ("Sweep 0397", ...).
   Ids stay dated (DP·SWEEP·YYYY-MM-DD) and files stay
   YYYY-MM-DD-logic-sweep.html, as every Sweep before them.

   Selection: score = rounds*10 + subsetUses*25 + hidden (typespec). Passing
   grids are drawn so the new run's score distribution matches the existing
   6x6 run's (quantile matching, over the Sweeps that meet the floor), so
   difficulty doesn't jump at the seam.
   Then the chosen set is shuffled deterministically across the dates.
   After writing, run `node tools/og-tags.js` so each new page's link-preview
   block names its own headline and URL (the template's block is copied as is). */
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

/* ---- the floor (19 Oct 2026) ---- */
const BV_MIN = 8;
/* 3BV: the fewest clicks that clear the board: one per opening (a zero region
   with its edge), plus one per number that is not on any opening's edge. */
function bv3(ms, n = G.counts(ms)) {
  const seen = new Set(); let v = 0;
  for (let i = 0; i < CELLS; i++) { if (n[i] !== 0 || seen.has(i)) continue; v++; for (const y of G.cascade(i, n)) seen.add(y); }
  for (let i = 0; i < CELLS; i++) if (n[i] > 0 && !seen.has(i)) v++;
  return v;
}
/* Does finishing this board need a subset step between two numbers? Replays
   the engine's own deduceStep without its subset step (single numbers and
   the mine count), plus the one subset the mine count allows (a number's
   hidden squares against all hidden squares), which is mine-count reasoning,
   not a two-number step. If that alone finishes the board, the answer is no. */
function needsPairStep(ms, opening, n) {
  const revealed = new Set(opening), flagged = new Set(), total = ms.size, safeCount = CELLS - total;
  while (revealed.size < safeCount) {
    let { safe, mine } = G.deduceStep(revealed, flagged, n, total, false);
    if (!safe.length && !mine.length) {
      const all = []; for (let i = 0; i < CELLS; i++) if (!revealed.has(i) && !flagged.has(i)) all.push(i);
      const T = total - flagged.size;
      for (const i of revealed) {
        const hid = NB[i].filter(j => !revealed.has(j) && !flagged.has(j));
        if (!hid.length || hid.length >= all.length) continue;
        const rest = all.filter(j => !hid.includes(j)), k = T - (n[i] - NB[i].filter(j => flagged.has(j)).length);
        if (k === 0) safe.push(...rest); else if (k === rest.length) mine.push(...rest);
      }
    }
    let progress = false;
    for (const x of mine) if (!flagged.has(x)) { flagged.add(x); progress = true; }
    for (const x of safe) {
      if (revealed.has(x) || flagged.has(x)) continue;
      if (ms.has(x)) throw new Error('needsPairStep: unsound deduction');
      for (const y of G.cascade(x, n)) revealed.add(y); progress = true;
    }
    if (!progress) return true;
  }
  return false;
}
function floorOf(ms, opening, n) {
  const pair = needsPairStep(ms, opening, n), bv = bv3(ms, n);
  return { pair, bv, pass: pair && bv >= BV_MIN };
}
/* the start convention: the opening's zero nearest the centroid of its zeros (stable, readable) */
function startOf(opening, n) {
  const zs = [...opening].filter(i => n[i] === 0);
  const cr = zs.reduce((a, i) => a + G.rc(i)[0], 0) / zs.length, cc = zs.reduce((a, i) => a + G.rc(i)[1], 0) / zs.length;
  zs.sort((a, b) => { const [ar, ac] = G.rc(a), [br, bc] = G.rc(b); return ((ar - cr) ** 2 + (ac - cc) ** 2) - ((br - cr) ** 2 + (bc - cc) ** 2) || a - b; });
  return zs[0];
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
  return { v, sc: v.pass ? score(ms, v.opening, v.n) : null, key: d4key(mines), fl: v.pass ? floorOf(ms, v.opening, v.n) : null };
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
   order) try it as the opening; keep the best-scoring passing opening.
   floor: only boards and openings that meet the floor. target: keep the
   opening whose score is closest to it instead of the best-scoring one. */
function candidate(seed, { floor = false, target = null } = {}) {
  const R = rng(seed), cells = [...Array(CELLS).keys()];
  for (let i = CELLS - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const ms = new Set(cells.slice(0, G.BAND.mines)), n = G.counts(ms);
  if (floor && bv3(ms, n) < BV_MIN) return null;
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
    if (floor && !needsPairStep(ms, opening, n)) continue;
    const sc = score(ms, opening, n);
    const st = startOf(opening, n);
    if (!best || (target === null ? sc.score > best.sc.score : Math.abs(sc.score - target) < Math.abs(best.sc.score - target))) best = { ms, st, sc };
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

module.exports = { G, stamp, fmtPuzzle, d4key, evalPuzzle, readExisting, score, candidate, fastCount, bv3, needsPairStep, floorOf, startOf, BV_MIN };

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
    floor: { pass: exScored.filter(x => x.fl && x.fl.pass).length, noPairStep: exScored.filter(x => x.fl && !x.fl.pair).length, bvUnder8: exScored.filter(x => x.fl && x.fl.bv < BV_MIN).length },
    score: { min: exScores[0], p10: q(exScores, .1), p50: q(exScores, .5), p90: q(exScores, .9), max: exScores.at(-1) },
    mean: { rounds: m('rounds'), subsetUses: m('subsetUses'), hidden: m('hidden'), opening: m('opening') } }, null, 1));
  process.exit(0);
}

if (has('--floor')) return floorMode(existing, exScored);

const through = arg('--through');
if (!through) { console.error('need --through YYYY-MM-DD (or --report, or --floor)'); process.exit(1); }
/* new days meet the floor too, and match the run of Sweeps that do */
const flScores = exScored.filter(x => x.fl && x.fl.pass).map(x => x.sc.score).sort((a, b) => a - b);
const last = existing.at(-1);
const lastSerial = parseInt(last.headline.match(/(\d+)\s*$/)[1], 10);
const days = []; for (let d = addDay(last.date, 1); d <= through; d = addDay(d, 1)) days.push(d);
if (!days.length) { console.log('nothing to build'); process.exit(0); }

const usedKeys = new Set(existing.map(e => d4key(e.mines.map(([r, c]) => [r - 1, c - 1]))));
const SEEDS = +arg('--seeds', 2000000), BASE = +arg('--seed', 1);
const pool = new Map(); // d4key -> best candidate
const t0 = Date.now(); let passes = 0;
for (let s = 0; s < SEEDS; s++) {
  const c = candidate(BASE * 1e7 + s, { floor: true });
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
const targets = days.map((_, i) => q(flScores, (i + 0.5) / days.length));
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
  existingScore: { min: flScores[0], p10: q(flScores, .1), p50: q(flScores, .5), p90: q(flScores, .9), max: flScores.at(-1) },
  dry: has('--dry') }, null, 1));
}

/* ================= --floor: lift forthcoming Sweeps to the floor, in place ================= */
const londonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const parsePuzzle = s => { const m = s.match(PZ_RE); if (!m) throw new Error('DN_PUZZLE block not found'); return (new Function('window', m[0] + '\nreturn window.DN_PUZZLE;'))({}); };
const gridFor = start => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (r === start[0] - 1 && c === start[1] - 1) ? 'o' : '.'));
/* Masked line diff: a rewritten page may differ from the old one only inside the
   DN_PUZZLE block's grid, mines and start arrays, line for line, and only by
   "."/"o" in the grid and digits in mines/start. Anything else throws. */
function maskedDiff(a, b, f) {
  const A = a.split('\n'), B = b.split('\n');
  if (A.length !== B.length) throw new Error(`${f}: line count changed (${A.length} -> ${B.length})`);
  const top = A.indexOf('window.DN_PUZZLE={'); if (top < 0) throw new Error(`${f}: DN_PUZZLE block not found`);
  const span = {};
  for (const k of ['grid', 'mines', 'start']) {
    const i = A.indexOf(`  ${k}: [`, top); if (i < 0) throw new Error(`${f}: no ${k} array`);
    let j = i + 1; while (j < A.length && !/^  \],?$/.test(A[j])) j++;
    span[k] = [i + 1, j];   // lines strictly inside the array
  }
  const where = i => Object.keys(span).find(k => i >= span[k][0] && i < span[k][1]);
  let changed = 0;
  for (let i = 0; i < A.length; i++) {
    if (A[i] === B[i]) continue;
    const k = where(i); changed++;
    if (!k) throw new Error(`${f}: line ${i + 1} changed outside grid/mines/start: ${JSON.stringify(A[i])} -> ${JSON.stringify(B[i])}`);
    const ok = k === 'grid' ? /^\s+"[.o]",?$/.test(A[i]) && /^\s+"[.o]",?$/.test(B[i]) && A[i].replace(/[.o]/, '') === B[i].replace(/[.o]/, '')
      : /^\s+\d+,?$/.test(A[i]) && /^\s+\d+,?$/.test(B[i]) && A[i].replace(/\d+/, '') === B[i].replace(/\d+/, '') && A[i].match(/^\s+/)[0] === B[i].match(/^\s+/)[0];
    if (!ok) throw new Error(`${f}: line ${i + 1} in ${k} changed shape: ${JSON.stringify(A[i])} -> ${JSON.stringify(B[i])}`);
  }
  return changed;
}
function floorMode(existing, exScored) {
  const today = londonToday(), from = arg('--from', addDay(today, 3));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from <= today) { console.error(`--from ${from}: must be a date after today (${today}, London); today's and past Sweeps are never edited`); process.exit(1); }
  const fut = exScored.filter(x => x.e.date >= from);
  const ok = x => x.v.pass && x.fl.pass, passing = fut.filter(ok), below = fut.filter(x => !ok(x));
  const why = { noPairStep: below.filter(x => x.fl && !x.fl.pair && x.fl.bv >= BV_MIN).length, bvUnder8: below.filter(x => x.fl && x.fl.pair && x.fl.bv < BV_MIN).length,
    both: below.filter(x => x.fl && !x.fl.pair && x.fl.bv < BV_MIN).length, gateFail: below.filter(x => !x.v.pass).length };
  const sorted = passing.map(x => x.sc.score).sort((a, b) => a - b);
  const target = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const summary = { from, to: fut.length ? fut.at(-1).e.date : null, forthcoming: fut.length, meetFloor: passing.length, below: below.length, why, targetScore: target };
  if (has('--check')) {
    console.log(JSON.stringify(summary, null, 1));
    for (const x of below) console.log(`  below floor: ${x.e.f} (pair step ${x.fl ? x.fl.pair : '?'}, 3BV ${x.fl ? x.fl.bv : '?'})`);
    process.exit(below.length ? 1 : 0);
  }
  if (!below.length) { console.log(JSON.stringify({ ...summary, replaced: 0 }, null, 1)); return; }
  if (!passing.length) { console.error('no forthcoming Sweep meets the floor, so there is no median to match'); process.exit(1); }

  /* the pool: floor-meeting, gate-screened grids closest to the target, one per D4 class */
  const usedKeys = new Set(existing.map(e => d4key(e.mines.map(([r, c]) => [r - 1, c - 1]))));
  const SEEDS = +arg('--seeds', 4000000), BASE = +arg('--seed', 2);
  const pool = new Map(); const t0 = Date.now(); let passes = 0;
  for (let s = 0; s < SEEDS; s++) {
    if (s % 500000 === 0 && s) console.error(`  ${s} seeds, ${passes} floor passes, ${pool.size} distinct new, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const c = candidate(BASE * 1e7 + s, { floor: true, target });
    if (!c) continue;
    passes++;
    const key = d4key(c.mines.map(([r, cc]) => [r - 1, cc - 1]));
    if (usedKeys.has(key)) continue;
    const dist = Math.abs(c.sc.score - target), prev = pool.get(key);
    if (!prev || dist < prev.dist) pool.set(key, { ...c, key, dist });
  }
  console.error(`scan: ${SEEDS} seeds, ${passes} floor passes, ${pool.size} D4-distinct new grids, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const ranked = [...pool.values()].sort((a, b) => a.dist - b.dist || a.seed - b.seed);
  const chosen = []; let gateRejects = 0;
  for (const c of ranked) {
    if (chosen.length === below.length) break;
    const v = G.validateSweep(c.mines.map(([r, cc]) => [r - 1, cc - 1]), [c.start[0] - 1, c.start[1] - 1]);
    if (v.pass) chosen.push(c); else gateRejects++;
  }
  if (chosen.length < below.length) { console.error(`pool exhausted (${chosen.length} of ${below.length}): raise --seeds`); process.exit(2); }
  /* deterministic shuffle across the dates, so near-misses of the target don't cluster */
  const R = rng(BASE * 7919 + below.length);
  for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }

  /* rewrite in place, each one checked before it is written */
  const dry = has('--dry'), out = [], manifest = ['date,file,id,oldScore,oldPairStep,old3BV,newScore,newRounds,newSubsetUses,new3BV,oldStart,newStart,seed,d4key'];
  below.forEach((x, i) => {
    const c = chosen[i], old = x.e.s, P = parsePuzzle(old);
    if (P.type !== 'sweep' || P.id !== 'DP·SWEEP·' + x.e.date) throw new Error(`${x.e.f}: unexpected puzzle ${P.type} ${P.id}`);
    if (fmtPuzzle(P) !== old.match(PZ_RE)[0]) throw new Error(`${x.e.f}: DN_PUZZLE block doesn't round-trip; refusing to rewrite it`);
    const block = fmtPuzzle({ type: P.type, id: P.id, band: P.band, grid: gridFor(c.start), mines: c.mines, start: c.start });
    const html = old.replace(PZ_RE, () => block);
    maskedDiff(old, html, x.e.f);
    if (!dry) fs.writeFileSync(path.join(REPORTS, x.e.f), html);
    out.push({ x, c, P, html });
    manifest.push([x.e.date, x.e.f, P.id, x.sc.score, x.fl.pair, x.fl.bv, c.sc.score, c.sc.rounds, c.sc.subsetUses, bv3(new Set(c.mines.map(([r, cc]) => G.ix(r - 1, cc - 1)))),
      '"' + x.e.start.join(' ') + '"', '"' + c.start.join(' ') + '"', c.seed, '"' + c.key + '"'].join(','));
  });

  /* verify: re-read every rewritten page (from disk unless --dry), re-parse, re-gate, re-floor */
  let lines = 0;
  for (const { x, c, P, html } of out) {
    const s2 = dry ? html : fs.readFileSync(path.join(REPORTS, x.e.f), 'utf8');
    if (s2 !== html) throw new Error(`${x.e.f}: file on disk differs from what was written`);
    lines += maskedDiff(x.e.s, s2, x.e.f);
    const P2 = parsePuzzle(s2);
    if (P2.type !== P.type || P2.id !== P.id || P2.band !== P.band) throw new Error(`${x.e.f}: type/id/band changed`);
    const os = []; P2.grid.forEach((row, r) => row.forEach((ch, k) => { if (ch === 'o') os.push([r + 1, k + 1]); }));
    if (os.length !== 1 || os[0][0] !== P2.start[0] || os[0][1] !== P2.start[1]) throw new Error(`${x.e.f}: grid "o" is not the start`);
    if (P2.mines.length !== G.BAND.mines) throw new Error(`${x.e.f}: ${P2.mines.length} mines`);
    const r = evalPuzzle(P2.mines, P2.start);
    if (!r.v.pass || !r.fl.pass || r.sc.score !== c.sc.score || r.key !== c.key) throw new Error(`${x.e.f}: re-check failed ${JSON.stringify({ gate: r.v.checks, floor: r.fl, score: r.sc && r.sc.score })}`);
    if (startOf(r.v.opening, r.v.n) !== G.ix(P2.start[0] - 1, P2.start[1] - 1)) throw new Error(`${x.e.f}: start breaks the convention`);
    for (const k of ['dn:headline', 'dn:date', 'dn:standfirst']) { const re = new RegExp(`name="${k}"\\s+content="([^"]*)"`); if ((x.e.s.match(re) || [])[1] !== (s2.match(re) || [])[1]) throw new Error(`${x.e.f}: ${k} changed`); }
  }
  /* and the whole set: every Sweep's mine set D4-distinct, every forthcoming one at the floor */
  const after = readExisting().map(e => { const o = out.find(y => y.x.e.f === e.f); return o && dry ? { ...e, mines: o.c.mines, start: o.c.start } : e; });
  const keys = new Map(), dupes = [];   // (some July 5x5 Sweeps share a mine set by an old house rule; the 6x6 run never does)
  for (const e of after.filter(e => e.N === 6)) { const k = d4key(e.mines.map(([r, c]) => [r - 1, c - 1])); if (keys.has(k)) dupes.push(keys.get(k) + ' = ' + e.f); else keys.set(k, e.f); }
  if (dupes.length) throw new Error(`D4 duplicate 6x6 Sweeps after the rewrite: ${dupes.slice(0, 5).join('; ')}`);
  const stillBelow = after.filter(e => e.N === 6 && e.date >= from).filter(e => { const r = evalPuzzle(e.mines, e.start); return !(r.v.pass && r.fl.pass); });
  if (stillBelow.length) throw new Error(`${stillBelow.length} forthcoming Sweeps still below the floor: ${stillBelow.slice(0, 5).map(e => e.f)}`);
  const mf = arg('--manifest'); if (mf) fs.writeFileSync(mf, manifest.join('\n') + '\n');
  const q2 = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  const ns = chosen.map(c => c.sc.score).sort((a, b) => a - b), all = after.filter(e => e.N === 6 && e.date >= from).map(e => evalPuzzle(e.mines, e.start).sc.score).sort((a, b) => a - b);
  console.log(JSON.stringify({ ...summary, replaced: out.length, gateRejects, linesChanged: lines,
    newScore: { min: ns[0], p10: q2(ns, .1), p50: q2(ns, .5), p90: q2(ns, .9), max: ns.at(-1), withinOne: ns.filter(v => Math.abs(v - target) <= 1).length },
    forthcomingAfter: { meetFloor: all.length, min: all[0], p10: q2(all, .1), p50: q2(all, .5), p90: q2(all, .9), max: all.at(-1) }, dry }, null, 1));
}

if (require.main === module) main();   // last, so every helper above is defined
