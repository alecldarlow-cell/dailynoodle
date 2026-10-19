#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Service worker test (sw.js), 19 Oct 2026.

     node tools/tests/sw.js

   Serves this repo from a local server (localhost counts as a secure origin,
   so the worker really registers) and drives headless Chromium:

     1. registers, takes control, caches the core files
     2. caches today's puzzles (puzzles-today.json) and their engines
     3. with the network cut: front pages, the feed, today's puzzle (engine
        included) and board.html?p=… load from the cache; a page never
        opened gets the "You're offline" page
     4. back online, a changed file is served fresh (network first)
     5. a hung network falls back to the cached copy after about 6 s
     6. a push message shows a notification with its title, body and link
     7. the kill switch (OFF = true) deletes the caches and unregisters

   The repo's puzzles-today.json is served under today's London date, so the
   worker treats it as today's. Google Fonts and Supabase are answered locally, never fetched.
--------------------------------------------------------------------------- */
'use strict';
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';   // let page.route see the worker's own requests
const fs = require('fs'), path = require('path'), http = require('http');
const { REPO, launch } = require('./harness');
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', webmanifest: 'application/manifest+json' };

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

const today = JSON.parse(fs.readFileSync(path.join(REPO, 'puzzles-today.json'), 'utf8'));
const mini = (today.items || []).find(i => i.type === 'mini') || today.items[0];

// The site, with a few switches the test flips.
const S = { down: false, hang: null, override: {} };
const srv = http.createServer((q, s) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  if (S.down) { q.socket.destroy(); return; }
  const send = () => {
    if (S.override[p] != null) { s.writeHead(200, { 'Content-Type': MIME[path.extname(p).slice(1)] || 'text/plain', 'Cache-Control': 'no-cache' }); return s.end(S.override[p]); }
    let f = path.join(REPO, p.endsWith('/') ? p + 'index.html' : p);
    if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      s.writeHead(404, { 'Content-Type': MIME.html }); return s.end(fs.readFileSync(path.join(REPO, '404.html')));
    }
    s.writeHead(200, { 'Content-Type': MIME[path.extname(f).slice(1)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
    s.end(fs.readFileSync(f));
  };
  if (S.hang && S.hang.test(p)) setTimeout(send, 12000); else send();
}).listen(0);
const ORIGIN = `http://localhost:${srv.address().port}`;

(async () => {
  // Full headless Chromium: the stripped-down headless shell refuses notification permission.
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-GB', timezoneId: 'Europe/London' });
  await ctx.grantPermissions(['notifications'], { origin: ORIGIN });
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (/fonts\.(googleapis|gstatic)\.com$/.test(u.host)) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.host.endsWith('supabase.co')) return r.fulfill({ status: 204, body: '' });
    if (u.origin === ORIGIN) return r.continue();
    return r.abort();
  });
  let p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(p.url().replace(ORIGIN, '') + ': ' + e.message));
  // The worker only warms a list dated today (London), so serve the repo's list under today's date.
  const london = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  S.override['/puzzles-today.json'] = JSON.stringify(Object.assign({}, today, { today: london }));

  // 1. register + control
  await p.goto(ORIGIN + '/puzzles.html');
  const reg = await p.evaluate(() => navigator.serviceWorker.ready.then(r => r.scope)).catch(e => 'ERR ' + e.message);
  ok(reg === ORIGIN + '/', `registers with the whole site as its scope (${reg})`);
  await p.reload(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'controls the page after a reload');
  const keys = async () => p.evaluate(async () => { const c = await caches.open((await caches.keys()).find(k => k.startsWith('nn-pages-'))); return (await c.keys()).map(r => new URL(r.url).pathname); });
  let k = await keys();
  ok(['/', '/puzzles.html', '/front.js', '/feed.json', '/engines/finish.js'].every(x => k.includes(x)), `core files cached (${k.length} entries)`);

  // 2. today's puzzles
  let warmed = false;
  for (let i = 0; i < 40 && !warmed; i++) { await p.waitForTimeout(250); k = await keys(); warmed = k.includes('/__nn/warmed'); }
  ok(warmed, "today's puzzles warmed once the worker is ready");
  ok(today.items.every(i => k.includes('/' + i.path)), `every puzzle in puzzles-today.json cached (${today.items.length})`);
  ok(k.includes('/engines/mini.js') && k.includes('/engines/mini.css'), "today's engines cached");

  // 3. offline
  S.down = true;
  await p.goto(ORIGIN + '/puzzles.html'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => document.querySelectorAll('a.card').length > 0), 'offline: Puzzles front page lists cards from the cached feed');
  await p.goto(ORIGIN + '/' + mini.path + '?via=share'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !!document.querySelector('#grid, #board') && !/offline/i.test(document.title)), `offline: today's ${mini.type} opens and draws its board (query string ignored)`);
  await p.goto(ORIGIN + '/board.html?p=mini&from=result'); await p.waitForTimeout(500);
  ok(/Noodle/i.test(await p.title()), 'offline: board.html?p=… opens from the cache');
  await p.goto(ORIGIN + '/reports/2026-10-01-never-opened.html'); await p.waitForTimeout(300);
  ok(/offline/i.test(await p.textContent('h1').catch(() => '')), 'offline: a page never opened shows "You\'re offline"');
  await p.goto(ORIGIN + '/admin.html').catch(() => {});
  ok(!/Noodle/.test(await p.title().catch(() => '')), 'offline: admin.html is never served from the cache');

  // 4. network first
  S.down = false;
  await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(p.url().replace(ORIGIN, '') + ': ' + e.message));   // leave the failed admin page behind
  await p.goto(ORIGIN + '/games.html'); await p.waitForTimeout(300);
  S.override['/feed.json'] = JSON.stringify({ items: [] , marker: 'fresh-1' });
  const feed = await p.evaluate(() => fetch('/feed.json', { cache: 'no-cache' }).then(r => r.json()));
  ok(feed.marker === 'fresh-1', 'online: a changed file is served fresh, not from the cache');
  delete S.override['/feed.json'];
  await p.evaluate(() => fetch('/feed.json', { cache: 'no-cache' }));

  // 5. hung network
  S.hang = /^\/front\.css$/;
  const t0 = Date.now();
  const css = await p.evaluate(() => fetch('/front.css', { cache: 'no-store' }).then(r => r.text()));
  const took = Date.now() - t0;
  ok(css.length > 1000 && took < 9000 && took > 4000, `hung network: cached copy after ~6 s (${(took / 1000).toFixed(1)} s)`);
  S.hang = null;

  // Real notification delivery is an opt-in platform check; deterministic
  // handler/click contracts run in unit/worker.test.js on every change.
  if (process.env.DN_NATIVE_PUSH === '1') {
  // 6. push
  const cdp = await ctx.newCDPSession(p);
  const regs = await new Promise(async res => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', e => { const r = e.registrations.find(x => x.scopeURL === ORIGIN + '/'); if (r) res(r); });
    await cdp.send('ServiceWorker.enable');
  });
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: ORIGIN, registrationId: regs.registrationId, data: JSON.stringify({ title: 'Jo beat your Mini', body: '0:41 — your move', url: '/board.html?p=mini', tag: 'test' }) });
  let notes = [];
  for (let i = 0; i < 20 && !notes.length; i++) { await p.waitForTimeout(150); notes = await p.evaluate(() => navigator.serviceWorker.ready.then(r => r.getNotifications()).then(n => n.map(x => ({ t: x.title, b: x.body, u: x.data && x.data.url, tag: x.tag })))); }
  ok(notes.length === 1 && notes[0].t === 'Jo beat your Mini' && notes[0].b === '0:41 — your move' && notes[0].u === '/board.html?p=mini' && notes[0].tag === 'test', `push: shows the notification it carries (${JSON.stringify(notes[0] || null)})`);

  } else console.log('DEVICE CHECK NOT RUN: native notification display (DN_NATIVE_PUSH=1 on a supported full browser); handler contract is covered separately.');

  ok(!errs.length, 'no page errors' + (errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''));

  // 7. kill switch
  S.override['/sw.js'] = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8').replace(/const OFF = false;/, 'const OFF = true;');
  await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  let gone = false;
  for (let i = 0; i < 40 && !gone; i++) { await p.waitForTimeout(250); gone = await p.evaluate(async () => !(await navigator.serviceWorker.getRegistration()) && !(await caches.keys()).some(k => k.startsWith('nn-'))); }
  ok(gone, 'kill switch: caches deleted and the worker unregistered');

  await b.close(); srv.close();
  console.log(`\nsw: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
