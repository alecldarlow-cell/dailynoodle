'use strict';
// Lab trial votes (11 Nov 2026), on a disposable PGlite database. Never a real project.
// The migration's last step patches the live dashboard's regex; its own checks run on the
// live definitions, so here the file is run up to that step, over a stand-in page_loads.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const SQL = fs.readFileSync(path.join(__dirname, '../../../toolchain/sql/2026-11-11-lab-votes.sql'), 'utf8');
const MARK = '-- The three Lab slugs';
const A1 = '00000000-0000-4000-8000-0000000000a1', A2 = '00000000-0000-4000-8000-0000000000a2';
const U1 = '00000000-0000-4000-8000-00000000000b';

async function db() {
  const d = new PGlite();
  await d.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema insights;
    create table auth.who (uid uuid, email text);
    create function auth.uid() returns uuid language sql stable as $$ select uid from auth.who limit 1 $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce((select jsonb_build_object('email', email) from auth.who limit 1), '{}'::jsonb) $$;
    create table insights.admins (email text primary key);
    insert into insights.admins values ('alec@example.com');
    create table insights.page_loads (item_path text, section text, anon_id uuid, day date,
      started boolean, outcome text, solve_secs int);`);
  assert.ok(SQL.includes(MARK));
  const body = SQL.slice(0, SQL.indexOf(MARK));
  await d.exec(body);
  await d.exec(body); // safe to re-run
  return d;
}
const vote = async (d, anon, type, yes, src = 'app') =>
  (await d.query(`select public.lab_vote($1, $2, $3, $4) v`, [anon, type, yes, src])).rows[0].v;
const rows = async d => (await d.query(`select voter, type, vote, source from insights.lab_votes order by voter, type`)).rows;

test('LAB-VOTE-SQL-01: GIVEN a device WHEN it votes and votes again THEN one row holds its latest answer', async () => {
  const d = await db();
  try {
    assert.equal(await vote(d, A1, 'redact', true), true);
    assert.equal(await vote(d, A1, 'redact', false, 'web'), true);
    assert.equal(await vote(d, A1, 'tilt', true), true);
    assert.deepEqual(await rows(d), [
      { voter: `a:${A1}`, type: 'redact', vote: false, source: 'web' },
      { voter: `a:${A1}`, type: 'tilt', vote: true, source: 'app' },
    ]);
  } finally { await d.close(); }
});

test('LAB-VOTE-SQL-02: GIVEN bad input WHEN voting THEN nothing is kept', async () => {
  const d = await db();
  try {
    assert.equal(await vote(d, A1, 'mini', true), false);      // a daily type
    assert.equal(await vote(d, A1, 'redact', true, 'ios'), false);
    assert.equal(await vote(d, null, 'redact', true), false);  // no voter at all
    assert.equal(await vote(d, A1, 'redact', null), false);
    assert.deepEqual(await rows(d), []);
  } finally { await d.close(); }
});

test('LAB-VOTE-SQL-03: GIVEN a signed-in player WHEN they vote from two devices THEN it counts once, on the account', async () => {
  const d = await db();
  try {
    await d.query(`insert into auth.who values ($1, null)`, [U1]);
    await vote(d, A1, 'tumbler', true);
    await vote(d, A2, 'tumbler', false, 'web');
    assert.deepEqual(await rows(d), [{ voter: `u:${U1}`, type: 'tumbler', vote: false, source: 'web' }]);
  } finally { await d.close(); }
});

test('LAB-VOTE-SQL-04: GIVEN 600 votes this hour WHEN another arrives THEN it is refused', async () => {
  const d = await db();
  try {
    await d.exec(`insert into insights.lab_votes (voter, type, vote, source)
      select 'a:' || gen_random_uuid(), 'redact', true, 'app' from generate_series(1, 600)`);
    assert.equal(await vote(d, A1, 'redact', true), false);
  } finally { await d.close(); }
});

test('LAB-VOTE-SQL-05: GIVEN plays and votes WHEN the admin reads the Lab THEN abandons sit beside the votes; others are refused', async () => {
  const d = await db();
  try {
    await d.exec(`insert into insights.page_loads values
      ('reports/2026-11-10-word-redact-0024.html', 'puzzles', '${A1}', '2026-11-10', true, 'solved', 100),
      ('reports/2026-11-10-word-redact-0024.html', 'puzzles', '${A2}', '2026-11-10', true, null, null),
      ('reports/2026-11-10-word-redact-0024.html', 'puzzles', '${A2}', '2026-11-10', false, null, null),
      ('reports/2026-11-10-logic-tilt-0024.html', 'puzzles', '${A1}', '2026-11-10', true, 'solved', 40),
      ('reports/2026-11-10-crossword-mini-0300.html', 'puzzles', '${A1}', '2026-11-10', true, 'solved', 30)`);
    await vote(d, A1, 'redact', true);
    await vote(d, A2, 'redact', false, 'web');
    await vote(d, A1, 'tilt', true);
    // not signed in as an admin: refused
    await assert.rejects(d.query(`select public.admin_lab(current_date - 7, current_date + 1)`), /not_admin/);
    await d.query(`insert into auth.who values (null, 'alec@example.com')`);
    const out = (await d.query(`select public.admin_lab('2026-11-01', current_date + 1) v`)).rows[0].v;
    const by = Object.fromEntries(out.types.map(t => [t.type, t]));
    assert.deepEqual(Object.keys(by), ['redact', 'tilt', 'tumbler']);
    assert.equal(by.redact.players, 2);
    assert.equal(by.redact.starts, 2);
    assert.equal(by.redact.finishes, 1);
    assert.equal(by.redact.abandons, 1);
    assert.equal(by.redact.pct_abandoned, 50);
    assert.equal(by.redact.median_solve_secs, 100);
    assert.equal(by.redact.yes, 1);
    assert.equal(by.redact.no, 1);
    assert.equal(by.redact.pct_yes, 50);
    assert.deepEqual(by.redact.app, { yes: 1, no: 0 });
    assert.deepEqual(by.redact.web, { yes: 0, no: 1 });
    assert.equal(by.tilt.pct_yes, 100);
    assert.equal(by.tumbler.players, 0);
    assert.equal(by.tumbler.pct_yes, null);
  } finally { await d.close(); }
});
