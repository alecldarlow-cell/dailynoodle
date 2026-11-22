#!/usr/bin/env node
'use strict';
/* tools/yarn-big-boards.js — boards for Yarn's Big Board mode (Alec, 17 Nov 2026): 5x5, two minutes, ten skeins of ten.
   25 tiles (q = Qu), at most one Qu and at most two of J/K/V/X/Z, a longest common word of 8+ letters that is the board's
   unique longest common word and that no rarer word beats, MIN-MAX common words, no longest word that is a daily Tangle's,
   a Yarn level's or a No clock board's. Seeded, so the same command gives the same boards.
   Usage: node tools/yarn-big-boards.js [count=100] [--probe] [--write]   (--write puts them in the page's BIG line) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { unpack } = require('./yarn-words.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports'), FILE = path.join(__dirname, 'data', 'yarn.html');   // tools/data/README.md
const html = fs.readFileSync(FILE, 'utf8');
const grab = name => vm.runInNewContext('(' + html.match(new RegExp('\\nconst ' + name + '=(\\[[\\s\\S]*?\\]);\\n'))[1] + ')');
const DICT = vm.runInNewContext('(' + html.match(/\nconst DICT=(\{.*?\});\n/)[1] + ')');
const LEVELS = grab('LEVELS'), NOCLOCK = grab('NOCLOCK');
const MAIN = unpack(DICT.M), ALL = MAIN.concat(unpack(DICT.B));
const COUNT = +(process.argv.slice(2).find(a => /^\d+$/.test(a)) || 100);
const N = 5, NN = N * N, MIN = 100, MAX = 150;

let seed = 0x9e3779b9 ^ 20261117;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rand() * a.length)];
const NB = [...Array(NN)].map((_, i) => [...Array(NN).keys()].filter(j => j !== i && Math.abs(Math.floor(i / N) - Math.floor(j / N)) <= 1 && Math.abs(i % N - j % N) <= 1));
const trie = ws => { const root = {}; for (const w of ws) { let n = root; for (const ch of w) n = n[ch] || (n[ch] = {}); n.$ = w; } return root; };
const TM = trie(MAIN), TA = trie(ALL);
const tilesOf = t => t.split('').map(c => c === 'q' ? 'qu' : c);
function solve(T, root) { const out = new Set(); const go = (i, node, used) => { let n = node; for (const ch of T[i]) { n = n[ch]; if (!n) return; } if (n.$ && n.$.length >= 3) out.add(n.$); for (const j of NB[i]) if (!(used >> j & 1)) go(j, n, used | 1 << j); }; for (let i = 0; i < NN; i++) go(i, root, 1 << i); return out; }

const daily = fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-word-tangle-\d{4}\.html$/.test(f)).map(f => {
  const s = fs.readFileSync(path.join(REPORTS, f), 'utf8'), m = s.match(/window\.DN_PUZZLE=(\{.*\});/) || s.match(/\nconst PUZZLE=(\{.*\});\n/);
  return vm.runInNewContext('(' + m[1] + ')'); });
const usedStars = new Set(daily.map(P => P.star).concat(LEVELS.map(L => L.s), NOCLOCK.map(L => L.s)));
// Big Boggle-style letter weights; q stands for the Qu tile
const W = { e: 19, t: 13, a: 12, r: 12, i: 11, n: 11, o: 11, s: 9, d: 6, c: 5, h: 5, l: 5, f: 4, m: 4, p: 4, u: 4, g: 3, y: 3, w: 2, b: 2, v: 2, k: 1, x: 1, j: 1, q: 1, z: 1 };
const BAG = Object.entries(W).flatMap(([c, n]) => Array(n).fill(c));
const ok = t => { const T = tilesOf(t); return T.filter(x => x === 'qu').length <= 1 && T.filter(x => /^[jkvxz]$/.test(x)).length <= 2; };
const NOSTAR = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'word-blocklist.json'), 'utf8')).nostar);
const STARS = MAIN.filter(w => w.length >= 8 && w.length <= 10 && !w.includes('q') && !usedStars.has(w) && !NOSTAR.has(w));

function lay(star) {
  for (let tries = 0; tries < 200; tries++) {
    const cells = Array(NN).fill(null), used = new Set(); let at = Math.floor(rand() * NN), okp = true;
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
  const AIM = MIN + 5 + rand() * (MAX - MIN - 10);   // each board its own richness, inside the band
  const cells = L.cells.map(c => c || pick(BAG));
  let t = cells.join(''), best = score(t, star);
  const free = [...Array(NN).keys()].filter(i => !L.fixed.has(i));
  const fit = s => s < 0 ? -1e9 : -Math.abs(s - AIM);
  for (let it = 0; it < 500 && Math.abs(best - AIM) > 4; it++) {
    const i = pick(free), c = cells[i]; cells[i] = pick(BAG);
    const t2 = cells.join(''), s2 = score(t2, star);
    if (fit(s2) >= fit(best)) { best = s2; t = t2; } else cells[i] = c;
  }
  return best >= MIN && best <= MAX ? { t, s: star, n: best } : null;
}

if (process.argv.includes('--probe')) {   // what plain random boards look like
  const ns = []; for (let k = 0; k < 40; k++) { const t = Array.from({ length: NN }, () => pick(BAG)).join(''); if (ok(t)) ns.push(solve(tilesOf(t), TM).size); }
  ns.sort((a, b) => a - b); console.log('random 5x5 common words', ns[0], ns[ns.length >> 1], ns.at(-1)); process.exit(0);
}
const out = [], seenStars = new Set(), seenBoards = new Set();
const pool = STARS.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
for (const star of pool) {
  if (out.length >= COUNT) break;
  if (seenStars.has(star)) continue;
  const b = board(star); if (!b || seenBoards.has(b.t)) continue;
  seenBoards.add(b.t); seenStars.add(star); out.push(b);
  if (out.length % 10 === 0) process.stderr.write(out.length + ' ');
}
process.stderr.write('\n');
const ns = out.map(b => b.n).sort((a, b) => a - b);
console.log(JSON.stringify({ boards: out.length, commonWords: { min: ns[0], median: ns[ns.length >> 1], max: ns.at(-1) } }));
if (process.argv.includes('--write')) {
  const line = '\nconst BIG=[' + out.map(b => JSON.stringify({ t: b.t, s: b.s })).join(',\n') + '];\n';
  const s = fs.readFileSync(FILE, 'utf8');
  fs.writeFileSync(FILE, /\nconst BIG=\[[\s\S]*?\];\n/.test(s) ? s.replace(/\nconst BIG=\[[\s\S]*?\];\n/, () => line) : s.replace(/\nconst SKEINS=/, () => line + 'const SKEINS='));
}
