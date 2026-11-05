'use strict';
/* Daily Tangle's rarer lists, in line with Yarn (Alec, 5 Nov 2026): from 8 Nov 2026 every reviewed extra word a board
   traces is accepted, unless it would tie or beat the star; the engine's own gate still passes. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { traceable, engineGate, extrasFor, EXTRA } = require('../../build-tangle-batch.js');
const REPORTS = path.resolve(__dirname, '../../../reports');
const pages = fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-word-tangle-\d{4}\.html$/.test(f) && f.slice(0, 10) >= '2026-11-08').map(f => {
  const s = fs.readFileSync(path.join(REPORTS, f), 'utf8');
  return { f, date: f.slice(0, 10), P: vm.runInNewContext('(' + s.match(/window\.DN_PUZZLE=(\{.*\});/)[1] + ')') };
});
test('TANGLE-WORDS-01: forthcoming boards hold every extra word they can, and still pass the engine gate', () => {
  const GATE = engineGate();
  assert.ok(pages.length > 600);
  for (const { f, date, P } of pages) {
    assert.strictEqual(extrasFor(P).join(), '', f + ' lacks words');
    assert.strictEqual(Array.from(GATE(P, date)).join(), '', f);
    assert.ok(P.bonus.every(w => traceable(P.tiles, w) && w.length < P.star.length), f);
  }
});
test('TANGLE-WORDS-02: the extra list keeps its hand review: real words in, abbreviations and crude words out', () => {
  for (const w of ['among', 'color', 'clays', 'dews', 'penne', 'dunno']) assert.ok(EXTRA.includes(w), w);
  for (const w of ['hoe', 'gun', 'kill', 'arsenic']) assert.ok(EXTRA.includes(w), w);   // Alec, 5 Nov 2026: no slurs, innocent meanings are fine
  for (const w of ['ert', 'csc', 'hhd', 'arsing', 'perv', 'bum', 'tart', 'slave', 'noose', 'nonce', 'goy', 'erection']) assert.ok(!EXTRA.includes(w), w);
});
