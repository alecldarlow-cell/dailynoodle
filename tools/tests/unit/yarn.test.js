'use strict';
/* Yarn (reports/2026-10-24-quiz-yarn.html), the game of the daily Tangle: its boards must never give a daily
   board or longest word away, and levels 1-360 are frozen (saves key on the level number). Since 1 Nov 2026 the
   rarer list is every real word (SCOWL 70) and the common list adds very common long words as stars for 361-720,
   so the lists are no longer a copy of the daily's: they must contain the daily's lists and stay blocklist-clean. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
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

const FROZEN_LEVELS = 'f5ff1f498377c468c6a91dea01cea1b8b87d7721ef561f69965cbdbaddc78063';    // levels 1-360 as shipped 24 Oct 2026
const FROZEN_COMMON = '5acab5b5d78707134f80d1c1d6110644f928e99a40a5500e776411ae42d2b0f5';    // their common words, so star scores 1-3 hold
const ROOT_TRIE = (ws) => { const root = {}; for (const w of ws) { let n = root; for (const ch of w) n = n[ch] || (n[ch] = {}); n.$ = w; } return root; };
const NB = [...Array(16)].map((_, i) => [...Array(16).keys()].filter(j => j !== i && Math.abs((i >> 2) - (j >> 2)) <= 1 && Math.abs((i & 3) - (j & 3)) <= 1));
const solveWith = root => T => { const out = new Set(); const go = (i, node, used) => { let n = node; for (const ch of T[i]) { n = n[ch]; if (!n) return; } if (n.$ && n.$.length >= 3) out.add(n.$); for (const j of NB[i]) if (!(used >> j & 1)) go(j, n, used | 1 << j); };
  for (let i = 0; i < 16; i++) go(i, root, 1 << i); return [...out]; };

test('YARN-DATA-01: the lists hold every daily word in the same list, plurals and common words, and nothing blocked', () => {
  const dm = new Set(), db = new Set(); daily.forEach(P => { P.main.forEach(w => dm.add(w)); P.bonus.forEach(w => db.add(w)); });
  for (const w of dm) if (!HOUSE.has(w)) assert.ok(MAINSET.has(w), 'daily main word missing from the common list: ' + w);
  for (const w of db) if (!HOUSE.has(w) && !MAINSET.has(w)) assert.ok(ALL.has(w), 'daily rarer word missing: ' + w);
  for (const w of MAIN) { assert.ok(!HOUSE.has(w), 'blocked ' + w); if (!dm.has(w)) assert.ok(w.length >= 7 && w.length <= 10, 'extra common words are long star words: ' + w); }
  for (const w of BONUS) { assert.ok(!HOUSE.has(w), 'blocked ' + w); assert.ok(!MAINSET.has(w), 'in both lists: ' + w); assert.ok(/^[a-z]{3,16}$/.test(w), 'shape ' + w); }
  for (const w of ['because', 'withdraws', 'butters', 'theories', 'knives', 'wolves', 'babies', 'churches']) assert.ok(ALL.has(w), 'real word rejected: ' + w);
  for (const w of ['balls', 'shag', 'willy', 'onanist', 'fucking', 'twats', 'dickhead', 'suicide']) assert.ok(!ALL.has(w), 'crude word accepted: ' + w);
  assert.ok(MAIN.length > 8000 && BONUS.length > 100000);
});

test('YARN-DATA-02: boards are valid and distinct, levels 1-360 are frozen, and none gives a daily board or longest word away', () => {
  const stars = new Set(daily.map(P => P.star)), boards = new Set(daily.map(P => d4(P.tiles.map(t => t.toLowerCase())))), seen = new Set(), used = new Set();
  assert.strictEqual(LEVELS.length, 720);
  assert.strictEqual(crypto.createHash('sha256').update(JSON.stringify(LEVELS.slice(0, 360))).digest('hex'), FROZEN_LEVELS, 'levels 1-360 changed');
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

test('YARN-DATA-03: each board\'s star is its unique longest common word; levels 1-360 keep their common words; 361-720 are rich', () => {
  const solveMain = solveWith(ROOT_TRIE(MAIN)), solveAll = solveWith(ROOT_TRIE([...ALL]));
  const old = [];
  for (const [i, L] of LEVELS.entries()) {
    const T = tiles(L.t), main = solveMain(T);
    assert.ok(main.every(w => traceable(T, w)), 'solver disagrees on level ' + (i + 1));
    assert.deepStrictEqual(main.filter(w => w !== L.s && w.length >= L.s.length), [], 'level ' + (i + 1) + ' has another common word as long as ' + L.s);
    assert.ok(main.length >= (i < 360 ? 44 : 52), 'too few common words on level ' + (i + 1));
    if (i < 360) old.push(main.slice().sort().join(','));
    else assert.deepStrictEqual(solveAll(T).filter(w => w.length > L.s.length), [], 'level ' + (i + 1) + ' has a rarer word longer than its star');
  }
  assert.strictEqual(crypto.createHash('sha256').update(old.join('|')).digest('hex'), FROZEN_COMMON, 'common words on levels 1-360 changed, which moves their star scores');
});
