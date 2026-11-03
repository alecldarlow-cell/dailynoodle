'use strict';
/* Tally (engines/tally.js; Lab pages reports/*-logic-tally-NNNN.html, 3 Nov 2026): every page's board must pass the
   generator's gate (tools/tally.js: Latin solution, connected cages of 1–4 cells with the clue in the first cell,
   − and ÷ on two-cell cages only, at most one lone digit, exactly one solution, solved by the bounded human
   solver with no naked pair and so no guess), be distinct, and be exactly what tools/build-tally-batch.js makes
   from its serial's seed, so a regeneration can never quietly change a board players have times on. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const T = require(path.join(ROOT, 'tools/tally.js'));
const B = require(path.join(ROOT, 'tools/build-tally-batch.js'));

test('TALLY-01: every Tally page passes the gate, is in band, and matches its seed', () => {
  const list = B.existing();
  assert.ok(list.length >= 10, 'at least the ten Lab pages');
  assert.deepStrictEqual(B.check(), []);
  for (const e of list) {
    const p = B.readPage(e.file), g = T.grade(p);
    assert.strictEqual(p.n, 4, e.file);
    assert.ok(g && B.BAND(g) && B.shape(p), e.file + ' out of band: ' + JSON.stringify(g));
  }
});

test('TALLY-02: the gate refuses what a player would call unfair', () => {
  const p = B.boardFor(1, null);
  const clone = () => JSON.parse(JSON.stringify(p));
  let q = clone(); q.cages[0].t += 1;                       // a clue that doesn't match the solution
  assert.ok(T.check(q).some(e => /clue does not match/.test(e)));
  q = clone(); const big = q.cages.find(c => c.c.length >= 3); big.op = '-'; big.t = 1;   // − on three cells
  assert.ok(T.check(q).some(e => /- on a cage of/.test(e)));
  q = clone(); q.cages = [];                                 // row sums only: many solutions
  for (let r = 0; r < 4; r++) for (const c of [[0, 1], [2, 3]]) { const cells = c.map(x => r * 4 + x); q.cages.push({ c: cells, op: '+', t: cells.reduce((a, i) => a + +q.sol[i], 0) }); }
  assert.strictEqual(T.countSolutions(q, 2), 2);
  assert.ok(T.check(q).some(e => /more than one solution/.test(e)));
  assert.ok(B.boardFor(1, null).sol === p.sol, 'a serial always gives the same board');
});

test('TALLY-03: the pages are thin Lab puzzle pages on the engine', () => {
  for (const e of B.existing()) {
    const html = fs.readFileSync(path.join(ROOT, 'reports', e.file), 'utf8');
    const meta = n => (html.match(new RegExp('<meta name="' + n + '"\\s+content="([^"]*)"')) || [])[1];
    assert.strictEqual(meta('dn:kind'), 'puzzle', e.file);
    assert.strictEqual(meta('dn:badge'), 'In development', e.file);
    assert.strictEqual(meta('dn:topic'), 'Logic', e.file);
    assert.strictEqual(meta('dn:headline'), 'Tally ' + String(e.serial).padStart(4, '0'), e.file);
    assert.ok(/<script src="\.\.\/engines\/tally\.js"><\/script>/.test(html), e.file + ' loads the engine');
    for (const id of ['grid', 'keys', 'modal', 'statTime', 'statStreak', 'timer', 'pid', 'pband', 'streakn']) assert.ok(html.includes('id="' + id + '"'), e.file + ' #' + id);
  }
  const engine = fs.readFileSync(path.join(ROOT, 'engines/tally.js'), 'utf8');
  assert.ok(/digi-tally-v1/.test(engine) && /digi-tally-streak/.test(engine), 'save keys');
  assert.ok(/dn-core:start/.test(engine), 'dn-core bundled (tools/sync-core.js)');
});
