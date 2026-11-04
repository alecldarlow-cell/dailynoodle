-- Tally in the admin dashboard (4 Nov 2026). Adds the tracker slug logic-tally to the puzzle-type regex in
-- public.admin_dashboard(date,date,boolean) and insights.puzzle_types, by substitution on the live definitions,
-- asserting every old fragment is found the expected number of times. Tally is timed, so the scored regex stays as it is.
-- Rollback: the same substitutions the other way round.
do $$
declare d text; c int;
  types_old text := 'geo-borders|word-tangle|quiz-reckon)';
  types_new text := 'geo-borders|word-tangle|quiz-reckon|logic-tally)';
begin
  d := pg_get_functiondef('public.admin_dashboard(date,date,boolean)'::regprocedure);
  c := (length(d) - length(replace(d, types_old, ''))) / length(types_old);
  if c <> 1 then raise exception 'admin_dashboard: expected 1 type regex, found %', c; end if;
  execute replace(d, types_old, types_new);

  d := pg_get_viewdef('insights.puzzle_types'::regclass);
  c := (length(d) - length(replace(d, types_old, ''))) / length(types_old);
  if c <> 2 then raise exception 'insights.puzzle_types: expected 2 type regexes, found %', c; end if;
  execute 'create or replace view insights.puzzle_types as ' || replace(d, types_old, types_new);
end $$;
