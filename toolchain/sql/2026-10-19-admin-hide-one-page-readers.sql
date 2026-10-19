-- 19 Oct 2026: admin dashboard can leave out "one-page readers".
--
-- After the move to dailynoodle.co.uk (18 Oct) the Readers figure jumped from
-- ~8 a day to 88, but 80 of those "readers" loaded a single page and did
-- nothing else: crawlers that run the tracker with fresh storage on every
-- page, and browsers opening the new address for the first time.
--
-- A one-page reader is a browser whose whole recorded history (all time, not
-- just the chosen range) is at most one page load and no event other than
-- page_view / page_exit. So a reader who comes back, opens a second page,
-- starts a puzzle, scrolls an article (read_depth) or taps a card stops being
-- one, and is counted for every day they were seen.
--
-- admin_dashboard gains p_ghosts (false = leave them out). The page
-- has a "One-page readers: hidden / shown" chip. The output adds
-- ghost_readers (how many one-page readers fall in the range) and
-- ghosts_shown. Nothing is deleted: public.events is untouched.
-- The old two-argument version stays (no drop), as a wrapper that hides them,
-- so an admin page cached from before still works. p_ghosts has no default,
-- so a two-argument call can only match the wrapper.
-- Applied as migration admin_hide_one_page_readers.

create or replace function public.admin_dashboard(p_from date, p_to date, p_ghosts boolean)
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
  gh as (
    select anon_id from insights.ev group by anon_id
    having count(distinct pv) filter (where event = 'page_view') <= 1
       and bool_and(event in ('page_view', 'page_exit'))
  ),
  ev as (select * from insights.ev e where day between p_from and p_to
         and (p_ghosts or not exists (select 1 from gh where gh.anon_id = e.anon_id))),
  pl as (select *, item_path ~ '(word-tangle|geo-borders)' as is_scored from insights.page_loads p where day between p_from and p_to
         and (p_ghosts or not exists (select 1 from gh where gh.anon_id = p.anon_id))),
  firsts as (select anon_id, min(day) as first_day from insights.ev e
             where p_ghosts or not exists (select 1 from gh where gh.anon_id = e.anon_id)
             group by anon_id),
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
    'excluded_readers', (select count(*) from insights.excluded_readers),
    'ghost_readers', (select count(distinct e.anon_id) from insights.ev e join gh using (anon_id) where e.day between p_from and p_to),
    'ghosts_shown', p_ghosts
  ) into out;
  return out;
end $function$;

revoke all on function public.admin_dashboard(date, date, boolean) from public, anon;
grant execute on function public.admin_dashboard(date, date, boolean) to authenticated, service_role;

create or replace function public.admin_dashboard(p_from date, p_to date)
 returns jsonb
 language sql
 security definer
 set search_path to ''
as $function$ select public.admin_dashboard(p_from, p_to, false) $function$;
