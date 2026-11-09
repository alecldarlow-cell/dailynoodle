#!/usr/bin/env node
'use strict';
/* tools/yarn-noclock-boards.js — boards for Yarn's No clock basket (Alec, 9 Nov 2026).
   No clock rounds have their own boards, never a level's, so playing untimed can't give a level's words away.
   Same rules as levels 361-720 (tools/tests/unit/yarn.test.js): 16 tiles (q = Qu), at most one Qu and one of J/X/Z,
   a longest common word of 7+ letters that is the board's unique longest common word and that no rarer word beats,
   52-70 common words (a long but finishable hunt), no board repeating a daily Tangle or a Yarn level under rotation and reflection, and no longest
   word that is a daily Tangle's or a level's. Seeded, so the same command gives the same boards.
   Usage: node tools/yarn-noclock-boards.js [count=100] [--write]   (--write puts them in the page's NOCLOCK line) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { unpack } = require('./yarn-words.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports'), FILE = path.join(REPORTS, '2026-10-24-quiz-yarn.html');
const html = fs.readFileSync(FILE, 'utf8');
const DICT = vm.runInNewContext('(' + html.match(/\nconst DICT=(\{.*?\});\n/)[1] + ')');
const LEVELS = vm.runInNewContext('(' + html.match(/\nconst LEVELS=(\[[\s\S]*?\]);\n/)[1] + ')');
const MAIN = unpack(DICT.M), ALL = MAIN.concat(unpack(DICT.B)), MAINSET = new Set(MAIN);
const COUNT = +(process.argv.slice(2).find(a => /^\d+$/.test(a)) || 100);

let seed = 0x9e3779b9 ^ 20261109;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rand() * a.length)];

const NB = [...Array(16)].map((_, i) => [...Array(16).keys()].filter(j => j !== i && Math.abs((i >> 2) - (j >> 2)) <= 1 && Math.abs((i & 3) - (j & 3)) <= 1));
const trie = ws => { const root = {}; for (const w of ws) { let n = root; for (const ch of w) n = n[ch] || (n[ch] = {}); n.$ = w; } return root; };
const TM = trie(MAIN), TA = trie(ALL);
const tilesOf = t => t.split('').map(c => c === 'q' ? 'qu' : c);
function solve(T, root) { const out = new Set(); const go = (i, node, used) => { let n = node; for (const ch of T[i]) { n = n[ch]; if (!n) return; } if (n.$ && n.$.length >= 3) out.add(n.$); for (const j of NB[i]) if (!(used >> j & 1)) go(j, n, used | 1 << j); }; for (let i = 0; i < 16; i++) go(i, root, 1 << i); return out; }
function d4(T) { const g = [0, 1, 2, 3].map(r => T.slice(r * 4, r * 4 + 4)), rot = m => m[0].map((_, c) => m.map(r => r[c]).reverse()), mir = m => m.map(r => r.slice().reverse());
  let best = null, m = g; for (let k = 0; k < 4; k++) { for (const c of [m, mir(m)]) { const s = c.map(r => r.join(',')).join('|'); if (best === null || s < best) best = s; } m = rot(m); } return best; }

const daily = fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-word-tangle-\d{4}\.html$/.test(f)).map(f => {
  const s = fs.readFileSync(path.join(REPORTS, f), 'utf8'), m = s.match(/window\.DN_PUZZLE=(\{.*\});/) || s.match(/\nconst PUZZLE=(\{.*\});\n/);
  return vm.runInNewContext('(' + m[1] + ')'); });
const usedStars = new Set(daily.map(P => P.star).concat(LEVELS.map(L => L.s)));
const usedBoards = new Set(daily.map(P => d4(P.tiles.map(t => t.toLowerCase()))).concat(LEVELS.map(L => d4(tilesOf(L.t)))));

// Boggle-style letter weights (new dice), q stands for the Qu tile
const W = { e: 19, t: 13, a: 12, r: 12, i: 11, n: 11, o: 11, s: 9, d: 6, c: 5, h: 5, l: 5, f: 4, m: 4, p: 4, u: 4, g: 3, y: 3, w: 2, b: 2, v: 2, k: 1, x: 1, j: 1, q: 1, z: 1 };
const BAG = Object.entries(W).flatMap(([c, n]) => Array(n).fill(c));
const ok = t => { const T = tilesOf(t); return T.filter(x => x === 'qu').length <= 1 && T.filter(x => /^[jxz]$/.test(x)).length <= 1; };
// a star must be traceable as single letters (no q) so it can be laid on a path of its own length
const NOSTAR = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'word-blocklist.json'), 'utf8')).nostar);
const STARS = MAIN.filter(w => w.length >= 7 && w.length <= 9 && !w.includes('q') && !usedStars.has(w) && !NOSTAR.has(w));

function lay(star) {
  for (let tries = 0; tries < 200; tries++) {
    const cells = Array(16).fill(null), used = new Set(); let at = Math.floor(rand() * 16), okp = true;
    for (let k = 0; k < star.length; k++) {
      if (k) { const nx = NB[at].filter(j => !used.has(j)); if (!nx.length) { okp = false; break; } at = pick(nx); }
      used.add(at); cells[at] = star[k];
    }
    if (okp) return { cells, fixed: used };
  }
  return null;
}
function score(t, star) {
  if (!ok(t)) return -1;
  const T = tilesOf(t), main = solve(T, TM);
  if (!main.has(star)) return -1;
  for (const w of main) if (w !== star && w.length >= star.length) return -1;
  for (const w of solve(T, TA)) if (w.length > star.length) return -1;
  return main.size;
}
function board(star) {
  const L = lay(star); if (!L) return null;
  const cells = L.cells.map(c => c || pick(BAG));
  let t = cells.join(''), best = score(t, star);
  const free = [...Array(16).keys()].filter(i => !L.fixed.has(i));
  for (let it = 0; it < 1400 && best < 56; it++) {
    const i = pick(free), c = cells[i]; cells[i] = pick(BAG);
    const t2 = cells.join(''), s2 = score(t2, star);
    if (s2 >= best) { best = s2; t = t2; } else cells[i] = c;
  }
  return best >= 52 && best <= 70 ? { t, s: star, n: best } : null;
}

const out = [], seenStars = new Set(), seenBoards = new Set(usedBoards);
const pool = STARS.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
for (const star of pool) {
  if (out.length >= COUNT) break;
  if (seenStars.has(star)) continue;
  const b = board(star); if (!b) continue;
  const k = d4(tilesOf(b.t)); if (seenBoards.has(k)) continue;
  seenBoards.add(k); seenStars.add(star); out.push(b);
  if (out.length % 10 === 0) process.stderr.write(out.length + ' ');
}
process.stderr.write('\n');
const ns = out.map(b => b.n).sort((a, b) => a - b);
console.log(JSON.stringify({ boards: out.length, commonWords: { min: ns[0], median: ns[ns.length >> 1], max: ns.at(-1) } }));
if (process.argv.includes('--write')) {
  const line = '\nconst NOCLOCK=[' + out.map(b => JSON.stringify({ t: b.t, s: b.s })).join(',\n') + '];\n';
  const s = fs.readFileSync(FILE, 'utf8');
  fs.writeFileSync(FILE, /\nconst NOCLOCK=\[[\s\S]*?\];\n/.test(s) ? s.replace(/\nconst NOCLOCK=\[[\s\S]*?\];\n/, () => line) : s.replace(/\nconst SKEINS=/, () => line + 'const SKEINS='));
}
