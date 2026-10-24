'use strict';
/* Yarn (reports/2026-10-24-quiz-yarn.html), the game of the daily Tangle: its embedded word list and
   boards must stay true to the daily's lists, and must never give a daily board or longest word away. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../../..'), REPORTS = path.join(ROOT, 'reports');
const html = fs.readFileSync(path.join(REPORTS, '2026-10-24-quiz-yarn.html'), 'utf8');
const DICT = vm.runInNewContext('(' + html.match(/\nconst DICT=(\{.*?\});\n/)[1] + ')');
const LEVELS = vm.runInNewContext('(' + html.match(/\nconst LEVELS=(\[[\s\S]*?\]);\n/)[1] + ')');
const unpack = s => { const r = []; let prev = ''; const re = /(\d)([a-z]*)/g; let m; while ((m = re.exec(s))) { const w = prev.slice(0, +m[1]) + m[2]; r.push(w); prev = w; } return r; };
const MAIN = unpack(DICT.M), BONUS = unpack(DICT.B), MAINSET = new Set(MAIN), ALL = new Set(MAIN.concat(BONUS));
const daily = fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-word-tangle-\d{4}\.html$/.test(f)).map(f => {
  const s = fs.readFileSync(path.join(REPORTS, f), 'utf8'), m = s.match(/window\.DN_PUZZLE=(\{.*\});/) || s.match(/\nconst PUZZLE=(\{.*\});\n/);
  return vm.runInNewContext('(' + m[1] + ')');
});
const HOUSE = new Set(fs.readFileSync(path.join(ROOT, 'tools/build-tangle-batch.js'), 'utf8').match(/const HOUSE = (\[[\s\S]*?\]);/)[1].replace(/\/\/.*$/gm, '').match(/"[a-z]+"/g).map(s => s.slice(1, -1)));
const tiles = t => t.split('').map(c => c === 'q' ? 'qu' : c);
function traceable(T, w) {
  const used = new Array(16).fill(false), adj = (a, b) => a !== b && Math.abs((a >> 2) - (b >> 2)) <= 1 && Math.abs((a & 3) - (b & 3)) <= 1;
  const at = (i, pos) => { const s = T[i]; if (w.substr(pos, s.length) !== s) return false; const np = pos + s.length; if (np === w.length) return true;
    used[i] = true; for (let k = 0; k < 16; k++) if (!used[k] && adj(i, k) && at(k, np)) { used[i] = false; return true; } used[i] = false; return false; };
  for (let i = 0; i < 16; i++) if (at(i, 0)) return true; return false;
}
function d4(t) {
  const g = [0, 1, 2, 3].map(r => t.slice(r * 4, r * 4 + 4)), rot = m => m[0].map((_, c) => m.map(r => r[c]).reverse()), mir = m => m.map(r => r.slice().reverse());
  let best = null, m = g; for (let k = 0; k < 4; k++) { for (const c of [m, mir(m)]) { const s = c.map(r => r.join(',')).join('|'); if (best === null || s < best) best = s; } m = rot(m); } return best;
}

test('YARN-DATA-01: every word comes from the daily Tangle lists, in the same list, and none is blocked', () => {
  const dm = new Set(), db = new Set(); daily.forEach(P => { P.main.forEach(w => dm.add(w)); P.bonus.forEach(w => db.add(w)); });
  for (const w of MAIN) { assert.ok(dm.has(w), 'main word not in any daily main list: ' + w); assert.ok(!HOUSE.has(w), 'blocked ' + w); }
  for (const w of BONUS) { assert.ok(db.has(w), 'rarer word not in any daily rarer list: ' + w); assert.ok(!HOUSE.has(w), 'blocked ' + w); }
  assert.ok(MAIN.length > 4000 && BONUS.length > 10000);
});

test('YARN-DATA-02: boards are valid, distinct and give no daily board or longest word away', () => {
  const stars = new Set(daily.map(P => P.star)), boards = new Set(daily.map(P => d4(P.tiles.map(t => t.toLowerCase())))), seen = new Set(), used = new Set();
  assert.strictEqual(LEVELS.length, 360);
  for (const [i, L] of LEVELS.entries()) {
    const n = i + 1, T = tiles(L.t);
    assert.ok(/^[a-z]{16}$/.test(L.t), 'tiles ' + n);
    assert.ok(T.filter(t => t === 'qu').length <= 1 && T.filter(t => /^[jxz]$/.test(t)).length <= 1, 'rare letters ' + n);
    assert.ok(MAINSET.has(L.s) && L.s.length >= 7, 'longest word ' + n);
    assert.ok(!stars.has(L.s), `level ${n} longest word ${L.s} is a daily Tangle's`);
    assert.ok(!used.has(L.s), 'longest word repeats ' + L.s); used.add(L.s);
    const k = d4(T); assert.ok(!boards.has(k), 'level ' + n + ' is a daily board'); assert.ok(!seen.has(k), 'board repeats ' + n); seen.add(k);
    assert.ok(traceable(T, L.s), 'longest word not traceable ' + n);
  }
});

test('YARN-DATA-03: on every board the longest word is the unique longest, with 44+ common words', () => {
  const root = {}; for (const w of ALL) { let n = root; for (const ch of w) n = n[ch] || (n[ch] = {}); n.$ = w; }
  const NB = [...Array(16)].map((_, i) => [...Array(16).keys()].filter(j => j !== i && Math.abs((i >> 2) - (j >> 2)) <= 1 && Math.abs((i & 3) - (j & 3)) <= 1));
  const solve = T => { const out = new Set(); const go = (i, node, used) => { let n = node; for (const ch of T[i]) { n = n[ch]; if (!n) return; } if (n.$ && n.$.length >= 3) out.add(n.$); for (const j of NB[i]) if (!(used >> j & 1)) go(j, n, used | 1 << j); };
    for (let i = 0; i < 16; i++) go(i, root, 1 << i); return [...out]; };
  for (const [i, L] of LEVELS.entries()) {
    const words = solve(tiles(L.t));
    // the solver and the per-word tracer must agree on this board
    assert.ok(words.every(w => traceable(tiles(L.t), w)), 'solver disagrees on level ' + (i + 1));
    assert.deepStrictEqual(words.filter(w => w !== L.s && w.length >= L.s.length), [], 'level ' + (i + 1) + ' has another word as long as ' + L.s);
    assert.ok(words.filter(w => MAINSET.has(w)).length >= 44, 'too few common words on level ' + (i + 1));
  }
});
