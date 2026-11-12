'use strict';
/* Reach (engines/reach.js; Lab pages reports/*-logic-reach-NNNN.html, Lab build 12 Nov 2026): every page's board must pass
   the generator's gate (tools/reach.js: six tiles drawn as the numbers round draws them, a target of 101–999 that isn't a
   tile or a tile × 10/100, an exact answer in 3–5 operations, 20–300 routes, a near miss, a stored way that is legal and
   shortest, and the human-proxy bot's predicted median inside the band), repeat no earlier board, and be exactly what
   tools/build-reach-batch.js makes from its serial's seed, so a regeneration can never quietly change a board players
   have times on. */
const test = require('node:test'), assert = require('node:assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const R = require(path.join(ROOT, 'tools/reach.js'));
const B = require(path.join(ROOT, 'tools/build-reach-batch.js'));

test('REACH-01: every Reach page passes the gate, is distinct and matches its seed', () => {
  const list = B.existing();
  assert.ok(list.length >= 10, 'at least the ten Lab pages');
  assert.deepStrictEqual(B.check(), []);
  for (const e of list) {
    const p = B.readPage(e.file), g = R.grade(p);
    assert.strictEqual(p.type, 'reach', e.file);
    assert.strictEqual(g.minOps, p.way.length, e.file + ' way is shortest');
    assert.deepStrictEqual(R.band(g), [], e.file);
  }
});

test('REACH-02: the rule is whole positive numbers only, and the refusals say why', () => {
  assert.strictEqual(R.apply(75, '*', 4), 300);
  assert.strictEqual(R.apply(300, '+', 25), 325);
  assert.strictEqual(R.apply(6, '-', 6), null);
  assert.strictEqual(R.apply(3, '-', 7), null);
  assert.strictEqual(R.apply(7, '/', 2), null);
  assert.strictEqual(R.apply(100, '/', 4), 25);
  assert.match(R.refusal(6, '-', 6), /zero/);
  assert.match(R.refusal(3, '-', 7), /below zero/);
  assert.match(R.refusal(7, '/', 2), /whole number/);
});

test('REACH-03: the exhaustive solver finds the fewest operations and counts routes', () => {
  assert.strictEqual(R.shortest([100, 4, 2, 1, 6, 6], 400).minOps, 1);          // 100 × 4
  assert.strictEqual(R.shortest([100, 4, 2, 1, 6, 6], 401).minOps, 2);          // 100 × 4 + 1
  const a = R.analyse([100, 4, 2, 1, 6, 6], 195);
  assert.strictEqual(a.minOps, 3);
  assert.ok(a.routes > 0 && a.nearMiss > 0);
  assert.strictEqual(R.analyse([1, 1, 1, 1, 1, 1], 999).minOps, null);          // nothing reaches it
  // + and × are counted once whichever way round: {2,3} makes 5 once and 6 once
  assert.strictEqual(R.analyse([2, 3, 50, 75, 100, 25], 5).routes >= 1, true);
});

test('REACH-04: the gate refuses what a player would call broken or unfair', () => {
  const p = B.readPage(B.existing()[0].file), clone = () => JSON.parse(JSON.stringify(p));
  let q = clone(); q.target = q.tiles[0] * 10; assert.ok(R.structure(q).some(e => /tile × 10/.test(e)));
  q = clone(); q.tiles = [100, 100, 1, 2, 3, 4]; assert.ok(R.structure(q).some(e => /distinct/.test(e)));
  q = clone(); q.tiles = [100, 7, 7, 7, 2, 3]; assert.ok(R.structure(q).some(e => /more than two 7s/.test(e)));
  q = clone(); q.way = q.way.slice(0, -1); assert.ok(R.wayErrors(q).length > 0);
  q = clone(); q.way[0] = [q.way[0][0], q.way[0][1], q.way[0][2], q.way[0][3] + 1]; assert.ok(R.wayErrors(q).length > 0);
  q = clone(); q.target = 100 * 4 + 1; q.tiles = [100, 4, 1, 2, 3, 5];               // two operations: too easy
  assert.ok(R.band(R.grade(q)).some(e => /too easy/.test(e)));
  // the bot is seeded by the board, so a page grades the same every time
  assert.deepStrictEqual(R.botGrade(p.tiles, p.target), R.botGrade(p.tiles, p.target));
});
