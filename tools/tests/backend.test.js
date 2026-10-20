'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

// Disposable PostgreSQL (WASM), with the actual checked-in board migrations.
// Only the hosting-provided auth/insights/events interfaces are stubbed.
// No URLs, credentials, production connection or network are used.
test('BOARD-01/02: migrations, permissions, first results, history and hide-only actions', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create schema insights; create table insights.admins(email text);
    create table public.events(anon_id uuid, event text, item_path text, props jsonb, occurred_at timestamptz default now());
  `);
  for (const name of ['2026-10-18-leaderboards.sql', '2026-10-18-leaderboards-hide-only.sql', '2026-10-20-reckon-board.sql'])
    await db.exec(fs.readFileSync(path.join(__dirname, '../../toolchain/sql', name), 'utf8'));
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
