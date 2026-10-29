#!/usr/bin/env node
/* Focused regressions for interrupted offline batches and the dated Next row.
   Uses the existing browser harness; all network calls are local or mocked. */
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const { REPO, launch, newPhone, open, wait } = require('./harness');
let pass = 0;
const ok = (v, m) => { assert.ok(v, m); pass++; console.log('PASS ' + m); };
const DAY = '2026-10-19', NEXT = '2026-10-20';
const list = day => ({ today: day, items: [{ type: 'link', id: 'DP·LINK·' + day, name: 'Link ' + day, path: 'reports/' + day + '-word-link-0001.html' }] });

async function interruptedBatches() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  for (const failed of ['/reports/' + day + '-word-link-0001.html', '/engines/link.js', '/engines/finish.js']) {
    const data = new Map(), calls = [];
    let fault = true;
    const key = k => new URL(k, 'https://example.test').href;
    const cache = { match: async k => data.get(key(k))?.clone(), put: async (k, r) => data.set(key(k), r.clone()) };
    const ctx = vm.createContext({ self: { location: { origin: 'https://example.test' }, addEventListener() {} }, caches: { open: async () => cache }, URL, Date, Intl, Response, Set,
      fetch: async u => {
        calls.push(u);
        if (u === '/puzzles-today.json') return new Response(JSON.stringify(list(day)));
        if (fault && u === failed) return new Response('not downloaded', { status: 503 });
        return new Response(u.startsWith('/reports/') ? '<script src="../engines/link.js"></script><link href="../engines/link.css">' : 'asset');
      } });
    vm.runInContext(fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8'), ctx);
    await vm.runInContext('warmIfDue()', ctx);
    ok(!data.has(key('/__nn/warmed')), failed + ': failed download leaves the day due');
    fault = false;
    await vm.runInContext('warmIfDue()', ctx);
    ok(data.has(key(failed)) && await data.get(key('/__nn/warmed')).text() === day, failed + ': next attempt downloads the missing file and completes the day');
    const n = calls.length; await vm.runInContext('warmIfDue()', ctx);
    ok(calls.length === n, 'completed batch makes no further downloads today');
  }
}

async function nextRow(browser) {
  const ctx = await newPhone(browser);
  let served = list('2026-10-18'), fail = false;
  await ctx.route('**/puzzles-today.json', r => fail ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(served) }));
  await ctx.addInitScript(() => {
    localStorage.setItem('digi-sweep-v1', JSON.stringify({ v: 1, done: { 'DP·SWEEP·2026-10-19': { o: 'loss', s: 14, b: 7, d: '2026-10-19' } } }));
    localStorage.setItem('dn-today-cache', JSON.stringify({ today: '2026-10-18', items: [] }));
  });
  const { p } = await open(browser, '2026-10-19-logic-sweep.html', { ctx, time: DAY + 'T23:58:00+01:00' });
  const row = p.locator('.fin-next'), sub = p.locator('.fin-next-sub');
  try {
    ok(await row.getAttribute('href') === '../puzzles.html' && !/done today/.test(await sub.textContent()), 'yesterday in storage and on the server is never labelled today');
    served = list(NEXT);
    await p.evaluate(() => dispatchEvent(new Event('online'))); await wait(p, 500);
    ok(await row.getAttribute('href') === '../puzzles.html', 'a future-dated list is not offered early');
    served = { today: DAY, items: [] };
    await p.evaluate(() => dispatchEvent(new Event('online'))); await wait(p, 500);
    ok(!/All \d+ done today/.test(await row.textContent()), 'an empty build is not presented as all puzzles done');
    served = list(DAY);
    await p.evaluate(() => dispatchEvent(new Event('online'))); await wait(p, 500);
    ok((await row.getAttribute('href')).includes(DAY + '-word-link'), 'reconnecting picks up today’s newly published list');
    fail = true;
    await p.evaluate(() => dispatchEvent(new Event('online'))); await wait(p, 500);
    ok((await row.getAttribute('href')).includes(DAY + '-word-link'), 'offline refresh keeps a valid same-day list');
    await p.clock.setSystemTime(new Date(NEXT + 'T00:05:00+01:00'));
    await wait(p, 31000);
    ok(await row.getAttribute('href') === '../puzzles.html' && !/done today/.test(await sub.textContent()), 'an open finish sheet discards yesterday after London midnight, even offline');
    fail = false; served = list(NEXT);
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(p, 500);
    ok((await row.getAttribute('href')).includes(NEXT + '-word-link'), 'resuming the app refreshes the list for the new day');
    served.items[0].name = 'Link updated today';
    await wait(p, 31000);
    ok(/Link updated today/.test(await row.textContent()), 'a visible sheet revalidates its in-memory list');
    ok(!p.errs.length, 'no browser errors');
  } finally { await ctx.close(); }
}

(async () => {
  await interruptedBatches();
  const b = await launch(); try { await nextRow(b); } finally { await b.close(); }
  console.log('\noffline-next: ' + pass + ' passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
