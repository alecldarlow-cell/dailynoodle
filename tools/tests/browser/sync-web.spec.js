'use strict';
// Sign-in sync on the website (dn-sync.js, 25 Oct 2026): the website half of the
// app's optional sign-in. The sync functions run for real, from
// toolchain/sql/2026-10-25-sync.sql, on a throwaway PGlite database (as in
// tools/tests/unit/sync.test.js), and the leagues on another one (board-db.js). Never
// the live project. Supabase Auth itself is a stand-in: a sign-in link's token names
// the test user ("alec" → alec@example.test).
//
// Each device is a separate browser context, i.e. separate storage, as two phones are.
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { test, expect, H } = require('./support');
const play = require('../play');
const { boardDb, rpc } = require('../board-db');

const TIME = '2026-10-18T14:30:00+01:00', DAY = '2026-10-18';
const MINI18 = 'reports/2026-10-18-crossword-mini-0099.html';
const MINI17 = 'reports/2026-10-17-crossword-mini-0098.html';
const MINI16 = 'reports/2026-10-16-crossword-mini-0097.html';
const SITE = 'https://dailynoodle.co.uk/';

/* ---------- the account side: the real sync functions ---------- */
const SYNC_SQL = fs.readFileSync(path.join(H.REPO, 'toolchain/sql/2026-10-25-sync.sql'), 'utf8');
const AUTH_HOSTING = `
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'sub', '')::uuid $$;
`;
const USERS = { 'alec@example.test': '00000000-0000-4000-8000-00000000000a', 'jo@example.test': '00000000-0000-4000-8000-00000000000b' };
async function syncDb() { const d = new PGlite(); await d.exec(AUTH_HOSTING); await d.exec(SYNC_SQL); return d; }
async function account(d, email, fn, args) {
  const sql = { sync_pull: 'select public.sync_pull() as v', sync_push: 'select public.sync_push($1::jsonb) as v', sync_forget: 'select public.sync_forget() as v' }[fn];
  if (!sql) return { data: null, error: { message: 'no function ' + fn } };
  try {
    const rows = await d.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(email ? { sub: USERS[email], role: 'authenticated' } : { role: 'anon' })]);
      return (await tx.query(sql, fn === 'sync_push' ? [JSON.stringify(args.p_saves)] : [])).rows;
    });
    return { data: rows[0].v, error: null };
  } catch (e) { return { data: null, error: { message: e.message } }; }
}
const held = async (d, email) => (await account(d, email, 'sync_pull')).data;

/* A stand-in for supabase-js: the session lives under the storageKey dn-sync.js asks for,
   as the real library keeps it; rpc goes to the account database above. */
function fakeSupabase() {
  window.__dnSyncTest = 1;
  window.__auth = [];
  window.__shared = []; navigator.share = d => { window.__shared.push(d); return Promise.resolve(); };
  window.supabase = { createClient(url, key, opts) {
    const SK = opts.auth.storageKey;
    const read = () => { try { return JSON.parse(localStorage.getItem(SK)); } catch (e) { return null; } };
    window.__opts = opts;
    return {
      auth: {
        getSession: async () => ({ data: { session: read() }, error: null }),
        setSession: async t => {
          window.__auth.push(['setSession', t]);
          if (t.access_token === 'expired') return { data: { session: null }, error: { message: 'Token has expired' } };
          const s = { access_token: t.access_token, refresh_token: t.refresh_token, user: { email: t.access_token + '@example.test' } };
          localStorage.setItem(SK, JSON.stringify(s)); return { data: { session: s }, error: null };
        },
        signInWithOtp: async a => { window.__auth.push(['otp', a]); return { data: {}, error: null }; },
        signOut: async () => { window.__auth.push(['signOut']); localStorage.removeItem(SK); return { error: null }; }
      },
      rpc: async (fn, args) => { const s = read(); window.__auth.push([fn]); return window.__account(s && s.user.email, fn, args || {}); }
    };
  } };
}

async function device(browser, dbs, name, { sync = true, time = TIME } = {}) {
  const events = [], calls = [], cdn = [];
  const ctx = await H.newPhone(browser, { events });
  if (sync) {
    await ctx.addInitScript(fakeSupabase);
    await ctx.exposeBinding('__account', (src, email, fn, args) => account(dbs.sync, email, fn, args));
  } else {
    await ctx.addInitScript(() => { window.__shared = []; navigator.share = d => { window.__shared.push(d); return Promise.resolve(); }; });
  }
  ctx.on('request', r => { if (/jsdelivr|supabase-js/.test(r.url())) cdn.push(r.url()); });
  await ctx.route(u => H.isSupabase(u.hostname) && /^\/rest\/v1\/rpc\/(board|admin)_/.test(u.pathname), async route => {
    const req = route.request(), fn = new URL(req.url()).pathname.split('/').pop();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
    const h = req.headers(), res = await rpc(dbs.board, fn, req.postData(), { apikey: h.apikey });
    calls.push({ fn, status: res.status });
    return route.fulfill({ status: res.status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(res.body) });
  });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date(time) });
  return { name, ctx, p, calls, cdn };
}
/* A link opened from an email or a chat is a new page load, never a same-page jump to a #fragment. */
const open = async (D, url) => { await D.p.goto('about:blank'); await D.p.goto(url); };
const go = async (D, file) => { await D.p.goto(SITE + file); await H.wait(D.p, 900); };
const store = (D, k) => D.p.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, k);
const doneIds = async D => Object.keys(((await store(D, 'digi-mini-v1')) || {}).done || {}).sort();
const card = D => D.p.locator('#dnsync');

async function solveMini(D, file) {
  await go(D, file);
  await play.start(D.p);
  const pz = await D.p.evaluate(() => window.DN_PUZZLE);
  const first = pz.grid.flat().findIndex(ch => ch !== '#');
  await H.tap(D.p, D.p.locator('#grid .cell').nth(first)); await H.wait(D.p, 200);
  await D.p.keyboard.press(pz.grid.flat()[first].toLowerCase());
  await play.grid(D.p);
  await expect(D.p.locator('#winModal.on')).toHaveCount(1);
}
/* Open a sign-in link as it arrives from the email: board.html#access_token=…&refresh_token=… */
async function signIn(D, token) {
  await open(D, SITE + 'board.html#access_token=' + token + '&refresh_token=r-' + token + '&expires_in=3600&token_type=bearer&type=magiclink');
  await expect(card(D)).toContainText('Signed in as ' + token + '@example.test', { timeout: 10000 });
  expect(new URL(D.p.url()).hash, 'the tokens leave the address bar at once').toBe('');
  await settled(D);
}
/* The page's sync is over and it won't reload by itself: a sync that brings results in reloads
   board.html once, and a step taken during that reload hits a page being torn down. */
const settled = D => expect(D.p.locator('html[data-dn-sync="done"]')).toHaveCount(1, { timeout: 15000 });

test.describe('SYNC-WEB', () => {
  test.describe.configure({ timeout: 150000 });   // several browsers and two databases each, as in board-key.spec.js
  const dbs = {};
  test.beforeEach(async () => { dbs.board = await boardDb({ today: DAY }); dbs.sync = await syncDb(); });
  test.afterEach(async () => { await dbs.board.close(); await dbs.sync.close(); });

  test('SYNC-WEB-01: switched off (as published), nothing shows and supabase-js is never fetched', async ({ browser }) => {
    const D = await device(browser, dbs, 'plain', { sync: false });
    try {
      await go(D, 'board.html');
      await expect(card(D)).toBeHidden();
      expect(await D.p.evaluate(() => typeof window.dnSync)).toBe('undefined');
      expect(await D.p.evaluate(() => typeof (window.dnMove && window.dnMove.importData)), 'dn-track.js offers its import').toBe('function');
      await solveMini(D, MINI18);
      await H.wait(D.p, 1500);
      expect(D.cdn).toEqual([]);
      expect(await D.p.evaluate(() => [...document.scripts].some(s => /dn-sync\.js/.test(s.src))), 'puzzle pages load nothing more for a player who isn’t signed in').toBe(false);
      expect(D.p.errs).toEqual([]);
    } finally { await D.ctx.close(); }
  });

  test('SYNC-WEB-02: dnMove.importData merges exactly as a #dnmove= link does', async ({ browser }) => {
    const here = {
      'digi-mini-v1': JSON.stringify({ v: 1, done: { 'DP·MINI·0098': { s: 90, d: '2026-10-17' } } }),
      'digi-mini-streak': JSON.stringify({ last: '2026-10-17', streak: 2, best: 4, dates: ['2026-10-16', '2026-10-17'] }),
      'digi-doku-v1': 'not json'
    };
    const d = {
      'digi-mini-v1': JSON.stringify({ v: 1, done: { 'DP·MINI·0098': { s: 40, d: '2026-10-17' }, 'DP·MINI·0099': { s: 60, d: '2026-10-18' } } }),
      'digi-mini-streak': JSON.stringify({ last: '2026-10-18', streak: 1, best: 6, dates: ['2026-10-18'] }),
      'digi-doku-v1': JSON.stringify({ v: 1, done: { x: { s: 1 } } }),
      'digi-link-v1': JSON.stringify({ v: 1, done: { y: { m: 1 } } })
    };
    const b = { pid: '11111111-2222-4333-8444-555555555555', leagues: [{ code: 'FAMILY1', name: 'Family', nick: 'Jo', owner: false }], cur: 'FAMILY1' };
    const L = await device(browser, dbs, 'link', { sync: false }), I = await device(browser, dbs, 'import', { sync: false });
    try {
      for (const D of [L, I]) { await go(D, 'privacy.html'); await D.p.evaluate(h => { for (const k in h) localStorage.setItem(k, h[k]); }, here); }
      const frag = Buffer.from(JSON.stringify({ v: 1, d, b })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await open(L, SITE + 'privacy.html#dnmove=' + frag);
      await L.p.waitForURL(u => !u.hash, { timeout: 10000 }); await H.wait(L.p, 600);
      await I.p.evaluate(([d, b]) => window.dnMove.importData(d, b), [d, b]);
      const dump = D => D.p.evaluate(() => {
        const o = {};
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^(digi-|noodle-board)/.test(k)) o[k] = localStorage.getItem(k); }
        if (o['noodle-board-v1']) { const s = JSON.parse(o['noodle-board-v1']); delete s.moved.at; o['noodle-board-v1'] = s; }
        return o;
      });
      const a = await dump(L), c = await dump(I);
      expect(c).toEqual(a);
      // and the rules themselves: first result kept, a new one added, the longer recounted run, the unreadable save left alone
      expect(JSON.parse(c['digi-mini-v1']).done).toEqual({ 'DP·MINI·0098': { s: 90, d: '2026-10-17' }, 'DP·MINI·0099': { s: 60, d: '2026-10-18' } });
      expect(JSON.parse(c['digi-mini-streak'])).toMatchObject({ last: '2026-10-18', streak: 3, best: 6 });
      expect(c['digi-doku-v1']).toBe('not json');
      expect(c['noodle-board-v1']).toMatchObject({ pid: b.pid, cur: 'FAMILY1' });
    } finally { await L.ctx.close(); await I.ctx.close(); }
  });

  test('SYNC-WEB-03: signing in asks for an email, checks it, and sends a link back to the board page', async ({ browser }) => {
    const D = await device(browser, dbs, 'new');
    try {
      await go(D, 'board.html');
      await expect(card(D)).toBeVisible();
      await expect(card(D).locator('h2')).toHaveText('Keep your streaks everywhere');
      expect(await D.p.evaluate(() => window.__opts.auth)).toMatchObject({ storageKey: 'noodle-sync-auth', persistSession: true, detectSessionInUrl: false });
      await D.p.fill('#dnsyncEmail', 'not an email');
      await H.tap(D.p, card(D).locator('button[type="submit"]'));
      await expect(D.p.locator('#dnsyncMsg')).toHaveText('Enter your email address, like you@example.com.');
      await D.p.fill('#dnsyncEmail', ' Jo@Example.test ');
      await H.tap(D.p, card(D).locator('button[type="submit"]'));
      await expect(D.p.locator('#dnsyncSent')).toContainText('we sent a sign-in link to jo@example.test');
      expect(await D.p.evaluate(() => window.__auth)).toEqual([['otp', { email: 'jo@example.test', options: { emailRedirectTo: 'https://dailynoodle.co.uk/board.html' } }]]);
      await H.tap(D.p, card(D).locator('[data-sync="again"]'));
      await expect(D.p.locator('#dnsyncEmail')).toBeVisible();
      // phone width: no sideways scroll
      expect(await D.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(D.p.errs).toEqual([]);
    } finally { await D.ctx.close(); }
  });

  test('SYNC-WEB-04: an expired or refused link says so, and leaves the address bar clean', async ({ browser }) => {
    const D = await device(browser, dbs, 'late');
    try {
      await D.p.goto(SITE + 'board.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
      await expect(D.p.locator('#dnsyncMsg')).toHaveText('That sign-in link didn’t work: Email link is invalid or has expired. Ask for a new one.');
      expect(new URL(D.p.url()).hash).toBe('');
      await open(D, SITE + 'board.html#access_token=expired&refresh_token=x');
      await expect(D.p.locator('#dnsyncMsg')).toHaveText('Token has expired');
      await expect(D.p.locator('#dnsyncEmail')).toBeVisible();
      expect(await store(D, 'noodle-sync-auth')).toBeNull();
    } finally { await D.ctx.close(); }
  });

  test('SYNC-WEB-05: two browsers signed in to one account share results and the league, first result kept', async ({ browser }) => {
    test.setTimeout(240000);
    const A = await device(browser, dbs, 'laptop'), B = await device(browser, dbs, 'phone');
    try {
      // The laptop is in a league, as Alec, and has finished the 17th.
      await go(A, 'board.html');
      await H.tap(A.p, A.p.locator('[data-go="start"]'));
      await A.p.fill('input[name="lname"]', 'Family');
      await A.p.fill('input[name="nick"]', 'Alec');
      await H.tap(A.p, A.p.locator('#f .btn.go'));
      await expect(A.p.locator('.daybar')).toHaveCount(1);
      await solveMini(A, MINI17);
      const pid = (await store(A, 'noodle-board-v1')).pid;

      // The phone, in no league, has its own 18th and its own 17th (a different time).
      await solveMini(B, MINI18);
      await B.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('digi-mini-v1')); s.done['DP·MINI·0098'] = { s: 999, d: '2026-10-17', phone: true }; localStorage.setItem('digi-mini-v1', JSON.stringify(s)); });

      // Signing in on the laptop sends its saves and league identity to the account.
      await signIn(A, 'alec');
      await expect(A.p.locator('#dnsyncLast')).toHaveText('Synced just now');
      let acc = await held(dbs.sync, 'alec@example.test');
      expect(Object.keys(acc['digi-mini-v1'].done)).toEqual(['DP·MINI·0098']);
      expect(acc['noodle-board-v1'].pid).toBe(pid);

      // Signing in on the phone brings them in, and the board reloads as Alec in Family.
      await signIn(B, 'alec');
      await expect.poll(() => doneIds(B), { timeout: 10000 }).toEqual(['DP·MINI·0098', 'DP·MINI·0099']);
      await expect(B.p.locator('#app .bcard').first()).toContainText('Alec', { timeout: 10000 });
      expect((await store(B, 'noodle-board-v1')).pid, 'the phone now plays as Alec').toBe(pid);
      expect((await store(B, 'digi-mini-v1')).done['DP·MINI·0098'], 'first result kept: the phone’s own').toMatchObject({ s: 999, phone: true });
      acc = await held(dbs.sync, 'alec@example.test');
      expect(Object.keys(acc['digi-mini-v1'].done).sort()).toEqual(['DP·MINI·0098', 'DP·MINI·0099']);

      // Sync now on the laptop brings the phone's 18th across; its own 17th stays as it was.
      await go(A, 'board.html');
      await H.tap(A.p, card(A).locator('[data-sync="now"]'));
      await expect.poll(() => doneIds(A), { timeout: 10000 }).toEqual(['DP·MINI·0098', 'DP·MINI·0099']);
      expect((await store(A, 'digi-mini-v1')).done['DP·MINI·0098'].phone).toBeUndefined();

      // A puzzle finished on the phone reaches the account by itself.
      await solveMini(B, MINI16);
      await expect.poll(async () => Object.keys((await held(dbs.sync, 'alec@example.test'))['digi-mini-v1'].done).sort(), { timeout: 10000 })
        .toEqual(['DP·MINI·0097', 'DP·MINI·0098', 'DP·MINI·0099']);
      expect(A.p.errs.concat(B.p.errs)).toEqual([]);
    } finally { await A.ctx.close(); await B.ctx.close(); }
  });

  test('SYNC-WEB-06: another player’s league on the account is asked about, never adopted', async ({ browser }) => {
    const A = await device(browser, dbs, 'jo'), B = await device(browser, dbs, 'alec');
    try {
      await go(A, 'board.html');
      await H.tap(A.p, A.p.locator('[data-go="start"]'));
      await A.p.fill('input[name="lname"]', 'Work');
      await A.p.fill('input[name="nick"]', 'Jo');
      await H.tap(A.p, A.p.locator('#f .btn.go'));
      await expect(A.p.locator('.daybar')).toHaveCount(1);
      await signIn(A, 'jo');
      await go(B, 'board.html');
      await H.tap(B.p, B.p.locator('[data-go="start"]'));
      await B.p.fill('input[name="lname"]', 'Family');
      await B.p.fill('input[name="nick"]', 'Alec');
      await H.tap(B.p, B.p.locator('#f .btn.go'));
      await expect(B.p.locator('.daybar')).toHaveCount(1);
      const mine = (await store(B, 'noodle-board-v1')).pid;
      await signIn(B, 'jo');
      await expect.poll(async () => !!(await store(B, 'noodle-board-v1')).pend, { timeout: 10000 }).toBe(true);
      expect((await store(B, 'noodle-board-v1')).pid, 'still this browser’s own player until it chooses').toBe(mine);
      const jo = (await store(A, 'noodle-board-v1')).pid;
      expect((await held(dbs.sync, 'jo@example.test'))['noodle-board-v1'].pid, 'the account keeps its player meanwhile').toBe(jo);
      await expect(B.p.locator('#app')).toContainText('Jo', { timeout: 10000 });
    } finally { await A.ctx.close(); await B.ctx.close(); }
  });

  test('SYNC-WEB-07: sign out keeps the account’s copy; Delete my synced copy removes it; results stay here', async ({ browser }) => {
    const D = await device(browser, dbs, 'alec');
    try {
      await solveMini(D, MINI18);
      await signIn(D, 'alec');
      await expect.poll(async () => Object.keys((await held(dbs.sync, 'alec@example.test')) || {}).length).toBeGreaterThan(0);
      await H.tap(D.p, card(D).locator('[data-sync="out"]'));
      await expect(D.p.locator('#dnsyncEmail')).toBeVisible();
      expect(await store(D, 'noodle-sync-auth')).toBeNull();
      expect(Object.keys(await held(dbs.sync, 'alec@example.test'))).toContain('digi-mini-v1');

      await signIn(D, 'alec');
      await H.tap(D.p, card(D).locator('[data-sync="forget"]'));
      await expect(D.p.locator('#dnsyncMsg')).toHaveText('Your synced copy is deleted.');
      await expect(D.p.locator('#dnsyncEmail')).toBeVisible();
      expect(await held(dbs.sync, 'alec@example.test')).toEqual({});
      expect(await doneIds(D)).toEqual(['DP·MINI·0099']);
      expect(D.p.errs).toEqual([]);
    } finally { await D.ctx.close(); }
  });

  test('SYNC-WEB-08: a puzzle page opened straight from a link continues the streak from a day played elsewhere', async ({ browser }) => {
    // Borders keeps its streak inside its save, with no list of days: only the account's
    // copy, pulled before the round ends, can tell this browser about yesterday.
    test.setTimeout(240000);
    const B17 = 'reports/2026-10-17-geo-borders-0013.html', B18 = 'reports/2026-10-18-geo-borders-0014.html';
    const A = await device(browser, dbs, 'yesterday', { time: '2026-10-17T19:00:00+01:00' }), B = await device(browser, dbs, 'today');
    try {
      await signIn(A, 'alec');
      await go(A, B17); await play.borders(A.p);
      await expect.poll(async () => ((await held(dbs.sync, 'alec@example.test')) || {})['digi-borders-v1']?.streak?.last, { timeout: 15000 }).toBe('2026-10-17');
      // Today, another browser that signed in before opens today's Borders straight from a link.
      await signIn(B, 'alec');
      await B.p.evaluate(() => localStorage.removeItem('digi-borders-v1'));
      await go(B, B18); await settled(B); await play.borders(B.p);
      await expect.poll(async () => (await store(B, 'digi-borders-v1'))?.streak?.n, { timeout: 15000 }).toBe(2);
      await expect.poll(async () => (await held(dbs.sync, 'alec@example.test'))['digi-borders-v1'].streak.n, { timeout: 15000 }).toBe(2);
      expect(A.p.errs.concat(B.p.errs)).toEqual([]);
    } finally { await A.ctx.close(); await B.ctx.close(); }
  });
});
