'use strict';
/* Pixel (working name; Lab build 12 Nov 2026, brief: project doc claude/brief-nonogram.md).
   A nonogram: a square grid with number clues on every row and column; each clue lists
   the runs of filled squares in that line, in order. Solving it draws a picture.

   This file is the generator's toolkit and the ship gate:
     parse(pic)                 a library picture ({name, size, rows of colour letters}) → {n, sol "0101…"}
     clues(sol, n)              {rows:[[3,1],…], cols:[…]} ([] is an empty line)
     lineSolve(known, clue)     the cells every arrangement of the clue agrees on (null = contradiction)
     logicSolve(n, rows, cols)  line logic repeated until stable: {solved, grid, rounds, steps, touched}
     countSolutions(n, rows, cols, limit)   a full backtracking solver, independent of the line logic
     exactFitOnly(n, rows, cols)            is the grid finished by the lines whose clue fills them exactly?
     botPlay(n, rows, cols, seed)           a human proxy: picks any line that can make progress
     grade(p), band(g), check(p), fingerprint(sol, n), predictSecs(g)
   Every board is solvable by line logic alone (Alec's rule: nothing ever needs trial and error).
   The engine (engines/pixel.js) runs the same clue check at load. */

const SIZES = [8, 10];
/* The gate (brief, 7 Nov 2026), plus the difficulty band, set from the bot (12 Nov 2026):
   fill 25–70%, unique, line logic alone, not finished by exact-fit lines alone, at least 3 rounds;
   band: the human-proxy bot's median line-steps, by size (the middle of the hand-made library). */
const FILL = [0.25, 0.70], MIN_ROUNDS = 3;
const BANDS = { 8: { steps: [16, 34], rounds: [3, 9] }, 10: { steps: [24, 44], rounds: [3, 11] } };
/* Seconds per line-step, from finished plays in public.events (12 Nov 2026; see SECS_NOTE).
   One "step" in each type is one deduction acted on: a nonogram line that yields at least one
   square; a Sweep square deduced and tapped (3BV clicks + flags); a Tally digit placed.
   Sweep is the nearest kin (grid logic from number clues, tap to mark), so it sets the estimate;
   Tally's rate (arithmetic per step) is the slow bound. */
const SECS_PER_STEP = { sweep: 2.83, tally: 10.88 }, SECS_PER_EXTRA_TAP = 0.35;
const SECS_NOTE = 'Sweep: 132 finished plays of 42 boards, 30 Sep–11 Nov 2026, median 48 s (p75 64 s), median 16 deductions (3BV − 1 + 7 mines), median 2.83 s a deduction; Tally 4×4: 91 finished plays of 19 boards, 25 Oct–12 Nov, median 174 s (p75 299 s) over 16 digits, 10.88 s a digit. A nonogram line-step usually yields several squares: each square beyond the first is a further tap or part of a drag, at 0.35 s.';

/* ---------- pictures ---------- */
function parse(pic) {
  const n = pic.size, rows = pic.rows;
  if (!SIZES.includes(n) || !Array.isArray(rows) || rows.length !== n || rows.some(r => typeof r !== 'string' || r.length !== n)) throw new Error('bad picture ' + (pic.name || '?'));
  return { n, sol: rows.join('').split('').map(ch => ch === '.' ? '0' : '1').join(''), colours: rows.join('') };
}

/* ---------- clues ---------- */
function runs(cells) { const out = []; let k = 0; for (const v of cells) { if (v === 1 || v === '1') k++; else if (k) { out.push(k); k = 0; } } if (k) out.push(k); return out; }
function lineCells(sol, n, li) { const a = []; for (let k = 0; k < n; k++) a.push(+sol[li < n ? li * n + k : k * n + (li - n)]); return a; }
function clues(sol, n) {
  const rows = [], cols = [];
  for (let i = 0; i < n; i++) { rows.push(runs(lineCells(sol, n, i))); cols.push(runs(lineCells(sol, n, n + i))); }
  return { rows, cols };
}

/* ---------- line logic ---------- */
/* known: array of -1 unknown, 0 empty, 1 filled. Returns the line with every cell that all
   arrangements agree on, or null if the clue can't fit. Enumerates arrangements (n ≤ 10). */
function lineSolve(known, clue) {
  const n = known.length, k = clue.length;
  const agree = new Array(n).fill(null); let any = false;
  const cur = new Array(n).fill(0);
  const minLen = i => { let s = 0; for (let j = i; j < k; j++) s += clue[j] + (j > i ? 1 : 0); return s; };
  const rest = []; for (let i = 0; i <= k; i++) rest.push(i < k ? minLen(i) : 0);
  function emptyOk(a, b) { for (let x = a; x < b; x++) if (known[x] === 1) return false; return true; }
  function record() {
    any = true;
    for (let x = 0; x < n; x++) { if (agree[x] === null) agree[x] = cur[x]; else if (agree[x] !== cur[x]) agree[x] = -1; }
  }
  function place(i, start) {
    if (i === k) { if (emptyOk(start, n)) { for (let x = start; x < n; x++) cur[x] = 0; record(); } return; }
    const len = clue[i];
    for (let s = start; s + rest[i] <= n; s++) {
      if (!emptyOk(start, s)) break;   // a filled square before this block would be left uncovered
      let ok = true; for (let x = s; x < s + len; x++) if (known[x] === 0) { ok = false; break; }
      if (!ok) continue;
      if (s + len < n && known[s + len] === 1) continue;
      for (let x = start; x < s; x++) cur[x] = 0;
      for (let x = s; x < s + len; x++) cur[x] = 1;
      if (s + len < n) cur[s + len] = 0;
      place(i + 1, Math.min(n, s + len + 1));
    }
  }
  if (k === 0) { if (!emptyOk(0, n)) return null; return new Array(n).fill(0); }
  place(0, 0);
  if (!any) return null;
  return agree.map((v, x) => v === -1 ? known[x] : v);
}
function getLine(g, n, li) { const a = []; for (let k = 0; k < n; k++) a.push(g[li < n ? li * n + k : k * n + (li - n)]); return a; }
function setLine(g, n, li, a) { for (let k = 0; k < n; k++) g[li < n ? li * n + k : k * n + (li - n)] = a[k]; }
const clueOf = (rows, cols, n, li) => li < n ? rows[li] : cols[li - n];

/* One line applied to the grid: how many squares it newly decides (−1 = contradiction). */
function apply(g, n, rows, cols, li) {
  const before = getLine(g, n, li), after = lineSolve(before, clueOf(rows, cols, n, li));
  if (!after) return -1;
  let d = 0; for (let k = 0; k < n; k++) if (before[k] === -1 && after[k] !== -1) d++;
  if (d) setLine(g, n, li, after);
  return d;
}

/* Rounds measure how deep the chain of deductions goes: in each round every row and column is
   solved against what was known at the start of that round (so a round is one layer of
   "this line tells me that square, which then tells that line…"). A step is a line that decides
   at least one square in a round; touched = distinct lines that ever did. */
function logicSolve(n, rows, cols, start) {
  let g = start ? start.slice() : new Array(n * n).fill(-1);
  let rounds = 0, steps = 0; const touched = new Set();
  for (;;) {
    const next = g.slice(); let changed = 0;
    for (let li = 0; li < 2 * n; li++) {
      const t = g.slice(), d = apply(t, n, rows, cols, li);
      if (d < 0) return { solved: false, contradiction: true, grid: g, rounds, steps, touched: touched.size };
      if (!d) continue;
      changed++; steps++; touched.add(li);
      const line = getLine(t, n, li); for (let k = 0; k < n; k++) { const i = li < n ? li * n + k : k * n + (li - n); if (line[k] !== -1) next[i] = line[k]; }
    }
    if (!changed) return { solved: !g.includes(-1), grid: g, rounds, steps, touched: touched.size };
    rounds++; g = next;
    if (!g.includes(-1)) return { solved: true, grid: g, rounds, steps, touched: touched.size };
  }
}

/* The lines whose clue fills them exactly (a full line, an empty line, "3 4" on 8), once, alone. */
function exactFitOnly(n, rows, cols) {
  const g = new Array(n * n).fill(-1);
  for (let li = 0; li < 2 * n; li++) {
    const c = clueOf(rows, cols, n, li), len = c.reduce((a, b) => a + b, 0) + Math.max(0, c.length - 1);
    if (c.length === 0 || len === n) apply(g, n, rows, cols, li);
  }
  return !g.includes(-1);
}

/* ---------- full solver (independent of line logic) ---------- */
function arrangements(clue, n) {
  const out = [];
  (function rec(i, start, acc) {
    if (i === clue.length) { const a = acc.slice(); for (let x = a.length; x < n; x++) a.push(0); out.push(a); return; }
    let need = 0; for (let j = i; j < clue.length; j++) need += clue[j] + (j > i ? 1 : 0);
    for (let s = start; s + need <= n; s++) {
      const a = acc.slice(); while (a.length < s) a.push(0);
      for (let x = 0; x < clue[i]; x++) a.push(1);
      if (a.length < n) a.push(0);
      rec(i + 1, a.length, a);
    }
  })(0, 0, []);
  return out.map(a => a.slice(0, n));
}
/* Row by row over every arrangement, pruned by each column's clue prefix. */
function countSolutions(n, rows, cols, limit) {
  limit = limit || 2;
  const opts = rows.map(c => arrangements(c, n)), grid = [];
  let count = 0;
  function colOk(r) {
    for (let c = 0; c < n; c++) {
      const col = new Array(n).fill(-1); for (let i = 0; i <= r; i++) col[i] = grid[i][c];
      if (!lineSolve(col, cols[c])) return false;
    }
    return true;
  }
  (function rec(r) {
    if (count >= limit) return;
    if (r === n) { count++; return; }
    for (const a of opts[r]) { grid[r] = a; if (colOk(r)) rec(r + 1); if (count >= limit) return; }
  })(0);
  return count;
}

/* ---------- the bot (a human proxy) ---------- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashSeed(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/* A player looks at lines in no particular order and works on any line that gives something,
   so it doesn't know the best line to look at next. Each step: a random line among those that
   can make progress, applied in full. Also counts the lines looked at that gave nothing ("scans"),
   assuming the player scans in reading order from where they last worked. */
function botPlay(n, rows, cols, seed) {
  const r = rng(seed), g = new Array(n * n).fill(-1);
  let steps = 0, scans = 0, at = 0;
  while (g.includes(-1)) {
    const live = [];
    for (let li = 0; li < 2 * n; li++) { const t = g.slice(); if (apply(t, n, rows, cols, li) > 0) live.push(li); }
    if (!live.length) return null;
    const li = live[Math.floor(r() * live.length)];
    scans += ((li - at + 2 * n) % (2 * n));   // the dead lines passed over on the way
    apply(g, n, rows, cols, li); steps++; at = li;
  }
  return { steps, scans };
}
function botMedian(n, rows, cols, key, runs) {
  runs = runs || 9;
  const out = [];
  for (let k = 0; k < runs; k++) { const b = botPlay(n, rows, cols, hashSeed(key + '#' + k)); if (!b) return null; out.push(b); }
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  return { steps: med(out.map(b => b.steps)), scans: med(out.map(b => b.scans)) };
}
function predictSecs(g) {
  const taps = Math.max(0, Math.round(g.fill * g.n * g.n) - g.bot.steps) * SECS_PER_EXTRA_TAP;
  return { sweepRate: Math.round(g.bot.steps * SECS_PER_STEP.sweep + taps), tallyRate: Math.round(g.bot.steps * SECS_PER_STEP.tally + taps) };
}

/* ---------- grade, band, gate ---------- */
function grade(p) {
  const n = p.n, rows = p.rows, cols = p.cols;
  const L = logicSolve(n, rows, cols);
  const fill = [...p.sol].filter(ch => ch === '1').length / (n * n);
  const g = { n, fill: Math.round(fill * 1000) / 1000, solved: L.solved, rounds: L.rounds, steps: L.steps, touched: L.touched,
    exactFit: exactFitOnly(n, rows, cols), solutions: countSolutions(n, rows, cols, 2), bot: L.solved ? botMedian(n, rows, cols, p.sol) : null };
  if (g.bot) g.secs = predictSecs(g);
  return g;
}
function band(g) {
  const b = BANDS[g.n], errs = [];
  if (!b) return ['no band for ' + g.n + '×' + g.n];
  if (g.rounds < b.rounds[0] || g.rounds > b.rounds[1]) errs.push('rounds ' + g.rounds + ' outside ' + b.rounds.join('–'));
  if (!g.bot || g.bot.steps < b.steps[0] || g.bot.steps > b.steps[1]) errs.push('bot line-steps ' + (g.bot && g.bot.steps) + ' outside ' + b.steps.join('–'));
  return errs;
}
/* The ship gate for a board record {n, rows, cols, sol}. Returns a list of reasons; empty = ships. */
function check(p, opts) {
  opts = opts || {};
  const errs = [];
  if (!p || !SIZES.includes(p.n) || typeof p.sol !== 'string' || p.sol.length !== p.n * p.n || !/^[01]+$/.test(p.sol)) return ['malformed board'];
  const want = clues(p.sol, p.n);
  if (JSON.stringify(want.rows) !== JSON.stringify(p.rows) || JSON.stringify(want.cols) !== JSON.stringify(p.cols)) errs.push('the clues don’t match the picture');
  if (errs.length) return errs;
  const g = grade(p);
  if (g.fill < FILL[0] || g.fill > FILL[1]) errs.push('fill ' + Math.round(g.fill * 100) + '% outside 25–70%');
  if (g.solutions !== 1) errs.push(g.solutions + ' solutions');
  if (!g.solved) errs.push('line logic alone does not finish it');
  if (g.exactFit) errs.push('finished by full, empty and exact-fit lines alone');
  if (g.solved && g.rounds < MIN_ROUNDS) errs.push('only ' + g.rounds + ' round' + (g.rounds === 1 ? '' : 's'));
  if (!opts.noBand && g.solved) errs.push(...band(g));
  return errs;
}

/* ---------- D4 fingerprint (rotation and reflection) ---------- */
function fingerprint(sol, n) {
  const m = []; for (let r = 0; r < n; r++) m.push(sol.slice(r * n, r * n + n).split(''));
  const rot = a => a[0].map((_, c) => a.map(row => row[c]).reverse()), mir = a => a.map(row => row.slice().reverse());
  let best = null, x = m;
  for (let k = 0; k < 4; k++) { for (const v of [x, mir(x)]) { const s = v.map(row => row.join('')).join(''); if (best === null || s < best) best = s; } x = rot(x); }
  return n + ':' + best;
}

/* the board record a page carries, from a library picture */
function board(pic) {
  const { n, sol, colours } = parse(pic), c = clues(sol, n);
  return { n, rows: c.rows, cols: c.cols, sol, colours, name: pic.name, pic: pic.id };
}

module.exports = { SIZES, FILL, MIN_ROUNDS, BANDS, SECS_PER_STEP, SECS_PER_EXTRA_TAP, SECS_NOTE, parse, runs, clues, lineSolve, logicSolve, exactFitOnly,
  arrangements, countSolutions, botPlay, botMedian, predictSecs, grade, band, check, fingerprint, board, rng, hashSeed };
