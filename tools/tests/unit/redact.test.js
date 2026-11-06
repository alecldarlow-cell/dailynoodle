'use strict';
/* Redact (engines/redact.js; Lab pages reports/*-word-redact-NNNN.html, 6 Nov 2026): every page's board must pass
   tools/redact.js's gate (crossword norms, everyday answers, no offensive word showing, no trap where a decoy turns an
   answer into a longer word, exactly one black set against the widest word list, solved by line logic and the count,
   effort in band), share no long answer with another page, and be exactly what its recorded seed makes. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const R = require(path.join(ROOT, 'tools/redact.js'));
const B = require(path.join(ROOT, 'tools/build-redact-batch.js'));

test('REDACT-01: every Redact page passes the gate, is distinct and matches its seed', () => {
  const list = B.existing();
  assert.ok(list.length >= 10, 'at least the ten Lab pages');
  assert.deepStrictEqual(B.check(), []);
  for (const e of list) assert.strictEqual(B.readPage(e.file).n, 6, e.file);
});

test('REDACT-02: the gate refuses what a player would call broken or unfair', () => {
  const p = B.readPage(B.existing()[0].file), clone = () => JSON.parse(JSON.stringify(p));
  let q = clone(); q.black = q.black.slice(1);                                   // one black square missing: a run that is not a word
  assert.ok(R.check(q).length > 0);
  q = clone(); const L = q.letters.split(''); const w = q.black.find(i => !q.black.includes(i + 1) && (i + 1) % q.n);
  L[w + 1] = L[w + 1] === 'Q' ? 'X' : 'Q'; q.letters = L.join('');               // an answer's letter changed: not a word
  assert.ok(R.check(q).length > 0);
  // a trap: SNAP with a decoy S after it reads SNAPS, a real word the player is told is wrong
  assert.strictEqual(R.trap('xsnaps' + 'x'.repeat(30), new Set([0, 5]), 6), 'snaps');
  assert.strictEqual(R.trap('xsnapq' + 'x'.repeat(30), new Set([0, 5]), 6), null);
});

test('REDACT-03: a board turned or mirrored has the same fingerprint', () => {
  const p = B.readPage(B.existing()[1].file), n = p.n, rot = i => { const r = Math.floor(i / n), c = i % n; return c * n + (n - 1 - r); };
  const letters = new Array(n * n); for (let i = 0; i < n * n; i++) letters[rot(i)] = p.letters[i];
  assert.strictEqual(R.fingerprint({ n, letters: letters.join(''), black: p.black.map(rot) }), R.fingerprint(p));
});

test('REDACT-04: the pages are thin Lab puzzle pages on the engine', () => {
  for (const e of B.existing()) {
    const html = fs.readFileSync(path.join(ROOT, 'reports', e.file), 'utf8');
    const meta = n => (html.match(new RegExp('<meta name="' + n + '"\\s+content="([^"]*)"')) || [])[1];
    assert.strictEqual(meta('dn:kind'), 'puzzle', e.file);
    assert.strictEqual(meta('dn:badge'), 'In development', e.file);
    assert.strictEqual(meta('dn:thumb'), 'assets/redact-thumb.svg', e.file);
    assert.strictEqual(meta('dn:topic'), 'Word', e.file);
    assert.strictEqual(meta('dn:headline'), 'Redact ' + String(e.serial).padStart(4, '0'), e.file);
    assert.ok(/<script src="\.\.\/engines\/redact\.js"><\/script>/.test(html), e.file + ' loads the engine');
    for (const id of ['grid', 'count', 'undoBtn', 'clearBtn', 'modal', 'statTime', 'statStreak', 'timer', 'pid', 'pband', 'streakn']) assert.ok(html.includes('id="' + id + '"'), e.file + ' #' + id);
  }
  const engine = fs.readFileSync(path.join(ROOT, 'engines/redact.js'), 'utf8');
  assert.ok(/digi-redact-v1/.test(engine) && /digi-redact-streak/.test(engine), 'save keys');
  assert.ok(/dn-core:start/.test(engine), 'dn-core bundled (tools/sync-core.js)');
  assert.deepStrictEqual(B.writeThrough(B.existing().slice(-1)[0].date), [], '--through never writes over an existing page');
});
