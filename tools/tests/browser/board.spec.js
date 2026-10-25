'use strict';
// Leaderboard, end to end (20 Oct 2026): two phones join one league, both
// finish the same Mini, and each sees both results ranked on board.html.
//
// Never touches the live database. Each test gets its own throwaway PGlite
// database built from the real checked-in migrations (tools/tests/board-db.js,
// shared with backend.test.js), and the pages' PostgREST calls
// (/rest/v1/rpc/board_*) are answered from it. Supabase is only reachable by
// the harness's unresolvable names (*.supabase.invalid; Chromium can't resolve
// *.supabase.co either), tracker events go to the harness's capture, and the
// database is closed (discarded) when the test ends, pass or fail.
const { test, expect, H } = require('./support');
const play = require('../play');
const { boardDb, rpc } = require('../board-db');

const DAY = '2026-10-18', TIME = '2026-10-18T14:30:00+01:00';
const MINI = 'reports/2026-10-18-crossword-mini-0099.html';
const SITE = 'https://dailynoodle.co.uk/';

/* A phone whose Supabase calls go to `db`: board RPCs are answered by the real
   SQL functions; anything else (the tracker's log_events) falls through to the
   harness, which captures it in `events` and answers 204. */
async function phone(browser, db, name) {
  const events = [], calls = [], hosts = [];
  const ctx = await H.newPhone(browser, { events });
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
  p.on('dialog', d => d.accept());   // Leave asks confirm()
  await p.clock.install({ time: new Date(TIME) });
  return { name, ctx, p, events, calls, hosts };
}
const go = async (P, path) => { await P.p.goto(SITE + path); await H.wait(P.p, 800); };
const submits = P => P.calls.filter(c => c.fn === 'board_submit');
/* the board as a player sees it: [rank, nickname, result] for each finisher */
const rows = p => p.locator('ol.rows li.row').evaluateAll(ls => ls.map(l => [l.querySelector('.rk').textContent.trim(),
  l.querySelector('.who').firstChild.textContent.trim(), l.querySelector('.res').firstChild.textContent.trim()]));
const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const q = async (db, sql, args = []) => (await db.query(sql, args)).rows;

/* Finish the Mini through its real controls (the puzzle suite's driver);
   `pause` seconds on the clock after the first letter make the times differ. */
async function finishMini(P, pause) {
  await go(P, MINI);
  await play.start(P.p);
  const pz = await P.p.evaluate(() => window.DN_PUZZLE);
  const first = pz.grid.flat().findIndex(ch => ch !== '#');
  await H.tap(P.p, P.p.locator('#grid .cell').nth(first)); await H.wait(P.p, 200);
  await P.p.keyboard.press(pz.grid.flat()[first].toLowerCase());
  await H.wait(P.p, pause * 1000);
  await play.grid(P.p);
  await expect(P.p.locator('#winModal.on')).toHaveCount(1);
  const end = P.events.filter(e => e.ev === 'puzzle_end');
  expect(end.length, P.name + ': the tracker read one finish').toBe(1);
  return end[0].x.secs;
}

test.describe('BOARD-E2E', () => {
  let db;
  test.beforeEach(async () => { db = await boardDb({ today: DAY }); });
  test.afterEach(async () => { await db.close(); db = null; });

  test('BOARD-E2E-01: create, invite, join, both finish the Mini, both boards rank it; replay, leave and rejoin', async ({ browser }) => {
    test.setTimeout(90000);
    const A = await phone(browser, db, 'A'), B = await phone(browser, db, 'B');
    try {
      // 1. A starts a league and shares its invite link.
      await go(A, 'board.html');
      await H.tap(A.p, A.p.locator('[data-go="start"]'));
      await A.p.fill('input[name="lname"]', 'Noodle Testers');
      await A.p.fill('input[name="nick"]', 'Ada');
      await H.tap(A.p, A.p.locator('#f .btn.go'));
      await expect(A.p.locator('.bcard h2')).toHaveText('Noodle Testers is ready');
      await H.tap(A.p, A.p.locator('.bcard [data-act="invite"]'));
      const shared = await A.p.evaluate(() => window.__shared);
      expect(shared.length).toBe(1);
      const invite = new URL(shared[0].url);
      expect(invite.origin + invite.pathname).toBe(SITE + 'board.html');
      const code = invite.searchParams.get('join');
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect((await q(db, 'select name, owner is not null as o from board.leagues where code = $1', [code]))).toEqual([{ name: 'Noodle Testers', o: true }]);

      // 2. B opens the invite and joins with a nickname.
      await go(B, invite.pathname.slice(1) + invite.search);
      await expect(B.p.locator('#f h2')).toHaveText('Join Noodle Testers');
      await expect(B.p.locator('#f p').first()).toContainText('1 player so far');
      await B.p.fill('input[name="nick"]', 'Bea');
      await H.tap(B.p, B.p.locator('#f .btn.go'));
      await expect(B.p.locator('.notyet')).toHaveText('Ada, Bea (you)');
      expect(await q(db, `select m.nickname from board.members m join board.leagues l on l.id = m.league_id
                          where l.code = $1 and m.left_at is null order by m.joined_at`, [code])).toEqual([{ nickname: 'Ada' }, { nickname: 'Bea' }]);

      // 3. Both finish today's Mini; dn-board submits each result once, on dn:puzzle_end.
      // Ada finishes first and her result reaches the board before Bea finishes, as on two real phones.
      // (Until 25 Oct 2026 they played at once; when Bea's result happened to land first, her sheet
      // briefly showed her as the league record and the check below failed about half the time.)
      const secsA = await finishMini(A, 0);
      await expect.poll(() => submits(A).filter(s => s.status === 200).length, 'A: result on the board first').toBe(1);
      const secsB = await finishMini(B, 20);
      expect(secsB).toBeGreaterThan(secsA);
      for (const [P, secs] of [[A, secsA], [B, secsB]]) {
        await expect.poll(() => submits(P).length, P.name + ': one board_submit').toBe(1);
        const s = submits(P)[0];
        expect(s.args).toMatchObject({ p_path: MINI, p_outcome: 'solved', p_secs: secs, p_score: null, p_mistakes: null });
        expect(s.status).toBe(200); expect(s.body).toBe(true);
      }
      // Records (25 Oct 2026): the first and fastest Mini in the league is its record; the sheet says so and the share
      // line gains 🏆. Bea's slower Mini is neither a record nor a personal best (her first), so her sheet adds nothing.
      await expect(A.p.locator('.fin-board-slot .nn-moment')).toHaveText('🏆 New league record in Noodle Testers!');
      await expect(A.p.locator('.fin-share-text')).toHaveText(/ 🏆$/);
      await H.wait(B.p, 1500);
      await expect(B.p.locator('.nn-moment')).toHaveCount(0);
      await expect(B.p.locator('.fin-share-text')).not.toHaveText(/🏆/);
      expect(await q(db, 'select ptype, puzzle_date::text d, outcome, secs from board.results order by secs')).toEqual([
        { ptype: 'mini', d: DAY, outcome: 'solved', secs: secsA }, { ptype: 'mini', d: DAY, outcome: 'solved', secs: secsB }]);

      // 4. Each opens the board from the result sheet and sees both rows, faster first.
      const want = [['🥇', 'Ada', mmss(secsA)], ['🥈', 'Bea', mmss(secsB)]];
      for (const P of [A, B]) {
        const link = P.p.locator('.fin-board-slot .nn-board-link');
        await expect(link).toHaveAttribute('href', `../board.html?p=mini&d=${DAY}&from=result`);
        await H.tap(P.p, link); await P.p.waitForURL(/board\.html/); await H.wait(P.p, 800);
        await expect(P.p.locator('ol.rows li.row')).toHaveCount(2);
        expect(await rows(P.p)).toEqual(want);
        await expect(P.p.locator('ol.rows li.row.me .who')).toContainText(P === A ? 'Ada' : 'Bea');
        await expect(P.p.locator('.notyet')).toHaveCount(0);
      }

      // 5. A replay doesn't change the board. Reopening the finished Mini reopens its
      //    result sheet and submits nothing. A real second solve (the Mini's own save
      //    gone, as after cleared site data, while the league membership stays) is
      //    submitted again, slower, and the server keeps the first result.
      await go(A, MINI);
      await expect(A.p.locator('#winModal.fin-open')).toHaveCount(1);
      await H.wait(A.p, 1000);
      expect(submits(A).length, 'reopening a finished Mini submits nothing').toBe(1);
      await A.p.evaluate(() => { localStorage.removeItem('digi-mini-v1'); localStorage.removeItem('digi-mini-streak'); });
      expect(A.events.filter(e => e.ev === 'board_create').length).toBe(1);
      A.events.length = 0;
      const again = await finishMini(A, 40);
      expect(again).toBeGreaterThan(secsA);
      await expect.poll(() => submits(A).length, 'the second solve is submitted').toBe(2);
      expect(submits(A)[1]).toMatchObject({ args: { p_path: MINI, p_secs: again }, status: 200, body: false });
      expect(await q(db, 'select secs from board.results order by secs')).toEqual([{ secs: secsA }, { secs: secsB }]);
      await go(A, `board.html?p=mini&d=${DAY}`);
      await expect(A.p.locator('ol.rows li.row')).toHaveCount(2);
      expect(await rows(A.p)).toEqual(want);

      // 6. B leaves: B's row is hidden from the board, not deleted.
      await go(B, `board.html?p=mini&d=${DAY}`);
      await B.p.locator('details.set summary').click();
      await H.tap(B.p, B.p.locator('[data-act="leave"]'));
      await expect(B.p.locator('[data-go="start"]')).toHaveCount(1);   // back to the intro: in no league
      expect(await q(db, `select m.left_at is not null as gone, m.left_by, m.left_nick, r.secs from board.members m
                          join board.results r using (player) where m.left_nick = 'Bea'`)).toEqual([{ gone: true, left_by: 'self', left_nick: 'Bea', secs: secsB }]);
      await go(A, `board.html?p=mini&d=${DAY}`);
      await expect(A.p.locator('ol.rows li.row')).toHaveCount(1);
      expect(await rows(A.p)).toEqual([want[0]]);

      // 7. B rejoins from the same link: the row and the result come back.
      await go(B, invite.pathname.slice(1) + invite.search);
      await B.p.fill('input[name="nick"]', 'Bea');
      await H.tap(B.p, B.p.locator('#f .btn.go'));
      await expect(B.p.locator('.daybar')).toHaveCount(1);
      await go(B, `board.html?p=mini&d=${DAY}`);   // a board opened with no puzzle shows All puzzles since 24 Oct 2026
      await expect(B.p.locator('ol.rows li.row')).toHaveCount(2);
      expect(await rows(B.p)).toEqual(want);
      await go(A, `board.html?p=mini&d=${DAY}`);
      await expect(A.p.locator('ol.rows li.row')).toHaveCount(2);
      expect(await rows(A.p)).toEqual(want);
      expect((await q(db, 'select count(*)::int n from board.members'))[0].n).toBe(2);
      expect((await q(db, 'select count(*)::int n from board.results'))[0].n).toBe(2);

      // Nothing left the machine: Supabase only by the unresolvable name, events captured.
      for (const P of [A, B]) {
        expect(P.hosts.length).toBeGreaterThan(0);
        expect(P.hosts.filter(h => !h.endsWith('.supabase.invalid')), P.name + ': calls to a live Supabase name').toEqual([]);
        expect(P.calls.filter(c => c.status !== 200), P.name + ': failed board calls').toEqual([]);
        expect(P.events.some(e => e.ev === 'puzzle_end')).toBe(true);
        expect(P.p.errs, P.name + ': page errors').toEqual([]);
      }
      expect(B.events.filter(e => e.ev === 'board_join').map(e => e.x.via)).toEqual(['link', 'link']);
    } finally {
      await A.ctx.close(); await B.ctx.close();
    }
  });

  test('BOARD-REC-E2E: Records tab, honours, a player card, the record line and last week’s crown', async ({ browser }) => {
    test.setTimeout(60000);
    const A = await phone(browser, db, 'A');
    try {
      await go(A, 'board.html');
      await H.tap(A.p, A.p.locator('[data-go="start"]'));
      await A.p.fill('input[name="lname"]', 'Recs');
      await A.p.fill('input[name="nick"]', 'Ada');
      await H.tap(A.p, A.p.locator('#f .btn.go'));
      await expect(A.p.locator('.bcard h2')).toHaveText('Recs is ready');
      const code = (await q(db, 'select code from board.leagues'))[0].code;
      const bea = '00000000-0000-4000-8000-0000000000be';
      expect((await rpc(db, 'board_join', JSON.stringify({ p_player: bea, p_code: code, p_nick: 'Bea' }))).status).toBe(200);
      const ada = (await q(db, "select player from board.members where nickname = 'Ada'"))[0].player;
      // last week (Mon 5 to Sun 11 Oct): Bea wins both Minis; this week Ada sets the Mini record today
      const res = [[bea, '2026-10-07', 40], [ada, '2026-10-07', 55], [bea, '2026-10-08', 38], [ada, '2026-10-08', 60],
                   [ada, '2026-10-18', 30], [bea, '2026-10-18', 45]];
      for (const [who, d, secs] of res) await q(db, `insert into board.results (player, puzzle_path, ptype, puzzle_date, outcome, secs)
        values ($1, $2, 'mini', $3, 'solved', $4)`, [who, `reports/${d}-crossword-mini-0${d.slice(8)}.html`, d, secs]);
      // DAY is Sun 18 Oct, so last week is Mon 5 to Sun 11 Oct: Bea's
      await go(A, 'board.html?p=records');
      await expect(A.p.locator('.chip[data-p="records"]')).toHaveAttribute('aria-pressed', 'true');
      const recRow = A.p.locator('ol.rows').first().locator('li.row');
      await expect(recRow).toHaveCount(1);
      await expect(recRow).toContainText('Mini'); await expect(recRow).toContainText('Ada'); await expect(recRow).toContainText('0:30');
      await expect(recRow).toContainText('🏆 today');
      const honours = A.p.locator('ol.rows').nth(1);
      await expect(honours.locator('li', { hasText: 'Daily wins' })).toContainText('Bea');
      await expect(honours.locator('li', { hasText: 'Daily wins' }).locator('.res')).toHaveText('2');
      await expect(honours.locator('li', { hasText: 'Weekly titles' })).toContainText('Bea');
      await expect(A.p.locator('.crown')).not.toHaveCount(0);   // 👑 next to Bea, last week's champion
      // a player card from a tapped name, and back
      await H.tap(A.p, A.p.locator('ol.rows').nth(2).locator('.nk', { hasText: 'Bea' }));
      await expect(A.p.locator('.bcard h2')).toContainText('Bea 👑');
      await expect(A.p.locator('.hgrid')).toContainText('Daily wins');
      await expect(A.p.locator('.bcard ol.rows li', { hasText: 'Mini' }).locator('.res')).toContainText('0:38');
      await H.tap(A.p, A.p.locator('[data-act="cardback"]'));
      await expect(A.p.locator('.hgrid')).toHaveCount(0);
      // the Mini's daily board: the record line, the trophy on today's record row and the crown by Bea
      await go(A, `board.html?p=mini&d=${DAY}`);
      await expect(A.p.locator('.reline')).toContainText('League record 0:30 · Ada');
      await expect(A.p.locator('li.row', { hasText: 'Ada' })).toContainText('🏆 New league record');
      await expect(A.p.locator('li.row', { hasText: 'Bea' }).locator('.crown')).toHaveCount(1);
      expect(A.calls.filter(c => c.status !== 200), 'failed board calls').toEqual([]);
      expect(A.p.errs, 'page errors').toEqual([]);
    } finally { await A.ctx.close(); }
  });

  test('BOARD-REC-STALE: with an older cached dn-board.js (no records), every board still loads', async ({ browser }) => {
    test.setTimeout(60000);
    const A = await phone(browser, db, 'A');
    try {
      const fs = require('node:fs'), path = require('node:path');
      const old = fs.readFileSync(path.join(__dirname, '../../../dn-board.js'), 'utf8').replace('records: records, moment: moment,', '');
      expect(old).not.toContain('records: records');
      await A.ctx.route(u => u.pathname.endsWith('/dn-board.js'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: old }));
      await go(A, 'board.html');
      await H.tap(A.p, A.p.locator('[data-go="start"]'));
      await A.p.fill('input[name="lname"]', 'Stale');
      await A.p.fill('input[name="nick"]', 'Ada');
      await H.tap(A.p, A.p.locator('#f .btn.go'));
      for (const p of ['all', 'mini', 'link']) {
        await go(A, `board.html?p=${p}&d=${DAY}`);
        await expect(A.p.locator('.daybar')).toHaveCount(1);
        await expect(A.p.locator('.loading')).toHaveCount(0);
      }
      await go(A, 'board.html?p=records');
      await expect(A.p.locator('.loading')).toHaveCount(0);
      await expect(A.p.locator('.nobody')).toContainText('Couldn’t load');   // the Records tab says so instead of hanging
      expect(A.p.errs, 'page errors').toEqual([]);
    } finally { await A.ctx.close(); }
  });
});
