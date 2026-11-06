'use strict';
/* Tumbler (engines/tumbler.js; Lab pages reports/*-word-tumbler-NNNN.html, 6 Nov 2026): every page must pass
   tools/tumbler.js's gate (everyday secret with four different letters, 12–25 everyday words makeable, no offensive
   word makeable, the page's word list exactly what the wheels make, bots in band), never repeat a secret, and be
   exactly what its recorded seed makes. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const T = require(path.join(ROOT, 'tools/tumbler.js'));
const B = require(path.join(ROOT, 'tools/build-tumbler-batch.js'));

test('TUMBLER-01: every page passes the gate, no secret twice, each matches its seed', () => {
  assert.ok(B.existing().length >= 10, 'at least the ten Lab pages');
  assert.deepStrictEqual(B.check(), []);
});

test('TUMBLER-02: the clues follow Wordle rules, repeated letters included', () => {
  assert.strictEqual(T.feedback('dive', 'dive'), 'gggg');
  assert.strictEqual(T.feedback('vide', 'dive'), 'agag');
  assert.strictEqual(T.feedback('eels', 'else'), 'gaaa');
  assert.strictEqual(T.feedback('noon', 'moon'), 'xggg');
  assert.strictEqual(T.feedback('oooo', 'moon'), 'xggx');
});

test('TUMBLER-03: the gate refuses broken boards', () => {
  const p = B.readPage(B.existing()[0].file), clone = () => JSON.parse(JSON.stringify(p));
  let q = clone(); q.words = q.words.slice(1);                                     // a word list that isn't what the wheels make
  assert.ok(T.check(q).some(e => /word list/.test(e)));
  q = clone(); q.wheels[0] = q.wheels[0].replace(q.secret[0].toUpperCase(), 'Q') ;  // a wheel without the secret's letter
  assert.ok(T.check(q).length > 0);
  q = clone(); q.secret = 'xyzw';
  assert.ok(T.check(q).length > 0);
});

test('TUMBLER-04: the pages are thin Lab puzzle pages on the engine', () => {
  for (const e of B.existing()) {
    const html = fs.readFileSync(path.join(ROOT, 'reports', e.file), 'utf8');
    const meta = n => (html.match(new RegExp('<meta name="' + n + '"\\s+content="([^"]*)"')) || [])[1];
    assert.strictEqual(meta('dn:kind'), 'puzzle', e.file);
    assert.strictEqual(meta('dn:badge'), 'In development', e.file);
    assert.strictEqual(meta('dn:thumb'), 'assets/tumbler-thumb.svg', e.file);
    assert.strictEqual(meta('dn:topic'), 'Word', e.file);
    assert.strictEqual(meta('dn:headline'), 'Tumbler ' + String(e.serial).padStart(4, '0'), e.file);
    assert.ok(/<script src="\.\.\/engines\/tumbler\.js"><\/script>/.test(html), e.file + ' loads the engine');
    for (const id of ['board', 'submitBtn', 'tries', 'modal', 'statTime', 'statStreak', 'timer', 'pid', 'pband', 'streakn']) assert.ok(html.includes('id="' + id + '"'), e.file + ' #' + id);
  }
  const engine = fs.readFileSync(path.join(ROOT, 'engines/tumbler.js'), 'utf8');
  assert.ok(/digi-tumbler-v1/.test(engine) && /digi-tumbler-streak/.test(engine), 'save keys');
  assert.ok(/dn-core:start/.test(engine), 'dn-core bundled (tools/sync-core.js)');
  assert.deepStrictEqual(B.writeThrough(B.existing().slice(-1)[0].date), [], '--through never writes over an existing page');
});
