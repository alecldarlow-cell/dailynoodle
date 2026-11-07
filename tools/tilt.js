'use strict';
/* Tilt: a rolling-ball maze generator, solver, bots and gate (Lab, 6 Nov 2026).

   The puzzle: an n×n maze, the ball resting at the centre, one exit in the outer
   wall. The player turns the whole maze a quarter at a time; after each turn the
   ball drops (screen-down) until it meets a wall, or leaves through the exit. The
   clock is the score; turns are shown as information.

   Puzzle record (the page's window.DN_PUZZLE, plain data):
     { type:"tilt", id, band, n, walls:[[bits…]…], start:[r,c], exit:[r,c,side], par }
   walls[r][c] is a bitmask: 1 = wall on the north side, 2 east, 4 south, 8 west.
   Two cells always agree about the side between them. exit = the boundary cell and
   the side (0 south, 1 west, 2 north, 3 east, i.e. the gravity direction, in the
   maze's own frame, that carries the ball out through the gap). par = the fewest
   turns that get the ball out.

   Gates (SITE.md › Tilt), set from Alec's plays on 6 Nov 2026:
   - the shortest route is 12 to 14 turns, slides on it average 2.2+ cells, no
     turn on it moves the ball nowhere, and at most 35% of its moves shift the
     ball a single cell (routes that inch along felt "annoying");
   - a slide through the exit cell that misses the gap is never more than 5
     turns from getting out (a near miss 11 turns from the exit was "frustrating");
   - 50 to 100 reachable (cell, gravity) positions: room to plan, not a sprawl;
   - a random spinner's median is at least 5× par and a player who plans three
     turns ahead needs 1.2× to 3.5× par (the bots below, seeded by the board);
   - every board is solvable by reasoning alone (there is nothing to guess).
   After the gates, "inert" walls are added where no reachable slide ever passes,
   so the maze reads as a maze; the state graph, and so the play, is unchanged. */

const DIRS = { 0: [1, 0, 4, 1], 1: [0, -1, 8, 2], 2: [-1, 0, 1, 4], 3: [0, 1, 2, 8] };   // dr, dc, wall bit this side, wall bit the far side
/* Bands by serial. Tilt 1–10 (the first Lab set) keep the band they were made under. From Tilt 11 (the
   two-week Lab daily run, 7 Nov 2026) the shortest way out is 17–20 turns, from a less open maze: the
   first ten took players a median of about 2 s per turn of the shortest route (median ~26 s at par
   12–13, 21 finishes, 6–7 Nov 2026), so par 17–20 aims at a 45–60 s median on the same 10×10 grid,
   inside Alec's limits (no bigger maze, no sprawl past 100 positions, no near miss far from the exit). */
const BANDS = [
  { upTo: 10, n: 10, par: [12, 14], states: [50, 100], avgSlide: 2.2, oneFrac: 0.35, tease: 5, rndMult: 5, look: [1.2, 3.5], openness: [0.35, 0.6] },
  { upTo: Infinity, n: 10, par: [17, 20], states: [50, 100], avgSlide: 2.2, oneFrac: 0.35, tease: 5, rndMult: 5, look: [1.2, 3.5], openness: [0.2, 0.4] }
];
const serialOf = x => { const m = String(x || '').match(/(\d{4})(?!.*\d{4})/); return m ? +m[1] : Infinity; };
const bandFor = serial => BANDS.find(b => serial <= b.upTo);
const BAND = BANDS[BANDS.length - 1];   // the current band, for new pages

/* ---------- seeded randomness (as tools/tally.js) ---------- */
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
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/* ---------- the maze ---------- */
function genMaze(r, n, openness) {
  const walls = []; for (let i = 0; i < n; i++) walls.push(new Array(n).fill(15));
  const seen = []; for (let i = 0; i < n; i++) seen.push(new Array(n).fill(false));
  const stack = [[Math.floor(r() * n), Math.floor(r() * n)]]; seen[stack[0][0]][stack[0][1]] = true;
  while (stack.length) {
    const [rr, cc] = stack[stack.length - 1];
    const nb = [];
    for (let d = 0; d < 4; d++) { const r2 = rr + DIRS[d][0], c2 = cc + DIRS[d][1]; if (r2 >= 0 && r2 < n && c2 >= 0 && c2 < n && !seen[r2][c2]) nb.push([d, r2, c2]); }
    if (!nb.length) { stack.pop(); continue; }
    const [d, r2, c2] = nb[Math.floor(r() * nb.length)];
    walls[rr][cc] &= ~DIRS[d][2]; walls[r2][c2] &= ~DIRS[d][3]; seen[r2][c2] = true; stack.push([r2, c2]);
  }
  let internal = [];
  for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) {
    if (cc + 1 < n && walls[rr][cc] & 2) internal.push([rr, cc, 3]);
    if (rr + 1 < n && walls[rr][cc] & 4) internal.push([rr, cc, 0]);
  }
  internal = shuffle(r, internal);
  for (const [rr, cc, d] of internal.slice(0, Math.floor(internal.length * openness))) {
    const r2 = rr + DIRS[d][0], c2 = cc + DIRS[d][1];
    walls[rr][cc] &= ~DIRS[d][2]; walls[r2][c2] &= ~DIRS[d][3];
  }
  return walls;
}

/* ---------- motion ---------- */
/* the ball at pos under gravity g: where it stops, whether it left through the exit, and the cells it passed */
function slide(walls, n, pos, g, exit) {
  let [r, c] = pos; const [dr, dc, bit] = DIRS[g], path = [];
  for (;;) {
    if (walls[r][c] & bit) return { pos: [r, c], out: false, path };
    const r2 = r + dr, c2 = c + dc;
    if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) return { pos: [r, c], out: r === exit[0] && c === exit[1] && g === exit[2], path };
    r = r2; c = c2; path.push([r, c]);
  }
}
const key = (pos, g) => pos[0] * 400 + pos[1] * 4 + g;
/* every (cell, gravity) state reachable from the start, with its two moves */
function graph(walls, n, start, exit) {
  const s0 = key(start, 0), edges = new Map(), queue = [[start, 0]], seen = new Set([s0]), crossings = new Set();
  while (queue.length) {
    const [pos, g] = queue.shift(), out = [];
    for (const turn of [1, 3]) {               // +1: the maze turned left on screen; +3: turned right
      const ng = (g + turn) % 4, s = slide(walls, n, pos, ng, exit);
      let [r, c] = pos; for (const cell of s.path) { crossings.add(key([r, c], ng)); [r, c] = cell; }
      out.push({ pos: s.pos, g: ng, out: s.out, path: s.path });
      const k = key(s.pos, ng);
      if (!s.out && !seen.has(k)) { seen.add(k); queue.push([s.pos, ng]); }
    }
    edges.set(key(pos, g), out);
  }
  return { edges, states: seen, crossings };
}
/* the shortest route: par and its moves */
function solve(walls, n, start, exit) {
  const s0 = key(start, 0), prev = new Map([[s0, null]]), queue = [[start, 0]];
  while (queue.length) {
    const [pos, g] = queue.shift(), k0 = key(pos, g);
    for (const turn of [1, 3]) {
      const ng = (g + turn) % 4, s = slide(walls, n, pos, ng, exit), k = key(s.pos, ng);
      if (s.out) {
        const moves = [{ from: pos, to: s.pos, g: ng, out: true }]; let cur = k0;
        while (prev.get(cur)) { const p = prev.get(cur); moves.push(p.move); cur = p.from; }
        moves.reverse();
        return { par: moves.length, route: moves };
      }
      if (!prev.has(k)) { prev.set(k, { from: k0, move: { from: pos, to: s.pos, g: ng, out: false } }); queue.push([s.pos, ng]); }
    }
  }
  return null;
}
function routeStats(route) {
  const lens = route.map(m => Math.abs(m.from[0] - m.to[0]) + Math.abs(m.from[1] - m.to[1]));
  return { avgSlide: lens.reduce((a, b) => a + b, 0) / lens.length, zero: lens.filter(l => l === 0).length, one: lens.filter(l => l === 1).length };
}
/* a slide through the exit cell that misses the gap: the most turns such a landing is from getting out */
function exitTouch(walls, n, start, exit) {
  const { edges } = graph(walls, n, start, exit);
  const dist = new Map(), rev = new Map(), queue = [];
  for (const [k, outs] of edges) for (const o of outs) {
    if (o.out) { if (!dist.has(k)) { dist.set(k, 1); queue.push(k); } }
    else { const k2 = key(o.pos, o.g); if (!rev.has(k2)) rev.set(k2, []); rev.get(k2).push(k); }
  }
  while (queue.length) { const k = queue.shift(); for (const p of rev.get(k) || []) if (!dist.has(p)) { dist.set(p, dist.get(k) + 1); queue.push(p); } }
  let worst = 0;
  for (const outs of edges.values()) for (const o of outs) {
    if (o.out) continue;
    if (o.path.some(([r, c]) => r === exit[0] && c === exit[1])) worst = Math.max(worst, dist.get(key(o.pos, o.g)) || 99);
  }
  return worst;
}

/* ---------- bots ---------- */
function randomPlay(walls, n, start, exit, r, cap) {
  let pos = start, g = 0;
  for (let t = 1; t <= cap; t++) {
    g = (g + (r() < 0.5 ? 1 : 3)) % 4; const s = slide(walls, n, pos, g, exit);
    if (s.out) return t; pos = s.pos;
  }
  return cap;
}
/* a player who plans k turns ahead: takes the exit if it is within reach, else heads for the
   reachable position nearest the exit, avoiding positions already visited */
function lookPlay(walls, n, start, exit, r, k, cap) {
  const d = pos => Math.abs(pos[0] - exit[0]) + Math.abs(pos[1] - exit[1]);
  let pos = start, g = 0; const visited = new Map([[key(pos, g), 1]]);
  for (let t = 1; t <= cap; t++) {
    let best = null; const seen = new Set([key(pos, g)]); let queue = [[pos, g, []]];
    search: while (queue.length) {
      const [p, g0, path] = queue.shift(); if (path.length === k) continue;
      for (const turn of [1, 3]) {
        const ng = (g0 + turn) % 4, s = slide(walls, n, p, ng, exit);
        if (s.out) { best = [-1, path.concat(ng)]; break search; }
        const kk = key(s.pos, ng); if (seen.has(kk)) continue; seen.add(kk);
        const score = d(s.pos) + 2 * (visited.get(kk) || 0) + r() * 0.1;
        if (!best || score < best[0]) best = [score, path.concat(ng)];
        queue.push([s.pos, ng, path.concat(ng)]);
      }
    }
    const ng = best ? best[1][0] : (g + (r() < 0.5 ? 1 : 3)) % 4, s = slide(walls, n, pos, ng, exit); g = ng;
    if (s.out) return t; pos = s.pos; visited.set(key(pos, g), (visited.get(key(pos, g)) || 0) + 1);
  }
  return cap;
}

/* ---------- inert walls: the maze reads as a maze, the play is untouched ---------- */
function fillWalls(walls, n, start, exit, r, target, maxPerCell) {
  const before = graph(walls, n, start, exit);
  const count = (rr, cc) => [1, 2, 4, 8].filter(b => walls[rr][cc] & b).length;
  let cands = [];
  for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) {
    if (rr + 1 < n && !(walls[rr][cc] & 4)) cands.push([rr, cc, 0]);
    if (cc + 1 < n && !(walls[rr][cc] & 2)) cands.push([rr, cc, 3]);
  }
  cands = shuffle(r, cands);
  const total = 2 * n * (n - 1);
  let walled = 0;
  for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) { if (rr + 1 < n && walls[rr][cc] & 4) walled++; if (cc + 1 < n && walls[rr][cc] & 2) walled++; }
  for (const [rr, cc, d] of cands) {
    if (walled / total >= target) break;
    const r2 = rr + DIRS[d][0], c2 = cc + DIRS[d][1], opp = d === 0 ? 2 : 1;
    if (before.crossings.has(key([rr, cc], d)) || before.crossings.has(key([r2, c2], opp))) continue;
    if (count(rr, cc) >= maxPerCell || count(r2, c2) >= maxPerCell) continue;
    walls[rr][cc] |= DIRS[d][2]; walls[r2][c2] |= DIRS[d][3]; walled++;
  }
  const after = graph(walls, n, start, exit);
  if (after.states.size !== before.states.size) throw new Error('inert walls changed the state graph');
  for (const [k, outs] of before.edges) {
    const o2 = after.edges.get(k);
    if (!o2 || JSON.stringify(outs.map(o => [o.pos, o.g, o.out])) !== JSON.stringify(o2.map(o => [o.pos, o.g, o.out]))) throw new Error('inert walls changed a move');
  }
  return walls;
}

/* ---------- structure: what every page's record must satisfy ---------- */
function structure(p) {
  const errs = [];
  if (!p || typeof p !== 'object') return ['malformed puzzle'];
  const n = p.n;
  if (!Number.isInteger(n) || n < 4 || n > 16) return ['bad size'];
  if (!Array.isArray(p.walls) || p.walls.length !== n || p.walls.some(row => !Array.isArray(row) || row.length !== n || row.some(w => !Number.isInteger(w) || w < 0 || w > 15))) return ['bad walls'];
  if (!Array.isArray(p.start) || p.start.length !== 2 || !Array.isArray(p.exit) || p.exit.length !== 3) return ['bad start or exit'];
  const [sr, sc] = p.start, [er, ec, eg] = p.exit;
  const inside = (r, c) => Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < n && c >= 0 && c < n;
  if (!inside(sr, sc) || !inside(er, ec) || !(eg >= 0 && eg <= 3)) return ['start or exit off the board'];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const w = p.walls[r][c];
    if (c + 1 < n && !!(w & 2) !== !!(p.walls[r][c + 1] & 8)) errs.push('cells disagree about a wall at ' + r + ',' + c);
    if (r + 1 < n && !!(w & 4) !== !!(p.walls[r + 1][c] & 1)) errs.push('cells disagree about a wall at ' + r + ',' + c);
    for (let d = 0; d < 4; d++) {
      const r2 = r + DIRS[d][0], c2 = c + DIRS[d][1];
      if (!inside(r2, c2)) {
        const isExit = r === er && c === ec && d === eg;
        if (isExit && (w & DIRS[d][2])) errs.push('the exit is walled');
        if (!isExit && !(w & DIRS[d][2])) errs.push('a gap in the outer wall at ' + r + ',' + c);
      }
    }
  }
  if (!(p.walls[sr][sc] & 4)) errs.push('no floor under the ball');
  if (sr === er && sc === ec) errs.push('the ball starts on the exit');
  return errs;
}

/* ---------- grade: the numbers the gate reads ---------- */
function grade(p) {
  const { n, walls, start, exit } = p;
  const sol = solve(walls, n, start, exit);
  if (!sol) return null;
  const g = graph(walls, n, start, exit), rs = routeStats(sol.route);
  const r = rng(hashSeed(fingerprint(p)));   // the bots are seeded by the board, so a page grades the same every time
  const rnd = median(Array.from({ length: 200 }, () => randomPlay(walls, n, start, exit, r, 400)));
  const look3 = median(Array.from({ length: 60 }, () => lookPlay(walls, n, start, exit, r, 3, 300)));
  return { par: sol.par, states: g.states.size, avgSlide: +rs.avgSlide.toFixed(2), zero: rs.zero, one: rs.one, tease: exitTouch(walls, n, start, exit), rnd, look3 };
}
function band(gr, p, BAND) {
  BAND = BAND || bandFor(serialOf(p && p.id));
  const errs = [];
  if (!gr) return ['no way out'];
  if (gr.par < BAND.par[0] || gr.par > BAND.par[1]) errs.push('shortest route ' + gr.par + ' turns');
  if (p.par !== undefined && p.par !== gr.par) errs.push('par on the page is ' + p.par + ', the shortest route is ' + gr.par);
  if (gr.states < BAND.states[0] || gr.states > BAND.states[1]) errs.push(gr.states + ' reachable positions');
  if (gr.avgSlide < BAND.avgSlide) errs.push('slides average ' + gr.avgSlide + ' cells');
  if (gr.zero) errs.push(gr.zero + ' turn(s) on the route move the ball nowhere');
  if (gr.one > BAND.oneFrac * gr.par) errs.push(gr.one + ' single-cell moves on a ' + gr.par + '-turn route');
  if (gr.tease > BAND.tease) errs.push('a near miss ' + gr.tease + ' turns from the exit');
  if (gr.rnd < BAND.rndMult * gr.par) errs.push('random spinning gets out in ' + gr.rnd);
  if (gr.look3 < BAND.look[0] * gr.par || gr.look3 > BAND.look[1] * gr.par) errs.push('the three-ahead bot needs ' + gr.look3 + ' turns');
  return errs;
}
/* the gate: structure, then the band */
function check(p, serial) {
  const BAND = bandFor(serial || serialOf(p.id));
  const errs = structure(p);
  if (errs.length) return errs;
  if (p.n !== BAND.n) errs.push('size ' + p.n + ', the Lab size is ' + BAND.n);
  return errs.concat(band(grade(p), p, BAND));
}

/* ---------- D4: the same maze turned or mirrored is the same maze ---------- */
const SYMS = [
  (r, c, n) => [r, c], (r, c, n) => [c, n - 1 - r], (r, c, n) => [n - 1 - r, n - 1 - c], (r, c, n) => [n - 1 - c, r],
  (r, c, n) => [r, n - 1 - c], (r, c, n) => [n - 1 - r, c], (r, c, n) => [c, r], (r, c, n) => [n - 1 - c, n - 1 - r]
];
/* where each side goes under each symmetry: index by the side's gravity direction (0 S, 1 W, 2 N, 3 E) */
const DMAP = [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2], [0, 3, 2, 1], [2, 1, 0, 3], [3, 2, 1, 0], [1, 0, 3, 2]];
function fingerprint(p) {
  const { n, walls, start, exit } = p; let best = null;
  for (let s = 0; s < 8; s++) {
    const w = []; for (let i = 0; i < n; i++) w.push(new Array(n).fill(0));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const [r2, c2] = SYMS[s](r, c, n);
      for (let d = 0; d < 4; d++) if (walls[r][c] & DIRS[d][2]) w[r2][c2] |= DIRS[DMAP[s][d]][2];
    }
    const st = SYMS[s](start[0], start[1], n), ex = SYMS[s](exit[0], exit[1], n).concat(DMAP[s][exit[2]]);
    const str = n + ':' + st.join(',') + ':' + ex.join(',') + ':' + w.map(row => row.map(x => x.toString(16)).join('')).join('/');
    if (best === null || str < best) best = str;
  }
  return best;
}

/* ---------- generate: one candidate per seed, or null when it fails the gate ---------- */
function generate(seed, opts) {
  opts = opts || {};
  const BAND = bandFor(opts.serial || serialOf(String(seed).match(/^tilt-(\d{4})/) ? String(seed).match(/^tilt-(\d{4})/)[1] : null));
  const n = opts.n || BAND.n, r = rng(hashSeed(seed));
  const walls = genMaze(r, n, BAND.openness[0] + r() * (BAND.openness[1] - BAND.openness[0]));
  const start = [Math.floor(n / 2), Math.floor(n / 2)];
  walls[start[0]][start[1]] |= 4; if (start[0] + 1 < n) walls[start[0] + 1][start[1]] |= 1;
  /* the exit is chosen after the maze is explored: a boundary position the ball reaches with
     gravity pointing out of the board, exactly `par` turns from the start, is where a gap lets it
     out in `par` turns. Random among those in band, so the maze decides where its exit is. */
  const dist = new Map([[key(start, 0), 0]]), queue = [[start, 0]], cands = [];
  while (queue.length) {
    const [pos, g] = queue.shift(), d0 = dist.get(key(pos, g));
    for (const turn of [1, 3]) {
      const ng = (g + turn) % 4, s = slide(walls, n, pos, ng, [-1, -1, -1]), k = key(s.pos, ng);
      if (dist.has(k)) continue;
      dist.set(k, d0 + 1); queue.push([s.pos, ng]);
      const [rr, cc] = s.pos, onEdge = (ng === 0 && rr === n - 1) || (ng === 1 && cc === 0) || (ng === 2 && rr === 0) || (ng === 3 && cc === n - 1);
      if (onEdge && d0 + 1 >= BAND.par[0] && d0 + 1 <= BAND.par[1] && !(rr === start[0] && cc === start[1])) cands.push([rr, cc, ng]);
    }
  }
  if (!cands.length) return null;
  /* every candidate exit is tried (seeded order): the first whose maze passes the whole band is the puzzle */
  let p = null, gr = null;
  for (const exit of shuffle(r, cands)) {
    const w = walls.map(row => row.slice());
    w[exit[0]][exit[1]] &= ~DIRS[exit[2]][2];
    const q = { n, walls: w, start, exit };
    if (structure(q).length) continue;
    const g = grade(q);
    if (!g || band(g, q, BAND).length) continue;
    p = q; gr = g; break;
  }
  if (!p) return null;
  const { walls: W, exit } = p;
  p.par = gr.par;
  fillWalls(W, n, start, exit, r, 0.55, 3);
  const after = grade(p);
  if (!after || band(after, p, BAND).length || after.par !== gr.par) return null;   // the inert walls are checked, not trusted
  p.seed = seed; p.grade = after;
  return p;
}

module.exports = { DIRS, BAND, BANDS, bandFor, rng, hashSeed, genMaze, slide, graph, solve, routeStats, exitTouch, randomPlay, lookPlay, fillWalls, structure, grade, band, check, fingerprint, generate };
