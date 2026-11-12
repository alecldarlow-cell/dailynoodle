'use strict';
/* Reach (working name): a numbers-target daily, generator, exhaustive solver, gate and
   human-proxy bot (Lab build, 12 Nov 2026; brief: project doc claude/brief-reach-numbers.md).

   The puzzle: six number tiles and a target, the same for everyone on the day. Some tiles
   are "large" (25, 50, 75, 100, each at most once), the rest "small" (1–10, at most two of
   each), as the UK numbers-round format draws them. The target is 101–999. Pick a tile, an
   operation and a second tile: the two become one new tile holding the result. Every result
   must be a whole, positive number (no fractions, no zero, no negatives). Solved when any
   tile equals the target. Tiles needn't all be used. No fail state: the clock is the score.

   Puzzle record (the page's window.DN_PUZZLE, plain data):
     { type:"reach", id, band, tiles:[6 numbers], target, way:[[a,op,b,result]…] }
   `way` is one shortest route (minOps steps), shown on the finish sheet and by "Show a way".
   op is one of "+", "-", "*", "/" (the player sees + − × ÷).

   analyse(tiles, target) is exhaustive over every sub-multiset of the tiles:
     minOps   the fewest operations that reach the target (exact, by iterative deepening)
     routes   distinct exact expression trees over any subset of the tiles (operands of + and ×
              unordered, tiles of equal value interchangeable, ×1 and ÷1 not counted as steps;
              intermediate values above 1,000,000 are dropped from the count, never from minOps)
     nearMiss expressions (one operation or more) landing within 5 of the target but not on it

   Gate (check): exactly-solvable; minOps 3–5 (2 or fewer is a × b or a × b + c, too easy);
   routes inside BAND.routes (too many: anything works; too few: one obscure route); the target
   is not a tile, nor a tile × 10 or × 100; the stored `way` is legal, reaches the target and is
   as short as minOps; the bot's predicted median time inside BAND.secs. The batch tool adds
   the repeat check (same multiset of tiles and target) across every page.

   The bot (botPlay) is a human proxy in the style of the Lab trio's bots: it keeps its eye on
   the tile nearest the target, checks whether one more operation with another tile finishes,
   and when the gap is small looks for a pair of tiles that makes the gap; otherwise it makes
   the most promising of a few moves it "notices" (greedy, biased to × with a large number and
   to moves on its working tile), and starts again (Reset) when a line stops getting closer.
   Every operation it works out counts as one step; every move it makes counts as one entry.
   Predicted seconds = SECS_PER_STEP × steps + SECS_PER_MOVE × moves, calibrated against
   Tally's finished plays (see CALIBRATION). The bot is seeded by the board, so a page grades
   the same every time. */

const LARGE = [25, 50, 75, 100];
const OPS = ['+', '-', '*', '/'];
const SHOW = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const CAP = 1e6;

/* CALIBRATION (12 Nov 2026, Supabase project "digi", public.events): Tally's finished plays
   (puzzle_end, outcome solved, 5 s–1 h; 92 plays over Tally 1–19), joined by page to the number
   of cage-combination evaluations tools/tally.js's human solver makes on that board
   (85–467 a board). Seconds per evaluation: play-weighted median of (board median secs /
   evaluations) 1.26 s; weighted least squares through the origin 0.93 s (correlation only
   0.30 across 19 boards, so this is a first band, to be refitted from Reach's own Lab plays as
   Tilt's was). A Reach step, one operation worked out in the head, is taken as one Tally
   evaluation (one sum or product checked against a clue); the median rate is used. A move
   (tile, sign, tile: three taps and a glance) is 2 s, as a Tilt turn measured from Lab plays. */
const SECS_PER_STEP = 1.26, SECS_PER_MOVE = 2, SECS_READ = 4;

/* The band, set from the bot over 387 seeded draws (12 Nov 2026; the report in the type spec):
   - three large numbers: the bot finished none inside 100 s (median 549 s), so the draw never
     deals three; one and two large pass about equally (7% and 5% of draws), so the mix is 50/50;
   - bot time 30–95 s a board (at 30–100 the first 30 boards' median was 92 s; 95 brings it inside 60–90);
   - routes 20–300: the 10th–90th percentile of the passing boards (32–232), so neither a board
     with one hidden way nor one where anything works gets through;
   - the bot finishes at least 70% of its 41 runs;
   - at least one near miss (a board you can't get close on teaches nothing). */
const BAND = { minOps: [3, 5], routes: [20, 300], secs: [30, 95], solved: 70, nearMiss: [1, Infinity] };
const LARGE_MIX = [[1, 0.5], [2, 0.5]];

/* ---------- seeded randomness (as tools/tilt.js) ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashSeed(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

/* ---------- the rule: a op b, whole and positive, or null ---------- */
function apply(a, op, b) {
  if (!(Number.isInteger(a) && Number.isInteger(b) && a > 0 && b > 0)) return null;
  if (op === '+') return a + b;
  if (op === '*') return a * b;
  if (op === '-') return a > b ? a - b : null;
  if (op === '/') return a % b === 0 ? a / b : null;
  return null;
}
/* why a move is refused, in the player's words (the engine shows the same text) */
function refusal(a, op, b) {
  if (op === '-' && a === b) return 'That would make zero. Results must be whole numbers above zero.';
  if (op === '-' && a < b) return 'That would go below zero. Take the smaller from the larger.';
  if (op === '/' && a % b) return a + ' ÷ ' + b + ' isn’t a whole number.';
  return '';
}

/* ---------- drawing a board ---------- */
function draw(r, large) {
  const big = shuffle(r, LARGE).slice(0, large);
  const deck = []; for (let v = 1; v <= 10; v++) deck.push(v, v);
  const small = shuffle(r, deck).slice(0, 6 - large);
  const target = 101 + Math.floor(r() * 899);
  return { tiles: big.sort((x, y) => y - x).concat(small), target };
}
function largeCount(r) { let x = r(); for (const [n, w] of LARGE_MIX) { if ((x -= w) < 0) return n; } return 2; }

/* ---------- exact search: fewest operations and one shortest way ---------- */
function shortest(tiles, target, maxOps) {
  maxOps = maxOps == null ? 5 : maxOps;
  if (tiles.includes(target)) return { minOps: 0, way: [] };
  for (let d = 1; d <= Math.min(maxOps, tiles.length - 1); d++) {
    const seen = new Set(), way = [];
    const dfs = (nums, left) => {
      const key = left + ':' + nums.slice().sort((x, y) => x - y).join(',');
      if (seen.has(key)) return false; seen.add(key);
      for (let i = 0; i < nums.length; i++) for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        for (const op of OPS) {
          if ((op === '+' || op === '*') && j < i) continue;   // commutative: once
          const v = apply(nums[i], op, nums[j]);
          if (v == null || ((op === '*' || op === '/') && nums[j] === 1) || (op === '*' && nums[i] === 1)) continue;
          way.push((op === '+' || op === '*') && nums[j] > nums[i] ? [nums[j], op, nums[i], v] : [nums[i], op, nums[j], v]);   // larger first, as people write it
          if (v === target) return true;
          if (left > 1) {
            const rest = nums.filter((_, k) => k !== i && k !== j); rest.push(v);
            if (dfs(rest, left - 1)) return true;
          }
          way.pop();
        }
      }
      return false;
    };
    if (dfs(tiles.slice(), d)) return { minOps: d, way };
  }
  return { minOps: null, way: null };
}

/* ---------- exhaustive count of routes and near misses ---------- */
function analyse(tiles, target) {
  const n = tiles.length, memo = new Map();
  const keyOf = m => { const a = []; for (let i = 0; i < n; i++) if (m & (1 << i)) a.push(tiles[i]); return a.sort((x, y) => x - y).join(','); };
  const add = (map, v, c) => { if (v <= CAP) map.set(v, (map.get(v) || 0) + c); };
  function values(m) {
    const k = keyOf(m); if (memo.has(k)) return memo.get(k);
    const out = new Map();
    if ((m & (m - 1)) === 0) { out.set(tiles[31 - Math.clz32(m)], 1); memo.set(k, out); return out; }
    const pairs = new Map();
    for (let s = (m - 1) & m; s > 0; s = (s - 1) & m) {
      const t = m ^ s; if (!t) continue;
      let ka = keyOf(s), kb = keyOf(t), sa = s, sb = t;
      if (ka > kb) { [ka, kb] = [kb, ka]; [sa, sb] = [sb, sa]; }
      const pk = ka + '|' + kb; if (!pairs.has(pk)) pairs.set(pk, [sa, sb, ka === kb]);
    }
    for (const [sa, sb, same] of pairs.values()) {
      const A = values(sa), B = values(sb);
      const comm = (fn, skipOne) => {
        if (same) {
          const acc = new Map();
          for (const [a, ca] of A) for (const [b, cb] of B) { if (skipOne && (a === 1 || b === 1)) continue; const v = fn(a, b); acc.set(v, (acc.get(v) || 0) + ca * cb); }
          for (const [a, ca] of A) { if (skipOne && a === 1) continue; const v = fn(a, a); acc.set(v, (acc.get(v) || 0) + ca); }
          for (const [v, c] of acc) add(out, v, c / 2);
        } else for (const [a, ca] of A) for (const [b, cb] of B) { if (skipOne && (a === 1 || b === 1)) continue; add(out, fn(a, b), ca * cb); }
      };
      comm((a, b) => a + b, false);
      comm((a, b) => a * b, true);
      const ord = (X, Y) => { for (const [a, ca] of X) for (const [b, cb] of Y) { if (a > b) add(out, a - b, ca * cb); if (b > 1 && a % b === 0) add(out, a / b, ca * cb); } };
      ord(A, B); if (!same) ord(B, A);
    }
    memo.set(k, out); return out;
  }
  let routes = 0, nearMiss = 0, fewest = Infinity;
  const keys = new Set();
  for (let m = 1; m < (1 << n); m++) {
    if ((m & (m - 1)) === 0) continue;
    const k = keyOf(m); if (keys.has(k)) continue; keys.add(k);
    const V = values(m), c = V.get(target) || 0;
    routes += c; if (c) fewest = Math.min(fewest, k.split(',').length - 1);
    for (let d = -5; d <= 5; d++) if (d) nearMiss += V.get(target + d) || 0;
  }
  // the count bounds the search: the exact search only has to prove nothing shorter exists and find one way
  const s = shortest(tiles, target, fewest === Infinity ? 5 : fewest);
  return { minOps: s.minOps, way: s.way, routes: Math.round(routes), nearMiss: Math.round(nearMiss) };
}

/* ---------- the human-proxy bot ---------- */
function botPlay(tiles, target, r, cap) {
  cap = cap || 300;
  let steps = 0, moves = 0, resets = 0;
  const closest = nums => nums.reduce((b, x, i) => Math.abs(x - target) < Math.abs(nums[b] - target) ? i : b, 0);
  const tryOp = (a, op, b) => { steps++; return apply(a, op, b); };
  const without = (arr, ...vals) => { const out = arr.slice(); for (const v of vals) { const i = out.indexOf(v); if (i >= 0) out.splice(i, 1); } return out; };
  /* ways to make `want` from `pool` with at most one operation: [opsUsed, tilesUsed] or null */
  function make(want, pool, pairsCap) {
    steps++; if (pool.includes(want)) return [0, [want]];   // one glance along the tiles
    const pairs = []; for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) pairs.push([Math.max(pool[i], pool[j]), Math.min(pool[i], pool[j])]);
    for (const [x, y] of shuffle(r, pairs).slice(0, pairsCap || 5)) for (const op of ['+', '*', '-']) if (tryOp(x, op, y) === want) return [1, [x, y]];
    return null;
  }
  /* the planner a person uses on a numbers round: target ÷ a big tile ≈ a multiplier; make the
     multiplier from one or two tiles, then make up the gap from what is left */
  function plan() {
    const bases = shuffle(r, tiles.filter(x => x >= 25)).concat(shuffle(r, tiles.filter(x => x < 25 && x > 2)).sort((a, b) => b - a));
    for (const a of bases.slice(0, 4)) {
      const rest = without(tiles, a), m = target / a; steps++;
      for (const mm of shuffle(r, [Math.floor(m), Math.ceil(m)].filter((x, i, arr) => x >= 2 && arr.indexOf(x) === i))) {
        const mk = make(mm, rest, 6); if (!mk) continue;
        const P = a * mm, d = Math.abs(target - P); steps++;
        if (d === 0) return mk[0] + 1;
        const rest2 = without(rest, ...mk[1]);
        if (d <= 30) { const g = make(d, rest2, 6); if (g) return mk[0] + 1 + g[0] + 1; }
      }
    }
    return 0;
  }
  function greedy() {
    let nums = tiles.slice(), best = Infinity, stale = 0, made = 0;
    for (;;) {
      if (nums.includes(target)) return made;
      if (nums.length < 2 || steps >= cap) return 0;
      const wi = closest(nums), w = nums[wi], others = nums.filter((_, k) => k !== wi), gap = Math.abs(target - w);
      for (const x of shuffle(r, others)) for (const op of (target > w ? ['+', '*'] : ['-', '/'])) {   // does one more operation finish it? (the way that heads for the target)
        if (tryOp(w, op, x) === target) return made + 1;
      }
      if (gap > 0 && gap <= 30 && others.length >= 2) { const g = make(gap, others, 6); if (g) return made + g[0] + 1; }   // a small gap: can the others make it?
      const cand = [];   // notice a handful of moves, make the one that lands nearest the target
      for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) {
        const a = Math.max(nums[i], nums[j]), b = Math.min(nums[i], nums[j]);
        for (const op of OPS) {
          let wgt = 1;
          if (op === '*' && a >= 25 && b > 1) wgt = 4; else if (op === '*' && b > 1) wgt = 2;
          if (i === wi || j === wi) wgt *= 2;
          if (op === '/' || (b === 1 && op === '*')) wgt *= 0.3;
          cand.push({ i, j, a, op, b, k: Math.log(r() + 1e-9) / wgt });   // weighted sampling without replacement
        }
      }
      cand.sort((x, y) => y.k - x.k);
      let pick = null, pickD = Infinity;
      for (const c of cand.slice(0, 5)) {
        const v = tryOp(c.a, c.op, c.b); if (v == null) continue;
        const d = Math.abs(target - v) * (1 + 0.25 * r());
        if (d < pickD) { pickD = d; pick = Object.assign({ v }, c); }
      }
      if (!pick) return 0;
      nums = nums.filter((_, k) => k !== pick.i && k !== pick.j); nums.push(pick.v); made++; moves++;
      const now = Math.abs(target - nums[closest(nums)]);
      if (now < best) { best = now; stale = 0; } else if (++stale >= 2) return 0;
    }
  }
  // a first look (greedy), then the multiplier plan, then fresh greedy lines with Reset until it lands or gives up
  for (let k = 0; steps < cap; k++) {
    const got = (k % 2) ? plan() : greedy();
    if (got) return { steps, moves: moves + got, resets, solved: true };
    resets++;
  }
  return { steps, moves, resets, solved: false };
}
const predict = b => SECS_READ + SECS_PER_STEP * b.steps + SECS_PER_MOVE * b.moves;
/* the bot's grade for a board: 41 seeded plays, the median predicted seconds and solve rate */
function botGrade(tiles, target, runs) {
  const r = rng(hashSeed('reach-bot|' + fingerprint({ tiles, target })));
  const plays = Array.from({ length: runs || 41 }, () => botPlay(tiles, target, r));
  const secs = plays.map(p => p.solved ? predict(p) : SECS_READ + SECS_PER_STEP * p.steps + 60);   // a give-up costs a minute more
  return { secs: Math.round(median(secs)), solvedPct: Math.round(100 * plays.filter(p => p.solved).length / plays.length), steps: median(plays.map(p => p.steps)) };
}

/* ---------- grade, gate ---------- */
function fingerprint(p) { return p.tiles.slice().sort((x, y) => x - y).join(',') + '>' + p.target; }
function grade(p) {
  const a = analyse(p.tiles, p.target), b = botGrade(p.tiles, p.target);
  return { minOps: a.minOps, routes: a.routes, nearMiss: a.nearMiss, way: a.way, large: p.tiles.filter(x => x >= 25).length, bot: b.secs, botSolved: b.solvedPct };
}
function band(g) {
  const errs = [];
  if (g.minOps == null) errs.push('no exact solution');
  else if (g.minOps < BAND.minOps[0]) errs.push('too easy: reached in ' + g.minOps + ' operation' + (g.minOps === 1 ? '' : 's'));
  else if (g.minOps > BAND.minOps[1]) errs.push('needs more than ' + BAND.minOps[1] + ' operations');
  if (g.routes < BAND.routes[0]) errs.push('only ' + g.routes + ' routes (one obscure way)');
  if (g.routes > BAND.routes[1]) errs.push(g.routes + ' routes (anything works)');
  if (g.nearMiss < BAND.nearMiss[0]) errs.push('no near miss');
  if (g.bot < BAND.secs[0] || g.bot > BAND.secs[1]) errs.push('bot time ' + g.bot + ' s outside ' + BAND.secs.join('–'));
  if (g.botSolved < BAND.solved) errs.push('the bot finished only ' + g.botSolved + '% of its runs');
  return errs;
}
/* the rules a board must keep whatever its band */
function structure(p) {
  const errs = [];
  if (!p || !Array.isArray(p.tiles) || p.tiles.length !== 6 || !p.tiles.every(x => Number.isInteger(x) && x > 0)) return ['malformed tiles'];
  if (!(Number.isInteger(p.target) && p.target >= 101 && p.target <= 999)) errs.push('target outside 101–999');
  const big = p.tiles.filter(x => x >= 11), small = p.tiles.filter(x => x <= 10);
  if (!big.every(x => LARGE.includes(x)) || new Set(big).size !== big.length) errs.push('large tiles must be distinct from 25, 50, 75, 100');
  if (big.length < 1 || big.length > 4) errs.push('one to four large tiles');
  for (let v = 1; v <= 10; v++) if (small.filter(x => x === v).length > 2) errs.push('more than two ' + v + 's');
  if (p.tiles.some(x => x === p.target || x * 10 === p.target || x * 100 === p.target)) errs.push('target is a tile, or a tile × 10 or × 100');
  return errs;
}
/* the stored way: legal moves on the board's own tiles, ending on the target */
function wayErrors(p) {
  if (!Array.isArray(p.way) || !p.way.length) return ['no way stored'];
  const pool = p.tiles.slice();
  for (const st of p.way) {
    if (!Array.isArray(st) || st.length !== 4) return ['malformed way'];
    const [a, op, b, v] = st, ia = pool.indexOf(a); if (ia < 0) return ['way uses ' + a + ', not on the board'];
    pool.splice(ia, 1); const ib = pool.indexOf(b); if (ib < 0) return ['way uses ' + b + ', not on the board'];
    pool.splice(ib, 1); if (apply(a, op, b) !== v) return ['way step ' + a + op + b + ' is not ' + v];
    pool.push(v);
  }
  return p.way[p.way.length - 1][3] === p.target ? [] : ['way does not end on the target'];
}
function check(p) {
  const errs = structure(p);
  if (errs.length) return errs;
  errs.push(...wayErrors(p));
  const g = grade(p);
  errs.push(...band(g));
  if (g.minOps != null && Array.isArray(p.way) && p.way.length !== g.minOps) errs.push('stored way has ' + p.way.length + ' steps, shortest is ' + g.minOps);
  return errs;
}

/* ---------- generation ---------- */
function generate(seed) {
  const r = rng(hashSeed(seed));
  const large = largeCount(r), b = draw(r, large), p = { tiles: b.tiles, target: b.target };
  if (structure(p).length) return null;
  const g = grade(p);
  if (band(g).length) return null;
  return { tiles: p.tiles, target: p.target, way: g.way, seed: String(seed), grade: g };
}
const label = st => st[0] + ' ' + SHOW[st[1]] + ' ' + st[2] + ' = ' + st[3];

module.exports = { LARGE, OPS, SHOW, BAND, LARGE_MIX, SECS_PER_STEP, SECS_PER_MOVE, rng, hashSeed, median, apply, refusal, draw, largeCount, shortest, analyse, botPlay, botGrade, predict, fingerprint, grade, band, structure, wayErrors, check, generate, label };
