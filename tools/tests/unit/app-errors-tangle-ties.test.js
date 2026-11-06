'use strict';
// The app's error log and Tangle's score-only ranking (5 Nov 2026), on a disposable PGlite
// database built from the board's real migrations. Never a real project.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const dir = path.join(__dirname, '../../../toolchain/sql');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const HOSTING = `
  create role anon; create role authenticated; create role service_role;
  create schema if not exists auth; create schema if not exists insights; create schema if not exists extensions;
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create table insights.admins (email text primary key);
`;
const CHAIN = ['2026-10-18-leaderboards.sql', '2026-10-18-leaderboards-hide-only.sql', '2026-10-20-reckon-board.sql', '2026-10-24-board-pins-and-overall.sql',
  '2026-10-25-board-records.sql', '2026-11-04-points-players-beaten.sql', '2026-11-04-tally-board.sql'];
const P1 = '00000000-0000-4000-8000-000000000001', P2 = '00000000-0000-4000-8000-000000000002',
  P3 = '00000000-0000-4000-8000-000000000003', PATH = 'reports/2026-11-02-word-tangle-0001.html';

async function league(withFix) {
  const d = new PGlite();
  await d.exec(HOSTING);
  for (const f of CHAIN) await d.exec(read(f));
  if (withFix) await d.exec(read('2026-11-05-tangle-score-only.sql'));
  await d.exec(`
    insert into board.leagues (id, code, name, owner) overriding system value values (1, 'ABCDEFGH', 'Test', '${P1}');
    insert into board.members (league_id, player, nickname) values (1, '${P1}', 'Ann'), (1, '${P2}', 'Bob'), (1, '${P3}', 'Cy');
    insert into board.results (player, puzzle_path, ptype, puzzle_date, outcome, secs, score) values
      ('${P1}', '${PATH}', 'tangle', '2026-11-02', 'scored', 90, 40),
      ('${P2}', '${PATH}', 'tangle', '2026-11-02', 'scored', null, 40),
      ('${P3}', '${PATH}', 'tangle', '2026-11-02', 'scored', 90, 10);`);
  return d;
}
const day = async d => (await d.query(`select public.board_day('${P1}', 'ABCDEFGH', 'tangle', '2026-11-02') v`)).rows[0].v;
const overall = async d => (await d.query(`select public.board_overall('${P1}', 'ABCDEFGH', '2026-11-02') v`)).rows[0].v;

test('TANGLE-TIE-01: a result with no time draws with the same score, on the board and in points', async () => {
  // GIVEN Ann (90 s) and Bob (no time, copied in) on 40, Cy on 10
  const d = await league(true);
  try {
    // WHEN the board and the All puzzles table are read
    const ranks = Object.fromEntries((await day(d)).ranked.map(r => [r.nick, r.rank]));
    const pts = Object.fromEntries((await overall(d)).day.map(r => [r.nick, r.points]));
    // THEN Ann and Bob share first and each beat only Cy
    assert.deepEqual(ranks, { Ann: 1, Bob: 1, Cy: 3 });
    assert.deepEqual(pts, { Ann: 1, Bob: 1, Cy: 0 });
  } finally { await d.close(); }
});

test('TANGLE-TIE-02: before the change the blank time lost the tie', async () => {
  // GIVEN the same results on the old functions  WHEN the board is read
  const d = await league(false);
  try {
    const ranks = Object.fromEntries((await day(d)).ranked.map(r => [r.nick, r.rank]));
    // THEN Bob came second: what TANGLE-TIE-01 fixes
    assert.deepEqual(ranks, { Ann: 1, Bob: 2, Cy: 3 });
  } finally { await d.close(); }
});

test('TANGLE-TIE-03: the migration can be re-run, and other puzzles still rank by time', async () => {
  const d = await league(true);
  try {
    await d.exec(read('2026-11-05-tangle-score-only.sql'));
    const p = 'reports/2026-11-02-crossword-mini-0001.html';
    await d.exec(`insert into board.results (player, puzzle_path, ptype, puzzle_date, outcome, secs) values
      ('${P1}', '${p}', 'mini', '2026-11-02', 'solved', 80), ('${P2}', '${p}', 'mini', '2026-11-02', 'solved', 60)`);
    const r = (await d.query(`select public.board_day('${P1}', 'ABCDEFGH', 'mini', '2026-11-02') v`)).rows[0].v;
    assert.deepEqual(r.ranked.map(x => x.nick), ['Bob', 'Ann']);
  } finally { await d.close(); }
});

async function errors() {
  const d = new PGlite();
  await d.exec(HOSTING);
  await d.exec(read('2026-11-05-app-errors.sql'));
  await d.exec(read('2026-11-05-app-errors.sql')); // the migration can be re-run
  return d;
}
const asAnon = (d, sql, params = []) => d.transaction(async tx => {
  await tx.exec('set local role anon');
  return (await tx.query(sql, params)).rows;
});
const log = (d, p) => asAnon(d, 'select public.log_app_error($1::jsonb) v', [JSON.stringify(p)]).then(r => r[0].v);

test('APP-ERR-01: the app can log an error, cut to length, and can never read the log', async () => {
  const d = await errors();
  try {
    assert.equal(await log(d, { kind: 'crash', message: 'x'.repeat(900), stack: 's', screen: '/play', version: '0.3.0', update: 'ab12', platform: 'android' }), true);
    const [row] = (await d.query('select * from insights.app_errors')).rows;
    assert.equal(row.message.length, 300);
    assert.equal(row.platform, 'android');
    await assert.rejects(asAnon(d, 'select * from insights.app_errors'));
  } finally { await d.close(); }
});

test('APP-ERR-02: a malformed report stores nothing, and the hourly limit holds', async () => {
  const d = await errors();
  try {
    assert.equal(await log(d, { kind: 'BAD KIND', message: 'x' }), false);
    assert.equal(await log(d, { kind: 'crash' }), false);
    await d.exec(`insert into insights.app_errors (kind, message) select 'crash', 'm' from generate_series(1, 300)`);
    assert.equal(await log(d, { kind: 'crash', message: 'one too many' }), false);
    assert.equal((await d.query('select count(*)::int n from insights.app_errors')).rows[0].n, 300);
  } finally { await d.close(); }
});

test('BOARD-NICK: a member can change their nickname, within the rules, keeping their results', async () => {
  // GIVEN Ann, Bob and Cy in a league, with results
  const d = await league(true);
  try {
    await d.exec(read('2026-11-06-board-set-nick.sql'));
    const set = (p, n) => d.query(`select public.board_set_nick($1, 'ABCDEFGH', $2) v`, [p, n]);
    // WHEN Ann renames THEN the board shows the new name with the same result
    assert.equal((await set(P1, 'Annie')).rows[0].v, 'Annie');
    assert.ok((await day(d)).ranked.some(r => r.nick === 'Annie' && r.score === 40));
    // AND changing only the capitals of your own name is fine
    assert.equal((await set(P1, 'ANNIE')).rows[0].v, 'ANNIE');
    // AND someone else's name, a bad name or a non-member is refused
    await assert.rejects(set(P2, 'annie'), /nick_taken/);
    await assert.rejects(set(P2, 'x'), /bad_nick/);
    await assert.rejects(set('00000000-0000-4000-8000-000000000009', 'Dee'), /not_member/);
  } finally { await d.close(); }
});
