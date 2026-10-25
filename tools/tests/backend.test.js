'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boardDb } = require('./board-db');
const { PGlite } = require('@electric-sql/pglite');   // the admin cases build their own database
const fs = require('node:fs'), path = require('node:path');

// Disposable PostgreSQL (WASM), with the actual checked-in board migrations
// (tools/tests/board-db.js, shared with browser/board.spec.js).
// Only the hosting-provided auth/insights/events interfaces are stubbed.
// No URLs, credentials, production connection or network are used.
test('BOARD-01/02: migrations, permissions, first results, history and hide-only actions', async t => {
  const db = await boardDb();
  t.after(() => db.close());
  const owner = '00000000-0000-4000-8000-000000000001', member = '00000000-0000-4000-8000-000000000002', outsider = '00000000-0000-4000-8000-000000000003';
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const rpc = async (name, args) => (await q(`select public.${name}(${args.map((_, i) => '$'+(i+1)).join(',')}) as value`, args))[0].value;
  const rejects = (fn, message) => assert.rejects(fn, new RegExp(message));
  const day = (await q('select board.today()::text as value'))[0].value;
  const prev = (await q("select (board.today()-1)::text as value"))[0].value;
  await db.exec('set role anon');
  await t.test('private tables cannot be read directly', async () => {
    await rejects(() => q('select * from board.results'), 'permission denied');
  });
  const a = await rpc('board_create', [owner, 'Test league A', 'Owner']);
  const b = await rpc('board_create', [outsider, 'Test league B', 'Other']);
  const code = a.code;
  await rpc('board_join', [member, code, 'Member']);
  await t.test('outsider cannot read another league or rename it', async () => {
    await rejects(() => rpc('board_day', [outsider, code, 'mini', day]), 'not_member');
    await rejects(() => rpc('board_rename', [member, code, 'Stolen']), 'not_owner');
    await rejects(() => rpc('admin_board', ['list']), 'not_admin');
  });
  const file = 'reports/'+day+'-crossword-mini-0099.html';
  await t.test('first result is immutable on repeats', async () => {
    await rpc('board_submit', [member, file, 'solved', 42, null, null]);
    await rpc('board_submit', [member, file, 'solved', 4, null, null]);
    await db.exec('reset role');
    const rows = await q('select secs from board.results where player=$1', [member]);
    assert.deepEqual(rows, [{ secs: 42 }]);
    await db.exec('set role anon');
  });
  await t.test('bad path/type/outcome is rejected and another league stays isolated', async () => {
    await rejects(() => rpc('board_submit', [member, '../admin.html', 'solved', 3, null, null]), 'bad_');
    const board = await rpc('board_day', [outsider, b.code, 'mini', day]);
    assert.ok(!JSON.stringify(board).includes('Member'));
  });
  await t.test('leave/rejoin hides membership and preserves results', async () => {
    await rpc('board_leave', [member, code]);
    await rejects(() => rpc('board_day', [member, code, 'mini', day]), 'not_member');
    await db.exec('reset role');
    assert.equal((await q('select count(*)::int n from board.results where player=$1', [member]))[0].n, 1);
    assert.equal((await q('select count(*)::int n from board.members where player=$1 and left_at is not null', [member]))[0].n, 1);
    await db.exec('set role anon');
    await rpc('board_join', [member, code, 'Member']);
    assert.match(JSON.stringify(await rpc('board_day', [member, code, 'mini', day])), /42/);
  });
  await t.test('backfill is idempotent', async () => {
    const rows = [{path: file, outcome:'solved', secs:2}, {path:'reports/'+prev+'-crossword-mini-0098.html',outcome:'solved',secs:60}];
    await rpc('board_backfill', [member, null, JSON.stringify(rows)]);
    await rpc('board_backfill', [member, null, JSON.stringify(rows)]);
    await db.exec('reset role');
    assert.equal((await q('select count(*)::int n from board.results where player=$1', [member]))[0].n, 2);
    assert.equal((await q('select secs from board.results where player=$1 and puzzle_path=$2', [member,file]))[0].secs,42);
    await db.exec('set role anon');
  });
  await t.test('old tracker events backfill the earliest result only', async () => {
    const aid='00000000-0000-4000-8000-000000000004', oldFile='reports/'+prev+'-crossword-mini-0097.html';
    await db.exec('reset role');
    for (const [secs,when] of [[30,'2026-01-01T00:00:00Z'],[10,'2026-01-02T00:00:00Z']])
      await q("insert into public.events values ($1,'puzzle_end',$2,$3::jsonb,$4::timestamptz)",[aid,oldFile,JSON.stringify({outcome:'solved',secs}),when]);
    await db.exec('set role anon');
    assert.equal(await rpc('board_backfill',[member,aid,'[]']),1);
    assert.equal(await rpc('board_backfill',[member,aid,'[]']),0);
    await db.exec('reset role');
    assert.equal((await q('select secs from board.results where player=$1 and puzzle_path=$2',[member,oldFile]))[0].secs,30);
    await db.exec('set role anon');
  });
  await t.test('RLS still hides real rows after an accidental SELECT grant', async () => {
    await db.exec('reset role; grant usage on schema board to anon, authenticated; grant select on board.results to anon, authenticated; set role anon');
    assert.equal((await q('select count(*)::int n from board.results'))[0].n,0);
    await db.exec('reset role; set role authenticated');
    assert.equal((await q('select count(*)::int n from board.results'))[0].n,0);
    await db.exec('reset role; revoke usage on schema board from anon, authenticated; revoke select on board.results from anon, authenticated; set role anon');
  });
  await t.test('authenticated admin identity is checked by the real function', async () => {
    await db.exec("reset role; insert into insights.admins values ('developer@example.test'); set role authenticated");
    await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({email:'developer@example.test'})]);
    await rpc('admin_board',['rename',b.code,'Renamed league']);
    assert.equal((await rpc('board_peek',[b.code])).name,'Renamed league');
    await q("select set_config('request.jwt.claims','{}',false)");
    await db.exec('reset role; set role anon');
  });
  await t.test('owner removal and close preserve rows', async () => {
    await rpc('board_remove', [owner, code, 'Member']);
    await rpc('board_close', [owner, code]);
    await db.exec('reset role');
    assert.equal((await q('select count(*)::int n from board.results where player=$1', [member]))[0].n, 3);
    assert.equal((await q('select count(*)::int n from board.leagues where code=$1 and closed_at is not null', [code]))[0].n, 1);
  });
  await t.test('RECKON-BOARD: Reckon is a scored round out of 1,000, equal scores ranked by time', async () => {
    // last, in league B, so the cases above keep their counts
    await db.exec('set role anon');
    await rpc('board_join', [member, b.code, 'Second']);
    const rk = 'reports/'+day+'-quiz-reckon-0001.html';
    await rejects(() => rpc('board_submit', [outsider, rk, 'solved', 90, 700, null]), 'bad_result');
    await rejects(() => rpc('board_submit', [outsider, rk, 'scored', 90, 1001, null]), 'bad_result');
    await rejects(() => rpc('board_submit', [outsider, rk, 'scored', 90, null, null]), 'bad_result');
    assert.equal(await rpc('board_submit', [outsider, rk, 'scored', 130, 800, null]), true);
    assert.equal(await rpc('board_submit', [member, rk, 'scored', 95, 800, null]), true);
    const board = await rpc('board_day', [outsider, b.code, 'reckon', day]);
    assert.deepEqual(board.ranked.map(r => [r.rank, r.nick, r.score, r.secs]), [[1, 'Second', 800, 95], [2, 'Other', 800, 130]]);
    await rejects(() => rpc('board_day', [outsider, b.code, 'ballpark', day]), 'bad_type');
  });
});

// BOARD-PIN / BOARD-ALL (24 Oct 2026): rejoining from another browser with a PIN, the owner's
// "Let back in", the attempt limits, and the all-puzzles table's points.
test('BOARD-PIN-01..04 and BOARD-ALL-01: PIN rejoin, lockout, owner let-back, and the all-puzzles table', async t => {
  const db = await boardDb({ today: '2026-10-21' });   // a Wednesday: its week is Mon 19 to Sun 25 Oct
  t.after(() => db.close());
  const [ada, bob, cy] = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c3'];
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const rpc = async (name, args) => (await q(`select public.${name}(${args.map((_, i) => '$'+(i+1)).join(',')}) as value`, args))[0].value;
  const rejects = (fn, message) => assert.rejects(fn, new RegExp(message));
  await db.exec('set role anon');
  const { code } = await rpc('board_create', [ada, 'Family', 'Ada']);
  await rpc('board_join', [bob, code, 'Bob']);
  await rpc('board_join', [cy, code, 'Cy']);

  await t.test('BOARD-PIN-01: a PIN is set by its holder only, stored hashed, and shown as a flag', async () => {
    await rejects(() => rpc('board_pin_set', ['00000000-0000-4000-8000-0000000000ff', '1234']), 'not_member');
    await rejects(() => rpc('board_pin_set', [bob, '12a4']), 'bad_pin_format');
    await rejects(() => rpc('board_pin_set', [bob, '12345']), 'bad_pin_format');
    assert.equal((await rpc('board_mine', [bob]))[0].pin, false);
    assert.equal(await rpc('board_pin_set', [bob, '2468']), true);
    assert.equal((await rpc('board_mine', [bob]))[0].pin, true);
    await db.exec('reset role');
    const row = (await q('select * from board.pins where player=$1', [bob]))[0];
    assert.ok(row && !JSON.stringify(row).includes('2468'), 'the PIN is not stored as typed');
    await db.exec('set role anon');
    await rejects(() => q('select * from board.pins'), 'permission denied');
    assert.deepEqual((await rpc('board_peek', [code])).players, ['Ada', 'Bob', 'Cy']);
  });

  await t.test('BOARD-PIN-02: the right nickname and PIN hand this browser the player; wrong ones do not', async () => {
    const ok = await rpc('board_claim', [code.toLowerCase(), ' bob ', '2468']);
    assert.deepEqual(ok, { ok: true, player: bob, code, name: 'Family', nick: 'Bob', needs_pin: false });
    assert.deepEqual(await rpc('board_claim', [code, 'Bob', '1111']), { ok: false, error: 'bad_pin' });
    assert.deepEqual(await rpc('board_claim', [code, 'Nobody', '2468']), { ok: false, error: 'no_player' });
    assert.deepEqual(await rpc('board_claim', [code, 'Cy', '2468']), { ok: false, error: 'no_pin' });
    await rejects(() => rpc('board_claim', ['ZZZZZZZZ', 'Bob', '2468']), 'no_league');
  });

  await t.test('BOARD-PIN-03: five wrong PINs lock the player for an hour, even with the right one', async () => {
    for (let i = 0; i < 4; i++) assert.equal((await rpc('board_claim', [code, 'Bob', '0000'])).error, 'bad_pin');   // 5th wrong in all
    assert.equal((await rpc('board_claim', [code, 'Bob', '2468'])).error, 'pin_locked');
    await db.exec('reset role');
    await q("update board.pins set locked_until = now() - interval '1 minute' where player=$1", [bob]);
    await q('delete from board.attempts');   // the per-address limit is checked separately below
    await db.exec('set role anon');
    assert.equal((await rpc('board_claim', [code, 'Bob', '2468'])).ok, true);
    // the per-address limit (10 an hour) stops guessing across players too
    for (let i = 0; i < 9; i++) await rpc('board_claim', [code, 'Cy', '0000']);
    await rejects(() => rpc('board_claim', [code, 'Bob', '2468']), 'busy');
    await db.exec('reset role'); await q('delete from board.attempts'); await db.exec('set role anon');
  });

  await t.test('BOARD-PIN-04: only the owner lets someone back in; it works once, without a PIN, and asks for a new one', async () => {
    assert.equal(await rpc('board_let_back', [ada, code, 'Cy']), true);
    await rejects(() => rpc('board_let_back', [bob, code, 'Cy']), 'not_owner');
    assert.equal(await rpc('board_let_back', [ada, code, 'Nobody']), false);
    const back = await rpc('board_claim', [code, 'cy', '']);
    assert.equal(back.ok, true); assert.equal(back.player, cy); assert.equal(back.needs_pin, true);
    assert.equal((await rpc('board_claim', [code, 'Cy', ''])).error, 'no_pin', 'the window closes after one use');
    await db.exec('reset role'); await q('delete from board.attempts'); await db.exec('set role anon');
  });

  await t.test('BOARD-ALL-01: points per puzzle (1 for completing + 1 per worse completed result), day and week', async () => {
    const f = (d, t) => `reports/2026-10-${d}-${t}.html`;
    // Mon 19: Mini, Ada 50s, Bob 70s, Cy failed
    await rpc('board_submit', [ada, f(19, 'crossword-mini-0100'), 'solved', 50, null, null]);
    await rpc('board_submit', [bob, f(19, 'crossword-mini-0100'), 'solved', 70, null, null]);
    await rpc('board_submit', [cy, f(19, 'crossword-mini-0100'), 'failed', 20, null, null]);
    // Wed 21: Tangle Bob 300 > Ada 200 = Cy 200 (Cy faster: ranked ahead, as on board_day); Link Ada 0 mistakes 90s, Cy 0 mistakes 60s
    await rpc('board_submit', [bob, f(21, 'word-tangle-0050'), 'scored', 80, 300, null]);
    await rpc('board_submit', [ada, f(21, 'word-tangle-0050'), 'scored', 90, 200, null]);
    await rpc('board_submit', [cy, f(21, 'word-tangle-0050'), 'scored', 60, 200, null]);
    await rpc('board_submit', [ada, f(21, 'word-link-0060'), 'solved', 90, null, 0]);
    await rpc('board_submit', [cy, f(21, 'word-link-0060'), 'solved', 60, null, 0]);
    // last week (Sun 18) does not count in this week
    await rpc('board_submit', [ada, f(18, 'crossword-mini-0099'), 'solved', 10, null, null]);
    const all = await rpc('board_overall', [ada, code, '2026-10-21']);
    assert.equal(all.week_from, '2026-10-19'); assert.equal(all.week_to, '2026-10-25');
    const pick = rows => rows.map(r => [r.rank, r.nick, r.points, r.played, r.completed]);
    // day: Tangle Bob 3, Cy 2, Ada 1; Link Cy 2, Ada 1
    assert.deepEqual(pick(all.day), [[1, 'Cy', 4, 2, 2], [2, 'Bob', 3, 1, 1], [3, 'Ada', 2, 2, 2]]);
    // week adds Monday's Mini: Ada 2, Bob 1, Cy 0 (played, failed)
    // all on 4 points: more completed puzzles ranks first, then equal
    assert.deepEqual(pick(all.week), [[1, 'Ada', 4, 3, 3], [2, 'Bob', 4, 2, 2], [2, 'Cy', 4, 3, 2]]);
    assert.deepEqual(all.not_yet, []);
    const mon = await rpc('board_overall', [bob, code, '2026-10-19']);
    assert.deepEqual(pick(mon.day), [[1, 'Ada', 2, 1, 1], [2, 'Bob', 1, 1, 1], [3, 'Cy', 0, 1, 0]]);
    assert.deepEqual(pick(mon.week), pick(mon.day), 'a Monday’s week holds only that day so far');
    await rejects(() => rpc('board_overall', ['00000000-0000-4000-8000-0000000000ff', code, '2026-10-21']), 'not_member');
  });
});

test('BOARD-REC-01..03: league records, honours, crown and the finish-sheet moment', async t => {
  const db = await boardDb({ today: '2026-10-21' });   // Wed; last week is Mon 12 to Sun 18 Oct
  t.after(() => db.close());
  const [ada, bob, cy] = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c3'];
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const rpc = async (name, args) => (await q(`select public.${name}(${args.map((_, i) => '$'+(i+1)).join(',')}) as value`, args))[0].value;
  await db.exec('set role anon');
  const { code } = await rpc('board_create', [ada, 'Family', 'Ada']);
  await rpc('board_join', [bob, code, 'Bob']);
  await rpc('board_join', [cy, code, 'Cy']);
  const f = (d, x) => `reports/2026-10-${d}-${x}.html`;
  const sub = (who, d, x, outcome, secs, score, m) => rpc('board_submit', [who, f(d, x), outcome, secs, score, m]);
  // Tue 14: Mini Ada 50 Bob 70; Doku Bob 90 Ada 100 (the site's set that day: two puzzles)
  await sub(ada, 14, 'crossword-mini-0090', 'solved', 50, null, null); await sub(bob, 14, 'crossword-mini-0090', 'solved', 70, null, null);
  await sub(bob, 14, 'logic-doku-0090', 'solved', 90, null, null); await sub(ada, 14, 'logic-doku-0090', 'solved', 100, null, null);
  // Wed 15: Mini Ada 40 Bob 60. Thu 16: Mini Bob 30 Ada 45. Fri 17: Bob alone (no rival: not a win)
  await sub(ada, 15, 'crossword-mini-0091', 'solved', 40, null, null); await sub(bob, 15, 'crossword-mini-0091', 'solved', 60, null, null);
  await sub(bob, 16, 'crossword-mini-0092', 'solved', 30, null, null); await sub(ada, 16, 'crossword-mini-0092', 'solved', 45, null, null);
  await sub(bob, 17, 'crossword-mini-0093', 'solved', 35, null, null);
  // Mon 20: Mini Ada 25 (new record) Bob 50. Tue 21: Tangle Cy 300 in 60s beats Bob 300 in 80s; Cy fails a Mini (not completed)
  await sub(ada, 20, 'crossword-mini-0096', 'solved', 25, null, null); await sub(bob, 20, 'crossword-mini-0096', 'solved', 50, null, null);
  await sub(bob, 21, 'word-tangle-0050', 'scored', 80, 300, null); await sub(cy, 21, 'word-tangle-0050', 'scored', 60, 300, null);
  await sub(cy, 21, 'crossword-mini-0097', 'failed', 20, null, null);

  await t.test('BOARD-REC-01: records per puzzle, best result first, holder and day', async () => {
    const r = await rpc('board_records', [bob, code]);
    const pick = x => [x.nick, x.date, x.secs, x.score];
    assert.deepEqual(pick(r.records.mini), ['Ada', '2026-10-20', 25, null]);
    assert.deepEqual(pick(r.records.doku), ['Bob', '2026-10-14', 90, null]);
    assert.deepEqual(pick(r.records.tangle), ['Cy', '2026-10-21', 60, 300]);
    assert.equal(r.records.doku.me, true); assert.equal(r.records.mini.me, false);
    assert.equal(r.records.link, undefined);
  });

  await t.test('BOARD-REC-02: honours, streaks, personal bests and last week’s crown', async () => {
    const r = await rpc('board_records', [ada, code]);
    const by = Object.fromEntries(r.players.map(p => [p.nick, p]));
    const h = p => [p.completed, p.wins, p.titles, p.perfect, p.sweeps, p.longest, p.current];
    assert.deepEqual(h(by.Ada), [5, 3, 0, 4, 2, 3, 1]);
    // Tue 21 had two puzzles on the site (Cy's failed Mini counts as published), so nobody had a perfect day then
    assert.deepEqual(h(by.Bob), [7, 2, 1, 5, 1, 4, 2]);
    assert.deepEqual(h(by.Cy), [1, 1, 0, 0, 0, 1, 1]);
    assert.equal(by.Ada.me, true);
    assert.equal(by.Bob.bests.mini.secs, 30); assert.equal(by.Bob.streaks.mini, 4); assert.equal(by.Ada.streaks.doku, 1);
    assert.deepEqual(r.crown, ['Bob']); assert.equal(r.crown_week, '2026-10-12');
    await assert.rejects(() => rpc('board_records', ['00000000-0000-4000-8000-0000000000ff', code]), /not_member/);
  });

  await t.test('BOARD-REC-03: the moment — personal best and league record for one result', async () => {
    assert.deepEqual(await rpc('board_moment', [ada, f(20, 'crossword-mini-0096')]), { type: 'mini', pb: true, records: [{ code, name: 'Family' }] });
    assert.deepEqual(await rpc('board_moment', [bob, f(16, 'crossword-mini-0092')]), { type: 'mini', pb: true, records: [] });
    assert.deepEqual(await rpc('board_moment', [bob, f(21, 'word-tangle-0050')]), { type: 'tangle', pb: false, records: [] });
    assert.equal(await rpc('board_moment', [cy, f(21, 'crossword-mini-0097')]), null, 'a failed round has no moment');
    await db.exec('reset role');
    await assert.rejects(() => q('select * from board.rec_rows(1, current_date)').then(() => db.exec('set role anon').then(() => q('select * from board.rec_rows(1, current_date)'))), /permission denied/);
  });
});

// ADMIN-01..04: the admin reporting, on the exact live definitions
// (toolchain/sql/2026-10-20-admin-live-definitions.sql: a record of what is
// deployed, read with pg_get_functiondef / pg_get_viewdef on 20 Oct 2026).
// Its own disposable database: the board test above stubs insights.admins and
// public.events in a different shape.
test('ADMIN-01..04: dashboard refusals, one-page readers, excluded readers and the two-argument wrapper', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated, service_role;
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, '../../toolchain/sql/2026-10-20-admin-live-definitions.sql'), 'utf8'));
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const as = async (role, email) => {
    await db.exec('reset role');
    await q("select set_config('request.jwt.claims',$1,false)", [email === undefined ? '' : JSON.stringify({ email })]);
    if (role) await db.exec('set role ' + role);
  };
  const dash = async (from, to, ghosts) => (ghosts === undefined
    ? await q('select public.admin_dashboard($1::date,$2::date) as v', [from, to])
    : await q('select public.admin_dashboard($1::date,$2::date,$3) as v', [from, to, ghosts]))[0].v;
  const exclude = async (anon, on) => (await q('select public.admin_exclude_device($1::uuid,$2) as v', [anon, on]))[0].v;
  const strip = d => { const o = { ...d }; delete o.generated_at; return o; };
  // order-free comparison: jsonb_agg without ORDER BY has no guaranteed order
  const canon = d => JSON.parse(JSON.stringify(strip(d), (k, v) => Array.isArray(v) ? [...v].sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1) : v));
  const ADMIN = 'Editor@Example.test';   // stored lower case; the check is case-insensitive
  await db.exec("insert into insights.admins values ('editor@example.test')");

  // The range is London days 10–12 Oct 2026; every event is at 12:00 UTC (13:00 BST).
  const id = n => '00000000-0000-4000-8000-0000000000' + String(n).padStart(2, '0');
  const R1 = id(11), R2 = id(12), LATE = id(13), G1 = id(21), G2 = id(22), X = id(31), S = id(99);
  const ev = (anon, day, event, item, section, props = {}) => q(
    'insert into public.events(occurred_at,anon_id,session_id,section,event,item_path,props) values ($1::timestamptz,$2,$3,$4,$5,$6,$7::jsonb)',
    [day + 'T12:00:00Z', anon, S, section, event, item, JSON.stringify(props)]);
  const pv = (anon, day, item, section, n, extra = {}) => ev(anon, day, 'page_view', item, section, { pv: anon + '-' + n, ...extra });
  const ART = 'reports/2026-10-01-uk-test.html', MINI = 'reports/2026-10-11-crossword-mini-0001.html';
  // R1: two page loads, an article read through
  await pv(R1, '2026-10-10', 'index.html', 'news', 1);
  await ev(R1, '2026-10-10', 'page_exit', 'index.html', 'news', { pv: R1 + '-1', secs: 5 });
  await pv(R1, '2026-10-11', ART, 'news', 2, { topic: 'Economy' });
  await ev(R1, '2026-10-11', 'page_exit', ART, 'news', { pv: R1 + '-2', secs: 140, depth: 90 });
  // R2: one page load, but a solved puzzle, so not a one-page reader
  await pv(R2, '2026-10-11', MINI, 'puzzles', 1);
  await ev(R2, '2026-10-11', 'puzzle_start', MINI, 'puzzles', { pv: R2 + '-1', tv: 3 });
  await ev(R2, '2026-10-11', 'puzzle_end', MINI, 'puzzles', { pv: R2 + '-1', outcome: 'solved', secs: 70 });
  // LATE: one page in the range, a second page after it; the rule reads the whole history
  await pv(LATE, '2026-10-12', 'puzzles.html', 'puzzles', 1);
  await pv(LATE, '2026-10-20', 'games.html', 'games', 2);
  // G1, G2: one-page readers (one page load, only page_view / page_exit)
  await pv(G1, '2026-10-11', 'index.html', 'news', 1);
  await ev(G1, '2026-10-11', 'page_exit', 'index.html', 'news', { pv: G1 + '-1', secs: 2 });
  await pv(G2, '2026-10-12', ART, 'news', 1);

  await t.test('ADMIN-01: only an admin email may read the dashboard or change exclusions', async () => {
    await as('anon');
    await assert.rejects(() => dash('2026-10-10', '2026-10-12', false), /permission denied/);
    await assert.rejects(() => dash('2026-10-10', '2026-10-12'), /permission denied/);
    await assert.rejects(() => exclude(X, true), /permission denied/);
    for (const email of [undefined, '', 'reader@example.test']) {
      await as('authenticated', email);
      const who = 'email ' + JSON.stringify(email);
      await assert.rejects(() => dash('2026-10-10', '2026-10-12', false), /not_admin/, who);
      await assert.rejects(() => dash('2026-10-10', '2026-10-12', true), /not_admin/, who);
      await assert.rejects(() => dash('2026-10-10', '2026-10-12'), /not_admin/, who);
      await assert.rejects(() => exclude(X, true), /not_admin/, who);
      await assert.rejects(() => exclude(X, null), /not_admin/, who);
    }
    await as('authenticated', 'reader@example.test');
    await assert.rejects(() => q('select * from insights.ev'), /permission denied/);
    await assert.rejects(() => q('select * from insights.excluded_readers'), /permission denied/);
    await assert.rejects(() => q("insert into insights.admins values ('reader@example.test')"), /permission denied/);
    await assert.rejects(() => q('select * from public.events'), /permission denied/);
    await as('authenticated', ADMIN);
    assert.equal((await dash('2026-10-10', '2026-10-12', false)).kpis.readers, 3);
    await assert.rejects(() => dash('2026-10-12', '2026-10-10', false), /bad_range/);
    assert.equal(await exclude(X, null), false);
    await as(null);
    assert.equal((await q('select count(*)::int n from insights.excluded_readers'))[0].n, 0, 'refused calls changed nothing');
  });

  await as('authenticated', ADMIN);
  const clean = { false: await dash('2026-10-10', '2026-10-12', false), true: await dash('2026-10-10', '2026-10-12', true) };

  await t.test('ADMIN-02: one-page readers are hidden by default and counted when p_ghosts is true', async () => {
    const h = clean.false, s = clean.true;
    assert.deepEqual([h.ghosts_shown, s.ghosts_shown, h.ghost_readers, s.ghost_readers], [false, true, 2, 2]);
    assert.deepEqual([h.kpis.readers, h.kpis.page_loads, h.kpis.new_readers, h.kpis.events], [3, 4, 3, 8]);
    assert.deepEqual([s.kpis.readers, s.kpis.page_loads, s.kpis.new_readers, s.kpis.events], [5, 6, 5, 11]);
    assert.deepEqual(h.daily.map(d => [d.day, d.readers]), [['2026-10-10', 1], ['2026-10-11', 2], ['2026-10-12', 1]]);
    assert.deepEqual(s.daily.map(d => [d.day, d.readers]), [['2026-10-10', 1], ['2026-10-11', 3], ['2026-10-12', 2]]);
    const art = d => d.items.find(i => i.item_path === ART);
    assert.deepEqual([art(h).readers, art(s).readers, h.kpis.article_readers, s.kpis.article_readers], [1, 2, 1, 2]);
    // the front pages: G1's News list visit shows only with ghosts; LATE counts though their range holds one page
    const front = (d, p) => (d.front_pages.find(f => f.page === p) || { readers: 0 }).readers;
    assert.deepEqual([front(h, 'index.html'), front(s, 'index.html'), front(h, 'puzzles.html')], [1, 2, 1]);
    assert.equal(h.kpis.puzzles_solved, 1);
  });

  await t.test('ADMIN-03: an excluded reader is removed from every figure', async () => {
    // X: a busy reader across all three sections, later excluded (e.g. a developer's own phone)
    await as(null);
    await pv(X, '2026-10-10', ART, 'news', 1, { via: 'share', screen: 'xl' });
    await ev(X, '2026-10-10', 'page_exit', ART, 'news', { pv: X + '-1', secs: 400, depth: 100 });
    await pv(X, '2026-10-11', 'reports/2026-10-11-geo-borders-0001.html', 'puzzles', 2);
    await ev(X, '2026-10-11', 'puzzle_start', 'reports/2026-10-11-geo-borders-0001.html', 'puzzles', { pv: X + '-2', tv: 3 });
    await ev(X, '2026-10-11', 'puzzle_end', 'reports/2026-10-11-geo-borders-0001.html', 'puzzles', { pv: X + '-2', outcome: 'scored', score: 500 });
    await pv(X, '2026-10-12', 'reports/2026-10-15-quiz-ballpark.html', 'games', 3);
    await ev(X, '2026-10-12', 'game_start', 'reports/2026-10-15-quiz-ballpark.html', 'games', { pv: X + '-3', game: 'ballpark' });
    await ev(X, '2026-10-12', 'card_click', 'puzzles.html', 'puzzles', { pv: X + '-3', to: 'reports/x.html', pos: 1 });
    await as('authenticated', ADMIN);
    const withX = await dash('2026-10-10', '2026-10-12', false);
    assert.equal(withX.kpis.readers, 4, 'the reader counts before exclusion');
    assert.notDeepEqual(canon(withX), canon(clean.false));
    assert.equal(await exclude(X, true), true);
    assert.equal(await exclude(X, true), true, 'adding twice is harmless');
    assert.equal(await exclude(X, null), true, 'null only reports');
    await as(null);
    assert.match((await q('select note from insights.excluded_readers where anon_id=$1', [X]))[0].note, /^added from admin page by editor@example\.test on \d{4}-\d{2}-\d{2}$/);
    await as('authenticated', ADMIN);
    for (const ghosts of [false, true]) {
      const after = await dash('2026-10-10', '2026-10-12', ghosts);
      assert.equal(after.excluded_readers, 1);
      assert.deepEqual(canon({ ...after, excluded_readers: 0 }), canon({ ...clean[ghosts], excluded_readers: 0 }),
        'with the reader excluded every figure equals a database that never saw them (ghosts ' + ghosts + ')');
    }
    // an excluded browser is not counted as a one-page reader either
    await as(null); await pv(id(32), '2026-10-11', 'index.html', 'news', 1); await as('authenticated', ADMIN);
    assert.equal((await dash('2026-10-10', '2026-10-12', false)).ghost_readers, 3);
    assert.equal(await exclude(id(32), true), true);
    assert.equal((await dash('2026-10-10', '2026-10-12', false)).ghost_readers, 2);
    assert.equal(await exclude(id(32), false), false);
    assert.equal(await exclude(X, false), false, 'false removes the exclusion');
    assert.equal((await dash('2026-10-10', '2026-10-12', false)).kpis.readers, 4, 'and the reader counts again');
    assert.equal(await exclude(X, true), true);
    await as(null);
    assert.equal((await q('select count(*)::int n from public.events where anon_id=$1', [X]))[0].n, 8, 'nothing is deleted');
  });

  await t.test('ADMIN-04: the two-argument admin_dashboard is a wrapper that hides one-page readers', async () => {
    await as('authenticated', ADMIN);
    const two = await dash('2026-10-10', '2026-10-12'), three = await dash('2026-10-10', '2026-10-12', false);
    assert.equal(two.ghosts_shown, false);
    assert.deepEqual(canon(two), canon(three));
    await as('service_role');
    await assert.rejects(() => dash('2026-10-10', '2026-10-12'), /not_admin/, 'the service role still needs an admin email');
    await as(null);
    const fn = await q("select p.oid::regprocedure::text sig, pronargdefaults n from pg_proc p where proname='admin_dashboard' order by 1");
    assert.deepEqual(fn.map(r => [r.sig, r.n]), [['admin_dashboard(date,date)', 0], ['admin_dashboard(date,date,boolean)', 0]],
      'p_ghosts has no default, so a two-argument call can only reach the wrapper');
  });
});
