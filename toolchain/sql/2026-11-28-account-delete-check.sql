-- =========================================================================
-- Read-only checks for 2026-11-28-account-delete.sql (app issue #188). Not a migration: run it on the
-- Supabase branch (or restored copy) before and after a test deletion, and on live before applying.
-- Every statement is a select; it changes nothing.
--
-- 1. Rows per table, to compare before and after one deletion: only the deleting account's own rows may go
--    (auth.users and Supabase's own auth tables, sync.saves, insights.lab_votes, board.pins, board.push_subs).
--    board.leagues, board.members, board.results and board.game_daily must keep the same counts.
-- 2. Every foreign key that cascades (or sets null/default) on delete, outside Supabase's auth schema.
--    Expected: only board.members -> board.leagues (account_delete never deletes a league). Anything that
--    references auth.users or sync.saves here is a stop: report it on issue #188 rather than applying.
-- 3. That account_delete is not there yet (before applying) and, after, has no arguments.
-- =========================================================================

select n.nspname || '.' || c.relname as table_name, c.reltuples::bigint as estimate,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint as exact
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind = 'r' and (n.nspname in ('board', 'sync', 'insights', 'public') or (n.nspname = 'auth' and c.relname in ('users', 'identities', 'sessions', 'refresh_tokens')))
 order by 1;

select conrelid::regclass::text as child, confrelid::regclass::text as parent, conname,
       case confdeltype when 'c' then 'cascade' when 'n' then 'set null' when 'd' then 'set default' end as on_delete
  from pg_constraint
 where contype = 'f' and confdeltype in ('c', 'n', 'd') and connamespace::regnamespace::text <> 'auth'
 order by 1, 2;

select p.oid::regprocedure::text as fn, p.pronargs, p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'account_delete';
