'use strict';
// Lab trial read-out (17 Nov 2026), on a disposable PGlite database. Never a real project.
// Runs the 11 Nov Lab migration (up to its live-regex step), then the 17 Nov admin_lab.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const dir = path.join(__dirname, '../../../toolchain/sql');
const BASE = fs.readFileSync(path.join(dir, '2026-11-11-lab-votes.sql'), 'utf8');
const NEXT = fs.readFileSync(path.join(dir, '2026-11-17-lab-readout.sql'), 'utf8');
const A = n => `00000000-0000-4000-8000-00000000000${n}`;

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
  await d.exec(BASE.slice(0, BASE.indexOf('-- The three Lab slugs')));
  await d.exec(NEXT);
  await d.exec(NEXT); // safe to re-run
  return d;
}
const tilt = (a, day, outcome = 'solved', started = true) =>
  `('reports/${day}-logic-tilt-00${day.slice(-2)}.html', 'puzzles', '${a}', '${day}', ${started}, ${outcome ? `'${outcome}'` : 'null'}, ${outcome ? 60 : 'null'})`;

test('LAB-READOUT-01: GIVEN one player back three days, one twice, one once and one who only looked WHEN the admin reads the Lab THEN returners, regulars and finishing are counted', async () => {
  const d = await db();
  try {
    await d.exec(`insert into insights.page_loads values
      ${tilt(A(1), '2026-11-14')}, ${tilt(A(1), '2026-11-15')}, ${tilt(A(1), '2026-11-16')},
      ${tilt(A(1), '2026-11-16')},
      ${tilt(A(2), '2026-11-14', null)}, ${tilt(A(2), '2026-11-16')},
      ${tilt(A(3), '2026-11-15', null)},
      ${tilt(A(4), '2026-11-15', null, false)}`);
    await assert.rejects(d.query(`select public.admin_lab('2026-11-01', '2026-11-30')`), /not_admin/);
    await d.query(`insert into auth.who values (null, 'alec@example.com')`);
    const out = (await d.query(`select public.admin_lab('2026-11-01', '2026-11-30') v`)).rows[0].v;
    const by = Object.fromEntries(out.types.map(t => [t.type, t]));
    const t = by.tilt;
    assert.equal(t.players, 4);       // includes the one who only looked
    assert.equal(t.starters, 3);
    assert.equal(t.returners, 2);     // A1 (3 days), A2 (2 days)
    assert.equal(t.regulars, 1);      // A1
    assert.equal(t.pct_returned, 67); // 2 of 3 starters
    assert.equal(Number(t.avg_days), 2); // (3 + 2 + 1) / 3
    assert.equal(t.pct_finished, 67); // A1, A2 of 3 starters
    assert.equal(t.trial_days, 3);
    assert.equal(t.abandons, 2);      // unchanged figures still there
    assert.equal(by.redact.returners, 0);
    assert.equal(by.redact.pct_returned, null);
    assert.equal(by.redact.avg_days, null);
  } finally { await d.close(); }
});

test('LAB-READOUT-02: GIVEN a range that cuts a regular to one day WHEN the admin reads it THEN only days in the range count', async () => {
  const d = await db();
  try {
    await d.exec(`insert into insights.page_loads values
      ${tilt(A(1), '2026-11-14')}, ${tilt(A(1), '2026-11-15')}, ${tilt(A(1), '2026-11-16')}`);
    await d.query(`insert into auth.who values (null, 'alec@example.com')`);
    const out = (await d.query(`select public.admin_lab('2026-11-16', '2026-11-16') v`)).rows[0].v;
    const t = out.types.find(x => x.type === 'tilt');
    assert.equal(t.returners, 0);
    assert.equal(t.trial_days, 1);
  } finally { await d.close(); }
});
