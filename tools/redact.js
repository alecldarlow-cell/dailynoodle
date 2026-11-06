'use strict';
/* Redact: an n×n grid full of letters where some of the letters are decoys sitting
   where the black squares belong (Lab trial, 6 Nov 2026; sizes 5, 6 and 7). Tap a
   letter to black it out; when the black set is right, every across and down run
   reads as a word and the grid is a proper crossword.

   Rules a board keeps (the crossword norms a player expects, and Alec's calls):
   - every white run, across and down, is 3+ letters and a real word; the white
     squares all connect;
   - the answers are everyday words (3–5 letters: the Mini bank's common tiers; 6–7:
     Tangle's everyday "main" words), never a vetoed or blocked word, never an
     acronym, no answer twice;
   - no offensive word appears anywhere in a visible line;
   - no trap: a decoy directly before or after an answer never turns it into a
     longer real word (SNAP+S, WAR+E), which reads as being told a real word is
     wrong (Alec, 6 Nov 2026);
   - exactly one black set, of any size, makes every line valid, against the widest
     British list we hold (the Mini bank, the Doku check list, the Mini additions
     and every word Tangle accepts);
   - solved by line logic and the black count alone, no guess (the model player in
     propagate()).
   Decoys are chosen, not just drawn: a hill-climb keeps the letters that make the
   most rows and columns readable in more than one way, within the rules above.

   Puzzle record (the page's window.DN_PUZZLE, plain data):
     { type:"redact", id, band, n, letters:"n² capitals", black:[cell…], words:[…] } */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const K = { 5: [5, 8], 6: [7, 11], 7: [11, 16] };
/* the Lab bands, by size. Effort is the model player's work; in practice it counts the
   rounds of line logic a board needs (one round ~130, two ~240, three ~350).
   6×6 (Alec 6 Nov 2026): set so a regular lands near Path and Sweep. The first plays
   (6 Nov) showed regulars finishing 6×6 in 11–30 s once learned, so 7×7 is the next
   trial (Alec 6 Nov 2026): one-round boards are refused, two and three rounds allowed. */
const BANDS = { 6: [150, 320], 7: [230, 420] };
const BAND = { n: 6, effort: BANDS[6] };   // the first Lab size, kept for older callers

/* ---------- words ---------- */
let LISTS = null;
function lists() {
  if (LISTS) return LISTS;
  const src = fs.readFileSync(path.join(ROOT, 'engines/mini.js'), 'utf8');
  const W = vm.runInNewContext('(' + src.match(/const WORDS\s*=\s*(\{[\s\S]*?\});/)[1] + ')');
  const veto = require('./word-veto.js'), banned = new Set([...veto.BLOCKED, ...veto.SENSITIVE, ...veto.VETO]);
  for (const w of ['barf', 'bum', 'cig', 'cigs', 'pee', 'peed', 'pees', 'pleb', 'plebs', 'poo', 'poop', 'poos', 'ricin', 'sod', 'sods', 'tart', 'tarts', 'wees',
    'irs', 'cpu', 'epa', 'usa', 'dvd', 'ufo', 'sos', 'nasa', 'fifa', 'uefa', 'opec', 'aids', 'vip', 'yea', 'tor', 'inter', 'mins', 'sup', 'mafia', 'pope', 'abs', 'ads', 'tire', 'tires', 'mar', 'mod', 'bop', 'plow', 'curb', 'program',
    'racist', 'racism', 'rapist', 'raping', 'killer', 'murder', 'suicide', 'abused', 'abuser', 'slaves', 'nazism', 'hitler', 'drunk', 'drugs', 'cancer', 'tumour', 'tumours', 'corpse', 'sexual', 'sexist', 'sexy', 'bloody', 'damned', 'hell', 'whores', 'bitchy', 'stoned', 'junkie']) banned.add(w);
  const docu = require('./doku-check-words.json'), add = require('./mini-word-additions.json').words;
  const main = {}, wide = {};
  for (let L = 3; L <= 7; L++) { main[L] = new Set(); wide[L] = new Set(); }
  for (const f of fs.readdirSync(path.join(ROOT, 'reports')).filter(f => /-word-tangle-\d+\.html$/.test(f))) {
    const m = fs.readFileSync(path.join(ROOT, 'reports', f), 'utf8').match(/main:(\[[^\]]*\]).*?bonus:(\[[^\]]*\])/);
    if (!m) continue;
    for (const w of JSON.parse(m[1])) { const x = String(w).toLowerCase(); if (x.length >= 3 && x.length <= 7 && /^[a-z]+$/.test(x)) { main[x.length].add(x); wide[x.length].add(x); } }
    for (const w of JSON.parse(m[2])) { const x = String(w).toLowerCase(); if (x.length >= 3 && x.length <= 7 && /^[a-z]+$/.test(x)) wide[x.length].add(x); }
  }
  const answers = {};
  for (let L = 3; L <= 7; L++) {
    if (L <= 5) for (const w of [...Object.keys(W[L]), ...(docu[L] || []), ...(add[L] || [])]) if (/^[a-z]+$/.test(w) && w.length === L) wide[L].add(w);
    const pool = L <= 5 ? Object.keys(W[L]).filter(w => W[L][w] <= (L === 3 ? 3 : 2)) : [...main[L]];
    answers[L] = pool.filter(w => /^[a-z]+$/.test(w) && !banned.has(w)).sort();
  }
  const offensive = new Set([...veto.BLOCKED, ...veto.SENSITIVE.filter(w => w.length >= 3)]);
  /* the whole Mini bank (every tier), 3–5 letters: words a solver knows, used by Tumbler's accepted list */
  const bank = {}; for (let L = 3; L <= 5; L++) bank[L] = new Set(Object.keys(W[L]).filter(w => /^[a-z]+$/.test(w) && w.length === L && !banned.has(w)));
  LISTS = { answers, wide, banned, offensive, bank };
  return LISTS;
}

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

/* ---------- geometry ---------- */
const GEO = {};
function geo(n) {
  if (GEO[n]) return GEO[n];
  const lines = [];
  for (let r = 0; r < n; r++) lines.push([...Array(n).keys()].map(c => r * n + c));
  for (let c = 0; c < n; c++) lines.push([...Array(n).keys()].map(r => r * n + c));
  const masks = []; for (let m = 0; m < 1 << n; m++) if (runs(m, n).every(([, l]) => l >= 3)) masks.push(m);
  return (GEO[n] = { lines, masks, maskSet: new Set(masks) });
}
function runs(mask, n) {
  const out = []; let i = 0;
  while (i < n) { if (mask >> i & 1) { i++; continue; } let j = i; while (j < n && !(mask >> j & 1)) j++; out.push([i, j - i]); i = j; }
  return out;
}
const maskOf = (line, black) => line.reduce((m, cell, i) => black.has(cell) ? m | 1 << i : m, 0);
function lineMasks(str, n) {
  const { wide } = lists();
  return geo(n).masks.filter(m => runs(m, n).every(([s, l]) => wide[l] && wide[l].has(str.slice(s, s + l))));
}
function connected(black, n) {
  const whites = []; for (let i = 0; i < n * n; i++) if (!black.has(i)) whites.push(i);
  if (!whites.length) return false;
  const seen = new Set([whites[0]]), stack = [whites[0]];
  while (stack.length) {
    const i = stack.pop(), r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r2 = r + dr, c2 = c + dc, j = r2 * n + c2;
      if (r2 >= 0 && r2 < n && c2 >= 0 && c2 < n && !black.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === whites.length;
}
function slots(black, n) {
  const out = [];
  for (const line of geo(n).lines) for (const [s, l] of runs(maskOf(line, black), n)) out.push(line.slice(s, s + l));
  return out;
}

/* ---------- every black set that makes all lines valid (up to limit) ---------- */
function solutions(letters, n, limit) {
  const { wide } = lists(), rowM = [];
  for (let r = 0; r < n; r++) rowM.push(lineMasks(letters.slice(r * n, r * n + n), n));
  const colWord = (c, a, b) => { let s = ''; for (let r = a; r < b; r++) s += letters[r * n + c]; return s; };
  const out = [];
  function colsOk(chosen, final) {
    const h = chosen.length;
    for (let c = 0; c < n; c++) {
      let i = 0;
      while (i < h) {
        if (chosen[i] >> c & 1) { i++; continue; }
        let j = i; while (j < h && !(chosen[j] >> c & 1)) j++;
        if (j < h || final) { const l = j - i; if (l < 3 || !wide[l] || !wide[l].has(colWord(c, i, j))) return false; }
        else if (j - i > 7) return false;
        i = j;
      }
    }
    return true;
  }
  (function rec(r, chosen) {
    if (out.length >= limit) return;
    if (r === n) {
      if (!colsOk(chosen, true)) return;
      const black = new Set(); chosen.forEach((m, rr) => { for (let c = 0; c < n; c++) if (m >> c & 1) black.add(rr * n + c); });
      if (connected(black, n)) out.push([...black].sort((a, b) => a - b));
      return;
    }
    for (const m of rowM[r]) { const nx = chosen.concat(m); if (colsOk(nx, false)) rec(r + 1, nx); }
  })(0, []);
  return out;
}

/* ---------- the model player: line logic and the black count, never a guess ----------
   effort: what a person scans, round by round: every still-open line costs its open squares plus the
   readings it still allows; a line that settles stops costing. Fitted to Alec's times in the prototype. */
function propagate(letters, n, k) {
  const { lines } = geo(n), state = new Array(n * n).fill(0);   // 0 unknown, 1 black, 2 white
  const cand = lines.map(line => lineMasks(line.map(i => letters[i]).join(''), n));
  const plaus = cand.reduce((a, c) => a + c.length, 0);
  let rounds = 0, effort = 0;
  for (;;) {
    let changed = false;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      cand[li] = cand[li].filter(m => line.every((cell, i) => state[cell] === 0 || (state[cell] === 1) === !!(m >> i & 1)));
      if (!cand[li].length) return { solved: false, rounds, plaus, effort };
      const open = line.filter(c => !state[c]).length;
      if (open) effort += open + cand[li].length - 1;
      line.forEach((cell, i) => {
        if (state[cell]) return;
        const bits = cand[li].map(m => m >> i & 1);
        if (bits.every(b => b === 1)) { state[cell] = 1; changed = true; }
        else if (bits.every(b => b === 0)) { state[cell] = 2; changed = true; }
      });
    }
    const blacks = state.filter(s => s === 1).length, unknown = state.filter(s => s === 0).length;
    if (unknown && blacks === k) { state.forEach((s, i) => { if (!s) state[i] = 2; }); changed = true; }
    else if (unknown && unknown === k - blacks) { state.forEach((s, i) => { if (!s) state[i] = 1; }); changed = true; }
    if (!changed) break;
    rounds++;
  }
  const solved = state.every(s => s);
  return { solved, rounds, plaus, effort, black: solved ? state.map((s, i) => s === 1 ? i : -1).filter(i => i >= 0) : null };
}

/* ---------- generation ---------- */
/* a random legal pattern with k blacks: rows chosen one at a time, columns kept legal, whites connected */
function pattern(r, n, k) {
  const { masks } = geo(n);
  for (let t = 0; t < 400; t++) {
    const rows = [];
    let ok = true;
    for (let rr = 0; rr < n && ok; rr++) {
      const opts = shuffle(r, masks).filter(m => {
        const chosen = rows.concat(m);
        for (let c = 0; c < n; c++) {   // a run closed off above must be 3+; the column so far must still be able to end legally
          let i = 0; const h = chosen.length;
          while (i < h) {
            if (chosen[i] >> c & 1) { i++; continue; }
            let j = i; while (j < h && !(chosen[j] >> c & 1)) j++;
            if (j < h && j - i < 3) return false;
            if (j === h && h === n && j - i < 3) return false;
            if (j === h && j - i < 3 && n - i < 3) return false;
            i = j;
          }
        }
        return true;
      });
      if (!opts.length) { ok = false; break; }
      rows.push(opts[0]);
    }
    if (!ok) continue;
    const black = new Set(); rows.forEach((m, rr) => { for (let c = 0; c < n; c++) if (m >> c & 1) black.add(rr * n + c); });
    if (black.size !== k || !connected(black, n)) continue;
    if (geo(n).lines.some(line => !geo(n).maskSet.has(maskOf(line, black)))) continue;
    return black;
  }
  return null;
}
/* crossword fill: most-constrained slot first, candidates from a (length, position, letter) index */
let IDX = null;
function index() {
  if (IDX) return IDX;
  const { answers } = lists(); IDX = {};
  for (const L in answers) {
    const by = []; for (let i = 0; i < +L; i++) by.push({});
    answers[L].forEach((w, wi) => { for (let i = 0; i < w.length; i++) (by[i][w[i]] = by[i][w[i]] || []).push(wi); });
    IDX[L] = { words: answers[L], by };
  }
  return IDX;
}
function fill(r, n, black, budget) {
  const sl = slots(black, n), grid = {}, used = new Set(), ix = index();
  let nodes = 0;
  function cands(slot) {
    const I = ix[slot.length]; if (!I) return [];
    let base = null;
    slot.forEach((cell, i) => {
      if (grid[cell] === undefined) return;
      const list = I.by[i][grid[cell]] || [];
      base = base === null ? list : (() => { const s = new Set(list); return base.filter(x => s.has(x)); })();
    });
    const pool = base === null ? I.words.map((_, i) => i) : base;
    return pool.map(i => I.words[i]).filter(w => !used.has(w));
  }
  function rec(done) {
    if (done.size === sl.length) return true;
    if (++nodes > budget) return false;
    let best = -1, bc = null;
    for (let i = 0; i < sl.length; i++) { if (done.has(i)) continue; const c = cands(sl[i]); if (!c.length) return false; if (!bc || c.length < bc.length) { best = i; bc = c; } }
    for (const w of shuffle(r, bc).slice(0, 8)) {
      const slot = sl[best], saved = slot.map(cell => grid[cell]);
      slot.forEach((cell, i) => { grid[cell] = w[i]; }); used.add(w);
      if (rec(new Set([...done, best]))) return true;
      used.delete(w); slot.forEach((cell, i) => { if (saved[i] === undefined) delete grid[cell]; else grid[cell] = saved[i]; });
    }
    return false;
  }
  return rec(new Set()) ? { grid, words: sl.map(s => s.map(c => grid[c]).join('')) } : null;
}
function visibleBanned(letters, n) {
  const { offensive } = lists();
  for (const line of geo(n).lines) { const s = line.map(i => letters[i]).join('').toLowerCase(); for (let i = 0; i < n; i++) for (let j = i + 3; j <= n; j++) if (offensive.has(s.slice(i, j))) return s.slice(i, j); }
  return null;
}
function trap(letters, black, n) {
  const { wide } = lists();
  for (const line of geo(n).lines) {
    for (const [s0, l] of runs(maskOf(line, black), n)) for (let a = 0; s0 - a >= 0; a++) for (let b = 0; s0 + l + b <= n; b++) {
      if (!a && !b) continue;
      if (!line.slice(s0 - a, s0).every(c => black.has(c)) || !line.slice(s0 + l, s0 + l + b).every(c => black.has(c))) continue;
      const w = line.slice(s0 - a, s0 + l + b).map(c => letters[c]).join('').toLowerCase();
      if (wide[w.length] && wide[w.length].has(w)) return w;
    }
  }
  return null;
}
const DECOY = 'aaabcdeeeeefghiiilmnnooprrsssttuuy';
/* the rules every board must keep, cheapest first; returns the model player's result when they hold */
function fair(letters, n, black, k) {
  if (visibleBanned(letters, n) || trap(letters, black, n)) return null;
  const pr = propagate(letters, n, k);
  if (!pr.solved || pr.black.join() !== [...black].sort((a, b) => a - b).join()) return null;
  if (solutions(letters, n, 2).length !== 1) return null;
  return pr;
}
/* one board per seed, or null: a pattern, a fill, then decoys hill-climbed for plausibility within the rules */
function generate(seed, opts) {
  opts = opts || {};
  const n = opts.n || 5, r = rng(hashSeed(seed)), kr = K[n];
  const k = opts.k || kr[0] + Math.floor(r() * (kr[1] - kr[0] + 1));
  /* most patterns can't be filled with everyday words; each try is cheap, so a seed tries several */
  let black = null, f = null;
  for (let t = 0; t < 40 && !f; t++) { black = pattern(r, n, k); if (black) f = fill(r, n, black, n === 7 ? 12000 : 6000); }
  if (!f) return null;
  const cells = [...black];
  const make = dec => { const a = []; for (let i = 0; i < n * n; i++) a.push(black.has(i) ? dec[i] : f.grid[i]); return a.join(''); };
  let dec = {}, cur = null, curPr = null;
  for (let t = 0; t < 40 && !cur; t++) {
    const d = {}; for (const c of cells) d[c] = DECOY[Math.floor(r() * DECOY.length)];
    const s = make(d), pr = fair(s, n, black, k);
    if (pr) { dec = d; cur = s; curPr = pr; }
  }
  if (!cur) return null;
  const steps = opts.climb === undefined ? 60 : opts.climb;
  for (let t = 0; t < steps; t++) {
    const c = cells[Math.floor(r() * cells.length)], d = Object.assign({}, dec); d[c] = DECOY[Math.floor(r() * DECOY.length)];
    if (d[c] === dec[c]) continue;
    const s = make(d), pr = fair(s, n, black, k);
    if (pr && pr.effort >= curPr.effort) { dec = d; cur = s; curPr = pr; }
  }
  return { n, letters: cur.toUpperCase(), black: [...black].sort((a, b) => a - b), words: f.words,
    grade: { n, k, rounds: curPr.rounds, plaus: curPr.plaus, effort: curPr.effort }, seed };
}

/* ---------- the gate a page's record must pass ---------- */
function check(p) {
  const errs = [];
  const n = p && p.n;
  if (!K[n] || typeof p.letters !== 'string' || !new RegExp('^[A-Z]{' + n * n + '}$').test(p.letters) || !Array.isArray(p.black)) return ['malformed board'];
  const letters = p.letters.toLowerCase(), black = new Set(p.black), { answers } = lists();
  if (p.black.some(i => !Number.isInteger(i) || i < 0 || i >= n * n) || black.size !== p.black.length) errs.push('bad black squares');
  if (p.black.length < K[n][0] || p.black.length > K[n][1]) errs.push(p.black.length + ' black squares');
  if (geo(n).lines.some(line => !geo(n).maskSet.has(maskOf(line, black)))) errs.push('a run of one or two letters');
  if (!connected(black, n)) errs.push('the white squares do not connect');
  const words = slots(black, n).map(s => s.map(c => letters[c]).join(''));
  for (const w of words) if (!(answers[w.length] || []).includes(w)) errs.push(w + ' is not an everyday answer');
  if (new Set(words).size !== words.length) errs.push('an answer appears twice');
  if (Array.isArray(p.words) && p.words.join() !== words.join()) errs.push("the listed words are not the grid's");
  const vb = visibleBanned(letters, n); if (vb) errs.push('an offensive word shows: ' + vb);
  const tw = trap(letters, black, n); if (tw) errs.push('a decoy turns an answer into ' + tw);
  const sols = solutions(letters, n, 2);
  if (sols.length !== 1) errs.push(sols.length ? 'more than one black set works' : 'no black set works');
  else if (sols[0].join() !== p.black.join()) errs.push('the answer is not the only black set');
  const pr = propagate(letters, n, p.black.length);
  if (!pr.solved) errs.push('needs a guess: line logic and the count stall');
  else errs.push(...band({ n, effort: pr.effort }));
  return errs;
}
/* the same board turned or mirrored is the same board */
function fingerprint(p) {
  const n = p.n, black = new Set(p.black), g = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(black.has(r * n + c) ? '#' : p.letters[r * n + c]); g.push(row); }
  const out = []; let cur = g;
  for (let t = 0; t < 4; t++) {
    cur = cur[0].map((_, c) => cur.map(row => row[c]).reverse());
    out.push(cur.map(r => r.join('')).join('/')); out.push(cur.map(r => r.slice().reverse().join('')).join('/'));
  }
  return out.sort()[0];
}
function band(g) {
  const e = [];
  const b = BANDS[g.n];
  if (!b) { e.push('size ' + g.n + ', the Lab sizes are ' + Object.keys(BANDS).join(' and ')); return e; }
  if (g.effort < b[0] || g.effort > b[1]) e.push('effort ' + g.effort);
  return e;
}
function grade(p) { const pr = propagate(p.letters.toLowerCase(), p.n, p.black.length); return { n: p.n, k: p.black.length, rounds: pr.rounds, plaus: pr.plaus, effort: pr.effort, solved: pr.solved }; }
module.exports = { K, BAND, BANDS, band, fingerprint, lists, rng, hashSeed, geo, runs, lineMasks, connected, slots, solutions, propagate, pattern, fill, trap, visibleBanned, fair, generate, check, grade };
