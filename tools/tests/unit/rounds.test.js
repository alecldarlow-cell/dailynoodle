'use strict';
// One unfinished round per puzzle (22 Nov 2026, Alec: the app's "Only one Tally can be
// part-played at a time" came up too often, and the website silently replaced the other
// round). Rounds live in `digi-<type>-v1.rounds` = {id: round}, each stamped `at`; the old
// `cur` slot still carries the latest round for older pages and app builds.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const C = require('../../../dn-core');

const ROOT = path.join(__dirname, '../../..');
const plain = x => JSON.parse(JSON.stringify(x));
const memory = () => { const data = new Map(); return { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)), data }; };

test('ROUNDS-01: GIVEN Tally 25 part-played WHEN Tally 29 is started THEN both rounds are kept and each reads back as its own', () => {
  const s = { v: 1, done: {} };
  C.keepRound(s, { id: 'T25', g: [1] }, 1000);
  C.keepRound(s, { id: 'T29', g: [2] }, 2000);
  assert.deepEqual(plain(C.roundFor(s, 'T25')), { id: 'T25', g: [1], at: 1000 });
  assert.deepEqual(plain(C.roundFor(s, 'T29')), { id: 'T29', g: [2], at: 2000 });
  assert.equal(s.cur.id, 'T29', 'cur carries the latest round for older pages');
});

test('ROUNDS-02: GIVEN a save from before rounds (only cur) WHEN read THEN cur resumes its own puzzle only', () => {
  const s = { v: 1, done: {}, cur: { id: 'T25', g: [1], at: 5 } };
  assert.equal(C.roundFor(s, 'T25').id, 'T25');
  assert.equal(C.roundFor(s, 'T29'), null);
  assert.equal(C.roundFor(null, 'T25'), null);
});

test('ROUNDS-03: GIVEN a finished puzzle WHEN its round is read or kept THEN nothing is offered and finished rounds are pruned', () => {
  const s = { v: 1, done: { T25: { s: 40 } }, rounds: { T25: { id: 'T25', at: 1 } }, cur: { id: 'T25', at: 1 } };
  assert.equal(C.roundFor(s, 'T25'), null);
  C.keepRound(s, { id: 'T29' }, 9);
  assert.deepEqual(Object.keys(s.rounds), ['T29']);
});

test('ROUNDS-04: GIVEN more than ten rounds WHEN another is kept THEN the newest ten stay, the one in play always', () => {
  const s = { v: 1, done: {} };
  for (let i = 1; i <= 12; i++) C.keepRound(s, { id: 'P' + i }, i * 10);
  assert.equal(Object.keys(s.rounds).length, 10);
  assert.ok(!s.rounds.P1 && !s.rounds.P2 && s.rounds.P12);
  C.keepRound(s, { id: 'OLD' }, 1);   // a clock set back: the round in play is still kept
  assert.ok(s.rounds.OLD);
});

test('ROUNDS-05: GIVEN a round WHEN dropped THEN only that puzzle goes, the key goes when empty, and cur is left to the engine', () => {
  const s = { v: 1, done: {} };
  C.keepRound(s, { id: 'A' }, 1); C.keepRound(s, { id: 'B' }, 2);
  C.dropRound(s, 'B');
  assert.deepEqual(Object.keys(s.rounds), ['A']);
  assert.equal(s.cur.id, 'B');
  C.dropRound(s, 'A');
  assert.equal('rounds' in s, false);
  assert.equal(C.dropRound(null, 'A'), null);
});

test('ROUNDS-06: GIVEN two tabs with different rounds WHEN saveProgress merges THEN both survive; the newer copy of a shared one wins; the active one is this tab\'s', () => {
  const stored = { v: 1, done: {}, rounds: { A: { id: 'A', n: 'old', at: 5 }, B: { id: 'B', n: 'there', at: 50 } } };
  const current = { v: 1, done: {}, rounds: { A: { id: 'A', n: 'here', at: 1 }, C: { id: 'C', at: 9 } } };
  const m = C.mergeProgress(current, stored, 'A');
  assert.deepEqual(Object.keys(m.rounds).sort(), ['A', 'B', 'C']);
  assert.equal(m.rounds.A.n, 'here', 'the round in play is this tab\'s');
  const m2 = C.mergeProgress(current, stored, 'Z');
  assert.equal(m2.rounds.A.n, 'old', 'otherwise the newer at wins');
});

test('ROUNDS-07: GIVEN a puzzle finished in one tab WHEN merged THEN its round is gone and an empty rounds key is removed', () => {
  const stored = { v: 1, done: {}, rounds: { A: { id: 'A', at: 5 } } };
  const current = { v: 1, done: { A: { s: 1 } } };
  const m = C.mergeProgress(current, stored, 'A');
  assert.equal('rounds' in m, false);
  const none = C.mergeProgress({ v: 1, done: {} }, { v: 1, done: {} }, 'A');
  assert.equal('rounds' in none, false, 'saves without rounds are unchanged');
});

test('ROUNDS-08: GIVEN saveProgress on real storage WHEN two tabs each keep a different puzzle THEN storage holds both', () => {
  const storage = memory();
  const a = { v: 1, done: {} }; C.keepRound(a, { id: 'A' }, 1); C.saveProgress('k', a, 'A', storage);
  const b = { v: 1, done: {} }; C.keepRound(b, { id: 'B' }, 2); C.saveProgress('k', b, 'B', storage);
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem('k')).rounds).sort(), ['A', 'B']);
});

// dn-track.js's import (the #dnmove= handoff and sign-in sync's merge), run in a VM as shipped.
const TRACK = fs.readFileSync(path.join(ROOT, 'dn-track.js'), 'utf8');
const start = TRACK.indexOf("(function () {\n  'use strict';\n  var TAG = '#dnmove=';");
const end = TRACK.indexOf('\n(function () {', start + 10);
function importer(here) {
  const data = new Map(Object.entries(here).map(([k, v]) => [k, JSON.stringify(v)]));
  const ctx = { localStorage: { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)) },
    location: { hash: '' }, history: {}, atob: s => Buffer.from(s, 'base64').toString('binary'), escape, decodeURIComponent };
  ctx.window = ctx;
  vm.runInNewContext(TRACK.slice(start, end), ctx);
  return { run: d => ctx.window.dnMove.importData(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, JSON.stringify(v)]))), get: k => JSON.parse(data.get(k)) };
}

test('ROUNDS-SYNC-01: GIVEN a round on each device WHEN imported THEN both are kept and the newer copy of a shared one wins', () => {
  const imp = importer({ 'digi-tally-v1': { v: 1, done: {}, rounds: { A: { id: 'A', n: 'here', at: 10 }, B: { id: 'B', at: 3 } } } });
  imp.run({ 'digi-tally-v1': { v: 1, done: {}, rounds: { A: { id: 'A', n: 'there', at: 20 }, C: { id: 'C', at: 4 } } } });
  const r = imp.get('digi-tally-v1').rounds;
  assert.deepEqual(Object.keys(r).sort(), ['A', 'B', 'C']);
  assert.equal(r.A.n, 'there');
});

test('ROUNDS-SYNC-02: GIVEN a puzzle finished on the other device WHEN imported THEN this device\'s round for it goes', () => {
  const imp = importer({ 'digi-tally-v1': { v: 1, done: {}, rounds: { A: { id: 'A', at: 10 }, B: { id: 'B', at: 3 } } } });
  imp.run({ 'digi-tally-v1': { v: 1, done: { A: { s: 50, d: '2026-11-22' } } } });
  const s = imp.get('digi-tally-v1');
  assert.deepEqual(Object.keys(s.rounds), ['B']);
  assert.ok(s.done.A);
});
