-- ===========================================================================
-- Digi MI audit fixes (15 Oct 2026). Applied to the `digi` Supabase project
-- as migration "mi_audit_fixes". Kept here so the reporting logic is on
-- record next to dn-track.js v3.
--
-- 1. insights.page_loads
--    started  - a v2 puzzle start (no tv on the event) that never finished
--               and spent under 15 seconds on the page was nearly always a
--               stray tap (masthead, start of a scroll). Not counted. v3
--               starts (tv:3) only fire inside the play area, so they stand.
--    outcome  - Tangle and Borders are timed rounds: every finish is "scored",
--               never solved or failed (v2 logged them all as "solved", and
--               an older Borders logged "So close." as failed).
--    new cols - score, got, of_n, words, mistakes from v3 puzzle_end events.
-- 2. public.admin_dashboard - median article time, solve rate over solvable
--    types only, score medians per type and item, shared-link / in-app
--    sources ahead of the (always-empty) referrer.
-- 3. public.admin_exclude_device - lets a signed-in admin add or remove the
--    browser they're on from insights.excluded_readers.
-- ===========================================================================

create or replace view insights.page_loads as
select pv,
  min(item_path) as item_path,
  min(section) as section,
  (min(anon_id::text))::uuid as anon_id,
  min(occurred_at) as opened_at,
  min(day) as day,
  max(props->>'topic') filter (where event = 'page_view') as topic,
  bool_or((props->>'new')::boolean) filter (where event = 'page_view') as new_reader,
  max((props->>'secs')::integer) filter (where event = 'page_exit') as secs,
  greatest(max((props->>'depth')::integer) filter (where event = 'page_exit'),
           max((props->>'pct')::integer) filter (where event = 'read_depth')) as depth,
  count(*) filter (where event = 'exhibit_view') as charts_seen,
  count(*) filter (where event = 'source_click') as sources_opened,
  ( bool_or(event = any (array['puzzle_start','game_start']))
    and not ( bool_or(event = 'puzzle_start')
              and not bool_or(event = 'puzzle_start' and props ? 'tv')
              and not bool_or(event = 'puzzle_end')
              and coalesce(max((props->>'secs')::integer) filter (where event = 'page_exit'), 0) < 15 )
  ) as started,
  case when bool_or(event = 'puzzle_end') and min(item_path) ~ '(word-tangle|geo-borders)' then 'scored'
       else max(props->>'outcome') filter (where event = 'puzzle_end') end as outcome,
  max((props->>'secs')::integer) filter (where event = 'puzzle_end') as solve_secs,
  max((props->>'checks')::integer + (props->>'reveals')::integer + (props->>'hints')::integer)
    filter (where event = 'puzzle_end') as help_used,
  max(case when props->>'score'    ~ '^-?\d{1,7}$' then (props->>'score')::integer end)    filter (where event = 'puzzle_end') as score,
  max(case when props->>'got'      ~ '^\d{1,5}$'   then (props->>'got')::integer end)      filter (where event = 'puzzle_end') as got,
  max(case when props->>'of'       ~ '^\d{1,5}$'   then (props->>'of')::integer end)       filter (where event = 'puzzle_end') as of_n,
  max(case when props->>'words'    ~ '^\d{1,5}$'   then (props->>'words')::integer end)    filter (where event = 'puzzle_end') as words,
  max(case when props->>'mistakes' ~ '^\d{1,3}$'   then (props->>'mistakes')::integer end) filter (where event = 'puzzle_end') as mistakes
from insights.ev
where pv is not null
  and item_path <> all (array['index.html','puzzles.html','games.html','privacy.html'])
group by pv;

create or replace function public.admin_dashboard(p_from date, p_to date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me text := lower(coalesce(auth.jwt()->>'email', ''));
  out jsonb;
begin
  if me = '' or not exists (select 1 from insights.admins a where lower(a.email) = me) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'bad_range';
  end if;

  with
  ev as (select * from insights.ev where day between p_from and p_to),
  pl as (select *, item_path ~ '(word-tangle|geo-borders)' as is_scored from insights.page_loads where day between p_from and p_to),
  firsts as (select anon_id, min(day) as first_day from insights.ev group by anon_id),
  rd as (select anon_id, min(day) as d0, max(day) as d1, count(distinct day) as days from ev group by anon_id),
  kpi as (
    select
      (select count(*) from rd) as readers,
      (select count(*) from rd join firsts f using (anon_id) where f.first_day between p_from and p_to) as new_readers,
      (select count(*) from rd join firsts f using (anon_id) where f.first_day < rd.d1) as returning_readers,
      (select count(distinct pv) from ev where event = 'page_view') as page_loads,
      (select count(distinct session_id) from ev) as visits,
      (select round(avg(secs)) from pl where section = 'news' and secs is not null) as avg_article_secs,
      (select percentile_cont(0.5) within group (order by secs)::int from pl where section = 'news' and secs is not null) as median_article_secs,
      (select round(100.0 * count(*) filter (where depth >= 75) / nullif(count(depth), 0)) from pl where section = 'news') as pct_articles_read_75,
      (select count(*) from pl where section = 'puzzles' and started) as puzzle_starts,
      (select count(*) from pl where section = 'puzzles' and started and not is_scored) as solvable_starts,
      (select count(*) from pl where section = 'puzzles' and outcome = 'solved') as puzzles_solved,
      (select count(*) from pl where section = 'puzzles' and outcome = 'scored') as puzzles_scored,
      (select count(*) from ev where event = 'game_start') as game_runs,
      (select count(*) from ev) as events
  ),
  days as (select d::date as day from generate_series(p_from, p_to, interval '1 day') d),
  daily as (
    select d.day,
      count(distinct e.anon_id) as readers,
      count(distinct e.anon_id) filter (where f.first_day = d.day) as new_readers,
      count(distinct e.pv) filter (where e.event = 'page_view') as page_loads,
      count(distinct e.anon_id) filter (where e.section = 'news') as news,
      count(distinct e.anon_id) filter (where e.section = 'puzzles') as puzzles,
      count(distinct e.anon_id) filter (where e.section = 'games') as games,
      count(*) filter (where e.event = 'puzzle_end' and e.props->>'outcome' = 'solved'
                         and e.item_path !~ '(word-tangle|geo-borders)') as solved
    from days d
    left join ev e on e.day = d.day
    left join firsts f on f.anon_id = e.anon_id
    group by d.day order by d.day
  ),
  items as (
    select item_path, section, max(topic) as topic,
      count(distinct anon_id) as readers, count(*) as page_loads,
      percentile_cont(0.5) within group (order by secs)::int as median_secs,
      round(100.0 * count(*) filter (where depth >= 75) / nullif(count(depth), 0))::int as pct_read_75,
      round(100.0 * count(*) filter (where secs < 10) / nullif(count(secs), 0))::int as pct_bounced,
      sum(charts_seen)::int as charts_seen, sum(sources_opened)::int as sources_opened,
      count(*) filter (where started) as starts,
      count(*) filter (where outcome = 'solved') as solved,
      count(*) filter (where outcome = 'failed') as failed,
      count(*) filter (where outcome = 'revealed') as revealed,
      count(*) filter (where outcome = 'scored') as scored,
      bool_or(is_scored) as is_scored,
      case when bool_or(is_scored) then null else
        round(100.0 * count(*) filter (where outcome = 'solved') / nullif(count(*) filter (where started), 0))::int end as pct_solved,
      percentile_cont(0.5) within group (order by solve_secs) filter (where outcome = 'solved')::int as median_solve_secs,
      percentile_cont(0.5) within group (order by score)::int as median_score,
      percentile_cont(0.5) within group (order by got)::int as median_got,
      max(of_n) as of_n,
      percentile_cont(0.5) within group (order by words)::int as median_words,
      round(avg(mistakes), 1) as avg_mistakes
    from pl group by item_path, section
  ),
  ptypes as (
    select substring(item_path from '(crossword-mini|logic-doku|logic-path|logic-sweep|word-link|geo-borders|word-tangle)') as type,
      bool_or(is_scored) as is_scored,
      count(distinct anon_id) as players, count(*) as page_loads,
      count(*) filter (where started) as starts,
      count(*) filter (where outcome = 'solved') as solved,
      count(*) filter (where outcome = 'failed') as failed,
      count(*) filter (where outcome = 'revealed') as revealed,
      count(*) filter (where outcome = 'scored') as scored,
      count(*) filter (where started and outcome is null) as abandoned,
      percentile_cont(0.5) within group (order by solve_secs) filter (where outcome = 'solved')::int as median_solve_secs,
      count(*) filter (where help_used > 0) as used_help,
      count(*) filter (where outcome is not null) as finished,
      percentile_cont(0.5) within group (order by score)::int as median_score,
      percentile_cont(0.5) within group (order by got)::int as median_got,
      max(of_n) as of_n,
      percentile_cont(0.5) within group (order by words)::int as median_words,
      round(avg(mistakes), 1) as avg_mistakes,
      count(score) + count(got) + count(words) + count(mistakes) as results_recorded
    from pl where section = 'puzzles' group by 1
  ),
  games as (
    -- Generic across games (site contract): level = how far the round got
    -- (whole number; legacy Lighthouse events used "headland"), secs = active
    -- play time. Casts are guarded so one malformed event can't break the page.
    select game, count(distinct anon_id) as players,
      count(*) filter (where event = 'game_start') as runs,
      count(*) filter (where event = 'game_end' and win is true) as wins,
      count(*) filter (where event = 'game_end' and win is false) as losses,
      greatest(count(*) filter (where event = 'game_start') - count(*) filter (where event = 'game_end'), 0) as abandoned,
      max(lvl) as furthest,
      round(avg(lvl) filter (where event = 'game_end'), 1) as avg_end,
      percentile_cont(0.5) within group (order by secs) filter (where event = 'game_end')::int as median_secs
    from (
      select anon_id, event, props->>'game' as game,
        case when props->'win' = 'true'::jsonb then true when props->'win' = 'false'::jsonb then false end as win,
        case when coalesce(props->>'level', props->>'headland') ~ '^[0-9]{1,6}$'
             then coalesce(props->>'level', props->>'headland')::int end as lvl,
        case when props->>'secs' ~ '^[0-9]{1,7}$' then (props->>'secs')::int end as secs
      from ev where event in ('game_start','game_end')
    ) g
    group by game
  ),
  sections as (
    select section, count(distinct anon_id) as readers, count(distinct pv) filter (where event = 'page_view') as page_loads
    from ev where section in ('news','puzzles','games') group by section
  ),
  mixes as (
    select concat_ws(' + ', case when n then 'News' end, case when p then 'Puzzles' end, case when g then 'Games' end) as mix, count(*) as readers
    from (select anon_id, bool_or(section='news') n, bool_or(section='puzzles') p, bool_or(section='games') g
          from ev group by anon_id) r
    where n or p or g group by 1
  ),
  cards as (
    select section, props->>'to' as item_path, count(*) as taps, count(distinct anon_id) as readers,
      round(avg((props->>'pos')::numeric), 1) as avg_pos
    from ev where event = 'card_click' group by 1, 2
  ),
  positions as (
    select section, least((props->>'pos')::int, 11) as pos, count(*) as taps
    from ev where event = 'card_click' and props->>'pos' ~ '^\d+$' group by 1, 2
  ),
  refs as (
    -- Shared-link tag first, then the in-app browser, then the referrer.
    select case when nullif(props->>'via', '') is not null then 'Shared link (' || (props->>'via') || ')'
                when nullif(props->>'app', '') is not null then 'In-app browser: ' || (props->>'app')
                when nullif(props->>'ref', '') is not null then props->>'ref'
                else 'Direct or internal' end as source,
      count(distinct anon_id) as readers, count(*) as page_loads
    from ev where event = 'page_view' group by 1
  ),
  devices as (
    select coalesce(props->>'screen', 'unknown') as screen, count(distinct anon_id) as readers
    from ev where event = 'page_view' group by 1
  ),
  cohorts as (
    select date_trunc('week', f.first_day)::date as week, count(*) as new_readers,
      count(*) filter (where r.days_all > 1) as came_back
    from firsts f
    join (select anon_id, count(distinct day) as days_all from insights.ev group by anon_id) r using (anon_id)
    where f.first_day between p_from and p_to
    group by 1 order by 1
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'generated_at', now(),
    'kpis', (select to_jsonb(kpi) from kpi),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily) order by day) from daily), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(items)) from items), '[]'),
    'puzzle_types', coalesce((select jsonb_agg(to_jsonb(ptypes)) from ptypes where type is not null), '[]'),
    'games', coalesce((select jsonb_agg(to_jsonb(games)) from games where game is not null), '[]'),
    'sections', coalesce((select jsonb_agg(to_jsonb(sections)) from sections), '[]'),
    'mix', coalesce((select jsonb_agg(to_jsonb(mixes)) from mixes), '[]'),
    'cards', coalesce((select jsonb_agg(to_jsonb(cards)) from cards), '[]'),
    'positions', coalesce((select jsonb_agg(to_jsonb(positions)) from positions), '[]'),
    'referrers', coalesce((select jsonb_agg(to_jsonb(refs)) from refs), '[]'),
    'devices', coalesce((select jsonb_agg(to_jsonb(devices)) from devices), '[]'),
    'cohorts', coalesce((select jsonb_agg(to_jsonb(cohorts)) from cohorts), '[]'),
    'excluded_readers', (select count(*) from insights.excluded_readers)
  ) into out;
  return out;
end $function$;

-- Add (p_exclude true), remove (false) or just report (null) whether the
-- browser with this reader ID is on the exclusion list. Admins only.
create or replace function public.admin_exclude_device(p_anon uuid, p_exclude boolean default null)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if me = '' or not exists (select 1 from insights.admins a where lower(a.email) = me) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_anon is null then return null; end if;
  if p_exclude is true then
    insert into insights.excluded_readers (anon_id, note)
    values (p_anon, 'added from admin page by ' || me || ' on ' || to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD'))
    on conflict (anon_id) do nothing;
  elsif p_exclude is false then
    delete from insights.excluded_readers where anon_id = p_anon;
  end if;
  return exists (select 1 from insights.excluded_readers where anon_id = p_anon);
end $function$;

revoke all on function public.admin_exclude_device(uuid, boolean) from public, anon;
grant execute on function public.admin_exclude_device(uuid, boolean) to authenticated;
