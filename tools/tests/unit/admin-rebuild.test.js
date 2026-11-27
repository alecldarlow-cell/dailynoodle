'use strict';
// Admin rebuild (27 Nov 2026): admin_players, admin_scorecard, admin_ops and admin_refresh on a
// disposable PGlite database (never a real project). The live views are stood in for by tables
// with the same columns; the migration's materialized copy is built over them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const SQL = fs.readFileSync(path.join(__dirname, '../../../toolchain/sql/2026-11-27-admin-rebuild.sql'), 'utf8');
const A = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function db() {
  const d = new PGlite();
  await d.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema insights;
    create table auth.who (email text);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce((select jsonb_build_object('email', email) from auth.who limit 1), '{}'::jsonb) $$;
    create table insights.admins (email text primary key);
    insert into insights.admins values ('alec@example.com');
    create table insights.ev (id bigserial, occurred_at timestamptz, anon_id uuid, section text, event text,
      item_path text, props jsonb, day date);
    create table insights.page_loads (pv text, item_path text, section text, anon_id uuid, opened_at timestamptz,
      day date, started boolean, outcome text, solve_secs int, help_used int, score int, got int, of_n int,
      words int, mistakes int);
    create table insights.app_errors (id bigserial, at timestamptz, kind text, message text, version text);
    create table insights.lab_votes (voter text, type text, vote boolean, source text, first_at timestamptz, at timestamptz);`);
  await d.exec(SQL);
  await d.exec(SQL); // safe to re-run
  return d;
}
const admin = d => d.query(`insert into auth.who values ('alec@example.com')`);
const one = async (d, q) => (await d.query(q)).rows[0].v;
let pvn = 0;
const load = (a, file, day, outcome, o = {}) => `('pv${++pvn}', 'reports/${file}', 'puzzles', '${a}', '${day}T09:00:00Z', '${day}',
  ${o.started ?? true}, ${outcome ? `'${outcome}'` : 'null'}, ${o.secs ?? 'null'}, ${o.help ?? 0}, ${o.score ?? 'null'},
  ${o.got ?? 'null'}, ${o.of ?? 'null'}, null, ${o.mistakes ?? 'null'})`;
const ev = (a, day, event, props = {}) => `('${day}T09:00:00Z', '${a}', 'puzzles', '${event}', 'x', '${JSON.stringify(props)}', '${day}')`;

test('ADMIN-REBUILD-01: GIVEN no admin email WHEN any new admin function is called THEN it refuses; a bad range is refused', async () => {
  const d = await db();
  try {
    for (const q of [`select public.admin_players('2026-11-01','2026-11-26')`, `select public.admin_scorecard('2026-11-01','2026-11-26')`,
                     `select public.admin_ops()`, `select public.admin_refresh()`])
      await assert.rejects(d.query(q), /not_admin/);
    await admin(d);
    await assert.rejects(d.query(`select public.admin_scorecard('2026-11-26','2026-11-01')`), /bad_range/);
  } finally { await d.close(); }
});

test('ADMIN-REBUILD-02: GIVEN Links won, failed and abandoned WHEN the scorecard is read THEN won, finished, gold, returning and the per-puzzle row are right', async () => {
  const d = await db();
  try {
    const f = '2026-11-20-word-link-0104.html';
    await d.exec(`insert into insights.page_loads values
      ${load(A(1), f, '2026-11-20', 'solved', { secs: 50, mistakes: 0 })},
      ${load(A(2), f, '2026-11-20', 'failed', { mistakes: 4 })},
      ${load(A(3), f, '2026-11-20', null)},
      ${load(A(4), f, '2026-11-20', 'solved', { secs: 120, mistakes: 2 })},
      ${load(A(5), f, '2026-11-20', 'solved', { secs: 90, mistakes: 1 })},
      ${load(A(1), '2026-11-21-word-link-0105.html', '2026-11-21', 'solved', { secs: 70, mistakes: 0 })}`);
    await d.exec(`refresh materialized view insights.page_loads_mat`);
    await admin(d);
    const s = await one(d, `select public.admin_scorecard('2026-11-14','2026-11-26') v`);
    const link = s.types.find(t => t.slug === 'word-link');
    assert.equal(link.players, 5);
    assert.equal(link.attempts, 6);
    assert.equal(link.pct_won, 80);          // 4 solved of 5 decided
    assert.equal(link.pct_finished, 67);     // 4 of 6
    assert.equal(link.pct_unfinished, 17);   // 1 of 6
    assert.equal(link.gold, 1);              // only A1's 0:50 no-mistake solve
    assert.equal(link.pct_returning, 20);    // A1 on 2 days
    assert.equal(link.pct_of_players, 100);
    const pz = s.puzzles.find(p => p.path === 'reports/' + f);
    assert.equal(pz.players, 5);
    assert.equal(pz.pct_won, 75);
    assert.equal(s.puzzles.length, 1, 'puzzles with fewer than 5 players are left out');
    assert.ok(s.prev && Array.isArray(s.prev.types), 'the window before is returned');
    assert.equal(s.prev.puzzles, undefined);
  } finally { await d.close(); }
});

test('ADMIN-REBUILD-03: GIVEN Doku bands passed in WHEN the scorecard is read THEN figures split by band', async () => {
  const d = await db();
  try {
    const e = '2026-11-25-logic-doku-0135.html', h = '2026-11-23-logic-doku-0133.html';
    await d.exec(`insert into insights.page_loads values
      ${load(A(1), e, '2026-11-25', 'solved', { secs: 30 })}, ${load(A(2), e, '2026-11-25', 'solved', { secs: 40 })},
      ${load(A(1), h, '2026-11-23', 'solved', { secs: 300 })}, ${load(A(2), h, '2026-11-23', null)}`);
    await d.exec(`refresh materialized view insights.page_loads_mat`);
    await admin(d);
    const s = await one(d, `select public.admin_scorecard('2026-11-14','2026-11-26',
      '{"reports/${e}":"easy","reports/${h}":"hard"}'::jsonb) v`);
    const by = Object.fromEntries(s.bands.map(b => [b.band, b]));
    assert.equal(by.easy.pct_finished, 100);
    assert.equal(by.easy.med_secs, 30);
    assert.equal(by.hard.pct_finished, 50);
    assert.equal(by.hard.attempts, 2);
  } finally { await d.close(); }
});

test('ADMIN-REBUILD-04: GIVEN starts, a share arrival and app plays WHEN players are read THEN daily, returning, cohorts, loops and sources add up', async () => {
  const d = await db();
  try {
    await d.exec(`insert into insights.ev (occurred_at, anon_id, section, event, item_path, props, day) values
      ${ev(A(1), '2026-11-01', 'page_view', { inst: '0' })}, ${ev(A(1), '2026-11-01', 'puzzle_start')},
      ${ev(A(1), '2026-11-02', 'puzzle_start')}, ${ev(A(1), '2026-11-10', 'puzzle_start')},
      ${ev(A(1), '2026-11-02', 'share_click')},
      ${ev(A(2), '2026-11-02', 'page_view', { via: 'share' })}, ${ev(A(2), '2026-11-02', 'puzzle_start')},
      ${ev(A(3), '2026-11-03', 'page_view', { inst: '2', via: 'app' })}, ${ev(A(3), '2026-11-03', 'puzzle_start')},
      ${ev(A(3), '2026-11-04', 'puzzle_start')}, ${ev(A(3), '2026-11-05', 'puzzle_start')},
      ${ev(A(4), '2026-11-04', 'page_view', {})},
      ${ev(A(1), '2026-11-03', 'board_join')}`);
    await admin(d);
    const p = await one(d, `select public.admin_players('2026-11-01','2026-11-14') v`);
    assert.equal(p.players, 3);
    assert.equal(p.new_players, 3);
    const day2 = p.daily.find(x => x.day === '2026-11-02');
    assert.deepEqual([day2.players, day2.returning, day2.new], [2, 1, 1]);
    assert.equal(p.daily.length, 14);
    assert.equal(p.cohort.d1_n, 3);
    assert.equal(p.cohort.d1, 2);             // A1 back on 2 Nov, A3 on 4 Nov
    assert.equal(p.cohort.w2, 1);             // A1 on 10 Nov (days 7-13 after 1 Nov)
    assert.equal(p.app.players_30, 1);        // A3
    assert.equal(p.loops.share_taps, 1);
    assert.equal(p.loops.share_arrivals, 1);
    assert.equal(p.loops.share_played, 1);
    assert.equal(p.loops.share_back, 0);
    assert.equal(p.loops.joins, 1);
    assert.equal(p.loops.joins_playing, 1);   // A1 played on 10 Nov, 7 days after joining
    assert.equal(p.loops.app_regular, 1);     // A3 on 3 days
    const src = Object.fromEntries(p.sources.map(s => [s.src, s]));
    assert.equal(src['Shared result'].played, 1);
    assert.equal(src['The app'].regular, 1);
    assert.equal(src['Direct or bookmark'].played, 1);   // A1 only; A4 never played
    assert.equal(src['Direct or bookmark'].visitors, 2);  // A4 visited but never played
  } finally { await d.close(); }
});

test('ADMIN-REBUILD-05: GIVEN app errors, Lab votes and a task run WHEN ops are read THEN counts and the latest run per task come back', async () => {
  const d = await db();
  try {
    await d.exec(`insert into insights.app_errors (at, kind, message, version) values
        (now() - interval '1 hour', 'fatal', 'boom', '0.5.0'), (now() - interval '3 days', 'save', 'quota', '0.5.0'),
        (now() - interval '20 days', 'save', 'old', '0.4.0');
      insert into insights.lab_votes values ('a:1','tilt',true,'app',now() - interval '2 days',now()),
        ('a:2','tilt',false,'web',now() - interval '10 days',now());
      insert into insights.task_runs (task, ran_at, ok, summary) values ('morning-check', now() - interval '1 day', true, 'ok'),
        ('morning-check', now(), false, 'build failed');`);
    await admin(d);
    const o = await one(d, `select public.admin_ops() v`);
    assert.equal(o.app_errors.day, 1);
    assert.equal(o.app_errors.week, 2);
    assert.equal(o.app_errors.fatal_week, 1);
    assert.equal(o.app_errors.latest_version, '0.5.0');
    const tilt = o.lab_votes.find(v => v.type === 'tilt');
    assert.deepEqual([tilt.total, tilt.yes, tilt.new_7d], [2, 1, 1]);
    assert.equal(o.tasks.length, 1);
    assert.equal(o.tasks[0].ok, false);
    assert.ok(await one(d, `select public.admin_refresh() v`));
  } finally { await d.close(); }
});
