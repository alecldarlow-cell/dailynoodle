-- Cryptic joins the Lab trial (20 Nov 2026, Alec: retire Redact, Cryptic takes its slot from 21 Nov).
-- Additive and idempotent: each object is rewritten only if it doesn't already know Cryptic, and every
-- replacement is counted first so a function that has drifted from what this expects stops the migration.
--   * lab_vote accepts type 'cryptic' (votes were refused for any type outside tilt/redact/tumbler).
--   * admin_lab reports word-cryptic plays and Cryptic votes beside the other trials. Redact stays in it:
--     a retired trial's figures are still wanted for the review.
--   * admin_dashboard and insights.puzzle_types know the word-cryptic slug (no blank type).
--   * sync.saves accepts digi-cryptic-v1 / digi-cryptic-streak for signed-in players.
-- Applied live 20 Nov 2026 as migration lab_cryptic (dry run in a rolled-back transaction first).
-- Rollback: delete from sync.saves where key ~ '^digi-cryptic-'; delete from insights.lab_votes where type = 'cryptic';
--           then re-run 2026-11-17-lab-readout.sql, 2026-11-11-lab-votes.sql (its lab_vote) and 2026-11-17-lab-sync.sql.

do $$
declare d text; c int;
  function_rx_old text := 'word-tumbler)';
  function_rx_new text := 'word-tumbler|word-cryptic)';
  case_old text := 'when ''word-redact'' then ''redact'' else ''tumbler'' end';
  case_new text := 'when ''word-redact'' then ''redact'' when ''word-tumbler'' then ''tumbler'' else ''cryptic'' end';
  arr_old text := 'array[''tilt'', ''redact'', ''tumbler'']';
  arr_new text := 'array[''tilt'', ''redact'', ''tumbler'', ''cryptic'']';
  list_old text := '(''tilt'', ''redact'', ''tumbler'')';
  list_new text := '(''tilt'', ''redact'', ''tumbler'', ''cryptic'')';
begin
  -- lab_vote
  d := pg_get_functiondef('public.lab_vote(uuid,text,boolean,text)'::regprocedure);
  if position(list_new in d) = 0 then
    c := (length(d) - length(replace(d, list_old, ''))) / length(list_old);
    if c <> 1 then raise exception 'lab_vote: expected 1 type list, found %', c; end if;
    execute replace(d, list_old, list_new);
  end if;

  -- admin_lab
  d := pg_get_functiondef('public.admin_lab(date,date)'::regprocedure);
  if position(function_rx_new in d) = 0 then
    c := (length(d) - length(replace(d, function_rx_old, ''))) / length(function_rx_old);
    if c <> 2 then raise exception 'admin_lab: expected 2 slug regexes, found %', c; end if;
    c := (length(d) - length(replace(d, case_old, ''))) / length(case_old);
    if c <> 3 then raise exception 'admin_lab: expected 3 slug cases, found %', c; end if;
    c := (length(d) - length(replace(d, arr_old, ''))) / length(arr_old);
    if c <> 1 then raise exception 'admin_lab: expected 1 type array, found %', c; end if;
    execute replace(replace(replace(d, function_rx_old, function_rx_new), case_old, case_new), arr_old, arr_new);
  end if;

  -- admin_dashboard
  -- (admin_dashboard and the view are skipped where they don't exist: the PGlite test database has neither.)
  if to_regprocedure('public.admin_dashboard(date,date,boolean)') is not null then
  d := pg_get_functiondef('public.admin_dashboard(date,date,boolean)'::regprocedure);
  if position(function_rx_new in d) = 0 then
    c := (length(d) - length(replace(d, function_rx_old, ''))) / length(function_rx_old);
    if c <> 1 then raise exception 'admin_dashboard: expected 1 type regex, found %', c; end if;
    execute replace(d, function_rx_old, function_rx_new);
  end if;
  end if;

  -- insights.puzzle_types
  if to_regclass('insights.puzzle_types') is not null then
  d := pg_get_viewdef('insights.puzzle_types'::regclass);
  if position(function_rx_new in d) = 0 then
    c := (length(d) - length(replace(d, function_rx_old, ''))) / length(function_rx_old);
    if c <> 2 then raise exception 'insights.puzzle_types: expected 2 type regexes, found %', c; end if;
    execute 'create or replace view insights.puzzle_types as ' || replace(d, function_rx_old, function_rx_new);
  end if;
  end if;
end $$;

-- Sign-in sync: Cryptic's save and streak.
alter table sync.saves drop constraint sync_key_allowed;
alter table sync.saves add constraint sync_key_allowed check (
  key ~ '^digi-(mini|doku|sweep|path|link|tangle|borders|reckon|tally|tilt|redact|tumbler|cryptic)-(v1|streak)$'
  or key in ('noodle-board-v1', 'noodle-lab-votes-v1'));
