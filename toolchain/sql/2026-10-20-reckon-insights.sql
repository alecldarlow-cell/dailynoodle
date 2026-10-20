-- Reckon in the admin dashboard (20 Oct 2026). Applied to the live database 20 Oct 2026 (migration reckon_insights), after 2026-10-20-reckon-board.sql.
-- Adds the tracker slug quiz-reckon to the puzzle-type regex and to the scored-round regex in
-- public.admin_dashboard(date,date,boolean) and the views insights.page_loads and insights.puzzle_types,
-- by substitution on the live definitions, asserting every old fragment is found the expected number
-- of times (as puzzle_types_add_word_tangle did). The two-argument admin_dashboard is a wrapper and
-- needs nothing. Rollback: the same substitutions the other way round.
do $$
declare d text; n text; c int;
  types_old text := 'word-link|geo-borders|word-tangle)';
  types_new text := 'word-link|geo-borders|word-tangle|quiz-reckon)';
  scored_old text := '(word-tangle|geo-borders)';
  scored_new text := '(word-tangle|geo-borders|quiz-reckon)';
begin
  -- the dashboard: two scored-round regexes, one type regex
  d := pg_get_functiondef('public.admin_dashboard(date,date,boolean)'::regprocedure);
  c := (length(d) - length(replace(d, scored_old, ''))) / length(scored_old);
  if c <> 2 then raise exception 'admin_dashboard: expected 2 scored regexes, found %', c; end if;
  c := (length(d) - length(replace(d, types_old, ''))) / length(types_old);
  if c <> 1 then raise exception 'admin_dashboard: expected 1 type regex, found %', c; end if;
  n := replace(replace(d, scored_old, scored_new), types_old, types_new);
  execute n;

  -- page loads: the scored-round regex
  d := pg_get_viewdef('insights.page_loads'::regclass);
  c := (length(d) - length(replace(d, scored_old, ''))) / length(scored_old);
  if c <> 1 then raise exception 'insights.page_loads: expected 1 scored regex, found %', c; end if;
  execute 'create or replace view insights.page_loads as ' || replace(d, scored_old, scored_new);

  -- puzzle types: the type regex, in the select list and the group by
  d := pg_get_viewdef('insights.puzzle_types'::regclass);
  c := (length(d) - length(replace(d, types_old, ''))) / length(types_old);
  if c <> 2 then raise exception 'insights.puzzle_types: expected 2 type regexes, found %', c; end if;
  execute 'create or replace view insights.puzzle_types as ' || replace(d, types_old, types_new);
end $$;
