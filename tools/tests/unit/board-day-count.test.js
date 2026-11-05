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
