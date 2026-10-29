#!/usr/bin/env node
/* Regression checks: reading the start card is untimed, and completed results
   use London calendar days in both shared players and archived full pages.
   Uses harness.js; Supabase calls are intercepted and never sent. */
'use strict';
const assert = require('assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { REPO, launch, open, tap, wait } = require('./harness');
const play = require('./play');
const F = { path: '2026-10-19-logic-path-0093.html', link: '2026-10-19-word-link-0072.html', sweep: '2026-10-19-logic-sweep.html' };
let passed = 0;
function check(value, message) { assert.ok(value, message); passed++; console.log('PASS ' + message); }
const seconds = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
const clock = p => p.locator('#timer').textContent().then(seconds);

function savedDates() {
  const files = ['mini', 'doku', 'sweep', 'path', 'link'].map(t => 'engines/' + t + '.js')
    .concat(fs.readdirSync(path.join(REPO, 'reports')).filter(f => fs.readFileSync(path.join(REPO, 'reports', f), 'utf8').includes('function donePut(')).map(f => 'reports/' + f));
  const cases = [
    ['2026-10-18T23:30:00Z', '2026-10-19'], // BST, after London midnight
    ['2026-10-25T23:30:00Z', '2026-10-25'], // GMT, after clocks go back
    ['2026-03-28T23:30:00Z', '2026-03-28'], // before clocks go forward
    ['2026-03-29T23:30:00Z', '2026-03-30'], // after clocks go forward
  ];
  for (const file of files) {
    const src = fs.readFileSync(path.join(REPO, file), 'utf8');
    const put = src.match(/^function donePut\(.*$/m)[0], day = src.match(/^function today\(.*$/m)[0];
    for (const [instant, expected] of cases) {
      const data = new Map();
      class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }
      const ctx = vm.createContext({ Date: FixedDate, Intl, DONE_KEY: 'save', doneShow() {}, localStorage: { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v) } });
      ctx.window=ctx;
      vm.runInContext(fs.readFileSync(path.join(REPO,'dn-core.js'),'utf8')+'\n'+day + '\n' + put + '\ndonePut("fixture", {s:10});', ctx);
      assert.equal(JSON.parse(data.get('save')).done.fixture.d, expected, file + ' at ' + instant);
      vm.runInContext('donePut("fixture", {s:99});', ctx);
      assert.equal(JSON.parse(data.get('save')).done.fixture.s, 10, file + ': preserve the first result');
    }
  }
  check(true, files.length + ' save writers use London dates across both DST changes and preserve first results');
}

async function timer(browser, type) {
  const ev = [], { ctx, p } = await open(browser, F[type], { events: ev });
  try {
    await wait(p, 60000);
    check(await p.locator('#dnPlay').isVisible() && await clock(p) === 0, type + ': one minute reading the start card costs no time');
    await play.start(p);
    await wait(p, 5000);
    check(await clock(p) >= 5 && await clock(p) <= 6, type + ': clock starts on Play');
    await p.evaluate(() => window.digi.flush());
    check(!ev.some(e => e.ev === 'puzzle_start'), type + ': Play still does not count as a tracker start');
    const cell = type === 'path' ? p.locator('#grid .cell').first() : p.locator('#board .tile').first();
    await tap(p, cell); await wait(p, 2000);
    check(await clock(p) >= 7 && await clock(p) <= 8, type + ': first board tap does not restart or duplicate the clock');
    if (type === 'path') await play.path(p); else await play.link(p, { wrong: 4 });
    const atEnd = await clock(p);
    check(atEnd > 7 && atEnd < 60, type + ': completed time excludes the minute on the start card');
    await wait(p, 5000);
    check(await clock(p) === atEnd, type + ': clock stops at the result');
    if (type === 'link') {
      await p.getByRole('button', { name: 'Play again (not recorded)', exact: true }).click();
      await wait(p, 5000);
      check(await clock(p) >= 5 && await clock(p) <= 6, 'link: replay starts a fresh clock without a start card');
    }
    await p.reload(); await wait(p, 5000);
    check(await clock(p) === atEnd, type + ': reopening preserves the original completed time');
  } finally { await ctx.close(); }
}

async function midnight(browser) {
  const { ctx, p } = await open(browser, F.sweep, { time: '2026-10-19T00:30:00+01:00' });
  try {
    await play.sweep(p, { boom: true });
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('digi-sweep-v1')));
    check(Object.values(saved.done)[0].d === '2026-10-19', 'Sweep at 00:30 BST saves the London day');
    check(await p.evaluate(() => window.dnFinish._test.overallRun()) === 1, 'one midnight play does not earn two days on the finish sheet');
    await p.goto('https://dailynoodle.co.uk/puzzles.html'); await wait(p, 1500);
    check(!/2-day streak/.test(await p.locator('#run').textContent()), 'one midnight play does not earn two days on the front page');
  } finally { await ctx.close(); }
}

(async () => {
  savedDates();
  const browser = await launch();
  try { await timer(browser, 'path'); await timer(browser, 'link'); await midnight(browser); }
  finally { await browser.close(); }
  console.log('\ntiming-dates: ' + passed + ' passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
