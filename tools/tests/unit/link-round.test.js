'use strict';
// Link's kept round (digi-link-v1.cur, AF-029, 29 Oct 2026) through the save
// move/sync import in dn-track.js: the newer round wins, done is untouched.
// Runs the shipped importData in a VM with a fake localStorage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '../../../dn-track.js'), 'utf8');
const start = SRC.indexOf("(function () {\n  'use strict';\n  var TAG = '#dnmove=';");
const end = SRC.indexOf('\n(function () {', start + 10);
const MOVE = SRC.slice(start, end);

function importer(here) {
  const data = new Map(Object.entries(here));
  const ctx = { localStorage: { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)) },
    location: { hash: '' }, history: {}, atob: s => Buffer.from(s, 'base64').toString('binary'), escape, decodeURIComponent };
  ctx.window = ctx;
  vm.runInNewContext(MOVE, ctx);
  return { run: d => ctx.window.dnMove.importData(d), get: k => JSON.parse(data.get(k)) };
}
const ID = 'DP·LINK·0071';
const round = (at, f) => ({ id: ID, f, m: 1, g: [[1, 1, 1, 1], [2, 2, 2, 3]], tr: [], l: [], s: 40, at });

test('LINK-ROUND-01: GIVEN two kept rounds WHEN saves are merged THEN the newer round wins and done is unchanged', () => {
  assert.ok(start > 0 && end > start, 'found the move/import block in dn-track.js');
  const done = { 'DP·LINK·0070': { o: 'win', t: '01:10', m: 0, r: [1, 2, 3, 4], g: [], d: '2026-10-17' } };
  let I = importer({ 'digi-link-v1': JSON.stringify({ v: 1, done, cur: round(1000, [1]) }) });
  I.run({ 'digi-link-v1': JSON.stringify({ v: 1, done: {}, cur: round(2000, [1, 2]) }) });
  assert.deepEqual(I.get('digi-link-v1').cur.f, [1, 2], 'the newer incoming round replaces the older one here');
  assert.deepEqual(I.get('digi-link-v1').done, done);

  I = importer({ 'digi-link-v1': JSON.stringify({ v: 1, done: {}, cur: round(3000, [3]) }) });
  I.run({ 'digi-link-v1': JSON.stringify({ v: 1, done, cur: round(2000, [1, 2]) }) });
  assert.deepEqual(I.get('digi-link-v1').cur.f, [3], 'an older incoming round never replaces a newer one');
  assert.deepEqual(I.get('digi-link-v1').done, done, 'finished results still union in');
});

test('LINK-ROUND-02: a round finished here (cur cleared) takes an incoming newer round only if it is newer; Borders rounds keep this browser\'s', () => {
  let I = importer({ 'digi-link-v1': JSON.stringify({ v: 1, done: {}, cur: null }) });
  I.run({ 'digi-link-v1': JSON.stringify({ v: 1, done: {}, cur: round(5000, [1]) }) });
  assert.deepEqual(I.get('digi-link-v1').cur.f, [1], 'a round from another device fills an empty slot');
  // no `at` stamp (Borders, Reckon): unchanged behaviour, this browser's round stays
  I = importer({ 'digi-borders-v1': JSON.stringify({ v: 1, done: {}, cur: { id: 'B', i: 3, ans: [] } }) });
  I.run({ 'digi-borders-v1': JSON.stringify({ v: 1, done: {}, cur: { id: 'B', i: 7, ans: [] } }) });
  assert.equal(I.get('digi-borders-v1').cur.i, 3);
});
