'use strict';
/* Personal stats (dn-stats.js, 6 Nov 2026): worked out from the players' own saves, read-only.
   Every type's record shape, old saves missing newer fields, empty and broken saves, small
   numbers, on-the-day vs archive, runs across London midnight and the clock change, the year card. */
const test = require('node:test'), assert = require('node:assert');
const path = require('path');
const S = require(path.join(__dirname, '../../../dn-stats.js'));

function store(map) {
  const m = {};
  for (const k of Object.keys(map)) m[k] = typeof map[k] === 'string' ? map[k] : JSON.stringify(map[k]);
  const writes = [];
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => writes.push([k, v]), writes };
}
const doc = done => ({ v: 1, done });

test('STATS-01: GIVEN no saves WHEN summarised THEN everything is zero and nothing is written', () => {
  const st = store({});
  const s = S.summary(S.read(st), { today: '2026-11-06' });
  assert.deepStrictEqual(s.overall, { finished: 0, days: 0, run: 0, longest: 0, favourite: null });
  for (const t of S.TYPES) assert.strictEqual(s.types[t].n, 0);
  assert.strictEqual(st.writes.length, 0);
  assert.strictEqual(S.yearCard(S.read(st), { today: '2026-12-05' }), null);
});

test('STATS-02: GIVEN broken or odd documents WHEN read THEN they are skipped, not thrown', () => {
  const st = store({ 'digi-mini-v1': '{not json', 'digi-doku-v1': '[1,2]', 'digi-path-v1': { v: 1, done: 'x' },
    'digi-link-v1': doc({ 'DP·LINK·0001': null, 'DP·LINK·0002': 7 }), 'digi-sweep-v1': doc({ a: { o: 'win', s: -4, d: 'bad' } }) });
  const s = S.summary(S.read(st), { today: '2026-11-06' });
  assert.strictEqual(s.overall.finished, 1);           // the sweep row; its time and date are refused
  assert.strictEqual(s.types.sweep.best, null);
  assert.strictEqual(s.overall.days, 0);
});

test('STATS-03: GIVEN every type\'s record shape WHEN read THEN each gives its own figures', () => {
  const d = '2026-11-01';
  const docs = {
    'digi-mini-v1': doc({ m: { s: 62, d } }),
    'digi-doku-v1': doc({ k: { s: 194, d } }),
    'digi-sweep-v1': doc({ s1: { o: 'win', s: 80, b: 9, d }, s2: { o: 'loss', s: 20, d }, s3: { o: 'gave', s: 5, d } }),
    'digi-path-v1': doc({ p: { t: '02:05', d } }),
    'digi-link-v1': doc({ l1: { o: 'win', t: '01:30', m: 1, r: [], g: [], d }, l2: { o: 'loss', t: '03:00', m: 4, r: [], g: [], d } }),
    'digi-tangle-v1': doc({ g: { o: 'played', s: 48, w: 17, st: true, d } }),
    'digi-borders-v1': doc({ b: { c: 8, p: 650, secs: 90, ans: [], on: d } }),
    'digi-reckon-v1': doc({ r: { p: 720, b: 3, z: [], g: [], secs: 60, d } }),
    'digi-tally-v1': doc({ y: { t: '1:42', s: 102, d } }),
  };
  const rows = S.results(S.read(store(docs)).docs);
  const by = id => rows.find(r => r.id === id);
  assert.strictEqual(by('m').secs, 62);
  assert.strictEqual(by('k').secs, 194);
  assert.deepStrictEqual([by('s1').won, by('s1').secs, by('s2').won, by('s2').secs, by('s3').won], [true, 80, false, null, false]);
  assert.strictEqual(by('p').secs, 125);
  assert.deepStrictEqual([by('l1').secs, by('l1').mistakes, by('l2').secs, by('l2').won], [90, 1, null, false]);
  assert.deepStrictEqual([by('g').score, by('g').words, by('g').star], [48, 17, true]);
  assert.deepStrictEqual([by('b').score, by('b').correct, by('b').played], [650, 8, d]);
  assert.deepStrictEqual([by('r').score, by('r').bulls], [720, 3]);
  assert.strictEqual(by('y').secs, 102);
  for (const r of rows) assert.strictEqual(r.played, d);
});

test('STATS-04: GIVEN old saves without newer fields WHEN summarised THEN they count as played, with no made-up figures', () => {
  const docs = {
    'digi-tally-v1': doc({ y: { t: '1:10' } }),                  // Tally from its Lab days: clock text only
    'digi-borders-v1': doc({ b: { c: 7, secs: 50, ans: [] } }),   // before points (26 Oct 2026) and before `on`
    'digi-mini-v1': doc({ m: { s: 40 } }),                        // no `d`
    'digi-tangle-v1': doc({ g: { o: 'played', s: 30 } }),         // no word count or star
  };
  const s = S.summary(S.read(store(docs)), { today: '2026-11-06' });
  assert.strictEqual(s.overall.finished, 4);
  assert.strictEqual(s.overall.days, 0);
  assert.strictEqual(s.types.tally.best, 70);
  assert.strictEqual(s.types.borders.best, null);
  assert.strictEqual(s.types.borders.bestCorrect, 7);
  assert.strictEqual(s.types.tangle.mostWords, null);
  assert.strictEqual(s.types.tangle.stars, 0);
  assert.strictEqual(s.unknown, 4);
});

test('STATS-05: GIVEN under 3 results WHEN summarised THEN only the count and best show', () => {
  const docs = { 'digi-mini-v1': doc({ a: { s: 60, d: '2026-11-01' }, b: { s: 90, d: '2026-11-02' } }) };
  const m = S.summary(S.read(store(docs)), { today: '2026-11-06' }).types.mini;
  assert.deepStrictEqual([m.n, m.best, m.median, m.spread, m.trend], [2, 60, null, null, null]);
});

test('STATS-06: GIVEN timed and scored results WHEN summarised THEN best, median, rates and spread are right', () => {
  const D = i => '2026-10-' + String(10 + i).padStart(2, '0');
  const mini = {}, link = {}, sweep = {}, reck = {}, tang = {};
  [30, 45, 50, 75, 300].forEach((s, i) => { mini['m' + i] = { s, d: D(i) }; });
  ['win', 'win', 'loss', 'win'].forEach((o, i) => { link['l' + i] = { o, t: '01:0' + i, m: i, r: [], g: [], d: D(i) }; });
  ['win', 'gave', 'loss'].forEach((o, i) => { sweep['s' + i] = { o, s: 100, d: D(i) }; });
  [500, 800, 650].forEach((p, i) => { reck['r' + i] = { p, b: i, z: [], g: [], secs: 1, d: D(i) }; });
  [[40, 12, true], [60, 20, false], [50, 15, true]].forEach(([s, w, st], i) => { tang['g' + i] = { o: 'played', s, w, st, d: D(i) }; });
  const s = S.summary(S.read(store({ 'digi-mini-v1': doc(mini), 'digi-link-v1': doc(link), 'digi-sweep-v1': doc(sweep),
    'digi-reckon-v1': doc(reck), 'digi-tangle-v1': doc(tang) })), { today: '2026-11-06' });
  const m = s.types.mini;
  assert.deepStrictEqual([m.best, m.median], [30, 50]);
  assert.strictEqual(m.spread.reduce((a, b) => a + b.n, 0), 5);
  assert.ok(m.spread.length <= 6);
  assert.deepStrictEqual([s.types.link.won, s.types.link.solveRate, s.types.link.mistakes, s.types.link.best], [3, 75, 1.5, 60]);
  assert.deepStrictEqual([s.types.sweep.won, s.types.sweep.solveRate], [1, 33]);
  assert.deepStrictEqual([s.types.reckon.best, s.types.reckon.average, s.types.reckon.bullseyes], [800, 650, 3]);
  assert.deepStrictEqual([s.types.tangle.best, s.types.tangle.mostWords, s.types.tangle.stars], [60, 20, 2]);
  assert.deepStrictEqual(s.overall.favourite, { type: 'mini', label: 'Mini', n: 5 });
  assert.strictEqual(s.overall.days, 5);
});

test('STATS-07: GIVEN on-the-day and catch-up plays WHEN filtered THEN each mode counts only its own', () => {
  const docs = { 'digi-mini-v1': doc({ a: { s: 60, d: '2026-11-01' }, b: { s: 70, d: '2026-11-05' }, c: { s: 80 } }) };
  const dates = { a: '2026-11-01', b: '2026-11-02', c: '2026-11-03' };
  const sv = S.read(store(docs));
  assert.strictEqual(S.summary(sv, { today: '2026-11-06', dates }).overall.finished, 3);
  assert.strictEqual(S.summary(sv, { today: '2026-11-06', dates, mode: 'day' }).overall.finished, 1);
  assert.strictEqual(S.summary(sv, { today: '2026-11-06', dates, mode: 'archive' }).overall.finished, 1);
  // Runs are about days played, so they don't change with the filter.
  assert.strictEqual(S.summary(sv, { today: '2026-11-06', dates, mode: 'archive' }).overall.longest, 1);
});

test('STATS-08: GIVEN days around midnight and the clock change WHEN runs are counted THEN London days join up', () => {
  // 24–27 Oct 2026 spans the end of BST (25 Oct). Play dates are London days already, as saved.
  const docs = { 'digi-mini-v1': doc({ a: { s: 1, d: '2026-10-24' }, b: { s: 1, d: '2026-10-25' }, c: { s: 1, d: '2026-10-26' } }),
    'digi-path-streak': { last: '2026-10-27', streak: 4, best: 4, dates: ['2026-10-27'], tz: 'L' } };
  const sv = S.read(store(docs));
  assert.deepStrictEqual(S.summary(sv, { today: '2026-10-27' }).overall.run, 4);
  assert.deepStrictEqual(S.summary(sv, { today: '2026-10-28' }).overall.run, 4);   // today not played yet: run stands
  assert.deepStrictEqual(S.summary(sv, { today: '2026-10-29' }).overall.run, 0);
  assert.strictEqual(S.summary(sv, { today: '2026-10-29' }).overall.longest, 4);
  // 28 Mar 2027 is the start of BST: 27→28→29 Mar is still three days.
  const spring = S.read(store({ 'digi-doku-v1': doc({ a: { s: 1, d: '2027-03-27' }, b: { s: 1, d: '2027-03-28' }, c: { s: 1, d: '2027-03-29' } }) }));
  assert.strictEqual(S.summary(spring, { today: '2027-03-29' }).overall.run, 3);
});

test('STATS-09: GIVEN 5+ results in two months WHEN summarised THEN a trend shows; otherwise none', () => {
  const done = {};
  for (let i = 0; i < 5; i++) done['o' + i] = { s: 100 + i, d: '2026-10-0' + (i + 1) };
  for (let i = 0; i < 5; i++) done['n' + i] = { s: 60 + i, d: '2026-11-0' + (i + 1) };
  done.x = { s: 10, d: '2026-09-01' };
  const t = S.summary(S.read(store({ 'digi-mini-v1': doc(done) })), { today: '2026-11-06' }).types.mini.trend;
  assert.strictEqual(t.length, 6);
  assert.deepStrictEqual(t.slice(-3).map(p => p.value), [null, 102, 62]);
  assert.strictEqual(t[0].month, '2026-06');
  delete done.n4;
  assert.strictEqual(S.summary(S.read(store({ 'digi-mini-v1': doc(done) })), { today: '2026-11-06' }).types.mini.trend, null);
  // A year boundary: January's six months reach back into the old year.
  assert.deepStrictEqual(S._test.months('2027-01-15', 3), ['2026-11', '2026-12', '2027-01']);
});

test('STATS-10: GIVEN the year card WHEN dated THEN it shows 1 Dec to 31 Jan from 10 results, for the right year', () => {
  const done = {};
  for (let i = 1; i <= 10; i++) done['m' + i] = { s: 50 + i, d: '2026-11-' + String(i).padStart(2, '0') };
  done.old = { s: 5, d: '2025-12-01' };
  const sv = S.read(store({ 'digi-mini-v1': doc(done), 'digi-reckon-v1': doc({ r: { p: 900, b: 5, z: [], g: [], secs: 1, d: '2026-12-02' } }) }));
  assert.strictEqual(S.yearCard(sv, { today: '2026-11-30' }), null);
  const y = S.yearCard(sv, { today: '2026-12-01' });
  assert.deepStrictEqual([y.year, y.finished, y.days, y.longest, y.busiest], [2026, 11, 11, 10, '2026-11']);
  assert.deepStrictEqual(y.favourite, { type: 'mini', label: 'Mini', n: 10 });
  assert.deepStrictEqual(y.bests, [{ type: 'mini', label: 'Mini', secs: 51 }, { type: 'reckon', label: 'Reckon', score: 900 }]);
  assert.strictEqual(S.yearCard(sv, { today: '2027-01-31' }).year, 2026);
  assert.strictEqual(S.yearCard(sv, { today: '2027-02-01' }), null);
  assert.strictEqual(S.yearShare(y), '🍜 My 2026 in Noodle — 11 puzzles · 11 days · 🔥10 best run · Mini most');
  delete done.m10; delete done.m9;
  assert.strictEqual(S.yearCard(S.read(store({ 'digi-mini-v1': doc(done) })), { today: '2026-12-01' }), null);
});

test('STATS-11: GIVEN the helpers WHEN called THEN clocks, spreads and medians are plain', () => {
  assert.strictEqual(S._test.clockSecs('1:02:03'), 3723);
  assert.strictEqual(S._test.clockSecs('nope'), null);
  assert.strictEqual(S.clock(3723), '1:02:03');
  assert.strictEqual(S.clock(65), '1:05');
  assert.strictEqual(S._test.median([4, 1, 3, 2]), 2.5);
  const sp = S._test.spread([10, 20, 1000], [10, 60]);
  assert.strictEqual(sp.reduce((a, b) => a + b.n, 0), 3);
  assert.ok(sp[sp.length - 1].open);
  assert.strictEqual(S._test.spread([1, 2], [1]), null);
  assert.strictEqual(S.monthName('2026-10'), 'October');
});
