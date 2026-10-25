/* ---------------------------------------------------------------------------
   A disposable leaderboard database for the tests (tools/tests/).

   boardDb() starts an in-memory PGlite PostgreSQL (WASM) and applies the real
   checked-in board migrations, in order. Only the interfaces the hosting
   provides are stubbed: the anon/authenticated/service_role roles, auth.jwt(),
   insights.admins and public.events. No URL, credential, server or network is
   involved; close() throws the whole database away.

   rpc(db, fn, body, headers) answers one PostgREST call, POST /rest/v1/rpc/<fn>
   with a JSON body of named arguments, the way PostgREST does for the board:
   the request's role (anon for an apikey-only call, as dn-board.js makes; no
   signed-in calls are supported here), request.jwt.claims and request.headers
   set for that one transaction, `select public.<fn>(name => $1, ...)`, the
   function's single value as the JSON body, and a raised exception as
   400 {code, message, details, hint} (401 for permission errors). Used by
   backend.test.js (SQL directly) and browser/board.spec.js (pages' calls).
--------------------------------------------------------------------------- */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const MIGRATIONS = ['2026-10-18-leaderboards.sql', '2026-10-18-leaderboards-hide-only.sql', '2026-10-20-reckon-board.sql',
                    '2026-10-24-board-pins-and-overall.sql', '2026-10-25-board-records.sql'];
const HOSTING = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create schema insights; create table insights.admins(email text);
  create table public.events(anon_id uuid, event text, item_path text, props jsonb, occurred_at timestamptz default now());
`;

/* today: optional 'YYYY-MM-DD' to pin board.today() (the database's London date)
   to a test's fake clock; the migrations' own definition is used otherwise. */
async function boardDb({ today = null } = {}) {
  const db = new PGlite();
  try {
    await db.exec(HOSTING);
    for (const name of MIGRATIONS) await db.exec(fs.readFileSync(path.join(__dirname, '../../toolchain/sql', name), 'utf8'));
    if (today) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('boardDb: today must be YYYY-MM-DD');
      await db.exec(`create or replace function board.today() returns date language sql stable set search_path = '' as $$ select '${today}'::date $$`);
    }
  } catch (e) { await db.close().catch(() => {}); throw e; }
  return db;
}

const NAME = /^[a-z_][a-z0-9_]{0,62}$/;
async function rpc(db, fn, body, headers = {}) {
  const h = {}; for (const k of Object.keys(headers || {})) h[k.toLowerCase()] = String(headers[k]);
  if (h.authorization) return { status: 501, body: { code: 'TEST', message: 'signed-in calls are not modelled by tools/tests/board-db.js' } };
  let args;
  try { args = body ? JSON.parse(body) : {}; } catch (e) { return { status: 400, body: { code: 'PGRST102', message: 'Empty or invalid json' } }; }
  if (!NAME.test(fn) || !args || typeof args !== 'object' || Array.isArray(args) || !Object.keys(args).every(k => NAME.test(k)))
    return { status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.' + fn } };
  const names = Object.keys(args);
  const values = names.map(k => args[k] === null || args[k] === undefined ? null : typeof args[k] === 'object' ? JSON.stringify(args[k]) : String(args[k]));
  const sql = `select public.${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as value`;
  try {
    const value = await db.transaction(async tx => {
      await tx.exec('set local role anon');
      await tx.query("select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)",
        [JSON.stringify({ role: 'anon' }), JSON.stringify(h)]);
      return (await tx.query(sql, values)).rows[0].value;
    });
    return { status: 200, body: value === undefined ? null : value };
  } catch (e) {
    const code = e.code || 'XX000';
    if (code === '42883') return { status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.' + fn, details: null, hint: null } };
    return { status: code === '42501' ? 401 : 400, body: { code, message: e.message, details: e.detail || null, hint: e.hint || null } };
  }
}

module.exports = { boardDb, rpc, MIGRATIONS };
