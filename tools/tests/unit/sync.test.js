'use strict';
// Optional sign-in sync (toolchain/sql/2026-10-25-sync.sql, app plan WP7), on a
// disposable PGlite database with the hosting's auth stubbed. Never a real project.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const SQL = fs.readFileSync(path.join(__dirname, '../../../toolchain/sql/2026-10-25-sync.sql'), 'utf8');
const HOSTING = `
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'sub', '')::uuid $$;
`;
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b';

async function db() {
  const d = new PGlite();
  await d.exec(HOSTING);
  await d.exec(SQL);
  await d.exec(SQL); // the migration can be re-run
  return d;
}
// One call as a role and (optionally) a signed-in user, as PostgREST makes it.
async function call(d, role, user, sql, params = []) {
  return d.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(user ? { sub: user, role } : { role })]);
    return (await tx.query(sql, params)).rows;
  });
}
const pull = (d, u) => call(d, 'authenticated', u, 'select public.sync_pull() as v').then(r => r[0].v);
const push = (d, u, saves) => call(d, 'authenticated', u, 'select public.sync_push($1::jsonb) as v', [JSON.stringify(saves)]).then(r => r[0].v);

test('SYNC-01: a signed-in player stores, reads and replaces their own saves', async () => {
  const d = await db();
  try {
    assert.deepEqual(await pull(d, A), {});
    const mini = { v: 1, done: { 'DP·MINI·0105': { s: 87, d: '2026-10-24' } } };
    assert.equal(await push(d, A, { 'digi-mini-v1': mini, 'digi-mini-streak': { last: '2026-10-24', streak: 3, best: 5, dates: [] } }), 2);
    assert.deepEqual((await pull(d, A))['digi-mini-v1'], mini);
    const more = { v: 1, done: { ...mini.done, 'DP·MINI·0106': { s: 50, d: '2026-10-25' } } };
    await push(d, A, { 'digi-mini-v1': more, 'noodle-board-v1': { pid: B, leagues: [] } });
    const all = await pull(d, A);
    assert.deepEqual(Object.keys(all).sort(), ['digi-mini-streak', 'digi-mini-v1', 'noodle-board-v1']);
    assert.deepEqual(all['digi-mini-v1'], more);
  } finally { await d.close(); }
});

test('SYNC-02: players never see or touch each other’s saves', async () => {
  const d = await db();
  try {
    await push(d, A, { 'digi-doku-v1': { v: 1, done: { x: { s: 1 } } } });
    await push(d, B, { 'digi-doku-v1': { v: 1, done: { y: { s: 2 } } } });
    assert.deepEqual(Object.keys((await pull(d, B))['digi-doku-v1'].done), ['y']);
    await call(d, 'authenticated', B, 'select public.sync_forget()');
    assert.deepEqual(await pull(d, B), {});
    assert.deepEqual(Object.keys((await pull(d, A))['digi-doku-v1'].done), ['x']);
  } finally { await d.close(); }
});

test('SYNC-03: no sign-in, no access; the table is never readable directly', async () => {
  const d = await db();
  try {
    await assert.rejects(() => call(d, 'anon', null, 'select public.sync_pull()'), /permission denied/);
    await assert.rejects(() => call(d, 'anon', A, 'select public.sync_push($1::jsonb)', ['{}']), /permission denied/);
    await assert.rejects(() => call(d, 'authenticated', null, 'select public.sync_pull()'), /not_signed_in/);
    await assert.rejects(() => call(d, 'authenticated', A, 'select * from sync.saves'), /permission denied/);
    await assert.rejects(() => call(d, 'authenticated', A, 'select sync.me()'), /permission denied/);
  } finally { await d.close(); }
});

test('SYNC-04: only puzzle and league documents, within size and count limits', async () => {
  const d = await db();
  try {
    await assert.rejects(() => push(d, A, { 'digi-yarn-v1': { v: 1 } }), /sync_key_allowed/);
    await assert.rejects(() => push(d, A, { 'dn-today-cache': { v: 1 } }), /sync_key_allowed/);
    await assert.rejects(() => push(d, A, { 'digi-mini-v1': [1, 2] }), /sync_doc_object/);
    await assert.rejects(() => push(d, A, { 'digi-mini-v1': { big: 'x'.repeat(270000) } }), /sync_doc_size/);
    await assert.rejects(() => push(d, A, [1]), /bad_saves/);
    const many = {}; for (let i = 0; i < 41; i++) many['k' + i] = {};
    await assert.rejects(() => push(d, A, many), /too_many/);
    assert.deepEqual(await pull(d, A), {}, 'a refused push stores nothing');
  } finally { await d.close(); }
});

/* ---------- SYNC-REV: revisions and compare-and-swap (toolchain/sql/2026-10-29-sync-revision.sql) ---------- */
const REV_SQL = fs.readFileSync(path.join(__dirname, '../../../toolchain/sql/2026-10-29-sync-revision.sql'), 'utf8');
async function dbRev({ before } = {}) {
  const d = new PGlite();
  await d.exec(HOSTING);
  await d.exec(SQL);
  if (before) await before(d);       // rows written before the migration
  await d.exec(REV_SQL);
  await d.exec(REV_SQL);             // re-runnable
  return d;
}
const pullRev = (d, u) => call(d, 'authenticated', u, 'select public.sync_pull_rev() as v').then(r => r[0].v);
const pushRev = (d, u, saves) => call(d, 'authenticated', u, 'select public.sync_push_rev($1::jsonb) as v', [JSON.stringify(saves)]).then(r => r[0].v);
const revsOf = all => Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.rev]));
/* The client's merge, as dn-track.js's import does it for done lists: first result kept. */
function mergeDone(here, there) {
  const out = { ...(there || {}), ...(here || {}) };
  out.done = { ...((there || {}).done || {}), ...((here || {}).done || {}) };
  for (const id in (there || {}).done || {}) if (!((here || {}).done || {})[id]) out.done[id] = there.done[id];
  return out;
}
/* One device's sync, as dn-sync.js does it: pull, merge, push with the pulled revs, retry on a conflict. */
async function deviceSync(d, u, mine, { between } = {}) {
  for (let i = 0; i < 3; i++) {
    const remote = await pullRev(d, u);
    const merged = {}, saves = {};
    for (const k of new Set([...Object.keys(mine), ...Object.keys(remote)])) merged[k] = mergeDone(mine[k], remote[k] && remote[k].doc);
    Object.assign(mine, merged);
    // What goes to the account: a puzzle it already has a result for keeps that one (first stored).
    for (const k in mine) saves[k] = { doc: remote[k] ? mergeDone(remote[k].doc, mine[k]) : mine[k], rev: remote[k] ? remote[k].rev : 0 };
    if (between && i === 0) await between();
    const r = await pushRev(d, u, saves);
    if (r.ok) return { tries: i + 1, r };
  }
  throw new Error('no agreement after 3 tries');
}

test('SYNC-REV-01: rows from before the migration keep their documents at revision 1; the old functions answer as before', async () => {
  const mini = { v: 1, done: { a: { s: 1 } } };
  const d = await dbRev({ before: d0 => push(d0, A, { 'digi-mini-v1': mini }) });
  try {
    assert.deepEqual(await pull(d, A), { 'digi-mini-v1': mini }, 'sync_pull unchanged');
    assert.deepEqual(await pullRev(d, A), { 'digi-mini-v1': { doc: mini, rev: 1 } });
    assert.equal(await push(d, A, { 'digi-mini-v1': mini }), 1, 'sync_push still counts what it was sent');
    assert.equal((await pullRev(d, A))['digi-mini-v1'].rev, 1, 'an identical document keeps its revision');
  } finally { await d.close(); }
});

test('SYNC-REV-02: the old sync_push bumps the revision, so a client on the new path notices it', async () => {
  const d = await dbRev();
  try {
    const r1 = await pushRev(d, A, { 'digi-mini-v1': { doc: { v: 1, done: { a: { s: 1 } } }, rev: 0 } });
    assert.equal(r1.ok, true);
    const base = r1.revs['digi-mini-v1'];
    assert.equal(await push(d, A, { 'digi-mini-v1': { v: 1, done: { a: { s: 1 }, b: { s: 2 } } } }), 1);   // an app on build 0.2.0
    const now = (await pullRev(d, A))['digi-mini-v1'].rev;
    assert.ok(now > base, 'old push gave a new revision');
    const r2 = await pushRev(d, A, { 'digi-mini-v1': { doc: { v: 1, done: { a: { s: 1 }, c: { s: 3 } } }, rev: base } });
    assert.equal(r2.ok, false);
    assert.deepEqual(r2.conflicts['digi-mini-v1'], { doc: { v: 1, done: { a: { s: 1 }, b: { s: 2 } } }, rev: now });
    assert.deepEqual(Object.keys((await pull(d, A))['digi-mini-v1'].done), ['a', 'b'], 'the refused push stored nothing');
  } finally { await d.close(); }
});

test('SYNC-REV-03: GIVEN two devices on one account from the same base WHEN they push in both orders THEN the second is refused, re-pulls, merges, retries, and a third device gets both', async () => {
  for (const order of [['phone', 'laptop'], ['laptop', 'phone']]) {
    const d = await dbRev();
    try {
      await pushRev(d, A, { 'digi-mini-v1': { doc: { v: 1, done: { base: { s: 1 } } }, rev: 0 } });
      const base = await pullRev(d, A);
      const dev = {
        phone: { 'digi-mini-v1': { v: 1, done: { base: { s: 1 }, p: { s: 10 } } }, 'digi-doku-v1': { v: 1, done: { dp: { s: 1 } } } },
        laptop: { 'digi-mini-v1': { v: 1, done: { base: { s: 1 }, l: { s: 20 } } } }
      };
      const saves = n => Object.fromEntries(Object.entries(dev[n]).map(([k, doc]) => [k, { doc, rev: base[k] ? base[k].rev : 0 }]));
      const first = await pushRev(d, A, saves(order[0]));
      assert.equal(first.ok, true, order[0] + ' goes first');
      const before = await pullRev(d, A);
      const second = await pushRev(d, A, saves(order[1]));
      assert.equal(second.ok, false, order[1] + ' was merged from an old revision');
      assert.ok(second.conflicts['digi-mini-v1'], 'the clash is named');
      assert.deepEqual(await pullRev(d, A), before, 'and NOTHING of its push was stored (not even its other keys)');
      const again = await deviceSync(d, A, dev[order[1]]);
      assert.equal(again.tries, 1);
      const third = await pullRev(d, A);
      assert.deepEqual(Object.keys(third['digi-mini-v1'].doc.done).sort(), ['base', 'l', 'p'], 'a fresh third device gets both results');
      assert.deepEqual(Object.keys(third['digi-doku-v1'].doc.done), ['dp']);
    } finally { await d.close(); }
  }
});

test('SYNC-REV-04: GIVEN the same puzzle finished on two devices WHEN both sync THEN the account keeps the first result stored and each device its own', async () => {
  const d = await dbRev();
  try {
    const phone = { 'digi-mini-v1': { v: 1, done: { x: { s: 30, phone: true } } } };
    const laptop = { 'digi-mini-v1': { v: 1, done: { x: { s: 99, laptop: true } } } };
    // Both pulled an empty account; the laptop pushes between the phone's pull and push.
    const r = await deviceSync(d, A, phone, { between: () => deviceSync(d, A, laptop) });
    assert.equal(r.tries, 2, 'the phone was refused once and retried');
    assert.deepEqual((await pullRev(d, A))['digi-mini-v1'].doc.done.x, { s: 99, laptop: true }, 'the account keeps the result stored first (the laptop’s)');
    assert.deepEqual(phone['digi-mini-v1'].done.x, { s: 30, phone: true }, 'and the phone keeps its own: nothing local is dropped');
  } finally { await d.close(); }
});

test('SYNC-REV-05: forget during a sync: a push based on deleted rows is refused, and the retry stores this device’s results afresh', async () => {
  const d = await dbRev();
  try {
    await deviceSync(d, A, { 'digi-mini-v1': { v: 1, done: { a: { s: 1 } } } });
    const old = await pullRev(d, A);
    await call(d, 'authenticated', A, 'select public.sync_forget()');
    const r = await pushRev(d, A, { 'digi-mini-v1': { doc: { v: 1, done: { a: { s: 1 }, b: { s: 2 } } }, rev: old['digi-mini-v1'].rev } });
    assert.deepEqual(r, { ok: false, conflicts: { 'digi-mini-v1': { doc: null, rev: 0 } } });
    assert.deepEqual(await pullRev(d, A), {}, 'nothing stored by the refused push');
    const mine = { 'digi-mini-v1': { v: 1, done: { a: { s: 1 }, b: { s: 2 } } } };
    await deviceSync(d, A, mine);
    const now = await pullRev(d, A);
    assert.deepEqual(Object.keys(now['digi-mini-v1'].doc.done), ['a', 'b']);
    assert.ok(now['digi-mini-v1'].rev > old['digi-mini-v1'].rev, 'a key stored again never gets an old revision back');
    // Expecting a new key that another device has meanwhile stored is a conflict too.
    const late = await pushRev(d, A, { 'digi-mini-v1': { doc: { v: 1, done: {} }, rev: 0 } });
    assert.equal(late.ok, false);
    assert.equal(late.conflicts['digi-mini-v1'].rev, now['digi-mini-v1'].rev);
  } finally { await d.close(); }
});

test('SYNC-REV-06: no sign-in, no access; own rows only', async () => {
  const d = await dbRev();
  try {
    await assert.rejects(() => call(d, 'anon', null, 'select public.sync_pull_rev()'), /permission denied/);
    await assert.rejects(() => call(d, 'anon', A, 'select public.sync_push_rev($1::jsonb)', ['{}']), /permission denied/);
    await assert.rejects(() => call(d, 'authenticated', null, 'select public.sync_pull_rev()'), /not_signed_in/);
    await assert.rejects(() => call(d, 'authenticated', null, 'select public.sync_push_rev($1::jsonb)', ['{}']), /not_signed_in/);
    await assert.rejects(() => call(d, 'authenticated', A, "select nextval('sync.rev_seq')"), /permission denied/);
    await pushRev(d, A, { 'digi-doku-v1': { doc: { v: 1, done: { x: {} } }, rev: 0 } });
    const a = await pullRev(d, A);
    assert.deepEqual(await pullRev(d, B), {}, 'B sees none of A’s rows');
    // B pushing A's revision of the same key is about B's own (missing) row: a conflict, and A's row is untouched.
    const r = await pushRev(d, B, { 'digi-doku-v1': { doc: { v: 1, done: { y: {} } }, rev: a['digi-doku-v1'].rev } });
    assert.deepEqual(r, { ok: false, conflicts: { 'digi-doku-v1': { doc: null, rev: 0 } } });
    assert.equal((await pushRev(d, B, { 'digi-doku-v1': { doc: { v: 1, done: { y: {} } }, rev: 0 } })).ok, true);
    assert.deepEqual(await pullRev(d, A), a);
  } finally { await d.close(); }
});

test('SYNC-REV-07: the new path keeps the same keys, sizes and counts, and refuses malformed entries', async () => {
  const d = await dbRev();
  try {
    const one = doc => ({ doc, rev: 0 });
    await assert.rejects(() => pushRev(d, A, { 'digi-yarn-v1': one({ v: 1 }) }), /sync_key_allowed/);
    await assert.rejects(() => pushRev(d, A, { 'dn-today-cache': one({ v: 1 }) }), /sync_key_allowed/);
    await assert.rejects(() => pushRev(d, A, { 'digi-mini-v1': one([1, 2]) }), /sync_doc_object/);
    await assert.rejects(() => pushRev(d, A, { 'digi-mini-v1': one({ big: 'x'.repeat(270000) }) }), /sync_doc_size/);
    await assert.rejects(() => pushRev(d, A, [1]), /bad_saves/);
    await assert.rejects(() => pushRev(d, A, { 'digi-mini-v1': { v: 1 } }), /bad_saves/, 'an entry without its doc');
    await assert.rejects(() => pushRev(d, A, { 'digi-mini-v1': { doc: null, rev: 0 } }), /bad_saves/);
    await assert.rejects(() => pushRev(d, A, { 'digi-mini-v1': { doc: {}, rev: 'x' } }), /bad_saves/);
    const many = {}; for (let i = 0; i < 41; i++) many['k' + i] = one({});
    await assert.rejects(() => pushRev(d, A, many), /too_many/);
    // Every allowed key at once: two per type for the eight types, and the board.
    const keys = [];
    for (const t of ['mini', 'doku', 'sweep', 'path', 'link', 'tangle', 'borders', 'reckon']) keys.push('digi-' + t + '-v1', 'digi-' + t + '-streak');
    keys.push('noodle-board-v1');
    assert.equal((await pushRev(d, A, Object.fromEntries(keys.map(k => [k, one({})])))).ok, true, '17 keys, the whole allow-list, fit');
    // The allow-list holds 17 keys, so the 60-a-user cap can't be reached through it; check it is still in the function.
    const src = (await d.query("select prosrc from pg_proc where proname = 'sync_push_rev'")).rows[0].prosrc;
    assert.match(src, /> 60 then raise exception 'too_many'/);
    // A refused push in the middle (one bad key among good ones) stores none of them.
    const before = await pullRev(d, A);
    await assert.rejects(() => pushRev(d, A, { 'digi-mini-v1': { doc: { v: 2 }, rev: before['digi-mini-v1'].rev }, 'digi-yarn-v1': one({}) }), /sync_key_allowed/);
    assert.deepEqual(await pullRev(d, A), before);
  } finally { await d.close(); }
});

/* ---------- SYNC-DEL: delete my account (toolchain/sql/2026-10-29-delete-account.sql) ---------- */
const DEL_SQL = fs.readFileSync(path.join(__dirname, '../../../toolchain/sql/2026-10-29-delete-account.sql'), 'utf8');
// Supabase's auth.users, reduced to what the function touches; sessions cascade from it as on the hosting.
const AUTH_USERS = `
  create table auth.users (id uuid primary key, email text);
  create table auth.sessions (id serial primary key, user_id uuid not null references auth.users(id) on delete cascade);
`;
async function dbDel() {
  const d = new PGlite();
  await d.exec(HOSTING);
  await d.exec(AUTH_USERS);
  await d.exec(SQL);
  await d.exec(REV_SQL);
  await d.exec(DEL_SQL);
  await d.exec(DEL_SQL);   // re-runnable
  await d.query("insert into auth.users values ($1, 'a@example.test'), ($2, 'b@example.test')", [A, B]);
  await d.query('insert into auth.sessions (user_id) values ($1), ($1), ($2)', [A, B]);
  return d;
}
const users = async d => (await d.query('select id from auth.users order by id')).rows.map(r => r.id);
const sessions = async d => (await d.query('select user_id from auth.sessions order by user_id')).rows.map(r => r.user_id);
const deleteAccount = (d, u, role = 'authenticated') => call(d, role, u, 'select public.sync_delete_account() as v').then(r => r[0].v);

test('SYNC-DEL-01: GIVEN a signed-in player WHEN they delete their account THEN their synced copy, sign-in user and sessions are gone, and nobody else’s', async () => {
  const d = await dbDel();
  try {
    await push(d, A, { 'digi-mini-v1': { v: 1, done: { a: {} } }, 'noodle-board-v1': { pid: B, leagues: [] } });
    await push(d, B, { 'digi-mini-v1': { v: 1, done: { b: {} } } });
    assert.equal(await deleteAccount(d, A), true);
    assert.deepEqual((await d.query('select user_id from sync.saves')).rows.map(r => r.user_id), [B], 'only B’s rows are left');
    assert.deepEqual(await users(d), [B], 'A’s sign-in account is gone, B’s is not');
    assert.deepEqual(await sessions(d), [B]);
    assert.deepEqual(Object.keys((await pull(d, B))['digi-mini-v1'].done), ['b']);
  } finally { await d.close(); }
});

test('SYNC-DEL-02: no sign-in, no deletion; calling twice is safe', async () => {
  const d = await dbDel();
  try {
    await assert.rejects(() => deleteAccount(d, null, 'anon'), /permission denied/);
    await assert.rejects(() => deleteAccount(d, A, 'anon'), /permission denied/, 'anon can’t call it even with a user in the claims');
    await assert.rejects(() => deleteAccount(d, null), /not_signed_in/);
    assert.deepEqual(await users(d), [A, B], 'nothing deleted by refused calls');
    assert.equal(await deleteAccount(d, A), true);
    assert.equal(await deleteAccount(d, A), true, 'a second call (a stale token) deletes nothing more and does not fail');
    assert.deepEqual(await users(d), [B]);
    // The role can't touch auth.users directly; only the function can.
    await assert.rejects(() => call(d, 'authenticated', B, 'delete from auth.users'), /permission denied/);
    const src = (await d.query("select prosecdef, proconfig from pg_proc where proname = 'sync_delete_account'")).rows[0];
    assert.equal(src.prosecdef, true);
    assert.deepEqual(src.proconfig, ['search_path=""']);
  } finally { await d.close(); }
});
