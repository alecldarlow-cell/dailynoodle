'use strict';
// BOARD-COUNT: All puzzles counts 8 a day before Tally joined the leagues on 5 Nov 2026, 9 from then on.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../../../board.html'), 'utf8');

test('BOARD-COUNT: the day and week totals follow the 5 Nov change', () => {
  // GIVEN the page's own two functions
  const start = html.indexOf('function dayCount'), end = html.indexOf('function renderOverall');
  const c = { S: {} }; vm.createContext(c); vm.runInContext(html.slice(start, end), c);
  // WHEN each day is asked THEN the count changes on 5 Nov
  assert.equal(c.dayCount('2026-11-04'), 8);
  assert.equal(c.dayCount('2026-11-05'), 9);
  // AND launch week adds 8+8+8+9 by Thursday and 60 by Sunday; a full later week is 63
  c.S.date = '2026-11-05'; assert.equal(c.weekDays({ week_from: '2026-11-02' }), 33);
  c.S.date = '2026-11-08'; assert.equal(c.weekDays({ week_from: '2026-11-02' }), 60);
  c.S.date = '2026-11-15'; assert.equal(c.weekDays({ week_from: '2026-11-09' }), 63);
});

test('BOARD-CROWN: the line that explains the crown shows only when a league has a champion', () => {
  // GIVEN the page's two functions
  const start = html.indexOf('function crowned'), end = html.indexOf('function nick(');
  const c = { R0: () => ({ crown: ['Ann'] }) }; vm.createContext(c); vm.runInContext(html.slice(start, end), c);
  // WHEN a league has a champion THEN the line shows; with none, or no records yet, it doesn't
  assert.match(c.crownNote(), /👑 Last week’s champion/);
  c.R0 = () => ({ crown: [] }); assert.equal(c.crownNote(), '');
  c.R0 = () => null; assert.equal(c.crownNote(), '');
});

test('BOARD-RECAP: the Monday card shows on Mondays, until closed, with the top three', () => {
  // GIVEN the page's recap functions
  const start = html.indexOf('function recapDue'), end = html.indexOf('function fillRecap');
  const store = {};
  const c = { MEDAL: { 1: '🥇', 2: '🥈', 3: '🥉' }, pts: n => n + ' pts', localStorage: { getItem: k => store[k] ?? null } };
  vm.createContext(c); vm.runInContext(html.slice(start, end), c);
  // WHEN it's a Monday THEN it's due, and not once closed, nor on a Tuesday
  assert.equal(c.recapDue('ABC', '2026-11-09'), true);
  store['noodle-board-recap-ABC'] = '2026-11-09'; assert.equal(c.recapDue('ABC', '2026-11-09'), false);
  assert.equal(c.recapDue('ABC', '2026-11-10'), false);
  // AND the share lines hold the top three, then how many more
  const week = [1, 2, 3, 4].map(r => ({ rank: r, nick: 'P' + r, points: 10 - r }));
  assert.deepEqual([...c.recapLines('Family', '2 Nov – 8 Nov', week)],
    ['🏆 Family · 2 Nov – 8 Nov', '🥇 P1 9 pts', '🥈 P2 8 pts', '🥉 P3 7 pts', '+1 more']);
});

test('BOARD-BATCH: a long history goes in batches the server accepts', () => {
  // GIVEN dn-board.js's batching
  const src = fs.readFileSync(path.join(__dirname, '../../../dn-board.js'), 'utf8');
  const start = src.indexOf('var BACKFILL_BATCH'), end = src.indexOf('function backfillDue');
  const c = {}; vm.createContext(c); vm.runInContext(src.slice(start, end), c);
  const rows = Array.from({ length: 2500 }, (_, i) => i);
  // WHEN 2,500 rows go THEN no call is over the limit and none is lost, the visitor code with the first
  const calls = c.backfillCalls({ rows, aids: ['a'] });
  assert.deepEqual([...calls].map(x => x.rows.length), [1000, 1000, 500]);
  assert.equal(calls[0].aid, 'a'); assert.equal(calls[1].aid, null);
  // AND a short history is still one call
  assert.equal(c.backfillCalls({ rows: [1], aids: [] }).length, 1);
});
