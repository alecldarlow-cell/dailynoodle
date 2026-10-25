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
