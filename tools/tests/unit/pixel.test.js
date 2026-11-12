'use strict';
/* Pixel (engines/pixel.js; Lab pages reports/*-logic-pixel-NNNN.html, built 12 Nov 2026, unmerged until Alec approves):
   every library picture and page passes tools/pixel.js's gate (clues match the picture, exactly one solution by a full
   solver, line logic alone finishes it, not exact-fit lines alone, at least 3 rounds, 25–70% filled, in the bot band),
   pictures are D4-distinct, no subject twice in 90 days, and each page is what its seed picks from the library. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const X = require(path.join(ROOT, 'tools/pixel.js'));
const B = require(path.join(ROOT, 'tools/build-pixel-batch.js'));

test('PIXEL-01: every Pixel page passes the gate, matches the library and its seed', () => {
  const list = B.existing();
  assert.ok(list.length >= 10, 'at least the ten Lab pages');
  assert.deepStrictEqual(B.check(), []);
  for (const e of list) assert.strictEqual(B.readPage(e.file).n, 8, e.file + ': the Lab pages are 8×8 (the bot report, 12 Nov 2026)');
});

test('PIXEL-02: the library: 15+ pictures at each size pass, every picture is D4-distinct and plainly named', () => {
  const all = B.graded(B.library());
  for (const n of [8, 10]) assert.ok(all.filter(x => x.pass && x.pic.size === n).length >= 15, n + '×' + n);
  for (const x of all) assert.deepStrictEqual(x.errs, [], x.pic.id);
});

test('PIXEL-03: line logic, the full solver and the gate agree on what a player would call unfair', () => {
  // the line solver: an 8 in 8 fills the line; "3 4" in 8 is an exact fit; "6" in 8 fixes the middle four
  assert.deepStrictEqual(X.lineSolve(new Array(8).fill(-1), [8]), new Array(8).fill(1));
  assert.deepStrictEqual(X.lineSolve(new Array(8).fill(-1), [3, 4]), [1, 1, 1, 0, 1, 1, 1, 1]);
  assert.deepStrictEqual(X.lineSolve(new Array(8).fill(-1), [6]), [-1, -1, 1, 1, 1, 1, -1, -1]);
  assert.strictEqual(X.lineSolve([1, 1, -1, -1, -1, -1, -1, -1], [1]), null, 'a contradiction');
  // two diagonal squares swap with the other diagonal: two solutions, and line logic is stuck
  const diag = { n: 8, sol: ('10000000' + '01000000' + '0'.repeat(48)) };
  Object.assign(diag, X.clues(diag.sol, 8));
  assert.strictEqual(X.countSolutions(8, diag.rows, diag.cols, 3), 2);
  assert.ok(X.check(diag).some(m => /solutions/.test(m)));
  // a solid block is finished by its exact-fit lines alone, and is too full
  const block = { n: 8, sol: '1'.repeat(64) }; Object.assign(block, X.clues(block.sol, 8));
  assert.ok(X.check(block).some(m => /exact-fit/.test(m)) && X.check(block).some(m => /fill/.test(m)));
  // clues that don't match the picture are refused before anything else
  const p = B.readPage(B.existing()[0].file), q = JSON.parse(JSON.stringify(p)); q.rows[0] = q.rows[0].concat([1]);
  assert.deepStrictEqual(X.check(q), ['the clues don’t match the picture']);
});

test('PIXEL-04: a picture turned or mirrored has the same fingerprint; seasons and the 90-day gap hold', () => {
  const p = B.readPage(B.existing()[1].file), n = p.n, rot = [];
  for (let i = 0; i < n * n; i++) { const r = Math.floor(i / n), c = i % n; rot[c * n + (n - 1 - r)] = p.sol[i]; }
  assert.strictEqual(X.fingerprint(rot.join(''), n), X.fingerprint(p.sol, n));
  assert.ok(B.inSeason('10-20..11-05', '2026-10-31') && !B.inSeason('10-20..11-05', '2026-11-06'));
  assert.ok(B.inSeason('12-01..02-28', '2027-01-15') && !B.inSeason('12-01..02-28', '2026-11-12'));
  const subj = B.existing().map(e => B.readPage(e.file).pic.replace(/-\d+$/, ''));
  assert.strictEqual(new Set(subj).size, subj.length, 'ten different pictures in ten days');
});

test('PIXEL-05: the pages are thin Lab puzzle pages on the engine, with the fixed thumb', () => {
  for (const e of B.existing()) {
    const html = fs.readFileSync(path.join(ROOT, 'reports', e.file), 'utf8');
    const meta = n => (html.match(new RegExp('<meta name="' + n + '"\\s+content="([^"]*)"')) || [])[1];
    assert.strictEqual(meta('dn:kind'), 'puzzle', e.file);
    assert.strictEqual(meta('dn:badge'), 'In development', e.file);
    assert.strictEqual(meta('dn:thumb'), 'assets/pixel-thumb.svg', e.file);
    assert.strictEqual(meta('dn:topic'), 'Logic', e.file);
    assert.strictEqual(meta('dn:headline'), 'Pixel ' + String(e.serial).padStart(4, '0'), e.file);
    assert.ok(/<script src="\.\.\/engines\/pixel\.js"><\/script>/.test(html), e.file + ' loads the engine');
    for (const id of ['grid', 'board', 'colClues', 'rowClues', 'fillMode', 'crossMode', 'undoBtn', 'checkBtn', 'linesDone', 'modal', 'statTime', 'statStreak', 'timer', 'pid', 'pband', 'streakn'])
      assert.ok(html.includes('id="' + id + '"'), e.file + ' #' + id);
  }
  const engine = fs.readFileSync(path.join(ROOT, 'engines/pixel.js'), 'utf8');
  assert.ok(/digi-pixel-v1/.test(engine) && /digi-pixel-streak/.test(engine), 'save keys');
  assert.ok(/dn-core:start/.test(engine), 'dn-core bundled (tools/sync-core.js)');
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/pixel-thumb.svg')));
  assert.deepStrictEqual(B.writeThrough(B.existing().slice(-1)[0].date), [], '--through never writes over an existing page');
});
