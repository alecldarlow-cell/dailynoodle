'use strict';
// Cryptic joins the Lab trial (20 Nov 2026), on a disposable PGlite database. Never a real project.
// Runs the 11 Nov Lab migration (up to its live-regex step), the 17 Nov read-out, then 2026-11-20-lab-cryptic.sql.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const dir = path.join(__dirname, '../../../toolchain/sql');
const BASE = fs.readFileSync(path.join(dir, '2026-11-11-lab-votes.sql'), 'utf8');
const READOUT = fs.readFileSync(path.join(dir, '2026-11-17-lab-readout.sql'), 'utf8');
const CRYPTIC = fs.readFileSync(path.join(dir, '2026-11-20-lab-cryptic.sql'), 'utf8');
const A = n => `00000000-0000-4000-8000-00000000000${n}`;

async function db() {
  const d = new PGlite();
  await d.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema insights; create schema sync;
    create table auth.who (uid uuid, email text);
    create function auth.uid() returns uuid language sql stable as $$ select uid from auth.who limit 1 $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce((select jsonb_build_object('email', email) from auth.who limit 1), '{}'::jsonb) $$;
    create table insights.admins (email text primary key);
    insert into insights.admins values ('alec@example.com');
    create table insights.page_loads (item_path text, section text, anon_id uuid, day date,
      started boolean, outcome text, solve_secs int);
    create table sync.saves (user_id uuid, key text, doc jsonb, constraint sync_key_allowed check (key = 'noodle-board-v1'));`);
  await d.exec(BASE.slice(0, BASE.indexOf('-- The three Lab slugs')));
  await d.exec(READOUT);
  await d.exec(CRYPTIC);
  await d.exec(CRYPTIC); // safe to re-run
  return d;
}

test('LAB-CRYPTIC-01: GIVEN the Cryptic migration WHEN a player votes on Cryptic THEN the vote is kept, and an unknown type is still refused', async () => {
  const d = await db();
  try {
    await d.query(`select public.lab_vote('${A(1)}', 'cryptic', true, 'app')`);
    const rows = (await d.query(`select type, vote, source from insights.lab_votes`)).rows;
    assert.deepEqual(rows, [{ type: 'cryptic', vote: true, source: 'app' }]);
    try { await d.query(`select public.lab_vote('${A(2)}', 'nonsense', true, 'web')`); } catch (e) { /* refused by raising, or by returning false */ }
    const n = (await d.query(`select count(*)::int n from insights.lab_votes`)).rows[0].n;
    assert.equal(n, 1);
  } finally { await d.close(); }
});

test('LAB-CRYPTIC-02: GIVEN Cryptic and Tumbler plays WHEN the admin reads the Lab THEN each is counted under its own type and Redact is still listed', async () => {
  const d = await db();
  try {
    await d.exec(`insert into insights.page_loads values
      ('reports/2026-11-21-word-cryptic-0001.html', 'puzzles', '${A(1)}', '2026-11-21', true, 'solved', 50),
      ('reports/2026-11-22-word-cryptic-0002.html', 'puzzles', '${A(1)}', '2026-11-22', true, 'solved', 70),
      ('reports/2026-11-21-word-tumbler-0035.html', 'puzzles', '${A(2)}', '2026-11-21', true, 'solved', 60)`);
    await d.query(`insert into auth.who values (null, 'alec@example.com')`);
    const out = (await d.query(`select public.admin_lab('2026-11-01', '2026-11-30') v`)).rows[0].v;
    const by = Object.fromEntries(out.types.map(t => [t.type, t]));
    assert.deepEqual(Object.keys(by).sort(), ['cryptic', 'redact', 'tilt', 'tumbler']);
    assert.equal(by.cryptic.starters, 1);
    assert.equal(by.cryptic.returners, 1);
    assert.equal(by.tumbler.starters, 1);
    assert.equal(by.tumbler.returners, 0);
  } finally { await d.close(); }
});

test('LAB-CRYPTIC-03: GIVEN the Cryptic migration WHEN a signed-in player syncs THEN digi-cryptic keys are accepted and unknown keys still refused', async () => {
  const d = await db();
  try {
    await d.exec(`insert into sync.saves values ('${A(1)}', 'digi-cryptic-v1', '{}'), ('${A(1)}', 'digi-cryptic-streak', '{}')`);
    await assert.rejects(d.exec(`insert into sync.saves values ('${A(1)}', 'digi-nope-v1', '{}')`), /sync_key_allowed/);
  } finally { await d.close(); }
});
