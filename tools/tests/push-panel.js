#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Notifications test panel (dn-push.js on board.html?push=test), 19 Oct 2026.

     node tools/tests/push-panel.js

   Real worker on a local server, full headless Chromium. A headless browser
   can't get a real push subscription, so pushManager.subscribe is replaced
   by a fake one; the Supabase calls are captured, not sent. Checks:
     - board.html without ?push=test has no panel and never loads dn-push.js
     - with it: Off -> Turn on (permission, key, subscribe, board_push_save
       with this browser's board id) -> Send me a test -> Turn off
       (unsubscribe, board_push_drop); no page errors
--------------------------------------------------------------------------- */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { REPO } = require('./harness');
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', webmanifest: 'application/manifest+json' };
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(REPO, p);
  if (!f.startsWith(REPO) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).slice(1)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
}).listen(0);
const ORIGIN = `http://localhost:${srv.address().port}`;
const KEY = 'BMr68dYPtF0NEbgWYTus3SJV29l0Jm98T4xHwAeNiEVi30NWwv2VhKDY2EfXEMS_Gqyq-3CAOMASO2IfMEipH1Q';

(async () => {
  const b = await require('playwright').chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.grantPermissions(['notifications'], { origin: ORIGIN });
  const calls = [], loaded = [];
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.origin === ORIGIN) { loaded.push(u.pathname); return r.continue(); }
    if (u.host.endsWith('supabase.co')) {
      const body = JSON.parse(r.request().postData() || '{}');
      calls.push({ path: u.pathname, body });
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      if (u.pathname.endsWith('/board-push')) return r.fulfill({ status: 200, headers: cors, contentType: 'application/json',
        body: JSON.stringify(body.action === 'key' ? { key: KEY } : { sent: 1, failed: 0, gone: 0, subs: 1 }) });
      if (u.pathname.endsWith('/board_mine')) return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '[]' });
      return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: 'true' });
    }
    return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  // A fake push subscription: headless Chromium has no push service.
  await ctx.addInitScript(() => {
    if (!self.PushManager) return;
    let cur = null;
    PushManager.prototype.getSubscription = function () { return Promise.resolve(cur); };
    PushManager.prototype.subscribe = function (o) {
      window.__subKey = o && o.applicationServerKey && o.applicationServerKey.byteLength;
      cur = { endpoint: 'https://fcm.googleapis.com/fcm/send/fake', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } }; },
              unsubscribe() { cur = null; return Promise.resolve(true); } };
      return Promise.resolve(cur);
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  await p.goto(ORIGIN + '/board.html'); await p.waitForTimeout(800);
  ok(!(await p.$('#nnPush')) && !loaded.includes('/dn-push.js'), 'board.html: no panel, dn-push.js never loaded');

  await p.goto(ORIGIN + '/board.html?push=test'); await p.waitForTimeout(2500);
  ok(!!(await p.$('#nnPush')), 'board.html?push=test: panel shown');
  ok(/Off for this phone/.test(await p.textContent('#nnPushMsg')) && await p.isVisible('#nnPushOn'), 'starts Off, with "Turn on"');
  const pid = await p.evaluate(() => window.noodleBoard.pid());

  await p.click('#nnPushOn'); await p.waitForTimeout(800);
  const saved = calls.find(c => c.path.endsWith('/board_push_save'));
  ok(calls.some(c => c.body.action === 'key') && await p.evaluate(() => window.__subKey) === 65, 'Turn on: fetches the public key and subscribes with it (65 bytes)');
  ok(saved && saved.body.p_player === pid && saved.body.p_endpoint === 'https://fcm.googleapis.com/fcm/send/fake' && saved.body.p_auth.length === 22, 'Turn on: saves the subscription against this browser\'s board id');
  ok(/On for this phone/.test(await p.textContent('#nnPushMsg')) && await p.isVisible('#nnPushTest') && await p.isVisible('#nnPushOff'), 'then shows On, with "Send me a test" and "Turn off"');

  await p.click('#nnPushTest'); await p.waitForTimeout(500);
  ok(calls.some(c => c.body.action === 'test' && c.body.player === pid) && /^Sent\./.test(await p.textContent('#nnPushMsg')), 'Send me a test: asks the server for a test to this board id');

  await p.click('#nnPushOff'); await p.waitForTimeout(800);
  const drop = calls.find(c => c.path.endsWith('/board_push_drop'));
  ok(drop && drop.body.p_player === pid && /Off for this phone/.test(await p.textContent('#nnPushMsg')), 'Turn off: unsubscribes and tells the server');
  ok(!calls.some(c => c.body.action === 'send'), 'never calls the real send action');
  ok(!errs.length, 'no page errors' + (errs.length ? ' — ' + errs.join(' | ') : ''));

  await b.close(); srv.close();
  console.log(`\npush-panel: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
