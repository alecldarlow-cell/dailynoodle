'use strict';
// A Tangle day finished on one device must not come back as "Resume" from the account
// (30 Oct 2026, app code review): the shipped dn-track.js import and dn-sync.js push rule,
// each run in a VM. A day saved mid-round (state 'playing') reaches the account when the page
// or app syncs; once finished, 'done' must replace it on both sides.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const ROOT = path.join(__dirname, '../../..');
const TRACK = fs.readFileSync(path.join(ROOT, 'dn-track.js'), 'utf8');
const start = TRACK.indexOf("(function () {\n  'use strict';\n  var TAG = '#dnmove=';");
const end = TRACK.indexOf('\n(function () {', start + 10);
const MOVE = TRACK.slice(start, end);

function importer(here) {
  const data = new Map(Object.entries(here));
  const ctx = { localStorage: { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)) },
    location: { hash: '' }, history: {}, atob: s => Buffer.from(s, 'base64').toString('binary'), escape, decodeURIComponent };
  ctx.window = ctx;
  vm.runInNewContext(MOVE, ctx);
  return { run: d => ctx.window.dnMove.importData(d), get: k => JSON.parse(data.get(k)) };
}

// forAccount and the helpers it uses, lifted from dn-sync.js as shipped.
const SYNC = fs.readFileSync(path.join(ROOT, 'dn-sync.js'), 'utf8');
function lift(name) {
  const i = SYNC.indexOf(`function ${name}(`);
  assert.ok(i > 0, `dn-sync.js has ${name}`);
  let depth = 0, j = SYNC.indexOf('{', i);
  for (; j < SYNC.length; j++) { if (SYNC[j] === '{') depth++; else if (SYNC[j] === '}' && --depth === 0) break; }
  return SYNC.slice(i, j + 1);
}
const forAccount = vm.runInNewContext(
  `var UNION = { done: 1, days: 1, found: 1 };\n${lift('isObj')}\n${lift('finished')}\n${lift('forAccount')}\nforAccount`);

const ID = 'DP·TANGLE·0042';
const playing = { state: 'playing', found: ['ant'], left: 52, score: 1 };
const finished = { state: 'done', found: ['ant', 'tan'], left: 0, score: 2 };
const result = { o: 'played', s: 2, w: 2, st: false, d: '2026-10-30' };

test('TANGLE-SYNC-01: GIVEN the account holds a day still in play WHEN this browser, which finished it, syncs THEN the account gets the finished day', () => {
  const mine = { v: 1, done: { [ID]: result }, days: { [ID]: finished } };
  const theirs = { v: 1, done: {}, days: { [ID]: playing } };
  const out = forAccount(mine, theirs);
  assert.deepEqual(JSON.parse(JSON.stringify(out.days[ID])), finished);
  assert.deepEqual(JSON.parse(JSON.stringify(out.done[ID])), result);
});

test('TANGLE-SYNC-02: GIVEN both finished the same day WHEN syncing THEN the account keeps its own first result (unchanged rule)', () => {
  const other = { state: 'done', found: ['ant'], left: 0, score: 1 };
  const out = forAccount({ v: 1, days: { [ID]: finished } }, { v: 1, days: { [ID]: other } });
  assert.deepEqual(JSON.parse(JSON.stringify(out.days[ID])), other);
  // A day still in play here never replaces the account's copy.
  const out2 = forAccount({ v: 1, days: { [ID]: playing } }, { v: 1, days: { [ID]: { ...playing, left: 10 } } });
  assert.equal(out2.days[ID].left, 10);
});

test('TANGLE-SYNC-03: GIVEN a day in play here WHEN a finished copy is imported THEN the finished day wins; a day in play never replaces a finished one', () => {
  let I = importer({ 'digi-tangle-v1': JSON.stringify({ v: 1, done: {}, days: { [ID]: playing } }) });
  I.run({ 'digi-tangle-v1': JSON.stringify({ v: 1, done: { [ID]: result }, days: { [ID]: finished } }) });
  assert.deepEqual(I.get('digi-tangle-v1').days[ID], finished);
  assert.deepEqual(I.get('digi-tangle-v1').done[ID], result);

  I = importer({ 'digi-tangle-v1': JSON.stringify({ v: 1, done: { [ID]: result }, days: { [ID]: finished } }) });
  I.run({ 'digi-tangle-v1': JSON.stringify({ v: 1, done: {}, days: { [ID]: playing } }) });
  assert.deepEqual(I.get('digi-tangle-v1').days[ID], finished);
});
