#!/usr/bin/env node
/* tools/build-path-batch.js — build-time Path generator and grader
   (typespec v4.1, plus the 19 Oct 2026 quality rules: Phase 6 of the build
   plan in claude/puzzle-quality-framework.md).

   The gate is read verbatim out of engines/path.js (validatePath,
   countSolutions, solveNoGuess, turnCount), not copied, so the tool and the
   player cannot drift. On top of the gate every Path must keep these rules:

     givens      9 to 11 locked cells, 1 and 36 included (as today)
     beside      no given number next to its consecutive number (they are
                 always adjacent in the thread, so the pair is a free move)
     straight    no straight run longer than 4 squares in the thread
     turns       at least 14 turns (MIN_TURNS, as the gate)
     stalls      2 to 4 stalls in the frontier model (below)
     unique      exactly one thread (the gate's countSolutions) and no
                 thread repeated under rotation, reflection or reversal
                 across every Path in reports/

   The frontier model is a player who can only extend the thread from the
   1 end or the 36 end (the real two-end controls) and uses three rules:
   count the steps to the next known number on that side, check odd/even
   (the grid is a chessboard, so steps and distance share parity), and
   don't strand a square (every empty square needs two ways in, since 1 and
   36 are fixed and every empty square is mid-thread; a way in is an empty
   neighbour or a placed number still missing a neighbour in the sequence).
   A candidate next square survives if it passes all three. When one end has
   exactly one survivor it is placed; when neither end does, that is a
   stall: the player has to reason elsewhere on the board, and the model
   then places the true square at the end with fewer survivors and goes on.
   Measured on the 760 Paths at commit 5ff4530 (19 Oct 2026): median 3
   stalls, 37 with none, 9 at most; 460 sit in the 2-to-4 band.

   Usage:
     node tools/build-path-batch.js --report                     # grade every Path
     node tools/build-path-batch.js --check [--from 2026-11-01]  # exit 1 if a Path from that date breaks a rule
     node tools/build-path-batch.js --regen --from 2026-11-01 [--seed 1] [--dry] [--manifest out.csv]
         regenerate in place every Path from --from that breaks a rule:
         same file, id, serial, date and band; only the solution, locked
         and turns lines of the puzzle block change. A thread that already
         keeps the thread rules (straight runs, turns, no repeat) keeps its
         shape and gets new givens; the rest get a new thread. Re-parses every
         written file and re-runs the gate and the rules on it.
     node tools/build-path-batch.js --through 2028-12-31 [--seed 1] [--dry] [--out dir]
     node tools/build-path-batch.js --blurb [--from D] [--dry]   (forthcoming days' blurb, AF-026)
         new days after the last Path, cloned from the newest page; run
         `node tools/og-tags.js` afterwards so each page's preview names
         its own headline and URL.

   Mix: givens and stall counts are drawn to match the 19 Oct 2026 set
   (givens 9/10/11 = 413/233/114; stalls 2/3/4 = 164/174/122), allocated
   by largest remainder and shuffled with the seed, so difficulty is steady
   from day to day with no runs of hard ones. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = k => args.includes(k);

const RULES = { givens: [9, 11], minTurns: 14, maxStraight: 4, stalls: [2, 4] };
const MIX = { givens: { 9: 413, 10: 233, 11: 114 }, stalls: { 2: 164, 3: 174, 4: 122 } };
const FILE_RE = /^\d{4}-\d{2}-\d{2}-logic-path-\d{4}\.html$/;
const PZ_RE = /window\.DN_PUZZLE=(\{[\s\S]*?\n\});/;

/* ---- the gate, read verbatim from the engine ---- */
function loadGate() {
  const src = fs.readFileSync(path.join(ROOT, 'engines/path.js'), 'utf8');
  const a = src.indexOf('const N = 6, TOTAL = 36;'), b = src.indexOf('// ---------- Run the gate at load');
  if (a < 0 || b < 0) throw new Error('gate anchors not found in engines/path.js');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) +
    '\nthis.G={N,TOTAL,neighbors,manhattan,pathFromSolution,turnCount,solveNoGuess,countSolutions,validatePath};', ctx);
  return ctx.G;
}
const G = loadGate();
const N = G.N, T = G.TOTAL;

/* ---- geometry on cell indices 0..35 ---- */
const NB = []; for (let i = 0; i < T; i++) { const r = (i / N) | 0, c = i % N, o = []; if (r > 0) o.push(i - N); if (r < N - 1) o.push(i + N); if (c > 0) o.push(i - 1); if (c < N - 1) o.push(i + 1); NB.push(o); }
const dist = (a, b) => Math.abs(((a / N) | 0) - ((b / N) | 0)) + Math.abs(a % N - b % N);

/* thread = cell index of each value: seq[v-1] */
const seqOf = sol => { const s = new Array(T); sol.forEach((row, r) => row.forEach((v, c) => { s[v - 1] = r * N + c; })); return s; };
const solOf = seq => { const s = Array.from({ length: N }, () => Array(N).fill(0)); seq.forEach((i, k) => { s[(i / N) | 0][i % N] = k + 1; }); return s; };
function maxStraight(seq) {   // longest run of squares crossed in one direction
  let best = 2, run = 2;
  for (let i = 2; i < seq.length; i++) {
    if (seq[i] - seq[i - 1] === seq[i - 1] - seq[i - 2]) run++; else run = 2;   // steps are ±1 or ±N between neighbours, so equal steps = same line
    if (run > best) best = run;
  }
  return best;
}
const turnsOf = seq => G.turnCount(seq.map(i => [(i / N) | 0, i % N]));
const beside = locked => { const s = new Set(locked.map(l => l[2])); let n = 0; for (const v of s) if (s.has(v + 1)) n++; return n; };

/* rotation, reflection and reversal: one key per thread shape */
const SYM = [(r, c) => [r, c], (r, c) => [c, N - 1 - r], (r, c) => [N - 1 - r, N - 1 - c], (r, c) => [N - 1 - c, r],
  (r, c) => [r, N - 1 - c], (r, c) => [N - 1 - r, c], (r, c) => [c, r], (r, c) => [N - 1 - c, N - 1 - r]];
function threadKey(seq) {
  let best = null;
  for (const f of SYM) {
    const m = seq.map(i => { const [r, c] = f((i / N) | 0, i % N); return r * N + c; });
    for (const s of [m, m.slice().reverse()]) { const k = s.join(','); if (best === null || k < best) best = k; }
  }
  return best;
}

/* ---- the frontier model (see the header) ---- */
function frontier(sol, locked, trace) {
  const seq = seqOf(sol);
  const at = new Array(T + 1).fill(-1), cellV = new Array(T).fill(0);
  for (const [r, c, v] of locked) { at[v] = (r - 1) * N + (c - 1); cellV[at[v]] = v; }
  const known = v => at[v] >= 0;
  let L = 1, H = T;
  const advance = () => { while (L < T && known(L + 1)) L++; while (H > 1 && known(H - 1)) H--; };
  advance();
  function noStrandedSquare() {
    for (let i = 0; i < T; i++) {
      if (cellV[i] !== 0) continue;
      let ways = 0;
      for (const n of NB[i]) { const w = cellV[n]; if (w === 0 || (w > 1 && !known(w - 1)) || (w < T && !known(w + 1))) ways++; }
      if (ways < 2) return false;
    }
    return true;
  }
  function survivors(end) {
    const low = end === 'low', t = low ? L + 1 : H - 1, head = at[low ? L : H];
    let K = null;
    if (low) { for (let v = t + 1; v <= T; v++) if (known(v)) { K = v; break; } }
    else { for (let v = t - 1; v >= 1; v--) if (known(v)) { K = v; break; } }
    const out = [];
    for (const c of NB[head]) {
      if (cellV[c] !== 0) continue;
      if (K !== null) { const steps = Math.abs(K - t), d = dist(c, at[K]); if (d > steps || (steps - d) % 2) continue; }   // step-count, odd/even
      at[t] = c; cellV[c] = t; const ok = noStrandedSquare(); at[t] = -1; cellV[c] = 0;                                    // don't strand a square
      if (ok) out.push(c);
    }
    return { t, out };
  }
  const place = (t, c) => { at[t] = c; cellV[c] = t; advance(); };
  let stalls = 0; const log = [];
  while (L + 1 < H) {
    let moved = false;
    for (const end of ['low', 'high']) {
      if (L + 1 >= H) break;
      const { t, out } = survivors(end);
      if (!out.includes(seq[t - 1])) throw new Error('frontier model pruned the true square for ' + t);   // the rules are sound, so this is a bug
      if (out.length === 1) { place(t, out[0]); moved = true; }
    }
    if (!moved) {
      stalls++;
      const a = survivors('low'), b = survivors('high'), e = a.out.length <= b.out.length ? a : b;
      if (trace) log.push({ low: L, high: H, options: [a.out.length, b.out.length], placed: e.t });
      place(e.t, seq[e.t - 1]);
    }
  }
  return trace ? { stalls, log } : stalls;
}

/* ---- grading one puzzle object ---- */
function grade(p) {
  const gate = G.validatePath(p), seq = seqOf(p.solution);
  const g = { gate, turns: gate.turns, givens: p.locked.length, beside: beside(p.locked), straight: maxStraight(seq), key: threadKey(seq), stalls: null, breaks: [] };
  for (const [k, v] of Object.entries(gate.checks)) if (!v) g.breaks.push('gate:' + k);
  if (gate.checks.valid_hamiltonian_path && gate.checks.locks_match_solution) g.stalls = frontier(p.solution, p.locked);
  if (g.givens < RULES.givens[0] || g.givens > RULES.givens[1]) g.breaks.push('givens');
  if (g.beside) g.breaks.push('beside');
  if (g.straight > RULES.maxStraight) g.breaks.push('straight');
  if (g.turns < RULES.minTurns) g.breaks.push('turns');
  if (g.stalls === null || g.stalls < RULES.stalls[0] || g.stalls > RULES.stalls[1]) g.breaks.push('stalls');
  return g;
}

/* ---- the Paths in reports/ ---- */
function parseBlock(s, f) {
  const m = s.match(PZ_RE);
  if (!m) throw new Error('DN_PUZZLE block not found in ' + f);
  return vm.runInNewContext('(' + m[1] + ')');
}
function readPaths() {
  return fs.readdirSync(REPORTS).filter(f => FILE_RE.test(f)).sort().map(f => {
    const s = fs.readFileSync(path.join(REPORTS, f), 'utf8'), p = parseBlock(s, f);
    return { f, s, p, date: f.slice(0, 10), serial: parseInt(f.slice(-9, -5), 10) };
  });
}
/* duplicate threads across a set of entries: key -> [files] */
function dupes(entries) {
  const m = new Map();
  for (const e of entries) { const k = e.g.key; if (!m.has(k)) m.set(k, []); m.get(k).push(e.f); }
  return [...m.values()].filter(l => l.length > 1);
}

/* ---- seeded RNG (mulberry32), as build-sweep-batch.js ---- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---- generation ---- */
/* A random Hamiltonian thread: start from a snake and apply backbite moves
   (pick an end, join it to a random grid neighbour, reverse the loop that
   makes), which mixes towards a uniform spread of thread shapes. */
function randomThread(R, moves = 4000) {
  let p = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) p.push(r * N + (r % 2 ? N - 1 - c : c));
  const pos = new Int8Array(T);
  for (let m = 0; m < moves; m++) {
    if (R() < 0.5) p.reverse();
    for (let i = 0; i < T; i++) pos[p[i]] = i;
    const nb = NB[p[0]], x = nb[Math.floor(R() * nb.length)], j = pos[x];
    if (j === 1) continue;
    p = p.slice(0, j).reverse().concat(p.slice(j));
  }
  if (R() < 0.5) p.reverse();
  return p;
}
/* 1 and 36 plus n-2 others, no two consecutive (so never 2 or 35) */
function pickGivens(R, n) {
  for (let tries = 0; tries < 50; tries++) {
    const vals = new Set([1, T]);
    for (const v of shuffle(Array.from({ length: T - 4 }, (_, i) => i + 3), R)) {
      if (vals.size === n) break;
      if (!vals.has(v - 1) && !vals.has(v + 1)) vals.add(v);
    }
    if (vals.size === n) return [...vals];
  }
  return null;
}
function lockedFor(seq, vals) {
  const out = [1, T, ...vals.filter(v => v !== 1 && v !== T).sort((a, b) => seq[a - 1] - seq[b - 1])]   // 1, 36, then reading order
    .map(v => [((seq[v - 1] / N) | 0) + 1, (seq[v - 1] % N) + 1, v]);
  return out;
}
/* one puzzle hitting a target givens count and stall count, with a thread
   not in `used` (keys), or on the given thread `keepSeq` (new givens only);
   returns null if the budget runs out */
function generate(R, target, used, budget = 4000, keepSeq = null) {
  for (let k = 0; k < budget; k++) {
    const seq = keepSeq || randomThread(R);
    if (maxStraight(seq) > RULES.maxStraight || turnsOf(seq) < RULES.minTurns) { if (keepSeq) return null; continue; }
    const key = threadKey(seq);
    if (!keepSeq && used.has(key)) continue;
    const solution = solOf(seq);
    for (let j = 0; j < (keepSeq ? 2000 : 40); j++) {
      const vals = pickGivens(R, target.givens);
      if (!vals) continue;
      const locked = lockedFor(seq, vals);
      if (!G.solveNoGuess(locked).solved) continue;
      if (frontier(solution, locked) !== target.stalls) continue;
      const p = { solution, locked };
      const gate = G.validatePath(p);
      if (!gate.pass) continue;
      return { solution, locked, turns: gate.turns, key };
    }
    if (keepSeq) return null;
  }
  return null;
}
/* largest-remainder allocation of n items over a weights table, shuffled */
function allocate(weights, n, R) {
  const ks = Object.keys(weights).map(Number), tot = ks.reduce((a, k) => a + weights[k], 0);
  const raw = ks.map(k => weights[k] * n / tot), base = raw.map(Math.floor);
  let left = n - base.reduce((a, b) => a + b, 0);
  ks.map((k, i) => [raw[i] - base[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, left).forEach(([, i]) => base[i]++);
  const out = []; ks.forEach((k, i) => { for (let j = 0; j < base[i]; j++) out.push(k); });
  return shuffle(out, R);
}

/* ---- stamping: only the solution, locked and turns lines change ---- */
const fmtSolution = sol => 'solution:[\n' + sol.map(r => '    [' + r.join(',') + ']').join(',\n') + '\n  ],';
function fmtLocked(locked) {
  const lines = []; for (let i = 0; i < locked.length; i += 5) lines.push('    ' + locked.slice(i, i + 5).map(l => '[' + l.join(',') + ']').join(','));
  return 'locked:[\n' + lines.join(',\n') + '\n  ],';
}
/* The day's blurb (dn:standfirst and og:description). AF-026, 29 Oct 2026: Path
   calls its line a path ("thread" is Tangle's word). New days always get this
   wording, whatever the template day said; --blurb rewrites forthcoming days. */
const BLURB = 'Thirty-six cells, one path. Place 1 through 36 so every consecutive pair sits next door.';
const OLD_BLURB = 'Thirty-six cells, one thread. Place 1 through 36 so every consecutive pair sits next door.';
function blurb(s) {
  return s.replace(/(<meta (?:name="dn:standfirst"|property="og:description")\s+content=")[^"]*(")/g, (m, a, b) => a + BLURB + b);
}
function restamp(s, pz) {
  const m = s.match(PZ_RE); if (!m) throw new Error('DN_PUZZLE block not found');
  let b = m[0];
  const swap = (re, rep, what) => { const n = (b.match(new RegExp(re.source, 'g')) || []).length; if (n !== 1) throw new Error(what + ' found ' + n + ' times in the block'); b = b.replace(re, rep); };
  swap(/solution:\[\n(?: {4}\[[\d,]+\],?\n){6} {2}\],/, fmtSolution(pz.solution), 'solution');
  swap(/locked:\[\n(?: {4}(?:\[\d,\d,\d+\],?)+\n)+ {2}\],/, fmtLocked(pz.locked), 'locked');
  swap(/\n {2}turns:\d+\n/, '\n  turns:' + pz.turns + '\n', 'turns');
  return s.replace(m[0], () => b);
}
/* the masked-diff assertion: outside the puzzle block nothing changes; inside
   it, type, id, band, size and grid are as they were */
function maskedSame(before, after) {
  const mb = before.match(PZ_RE), ma = after.match(PZ_RE);
  if (!mb || !ma) return 'block missing';
  if (before.replace(mb[0], '') !== after.replace(ma[0], '')) return 'page changed outside the puzzle block';
  const pb = vm.runInNewContext('(' + mb[1] + ')'), pa = vm.runInNewContext('(' + ma[1] + ')');
  for (const k of ['type', 'id', 'band', 'size']) if (pb[k] !== pa[k]) return k + ' changed';
  if (JSON.stringify(pb.grid) !== JSON.stringify(pa.grid)) return 'grid changed';
  const keys = o => Object.keys(o).sort().join(',');
  if (keys(pb) !== keys(pa)) return 'block fields changed';
  const strip = t => t.replace(/solution:\[[\s\S]*?\n {2}\],/, '').replace(/locked:\[[\s\S]*?\n {2}\],/, '').replace(/\n {2}turns:\d+\n/, '\n');
  if (strip(mb[0]) !== strip(ma[0])) return 'block changed outside solution, locked and turns';
  return null;
}

module.exports = { G, RULES, MIX, BLURB, blurb, frontier, grade, threadKey, maxStraight, readPaths, generate, restamp, maskedSame, parseBlock, seqOf };
if (require.main === module) main();

/* ================= main ================= */
function quant(arr) { const a = arr.slice().sort((x, y) => x - y), q = p => a[Math.floor(p * (a.length - 1))]; return { min: a[0], p25: q(.25), median: q(.5), p75: q(.75), max: a.at(-1) }; }
function hist(arr) { const h = {}; for (const x of arr) h[x] = (h[x] || 0) + 1; return h; }

function main() {
  const all = readPaths();
  for (const e of all) e.g = grade(e.p);
  const from = arg('--from', '2026-11-01');

  if (has('--report') || has('--check')) {
    const scope = has('--check') ? all.filter(e => e.date >= from) : all;
    const d = dupes(all).filter(l => l.some(f => scope.some(e => e.f === f)));
    const breaking = scope.filter(e => e.g.breaks.length);
    const why = {}; for (const e of breaking) for (const b of e.g.breaks) why[b] = (why[b] || 0) + 1;
    console.log(JSON.stringify({
      paths: all.length, inScope: scope.length, from: has('--check') ? from : all[0].date,
      breaking: breaking.length, why, duplicateThreads: d,
      stalls: { ...quant(scope.map(e => e.g.stalls)), none: scope.filter(e => e.g.stalls === 0).length, hist: hist(scope.map(e => e.g.stalls)) },
      givens: hist(scope.map(e => e.g.givens)), fullLine: scope.filter(e => e.g.straight === N).length,
      besidePerPuzzle: +(scope.reduce((a, e) => a + e.g.beside, 0) / scope.length).toFixed(2),
      turns: quant(scope.map(e => e.g.turns)),
    }, null, 1));
    if (has('--check')) process.exit(breaking.length || d.length ? 1 : 0);
    return;
  }

  const seed = +arg('--seed', 1), R = rng(seed * 7919 + 17), dry = has('--dry');
  const used = new Set(all.map(e => e.g.key));   // never reuse a thread already in the repo, even one being replaced

  if (has('--regen')) {
    const scope = all.filter(e => e.date >= from);
    // a thread repeated in the repo: regenerate the later copy (if it is in scope)
    const dupeLater = new Set(); { const seen = new Set(); for (const e of all) { if (seen.has(e.g.key) && e.date >= from) dupeLater.add(e.f); seen.add(e.g.key); } }
    const todo = scope.filter(e => e.g.breaks.length || dupeLater.has(e.f));
    const givensT = allocate(MIX.givens, todo.length, R), stallsT = allocate(MIX.stalls, todo.length, R);
    const manifest = ['date,serial,file,id,why,thread,before_stalls,before_givens,before_beside,before_straight,before_turns,stalls,givens,turns,straight'];
    const out = []; const t0 = Date.now();
    todo.forEach((e, i) => {
      const target = { givens: givensT[i], stalls: stallsT[i] };
      // a thread that already keeps the thread rules keeps its shape: only its givens are chosen again
      const threadOk = !dupeLater.has(e.f) && e.g.straight <= RULES.maxStraight && e.g.turns >= RULES.minTurns;
      const pz = (threadOk && generate(R, target, used, 1, seqOf(e.p.solution))) || generate(R, target, used);
      if (!pz) throw new Error('no puzzle found for ' + e.f + ' target ' + JSON.stringify(target));
      used.add(pz.key);
      const html = restamp(e.s, pz);
      const why = maskedSame(e.s, html); if (why) throw new Error(e.f + ': ' + why);
      const g = grade(parseBlock(html, e.f));
      if (!g.gate.pass || g.breaks.length) throw new Error(e.f + ' fails after stamping: ' + g.breaks.join(' '));
      out.push({ e, html, g });
      manifest.push([e.date, e.serial, e.f, e.p.id, (dupeLater.has(e.f) ? ['dupe', ...e.g.breaks] : e.g.breaks).join(' '), g.key === e.g.key ? 'kept' : 'new', e.g.stalls, e.g.givens, e.g.beside, e.g.straight, e.g.turns, g.stalls, g.givens, g.turns, g.straight].join(','));
      if ((i + 1) % 100 === 0) console.error(`  ${i + 1}/${todo.length} built, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    });
    if (!dry) for (const o of out) fs.writeFileSync(path.join(REPORTS, o.e.f), o.html);
    // re-parse from disk and re-run the gate and the rules on what was written
    let reread = 0;
    if (!dry) {
      for (const o of out) {
        const s = fs.readFileSync(path.join(REPORTS, o.e.f), 'utf8');
        if (s !== o.html) throw new Error(o.e.f + ': file on disk differs from what was stamped');
        const g = grade(parseBlock(s, o.e.f)); if (!g.gate.pass || g.breaks.length) throw new Error(o.e.f + ' fails on re-read: ' + g.breaks.join(' '));
        if (maskedSame(o.e.s, s)) throw new Error(o.e.f + ' masked diff on re-read');
        reread++;
      }
      const after = readPaths(); for (const e of after) e.g = grade(e.p);
      const d = dupes(after); if (d.length) throw new Error('duplicate threads after regen: ' + JSON.stringify(d));
      const bad = after.filter(e => e.date >= from && e.g.breaks.length); if (bad.length) throw new Error('still breaking: ' + bad.map(e => e.f).join(' '));
    }
    const mf = arg('--manifest'); if (mf) fs.writeFileSync(mf, manifest.join('\n') + '\n');
    console.log(JSON.stringify({ from, inScope: scope.length, regenerated: out.length, kept: scope.length - out.length, reread, dry,
      newStalls: hist(out.map(o => o.g.stalls)), newGivens: hist(out.map(o => o.g.givens)), newTurns: quant(out.map(o => o.g.turns)),
      seconds: +((Date.now() - t0) / 1000).toFixed(1) }, null, 1));
    return;
  }

  const through = arg('--through');
  if (through) {
    const last = all.at(-1), tpl = last.s, oldId = last.p.id, outDir = arg('--out', REPORTS);
    const addDay = (d, k) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };
    const days = []; for (let d = addDay(last.date, 1); d <= through; d = addDay(d, 1)) days.push(d);
    if (!days.length) { console.log('nothing to build'); return; }
    const givensT = allocate(MIX.givens, days.length, R), stallsT = allocate(MIX.stalls, days.length, R);
    const made = days.map((date, i) => {
      const serial = last.serial + 1 + i, num = String(serial).padStart(4, '0'), id = 'DP·PATH·' + num, f = `${date}-logic-path-${num}.html`;
      const pz = generate(R, { givens: givensT[i], stalls: stallsT[i] }, used);
      if (!pz) throw new Error('no puzzle found for ' + date);
      used.add(pz.key);
      let s = tpl.split(oldId).join(id);
      s = s.replace(/(name="dn:headline"\s+content=")Path \d+(")/, `$1Path ${num}$2`).replace(/(name="dn:date"\s+content=")[^"]*(")/, `$1${date}$2`);
      s = blurb(s);
      s = restamp(s, pz);
      const g = grade(parseBlock(s, f)); if (!g.gate.pass || g.breaks.length) throw new Error(f + ' fails: ' + g.breaks.join(' '));
      if (!dry) fs.writeFileSync(path.join(outDir, f), s);
      return { f, g };
    });
    console.log(JSON.stringify({ built: made.length, from: days[0], to: days.at(-1), serials: [last.serial + 1, last.serial + days.length], outDir, dry,
      stalls: hist(made.map(m => m.g.stalls)), givens: hist(made.map(m => m.g.givens)) }, null, 1));
    return;
  }
  if (has('--blurb')) {
    // forthcoming days only: from three days ahead (London), as the other tools' no-edit window
    const ld = (() => { const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; }); return p.year + '-' + p.month + '-' + p.day; })();
    const add = (d, k) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };
    const from = arg('--from', add(ld, 3));
    if (from < add(ld, 3)) { console.error('--from ' + from + ' is inside the no-edit window (today and the next two days, London)'); process.exit(1); }
    let changed = 0;
    for (const e of all) {
      if (e.date < from || !e.s.includes(OLD_BLURB)) continue;
      const out = blurb(e.s);
      // only the two meta lines may change
      const a = e.s.split('\n'), b = out.split('\n');
      const diff = a.map((l, i) => l === b[i] ? null : i).filter(i => i != null);
      if (a.length !== b.length || diff.length !== 2 || diff.some(i => !/dn:standfirst|og:description/.test(a[i]))) throw new Error(e.f + ': blurb change touched more than the two meta lines');
      if (!dry) fs.writeFileSync(path.join(REPORTS, e.f), out);
      changed++;
    }
    console.log(JSON.stringify({ blurb: BLURB, from, changed, dry }));
    return;
  }
  console.error('use --report, --check, --regen, --through or --blurb (see the header)'); process.exit(1);
}
