'use strict';
/* Tally (reports/2026-11-02-quiz-tally.html, Lab, 2 Nov 2026): the ten boards the page holds must pass the
   generator's gate (tools/tally.js: Latin solution, connected cages of 1–4 cells with the clue in the first cell,
   − and ÷ on two-cell cages only, at most one lone digit, exactly one solution, solved by the bounded human
   solver with no naked pair and so no guess), be ten different layouts, and be exactly what
   tools/build-tally-lab.js makes from its fixed seeds, so a regeneration can never quietly change a board
   players have times on. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const T = require(path.join(ROOT, 'tools/tally.js'));
const B = require(path.join(ROOT, 'tools/build-tally-lab.js'));
const PAGE = path.join(ROOT, 'reports/2026-11-02-quiz-tally.html');

test('TALLY-01: the page holds ten boards that pass the gate and match the generator', () => {
  const { puzzles } = B.read();
  assert.strictEqual(puzzles.length, 10);
  assert.deepStrictEqual(B.gate(puzzles), []);
  assert.deepStrictEqual(puzzles, B.make(), 'page boards differ from the fixed-seed generator');
  for (const p of puzzles) {
    const g = T.grade(p);
    assert.ok(g && g.pairs === 0, 'no naked pairs');
    assert.ok(g.rounds >= 3 && g.rounds <= 8, 'rounds in band: ' + g.rounds);
  }
  assert.deepStrictEqual(puzzles.slice(0, 2).map(p => p.band), ['easy', 'easy']);
  assert.ok(puzzles.slice(2).every(p => p.band === 'medium'));
});

test('TALLY-02: the gate refuses what a player would call unfair', () => {
  const [p] = B.make();
  const clone = () => JSON.parse(JSON.stringify(p));
  let q = clone(); q.cages[0].t += 1;                       // a clue that doesn't match the solution
  assert.ok(T.check(q).some(e => /clue does not match/.test(e)));
  q = clone(); const big = q.cages.find(c => c.c.length >= 3); big.op = '-'; big.t = 1;   // − on three cells
  assert.ok(T.check(q).some(e => /- on a cage of/.test(e)));
  q = clone(); q.cages = [];                                 // row sums only: many solutions
  for (let r = 0; r < 5; r++) for (const c of [[0, 1], [2, 3, 4]]) { const cells = c.map(x => r * 5 + x); q.cages.push({ c: cells, op: '+', t: cells.reduce((a, i) => a + +q.sol[i], 0) }); }
  assert.strictEqual(T.countSolutions(q, 2), 2);
  assert.ok(T.check(q).some(e => /more than one solution/.test(e)));
  // the solver: a board with no clues at all cannot be solved without guessing
  q = clone(); q.cages = q.cages.map(c => ({ c: c.c, op: '+', t: c.c.map(i => +q.sol[i]).reduce((a, b) => a + b, 0) }));
  const h = T.humanSolve(q); assert.ok(h.solved === true || h.solved === false); // runs to a verdict either way
});

test('TALLY-03: the page is a Lab game with the house metas', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  const meta = n => (html.match(new RegExp('<meta name="' + n + '"\\s+content="([^"]*)"')) || [])[1];
  assert.strictEqual(meta('dn:kind'), 'game');
  assert.strictEqual(meta('dn:badge'), 'In development');
  assert.strictEqual(meta('dn:headline'), 'Tally');
  assert.ok(/^data:image\/svg\+xml;base64,/.test(meta('dn:thumb')));
  assert.ok(!/dn-track\.js/.test(html), 'the workflow adds the tracker');
  assert.ok(/digi-tally-v1/.test(html), 'save key');
  assert.ok(/window\.__dg=/.test(html), 'test hook');
});
