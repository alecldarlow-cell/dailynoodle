'use strict';
// Delete my account (toolchain/sql/2026-11-28-account-delete.sql; app issue #188), on a disposable PGlite
// database with the real board, sync and Lab-vote migrations and the hosting's auth stubbed. Never a real project.
// Alec's checks (27 Nov 2026): acts only on the signed-in caller; another player's rows byte-for-byte unchanged;
// the deleted player's league rows kept with no id, email or name; their own saves, sync rows and sign-in gone;
// no ON DELETE CASCADE reaches a shared table; additive only; running it twice is harmless.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { boardDb } = require('../board-db');

const SQL_DIR = path.join(__dirname, '../../../toolchain/sql');
const read = f => fs.readFileSync(path.join(SQL_DIR, f), 'utf8');
const MIGRATION = read('2026-11-28-account-delete.sql');
const LAB = read('2026-11-11-lab-votes.sql');
const LAB_BODY = LAB.slice(0, LAB.indexOf('-- The three Lab slugs'));
const PUSH = read('2026-10-19-push.sql');
const PUSH_BODY = PUSH.slice(0, PUSH.indexOf('-- So the database can call'));   // the pg_net step is the hosting's
const DAY = '2026-11-20';

const UA = '00000000-0000-4000-8000-0000000000a1', PA = '00000000-0000-4000-8000-0000000000a2';
const UB = '00000000-0000-4000-8000-0000000000b1', PB = '00000000-0000-4000-8000-0000000000b2';
const PC = '00000000-0000-4000-8000-0000000000c2';                 // never signs in
const UD = '00000000-0000-4000-8000-0000000000d1';                 // syncs someone else's board id
const UE = '00000000-0000-4000-8000-0000000000e1', PE = '00000000-0000-4000-8000-0000000000e2';

// Supabase's auth.users, with one of its own tables hanging off it by cascade, as on the hosting.
const AUTH = `
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'sub', '')::uuid $$;
  create table auth.users (id uuid primary key, email text);
  create table auth.sessions (id bigint generated always as identity primary key,
                              user_id uuid not null references auth.users(id) on delete cascade);
  create table insights.page_loads (item_path text, section text, anon_id uuid, day date,
    started boolean, outcome text, solve_secs int);`;

async function baseDb() {
  const d = await boardDb({ today: DAY });
  await d.exec(AUTH);
  await d.exec(PUSH_BODY);
  for (const f of ['2026-10-25-sync.sql', '2026-10-29-sync-revision.sql', '2026-11-17-lab-sync.sql']) await d.exec(read(f));
  await d.exec(LAB_BODY);
  return d;
}
async function db() {
  const d = await baseDb();
  await d.exec(MIGRATION);
  await d.exec(MIGRATION);           // re-runnable
  return d;
}

// One call as PostgREST makes it: a role and, optionally, a signed-in user.
async function as(d, role, user, sql, params = []) {
  return d.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(user ? { sub: user, role } : { role })]);
    return (await tx.query(sql, params)).rows;
  });
}
const anon = (d, fn, args) => as(d, 'anon', null, `select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as v`, args).then(r => r[0].v);
const signedIn = (d, u, fn, args = []) => as(d, 'authenticated', u, `select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as v`, args).then(r => r[0].v);
const del = (d, u) => signedIn(d, u, 'account_delete');

const TABLES = ['auth.users', 'auth.sessions', 'board.leagues', 'board.members', 'board.results', 'board.game_daily',
                'board.pins', 'board.push_subs', 'board.attempts', 'board.settings', 'sync.saves', 'insights.lab_votes', 'public.events'];
// Every row of every table, as text, in a stable order (superuser: the test's own view, not a client's).
async function dump(d) {
  const out = {};
  for (const t of TABLES) {
    const rows = (await d.query(`select to_jsonb(x)::text as j from ${t} x`)).rows.map(r => r.j).sort();
    out[t] = rows;
  }
  return out;
}
const counts = dump => Object.fromEntries(Object.entries(dump).map(([t, rows]) => [t, rows.length]));
const mentions = (dump, needle) => Object.entries(dump).flatMap(([t, rows]) => rows.filter(r => r.includes(needle)).map(r => `${t}: ${r}`));
// The rows that belong to one player or account, by every id they hold.
const own = (dump, ids) => Object.fromEntries(Object.entries(dump).map(([t, rows]) => [t, rows.filter(r => ids.some(id => r.includes(id)))]));

const endpoint = n => `https://fcm.googleapis.com/fcm/send/${n}-${'x'.repeat(40)}`;
const P256 = 'B' + 'a'.repeat(86), AUTHK = 'c'.repeat(22);
const path_ = t => `reports/${DAY}-${t}-0001.html`;

// Two players in a shared league, plus one who never signs in. Alpha (A) owns Noodlers; Bravo (B) owns Second,
// which Alpha joined and left.
async function seed(d) {
  await d.query(`insert into auth.users values ($1,'a@example.com'),($2,'b@example.com'),($3,'d@example.com'),($4,'e@example.com')`, [UA, UB, UD, UE]);
  await d.query(`insert into auth.sessions (user_id) values ($1),($2),($3)`, [UA, UB, UA]);
  const l1 = (await anon(d, 'board_create', [PA, 'Noodlers', 'Alpha'])).code;
  await anon(d, 'board_join', [PB, l1, 'Bravo']);
  await anon(d, 'board_join', [PC, l1, 'Charlie']);
  const l2 = (await anon(d, 'board_create', [PB, 'Second', 'Bravo'])).code;
  await anon(d, 'board_join', [PA, l2, 'Alpha']);
  await anon(d, 'board_leave', [PA, l2]);
  for (const [p, mini, doku] of [[PA, 50, 30], [PB, 40, 90], [PC, 60, null]]) {
    await anon(d, 'board_submit', [p, path_('crossword-mini'), 'solved', mini, null, null]);
    if (doku) await anon(d, 'board_submit', [p, path_('logic-doku'), 'solved', doku, null, null]);
  }
  await anon(d, 'board_game_submit', [PA, 'astro-drop', 1200, 2, 3]);
  await anon(d, 'board_game_submit', [PB, 'astro-drop', 900, 1, 2]);
  await anon(d, 'board_pin_set', [PA, '1357']);
  await anon(d, 'board_pin_set', [PB, '2468']);
  await anon(d, 'board_push_save', [PA, endpoint('a'), P256, AUTHK]);
  await anon(d, 'board_push_save', [PB, endpoint('b'), P256, AUTHK]);
  const saves = (pid, n) => ({
    'digi-mini-v1': { v: 1, done: { 'DP·MINI·0001': { s: n, d: DAY } } },
    'digi-mini-streak': { last: DAY, streak: 3, best: 5, gold: [DAY] },
    'noodle-board-v1': { pid, leagues: [{ code: l1, name: 'Noodlers', nick: pid === PA ? 'Alpha' : 'Bravo' }], cur: l1 }
  });
  await signedIn(d, UA, 'sync_push', [JSON.stringify(saves(PA, 50))]);
  await signedIn(d, UB, 'sync_push', [JSON.stringify(saves(PB, 40))]);
  await signedIn(d, UA, 'lab_vote', ['00000000-0000-4000-8000-0000000000f1', 'tilt', true, 'app']);
  await signedIn(d, UB, 'lab_vote', ['00000000-0000-4000-8000-0000000000f2', 'tilt', false, 'web']);
  await anon(d, 'lab_vote', ['00000000-0000-4000-8000-0000000000f3', 'tumbler', true, 'web']);
  return { l1, l2 };
}
// What Bravo sees: the day's board, the week's points and the league's records.
async function bravoSees(d, l1) {
  return JSON.stringify({
    mini: await anon(d, 'board_day', [PB, l1, 'mini', DAY]),
    doku: await anon(d, 'board_day', [PB, l1, 'doku', DAY]),
    week: await anon(d, 'board_overall', [PB, l1, DAY]),
    records: await anon(d, 'board_records', [PB, l1]),
    game: await anon(d, 'board_game_day', [PB, l1, 'astro-drop', DAY]),
    mine: await anon(d, 'board_mine', [PB])
  });
}

test('ACCOUNT-DELETE-01: GIVEN two players in a shared league WHEN one deletes their account THEN the other is byte-for-byte unchanged and the deleted player is anonymised, not removed', async () => {
  const d = await db();
  try {
    const { l1 } = await seed(d);
    const before = await dump(d);
    const seenBefore = await bravoSees(d, l1);
    assert.match(seenBefore, /Alpha/);

    const answer = await del(d, UA);
    assert.deepEqual({ ...answer, deleted: undefined }, { ok: true, board: 'anonymised', deleted: undefined });
    assert.ok(answer.deleted >= 5);
    const after = await dump(d);

    // THEN: Bravo's and Charlie's rows, every one of them, are identical (saves, streaks, gold stars, Lab votes,
    // league rows, results, PIN, push subscription, sign-in).
    // The one change on a shared row is Noodlers' owner (Alpha's league passes to Bravo, as on leaving), so leagues
    // are compared without their owner here and the owner is checked below.
    const noOwner = dump => ({ ...dump, 'board.leagues': dump['board.leagues'].map(r => r.replace(/"owner": "[^"]+"/, '"owner": ?')) });
    for (const ids of [[UB, PB, 'b@example.com'], [PC]]) assert.deepEqual(own(noOwner(after), ids), own(noOwner(before), ids));
    // ...and what Bravo sees is the same, with Alpha now shown as "Former player": same places, same points.
    const seenAfter = await bravoSees(d, l1);
    // Tables list ties by nickname, so a renamed player can swap places within a tie: same rank, same points.
    const tidy = v => Array.isArray(v) ? v.map(tidy).sort((a, b) => a && b && a.nick && b.nick && a.rank === b.rank ? a.nick.localeCompare(b.nick) : 0)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)])) : v;
    const view = (seen, rename) => JSON.stringify(tidy({ ...JSON.parse(rename ? seen.replaceAll('"Alpha"', '"Former player"') : seen), mine: null }));
    assert.equal(view(seenAfter), view(seenBefore, true));

    // THEN: nothing anywhere carries Alpha's account id, email, board id or nickname.
    for (const needle of [UA, PA, 'a@example.com', 'Alpha']) assert.deepEqual(mentions(after, needle), [], needle);

    // THEN: Alpha's league rows are still there, under one fresh id, named Former player where still playing.
    const q = async (sql, p = []) => (await d.query(sql, p)).rows;
    const ghost = await q(`select m.player, m.nickname, m.left_at is not null as left, m.left_nick, l.name
                             from board.members m join board.leagues l on l.id = m.league_id
                            where m.player not in ($1, $2) order by l.name`, [PB, PC]);
    assert.equal(ghost.length, 2);
    assert.equal(new Set(ghost.map(g => g.player)).size, 1);
    assert.deepEqual(ghost.map(g => [g.name, g.left, g.left_nick]), [['Noodlers', false, null], ['Second', true, null]]);
    assert.equal(ghost[0].nickname, 'Former player');
    assert.match(ghost[1].nickname, /^~[0-9a-f]{12}$/);
    const fresh = ghost[0].player;
    assert.deepEqual((await q(`select puzzle_path, secs from board.results where player = $1 order by puzzle_path`, [fresh]))
      .map(r => [r.puzzle_path, r.secs]), [[path_('crossword-mini'), 50], [path_('logic-doku'), 30]]);
    assert.equal((await q(`select count(*)::int n from board.game_daily where player = $1`, [fresh]))[0].n, 1);

    // THEN: Noodlers passes to its longest-standing current member, as on leaving.
    assert.equal((await q(`select owner from board.leagues where name = 'Noodlers'`))[0].owner, PB);
    assert.deepEqual(noOwner(after)['board.leagues'], noOwner(before)['board.leagues']);
    // Bravo's own league list: the same leagues, now owner of Noodlers.
    const mine = seen => JSON.parse(seen).mine;
    assert.deepEqual(mine(seenAfter), mine(seenBefore).map(l => l.name === 'Noodlers' ? { ...l, owner: true } : l));

    // THEN: row counts per table: only the deleting player's own rows went.
    const c0 = counts(before), c1 = counts(after);
    assert.deepEqual(c1, { ...c0, 'auth.users': c0['auth.users'] - 1, 'auth.sessions': c0['auth.sessions'] - 2,
      'board.pins': c0['board.pins'] - 1, 'board.push_subs': c0['board.push_subs'] - 1,
      'sync.saves': c0['sync.saves'] - 3, 'insights.lab_votes': c0['insights.lab_votes'] - 1 });
  } finally { await d.close(); }
});

test('ACCOUNT-DELETE-02: GIVEN a deleted account WHEN delete runs again THEN it is harmless', async () => {
  const d = await db();
  try {
    await seed(d);
    await del(d, UA);
    const once = await dump(d);
    assert.deepEqual(await del(d, UA), { ok: true, board: 'none', deleted: 0 });
    assert.deepEqual(await dump(d), once);
  } finally { await d.close(); }
});

test('ACCOUNT-DELETE-03: GIVEN the function WHEN anyone but a signed-in caller calls it THEN it is refused, and it takes no user argument', async () => {
  const d = await db();
  try {
    await seed(d);
    const before = await dump(d);
    await assert.rejects(() => as(d, 'anon', null, 'select public.account_delete()'), /permission denied/);
    await assert.rejects(() => as(d, 'anon', UA, 'select public.account_delete()'), /permission denied/);
    await assert.rejects(() => as(d, 'authenticated', null, 'select public.account_delete()'), /not_signed_in/);
    await assert.rejects(() => as(d, 'authenticated', UB, `select public.account_delete('${UA}')`), /does not exist/);
    assert.deepEqual(await dump(d), before);
    const procs = (await d.query(`select pronargs, prosecdef, proconfig from pg_proc where proname = 'account_delete'`)).rows;
    assert.deepEqual(procs, [{ pronargs: 0, prosecdef: true, proconfig: ['search_path=""'] }]);
  } finally { await d.close(); }
});

test('ACCOUNT-DELETE-04: GIVEN an account that synced another player\'s board id WHEN it deletes THEN that player\'s league rows are not reached', async () => {
  const d = await db();
  try {
    const { l1 } = await seed(d);
    await signedIn(d, UD, 'sync_push', [JSON.stringify({ 'noodle-board-v1': { pid: PB.toUpperCase(), leagues: [] } })]);
    const before = await dump(d);
    const seen = await bravoSees(d, l1);
    assert.deepEqual(await del(d, UD), { ok: true, board: 'shared', deleted: 2 });
    const after = await dump(d);
    assert.deepEqual(own(after, [UB, PB, PA, UA, PC]), own(before, [UB, PB, PA, UA, PC]));
    assert.equal(await bravoSees(d, l1), seen);
    assert.deepEqual(mentions(after, UD), []);
  } finally { await d.close(); }
});

test('ACCOUNT-DELETE-05: GIVEN a league with a former player WHEN another member deletes THEN names stay unique; an account with no league just goes', async () => {
  const d = await db();
  try {
    const { l1 } = await seed(d);
    await anon(d, 'board_join', [PE, l1, 'Echo']);
    await signedIn(d, UE, 'sync_push', [JSON.stringify({ 'noodle-board-v1': { pid: PE, leagues: [] } })]);
    await del(d, UA);
    await del(d, UE);
    const names = (await d.query(`select nickname from board.members m join board.leagues l on l.id = m.league_id
                                    where l.name = 'Noodlers' order by nickname`)).rows.map(r => r.nickname);
    assert.deepEqual(names, ['Bravo', 'Charlie', 'Former player', 'Former player 2']);
    // A synced document with no usable board id: saves and sign-in go, nothing else is touched.
    const before = await dump(d);
    await signedIn(d, UD, 'sync_push', [JSON.stringify({ 'noodle-board-v1': { pid: 'not-a-uuid' }, 'digi-mini-v1': { v: 1 } })]);
    assert.deepEqual(await del(d, UD), { ok: true, board: 'none', deleted: 3 });
    const after = await dump(d);
    assert.deepEqual({ ...after, 'auth.users': null }, { ...before, 'auth.users': null });
    assert.deepEqual(after['auth.users'].length, before['auth.users'].length - 1);
  } finally { await d.close(); }
});

test('ACCOUNT-DELETE-06: GIVEN the schema WHEN the migration is applied THEN no ON DELETE CASCADE reaches a shared table and nothing existing changed', async () => {
  // Catalogue: every function, column, constraint, index and policy outside pg_catalog/information_schema.
  const catalogue = async d => {
    const q = async sql => (await d.query(sql)).rows.map(r => r.x).sort();
    return {
      functions: await q(`select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' ||
                                 md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(array_to_string(p.proacl, ','), '') as x
                            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname in ('public', 'board', 'sync', 'insights', 'auth') and p.prokind = 'f'`),
      columns: await q(`select table_schema || '.' || table_name || '.' || column_name || ' ' || data_type || ' ' ||
                               coalesce(column_default, '') || ' ' || is_nullable as x from information_schema.columns
                         where table_schema in ('public', 'board', 'sync', 'insights', 'auth')`),
      constraints: await q(`select conrelid::regclass::text || ' ' || conname || ' ' || pg_get_constraintdef(oid) as x
                              from pg_constraint where connamespace::regnamespace::text in ('public', 'board', 'sync', 'insights', 'auth')`),
      indexes: await q(`select schemaname || ' ' || indexdef as x from pg_indexes where schemaname in ('public', 'board', 'sync', 'insights', 'auth')`),
      policies: await q(`select schemaname || '.' || tablename || ' ' || policyname as x from pg_policies`),
      grants: await q(`select table_schema || '.' || table_name || ' ' || grantee || ' ' || privilege_type as x
                         from information_schema.role_table_grants where table_schema in ('public', 'board', 'sync', 'insights', 'auth')`)
    };
  };
  const d = await baseDb();
  try {
    const before = await catalogue(d);
    await d.exec(MIGRATION);
    const after = await catalogue(d);
    const added = after.functions.filter(f => !before.functions.includes(f));
    assert.deepEqual(after.functions.filter(f => !added.includes(f)), before.functions, 'no existing function changed');
    assert.equal(added.length, 1);
    assert.match(added[0], /^public\.account_delete\(\) /);
    for (const k of ['columns', 'constraints', 'indexes', 'policies', 'grants']) assert.deepEqual(after[k], before[k], k);

    // Cascading foreign keys: only Supabase's own auth tables hang off auth.users, and the one board cascade
    // (members follow their league) starts at a table this function never deletes from.
    const cascades = (await d.query(`select conrelid::regclass::text as child, confrelid::regclass::text as parent
                                       from pg_constraint where contype = 'f' and confdeltype in ('c', 'n', 'd')
                                      order by 1, 2`)).rows;
    assert.deepEqual(cascades, [{ child: 'auth.sessions', parent: 'auth.users' }, { child: 'board.members', parent: 'board.leagues' }]);
    const shared = ['board.leagues', 'board.members', 'board.results', 'board.game_daily'];
    for (const c of cascades) if (c.parent === 'auth.users') assert.ok(!shared.includes(c.child));
    const body = MIGRATION.slice(MIGRATION.indexOf('create or replace function'));
    for (const t of shared) assert.doesNotMatch(body, new RegExp(`delete\\s+from\\s+${t.replace('.', '\\.')}\\b`, 'i'), t);
    // The file itself is additive: one function and its grants, no DDL on anything else.
    const statements = body.replace(/\$\$[\s\S]*?\$\$/g, '$$').split(';').map(s => s.trim()).filter(Boolean);
    assert.deepEqual(statements.map(s => s.split(/\s+/).slice(0, 2).join(' ')), ['create or', 'revoke all', 'grant execute']);
    assert.doesNotMatch(MIGRATION.replace(/^--.*$/gm, ''), /\b(alter|drop|truncate)\b|create\s+(table|policy|index)/i);

    // The branch/live check file is read-only and runs: counts, the cascade list (only members -> leagues
    // outside auth) and the new function with no arguments.
    const CHECK = read('2026-11-28-account-delete-check.sql');
    const checks = CHECK.replace(/^--.*$/gm, '').split(';').map(x => x.trim()).filter(Boolean);
    assert.ok(checks.every(x => /^select\b/i.test(x)) && !/\b(insert|update|delete|alter|drop|create|grant|revoke)\b/i.test(checks.join(' ')));
    const [rows, fks, fn] = await Promise.all(checks.map(x => d.query(x).then(r => r.rows)));
    assert.ok(rows.some(r => r.table_name === 'board.results') && rows.every(r => Number(r.exact) >= 0));
    assert.deepEqual(fks.map(r => [r.child, r.parent, r.on_delete]), [['board.members', 'board.leagues', 'cascade']]);
    assert.deepEqual(fn, [{ fn: 'account_delete()', pronargs: 0, prosecdef: true }]);
  } finally { await d.close(); }
});
