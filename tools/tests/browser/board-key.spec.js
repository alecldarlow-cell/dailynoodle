'use strict';
// Your leagues somewhere else (21 Oct 2026). On an iPhone, Safari, the
// home-screen app and the browser inside WhatsApp each keep their own storage,
// so a player who joined from a link tapped in WhatsApp and then played in
// Safari was in no league there: after their first puzzle nothing reached the
// board. The board page now gives each player a personal link (dn-board.js
// moveLink) that dn-track.js unpacks wherever it is opened.
//
// Each phone here is a separate browser context, i.e. a separate storage, just
// as the iPhone's places are. Same rules as board.spec.js: a throwaway PGlite
// database from the checked-in migrations, never the live one.
const { test, expect, H } = require('./support');
const play = require('../play');
const { boardDb, rpc } = require('../board-db');

const DAY = '2026-10-18', TIME = '2026-10-18T14:30:00+01:00';
const MINI18 = 'reports/2026-10-18-crossword-mini-0099.html';
const MINI17 = 'reports/2026-10-17-crossword-mini-0098.html';
const MINI16 = 'reports/2026-10-16-crossword-mini-0097.html';
const SITE = 'https://dailynoodle.co.uk/';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1';
async function phone(browser, db, name, { ios = false } = {}) {
  const events = [], calls = [], hosts = [];
  const ctx = await H.newPhone(browser, { events });
  // In Chromium the page can still be told it's on an iPhone, for the iPhone-only wording.
  if (ios) await ctx.addInitScript(ua => { Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => ua, configurable: true }); }, IPHONE_UA);
  await ctx.addInitScript(() => { window.__shared = []; navigator.share = d => { window.__shared.push(d); return Promise.resolve(); }; });
  ctx.on('request', r => { const u = new URL(r.url()); if (/supabase/.test(u.hostname)) hosts.push(u.hostname); });
  await ctx.route(u => H.isSupabase(u.hostname) && /^\/rest\/v1\/rpc\/(board|admin)_/.test(u.pathname), async route => {
    const req = route.request(), fn = new URL(req.url()).pathname.split('/').pop();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
    const h = req.headers(), res = await rpc(db, fn, req.postData(), { apikey: h.apikey, ...(h.authorization ? { authorization: h.authorization } : {}) });
    calls.push({ fn, args: JSON.parse(req.postData() || '{}'), status: res.status, body: res.body });
    return route.fulfill({ status: res.status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(res.body) });
  });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date(TIME) });
  return { name, ctx, p, events, calls, hosts };
}
const go = async (P, path) => { await P.p.goto(SITE + path); await H.wait(P.p, 800); };
const submits = P => P.calls.filter(c => c.fn === 'board_submit');
const q = async (db, sql, args = []) => (await db.query(sql, args)).rows;
const nicks = async (db, sql) => (await q(db, sql)).map(r => r.nickname);

/* Finish a Mini through its real controls. */
async function solveMini(P, path) {
  await go(P, path);
  await play.start(P.p);
  const pz = await P.p.evaluate(() => window.DN_PUZZLE);
  const first = pz.grid.flat().findIndex(ch => ch !== '#');
  await H.tap(P.p, P.p.locator('#grid .cell').nth(first)); await H.wait(P.p, 200);
  await P.p.keyboard.press(pz.grid.flat()[first].toLowerCase());
  await play.grid(P.p);
  await expect(P.p.locator('#winModal.on')).toHaveCount(1);
}
async function join(P, invite, nick) {
  await go(P, invite.pathname.slice(1) + invite.search);
  await P.p.fill('input[name="nick"]', nick);
  await H.tap(P.p, P.p.locator('#f .btn.go'));
  await expect(P.p.locator('.daybar')).toHaveCount(1);
}
/* the link a player gets from League settings › Send me my link */
async function myLink(P) {
  await go(P, `board.html?p=mini&d=${DAY}`);
  await P.p.locator('details.set summary').click();
  const before = (await P.p.evaluate(() => window.__shared)).length;
  await H.tap(P.p, P.p.locator('#keygrp [data-act="key"]'));
  const shared = await P.p.evaluate(() => window.__shared);
  expect(shared.length).toBe(before + 1);
  const u = shared[shared.length - 1].url;
  expect(u.startsWith(SITE + 'board.html#dnmove=')).toBe(true);
  return u;
}
const doneIds = P => P.p.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('digi-mini-v1') || '{}').done) || {}).sort());
const boardPid = P => P.p.evaluate(() => (JSON.parse(localStorage.getItem('noodle-board-v1') || '{}')).pid);

test.describe('BOARD-KEY', () => {
  let db;
  test.beforeEach(async () => { db = await boardDb({ today: DAY }); });
  test.afterEach(async () => { await db.close(); db = null; });

  test('BOARD-KEY-01: joined in one place, played in another: the link brings leagues and saves, and results reach the board', async ({ browser }) => {
    test.setTimeout(150000);
    const O = await phone(browser, db, 'owner'), W = await phone(browser, db, 'whatsapp', { ios: true }), S = await phone(browser, db, 'safari', { ios: true });
    try {
      // The owner starts a league and shares its invite.
      await go(O, 'board.html');
      await H.tap(O.p, O.p.locator('[data-go="start"]'));
      await O.p.fill('input[name="lname"]', 'Family');
      await O.p.fill('input[name="nick"]', 'Alec');
      await H.tap(O.p, O.p.locator('#f .btn.go'));
      await H.tap(O.p, O.p.locator('.bcard [data-act="invite"]'));
      const invite = new URL((await O.p.evaluate(() => window.__shared))[0].url);

      // "Safari" has been playing for a while: the 17 Oct Mini is finished there. It's in no league.
      await solveMini(S, MINI17);
      expect(submits(S), 'not in a league: nothing submitted').toEqual([]);

      // The invite opens in WhatsApp's own browser: Jake joins there and plays one puzzle.
      // On an iPhone the join form and the "You're in" card say where to join and offer the link at once.
      await go(W, invite.pathname.slice(1) + invite.search);
      await expect(W.p.locator('#f .tip')).toContainText('open it in Safari');
      await join(W, invite, 'Jake');
      await expect(W.p.locator('.bcard [data-act="key"]')).toHaveCount(1);
      await solveMini(W, MINI18);
      await expect.poll(() => submits(W).length).toBe(1);
      const jake = await boardPid(W);

      // Jake sends himself his link and opens it in Safari.
      const key = await myLink(W);
      expect(key.length, 'a link, not a novel').toBeLessThan(8000);
      await S.p.goto(key);
      await S.p.waitForURL(u => !u.hash, { timeout: 10000 });   // unpacked, fragment gone, page reloaded
      await H.wait(S.p, 1200);
      expect(new URL(S.p.url()).hash).toBe('');
      await expect(S.p.locator('.bcard h2').first()).toHaveText('Your leagues are here now');
      await expect(S.p.locator('.bcard').first()).toContainText('as Jake');
      expect(await boardPid(S), 'Safari now plays as Jake').toBe(jake);

      // Both Minis are now finished in Safari: its own 17th and the 18th from WhatsApp.
      expect(await doneIds(S)).toEqual(['DP·MINI·0098', 'DP·MINI·0099']);
      // Safari's earlier 17 Oct result was copied onto the board as Jake's (history copy from its saves).
      await expect.poll(async () => (await q(db, `select puzzle_date::text d from board.results r
        join board.members m using (player) where m.nickname = 'Jake' order by 1`)).map(r => r.d))
        .toEqual(['2026-10-17', '2026-10-18']);

      // And a puzzle finished in Safari from now on goes on the board as Jake.
      await solveMini(S, MINI16);
      await expect.poll(() => submits(S).length).toBe(1);
      expect(submits(S)[0]).toMatchObject({ args: { p_player: jake, p_path: MINI16 }, status: 200 });
      expect(await nicks(db, 'select nickname from board.members where left_at is null order by joined_at')).toEqual(['Alec', 'Jake']);

      // The reopened 18th shows as already finished in Safari, and submits nothing more.
      await go(S, MINI18);
      await expect(S.p.locator('#winModal.fin-open')).toHaveCount(1);
      await H.wait(S.p, 800);
      expect(submits(S).length).toBe(1);

      expect(S.events.filter(e => e.ev === 'board_key').map(e => e.x.act)).toEqual(['open']);
      expect(W.events.filter(e => e.ev === 'board_key').map(e => e.x.act)).toEqual(['send']);
      for (const P of [O, W, S]) {
        expect(P.hosts.filter(h => !h.endsWith('.supabase.invalid')), P.name + ': calls to a live Supabase name').toEqual([]);
        expect(P.calls.filter(c => c.status !== 200), P.name + ': failed board calls').toEqual([]);
        expect(P.p.errs, P.name + ': page errors').toEqual([]);
      }
    } finally {
      await O.ctx.close(); await W.ctx.close(); await S.ctx.close();
    }
  });

  test('BOARD-KEY-02: pasted into a browser with no address bar; a browser already in a league as someone else asks first', async ({ browser }) => {
    test.setTimeout(120000);
    const O = await phone(browser, db, 'owner'), W = await phone(browser, db, 'whatsapp'),
          A = await phone(browser, db, 'app'), T = await phone(browser, db, 'thea');
    try {
      await go(O, 'board.html');
      await H.tap(O.p, O.p.locator('[data-go="start"]'));
      await O.p.fill('input[name="lname"]', 'Family');
      await O.p.fill('input[name="nick"]', 'Alec');
      await H.tap(O.p, O.p.locator('#f .btn.go'));
      await H.tap(O.p, O.p.locator('.bcard [data-act="invite"]'));
      const invite = new URL((await O.p.evaluate(() => window.__shared))[0].url);
      await join(W, invite, 'Jake');
      const key = await myLink(W), jake = await boardPid(W);

      // The home-screen app: no address bar, so the link is pasted on the intro screen.
      await go(A, 'board.html');
      await H.tap(A.p, A.p.locator('[data-go="paste"]'));
      await A.p.fill('input[name="key"]', 'not my link');
      await H.tap(A.p, A.p.locator('#f .btn.go'));
      await expect(A.p.locator('#m')).toContainText('doesn’t look like your link');
      await A.p.fill('input[name="key"]', '  ' + key + '\n');
      await H.tap(A.p, A.p.locator('#f .btn.go'));
      await expect(A.p.locator('.bcard h2').first()).toHaveText('Your leagues are here now', { timeout: 10000 });
      expect(await boardPid(A)).toBe(jake);
      expect(A.events.filter(e => e.ev === 'board_key').map(e => e.x.act)).toEqual(['paste', 'open']);

      // Thea's phone is already in the league as Thea. Opening Jake's link must not silently make her Jake.
      // (Not an iPhone here, unless the run is WebKit's: no iPhone wording.)
      const ios = await T.p.evaluate(() => /iPhone|iPad|iPod/.test(navigator.userAgent));
      await go(T, invite.pathname.slice(1) + invite.search);
      await expect(T.p.locator('#f .tip')).toHaveCount(ios ? 1 : 0);
      await join(T, invite, 'Thea');
      await expect(T.p.locator('.bcard [data-act="key"]')).toHaveCount(ios ? 1 : 0);
      const thea = await boardPid(T);
      await T.p.goto(key); await T.p.waitForURL(u => !u.hash, { timeout: 10000 }); await H.wait(T.p, 1200);
      await expect(T.p.locator('.bcard h2')).toHaveText('Which leagues should this browser use?');
      await expect(T.p.locator('.bcard')).toContainText('Family as Thea');
      await expect(T.p.locator('.bcard')).toContainText('Family as Jake');
      await H.tap(T.p, T.p.locator('[data-pend="keep"]'));
      await expect(T.p.locator('.daybar')).toHaveCount(1);
      expect(await boardPid(T)).toBe(thea);
      await go(T, `board.html?p=mini&d=${DAY}`);   // the question doesn't come back
      await expect(T.p.locator('.daybar')).toHaveCount(1);

      // Asked again, she takes the link this time.
      await T.p.goto(key); await T.p.waitForURL(u => !u.hash, { timeout: 10000 }); await H.wait(T.p, 1200);
      await H.tap(T.p, T.p.locator('[data-pend="take"]'));
      await expect(T.p.locator('.bcard h2').first()).toHaveText('Your leagues are here now');
      expect(await boardPid(T)).toBe(jake);
      await expect(T.p.locator('.notyet')).toContainText('Jake (you)');

      for (const P of [O, W, A, T]) {
        expect(P.hosts.filter(h => !h.endsWith('.supabase.invalid')), P.name + ': calls to a live Supabase name').toEqual([]);
        expect(P.calls.filter(c => c.status !== 200), P.name + ': failed board calls').toEqual([]);
        expect(P.p.errs, P.name + ': page errors').toEqual([]);
      }
    } finally {
      for (const P of [O, W, A, T]) await P.ctx.close();
    }
  });
});
