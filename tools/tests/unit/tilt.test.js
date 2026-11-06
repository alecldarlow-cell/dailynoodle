'use strict';
/* Tilt (engines/tilt.js; Lab pages reports/*-logic-tilt-NNNN.html, 6 Nov 2026): every page's maze must pass the
   generator's gate (tools/tilt.js: walls that agree, one gap in the rim, a floor under the ball, a shortest way out of
   12–14 turns of long slides, no near miss far from the exit, 50–100 reachable positions, random spinning far slower
   than the route, a three-ahead planner in range), be distinct under rotation and reflection, and be exactly what
   tools/build-tilt-batch.js makes from its serial's seed, so a regeneration can never quietly change a maze players
   have times on. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const T = require(path.join(ROOT, 'tools/tilt.js'));
const B = require(path.join(ROOT, 'tools/build-tilt-batch.js'));

test('TILT-01: every Tilt page passes the gate, is distinct and matches its seed', () => {
  const list = B.existing();
  assert.ok(list.length >= 10, 'at least the ten Lab pages');
  assert.deepStrictEqual(B.check(), []);
  for (const e of list) {
    const p = B.readPage(e.file), g = T.grade(p);
    assert.strictEqual(p.n, 10, e.file);
    assert.strictEqual(g.par, p.par, e.file + ' par');
    assert.deepStrictEqual(T.band(g, p), [], e.file);
  }
});

test('TILT-02: the gate refuses what a player would call broken or unfair', () => {
  const p = B.readPage(B.existing()[0].file), clone = () => JSON.parse(JSON.stringify(p));
  let q = clone(); q.walls[0][0] &= ~1;                                   // a hole in the rim
  assert.ok(T.structure(q).some(e => /gap in the outer wall/.test(e)));
  q = clone(); q.walls[q.exit[0]][q.exit[1]] |= T.DIRS[q.exit[2]][2];   // the exit walled up
  assert.ok(T.structure(q).some(e => /exit is walled/.test(e)));
  q = clone(); q.walls[2][3] ^= 2;                                        // two cells disagree about a wall
  assert.ok(T.structure(q).some(e => /disagree/.test(e)));
  q = clone(); q.par = p.par + 1;                                         // a par that isn't the shortest way out
  assert.ok(T.check(q).some(e => /par on the page/.test(e)));
  // a maze with no inner walls at all: the ball shoots straight out or is trivially near the exit
  q = clone(); for (let r = 0; r < q.n; r++) for (let c = 0; c < q.n; c++) { let w = 0; if (r === 0) w |= 1; if (r === q.n - 1) w |= 4; if (c === 0) w |= 8; if (c === q.n - 1) w |= 2; q.walls[r][c] = w; }
  q.walls[q.exit[0]][q.exit[1]] &= ~T.DIRS[q.exit[2]][2]; q.walls[q.start[0]][q.start[1]] |= 4; q.walls[q.start[0] + 1][q.start[1]] |= 1;
  assert.ok(T.check(q).length > 0, 'an open box is not a puzzle');
});

test('TILT-03: a maze turned or mirrored has the same fingerprint, and the bots grade a page the same every time', () => {
  const p = B.readPage(B.existing()[1].file), n = p.n;
  const turned = { n, walls: [], start: [p.start[1], n - 1 - p.start[0]], exit: [p.exit[1], n - 1 - p.exit[0], (p.exit[2] + 1) % 4] };
  for (let r = 0; r < n; r++) turned.walls.push(new Array(n).fill(0));
  const rot = [2, 4, 8, 1];   // N→E, E→S, S→W, W→N under a quarter turn clockwise
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { let w = 0; for (let b = 0; b < 4; b++) if (p.walls[r][c] & (1 << b)) w |= rot[b]; turned.walls[c][n - 1 - r] = w; }
  assert.strictEqual(T.fingerprint(turned), T.fingerprint(p));
  assert.deepStrictEqual(T.grade(p), T.grade(p));
  assert.strictEqual(T.solve(turned.walls, n, turned.start, turned.exit) && true, true);
});

test('TILT-04: the pages are thin Lab puzzle pages on the engine', () => {
  for (const e of B.existing()) {
    const html = fs.readFileSync(path.join(ROOT, 'reports', e.file), 'utf8');
    const meta = n => (html.match(new RegExp('<meta name="' + n + '"\\s+content="([^"]*)"')) || [])[1];
    assert.strictEqual(meta('dn:kind'), 'puzzle', e.file);
    assert.strictEqual(meta('dn:badge'), 'In development', e.file);
    assert.strictEqual(meta('dn:thumb'), 'assets/tilt-thumb.svg', e.file);
    assert.strictEqual(meta('dn:topic'), 'Logic', e.file);
    assert.strictEqual(meta('dn:headline'), 'Tilt ' + String(e.serial).padStart(4, '0'), e.file);
    assert.ok(/<script src="\.\.\/engines\/tilt\.js"><\/script>/.test(html), e.file + ' loads the engine');
    for (const id of ['board', 'maze', 'leftBtn', 'rightBtn', 'undoBtn', 'turns', 'modal', 'statTime', 'statStreak', 'timer', 'pid', 'pband', 'streakn']) assert.ok(html.includes('id="' + id + '"'), e.file + ' #' + id);
  }
  const engine = fs.readFileSync(path.join(ROOT, 'engines/tilt.js'), 'utf8');
  assert.ok(/digi-tilt-v1/.test(engine) && /digi-tilt-streak/.test(engine), 'save keys');
  assert.ok(/dn-core:start/.test(engine), 'dn-core bundled (tools/sync-core.js)');
  assert.deepStrictEqual(B.writeThrough(B.existing().slice(-1)[0].date), [], '--through never writes over an existing page');
});
