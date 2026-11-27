-- Admin rebuild (27 Nov 2026, Alec; project docs claude/admin-review-2026-11-27.md and
-- claude/admin-targets-draft-2026-11-27.md). Migration name: admin_rebuild.
--
-- Read-only figures for the new admin tabs (Today, Players & growth, Puzzles, Lab), plus one
-- speed-up. Nothing is deleted and no existing function changes:
--
--   * insights.page_loads_mat: a materialized copy of the insights.page_loads view. The view
--     regroups every event on each call (about 2 s on 27 Nov, growing with the table); the copy
--     is refreshed nightly at 00:20 UTC by pg_cron and on demand by public.admin_refresh(). The
--     new functions read the copy, so figures run to the last refresh (ranges end yesterday).
--   * public.admin_players(p_from, p_to): players, coming back, app players, growth loops and
--     where new players came from.
--   * public.admin_scorecard(p_from, p_to, p_bands): per puzzle type against the targets, the
--     same for the window before, each dated puzzle (for the worst-puzzle list) and, for paths
--     given in p_bands, figures by easy / medium / hard.
--   * public.admin_ops(): app errors, Lab vote pace and scheduled-task runs (insights.task_runs,
--     new and empty; written only by scheduled tasks, through the database owner).
--   * public.admin_refresh(): refreshes the copy now.
--
-- All admin_* functions answer only an email in insights.admins, like admin_lab.
-- Gold rules mirror GOLD in dn-core.js (21 Nov 2026); change both together.
-- Safe to re-run. Rollback: drop the five functions, the cron job, insights.task_runs and
-- insights.page_loads_mat.

create materialized view if not exists insights.page_loads_mat as
  select * from insights.page_loads;
create unique index if not exists page_loads_mat_pv on insights.page_loads_mat (pv);
create index if not exists page_loads_mat_day on insights.page_loads_mat (day);
revoke all on table insights.page_loads_mat from public, anon, authenticated;

create table if not exists insights.task_runs (
  id bigserial primary key,
  task text not null check (length(task) between 1 and 60),
  ran_at timestamptz not null default now(),
  ok boolean not null,
  summary text check (summary is null or length(summary) <= 300)
);
alter table insights.task_runs enable row level security;
revoke all on table insights.task_runs from public, anon, authenticated;

-- ---------------------------------------------------------------- shared checks
create or replace function insights.admin_check(p_from date, p_to date)
 returns void language plpgsql stable security definer set search_path to ''
as $function$
declare me text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if me = '' or not exists (select 1 from insights.admins a where lower(a.email) = me) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_from is not null and (p_to is null or p_from > p_to or p_to - p_from > 400) then
    raise exception 'bad_range';
  end if;
end $function$;
revoke all on function insights.admin_check(date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------- refresh
create or replace function public.admin_refresh()
 returns timestamptz language plpgsql volatile security definer set search_path to ''
as $function$
begin
  perform insights.admin_check(null, null);
  refresh materialized view concurrently insights.page_loads_mat;
  return now();
end $function$;
revoke all on function public.admin_refresh() from public, anon;
grant execute on function public.admin_refresh() to authenticated;

-- ---------------------------------------------------------------- players and growth
create or replace function public.admin_players(p_from date, p_to date)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare out jsonb;
begin
  perform insights.admin_check(p_from, p_to);
  with
  st as (select distinct anon_id, day from insights.ev where event = 'puzzle_start' and day <= p_to),
  first_st as (select anon_id, min(day) as f from st group by 1),
  pdays as (select anon_id, count(distinct day) as d from st group by 1),
  app as (select distinct anon_id from insights.ev where event = 'page_view' and props->>'inst' = '2' and day <= p_to),
  rng as (select * from st where day between p_from and p_to),
  daily as (
    select g.day::date as day,
      count(distinct r.anon_id) as players,
      count(distinct r.anon_id) filter (where f.f < g.day::date) as returning,
      count(distinct r.anon_id) filter (where f.f = g.day::date) as new
    from generate_series(p_from, p_to, interval '1 day') g(day)
    left join rng r on r.day = g.day::date
    left join first_st f on f.anon_id = r.anon_id
    group by 1),
  last7 as (select * from st where day between greatest(p_from, p_to - 6) and p_to),
  first7 as (select * from st where day between p_from and least(p_to, p_from + 6)),
  coh as (
    select f.anon_id, f.f,
      exists (select 1 from st s where s.anon_id = f.anon_id and s.day = f.f + 1) as d1,
      exists (select 1 from st s where s.anon_id = f.anon_id and s.day between f.f + 7 and f.f + 13) as w2,
      exists (select 1 from st s where s.anon_id = f.anon_id and s.day between f.f + 28 and f.f + 34) as m1
    from first_st f where f.f between p_to - 64 and p_to),
  -- first page view of every visitor, and how it arrived
  fv as (
    select distinct on (anon_id) anon_id, day, props->>'via' as via, props->>'ref' as ref, props->>'inst' as inst
    from insights.ev where event = 'page_view' and day <= p_to
    order by anon_id, occurred_at),
  nv as (
    select fv.*, coalesce(pd.d, 0) as d,
      case
        when via = 'share' then 'Shared result'
        when inst = '2' or via = 'app' then 'The app'
        when via is not null and via not in ('how-to-play', 'archive', 'about', 'finish', 'lab', 'board', 'join') then 'Link: ' || via
        when ref ilike '%google.%' then 'Google'
        when ref ilike '%bing.%' or ref ilike '%duckduckgo.%' then 'Other search'
        when ref ~* '(chatgpt|openai|perplexity|gemini\.google|copilot|claude\.ai)' then 'AI tools'
        when coalesce(ref, '') <> '' and ref !~* 'dailynoodle' then split_part(regexp_replace(ref, '^https?://(www\.)?', ''), '/', 1)
        else 'Direct or bookmark' end as src
    from fv left join pdays pd using (anon_id)
    where fv.day between p_from and p_to),
  joins as (select anon_id, min(day) as jd from insights.ev where event = 'board_join' and day between p_from and p_to group by 1)
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'players', (select count(distinct anon_id) from rng),
    'new_players', (select count(*) from first_st where f between p_from and p_to),
    'avg_daily', (select round(avg(players), 1) from daily),
    'avg_daily_first7', (select round(avg(c), 1) from (select count(distinct anon_id) c from first7 group by day) x),
    'avg_daily_last7', (select round(avg(c), 1) from (select count(distinct anon_id) c from last7 group by day) x),
    'weekly_players', (select count(distinct anon_id) from last7),
    'daily', (select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb) from daily d),
    'cohort', (select jsonb_build_object(
        'd1_n', count(*) filter (where f <= p_to - 1), 'd1', count(*) filter (where f <= p_to - 1 and d1),
        'w2_n', count(*) filter (where f <= p_to - 13), 'w2', count(*) filter (where f <= p_to - 13 and w2),
        'm1_n', count(*) filter (where f <= p_to - 34), 'm1', count(*) filter (where f <= p_to - 34 and m1)) from coh),
    'app', jsonb_build_object(
      'players_30', (select count(distinct s.anon_id) from st s join app using (anon_id) where s.day between p_to - 29 and p_to),
      'players_7', (select count(distinct s.anon_id) from st s join app using (anon_id) where s.day between p_to - 6 and p_to),
      'weeks', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'players', n) order by w), '[]'::jsonb) from (
          select date_trunc('week', s.day)::date as w, count(distinct s.anon_id) as n
          from st s join app using (anon_id) where s.day between p_to - 55 and p_to group by 1) x)),
    'sources', (select coalesce(jsonb_agg(x order by x.played desc, x.visitors desc), '[]'::jsonb) from (
        select src, count(*) as visitors, count(*) filter (where d >= 1) as played,
          count(*) filter (where d >= 2) as came_back, count(*) filter (where d >= 3) as regular
        from nv group by src having count(*) filter (where d >= 1) > 0) x),
    'loops', jsonb_build_object(
      'share_taps', (select count(*) from insights.ev where event = 'share_click' and day between p_from and p_to),
      'share_players', (select count(distinct anon_id) from insights.ev where event = 'share_click' and day between p_from and p_to),
      'share_arrivals', (select count(*) from nv where src = 'Shared result'),
      'share_played', (select count(*) from nv where src = 'Shared result' and d >= 1),
      'share_back', (select count(*) from nv where src = 'Shared result' and d >= 2),
      'invites', (select count(*) from insights.ev where event = 'board_invite' and day between p_from and p_to),
      'joins', (select count(*) from joins),
      'joins_due', (select count(*) from joins where jd <= p_to - 7),
      'joins_playing', (select count(*) from joins j where j.jd <= p_to - 7
                         and exists (select 1 from st s where s.anon_id = j.anon_id and s.day >= j.jd + 7)),
      'app_prompt_views', (select count(*) from insights.ev where event = 'app_promo_view' and day between p_from and p_to),
      'app_prompt_taps', (select count(*) from insights.ev where event = 'app_promo_tap' and day between p_from and p_to),
      'app_new', (select count(*) from nv where src = 'The app' and d >= 1),
      'app_back', (select count(*) from nv where src = 'The app' and d >= 2),
      'app_regular', (select count(*) from nv where src = 'The app' and d >= 3)),
    'refreshed', (select max(opened_at) from insights.page_loads_mat)
  ) into out;
  return out;
end $function$;
revoke all on function public.admin_players(date, date) from public, anon;
grant execute on function public.admin_players(date, date) to authenticated;

-- ---------------------------------------------------------------- puzzle scorecard
create or replace function insights.scorecard_window(p_from date, p_to date, p_bands jsonb)
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  with
  pl as (
    select anon_id, item_path, day,
      substring(item_path, '^reports/\d{4}-\d{2}-\d{2}-([a-z]+-[a-z]+)') as slug,
      substring(item_path, '^reports/(\d{4}-\d{2}-\d{2})')::date as pdate,
      outcome, solve_secs, help_used, score, got, of_n, words, mistakes
    from insights.page_loads_mat
    where section = 'puzzles' and started and day between p_from and p_to and item_path ~ '^reports/\d{4}-\d{2}-\d{2}-'),
  pp as (
    select slug, anon_id, item_path, min(pdate) as pdate,
      coalesce(bool_or(outcome = 'solved'), false) as solved,
      coalesce(bool_or(outcome = 'failed'), false) as failed,
      coalesce(bool_or(outcome = 'scored'), false) as scored,
      min(solve_secs) filter (where outcome = 'solved') as secs,
      max(score) filter (where outcome = 'scored') as score,
      max(got) filter (where outcome = 'scored') as got,
      max(of_n) as of_n,
      max(words) filter (where outcome = 'scored') as words,
      min(mistakes) filter (where outcome in ('solved', 'failed')) as mistakes,
      coalesce(bool_or(coalesce(help_used, 0) > 0), false) as helped
    from pl where slug is not null group by 1, 2, 3),
  g as (   -- gold: dn-core.js GOLD, judged on the best finish
    select pp.*, (solved or scored) as finished,
      case slug
        when 'crossword-mini' then solved and secs <= 40 and not helped
        when 'logic-doku'     then solved and secs <= 30
        when 'logic-sweep'    then solved and secs <= 30
        when 'logic-path'     then solved and secs <= 20
        when 'logic-tally'    then solved and secs <= 60
        when 'word-link'      then solved and mistakes = 0 and secs <= 60
        when 'word-tangle'    then score >= 40
        when 'geo-borders'    then got = 10
        when 'quiz-reckon'    then score >= 750
      end as gold
    from pp),
  allp as (select count(distinct anon_id) as n from pl),
  days as (select slug, anon_id, count(distinct day) as d from pl where slug is not null group by 1, 2),
  t as (
    select slug,
      count(distinct anon_id) as players, count(*) as attempts,
      count(*) filter (where finished) as finishes,
      round(100.0 * count(*) filter (where finished) / count(*))::int as pct_finished,
      round(100.0 * count(*) filter (where failed and not solved) / count(*))::int as pct_failed,
      round(100.0 * count(*) filter (where not finished and not failed) / count(*))::int as pct_unfinished,
      case when count(*) filter (where solved or failed) > 0
        then round(100.0 * count(*) filter (where solved) / count(*) filter (where solved or failed))::int end as pct_won,
      percentile_disc(0.5) within group (order by secs) as med_secs,
      percentile_disc(0.75) within group (order by secs) as p75_secs,
      percentile_disc(0.9) within group (order by secs) as p90_secs,
      percentile_disc(0.5) within group (order by score) as med_score,
      round(avg(score))::int as mean_score,
      percentile_disc(0.5) within group (order by got) as med_got,
      max(of_n) as of_n,
      percentile_disc(0.5) within group (order by words) as med_words,
      round(avg(mistakes)::numeric, 2) as avg_mistakes,
      round(100.0 * count(*) filter (where helped) / count(*))::int as pct_help,
      count(*) filter (where gold) as gold,
      case when count(*) filter (where finished) > 0
        then round(100.0 * count(*) filter (where gold) / count(*) filter (where finished), 1) end as pct_gold
    from g group by slug),
  r as (select slug, round(100.0 * count(*) filter (where d >= 2) / count(*))::int as pct_returning from days group by slug),
  pz as (
    select slug, item_path as path, min(pdate) as date, count(*) as players,
      round(100.0 * count(*) filter (where finished) / count(*))::int as pct_finished,
      case when count(*) filter (where solved or failed) > 0
        then round(100.0 * count(*) filter (where solved) / count(*) filter (where solved or failed))::int end as pct_won,
      percentile_disc(0.5) within group (order by secs) as med_secs,
      percentile_disc(0.5) within group (order by score) as med_score
    from g where pdate between p_from and p_to group by 1, 2 having count(*) >= 5),
  bands as (
    select g.slug, b.value as band, count(*) as attempts,
      round(100.0 * count(*) filter (where finished) / count(*))::int as pct_finished,
      percentile_disc(0.5) within group (order by secs) as med_secs,
      percentile_disc(0.75) within group (order by secs) as p75_secs,
      percentile_disc(0.9) within group (order by secs) as p90_secs
    from g join jsonb_each_text(coalesce(p_bands, '{}'::jsonb)) b on b.key = g.item_path
    group by 1, 2)
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'players', (select n from allp),
    'types', (select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object(
        'pct_returning', r.pct_returning,
        'pct_of_players', case when (select n from allp) > 0 then round(100.0 * t.players / (select n from allp))::int end)
      order by t.slug), '[]'::jsonb) from t left join r using (slug)),
    'puzzles', (select coalesce(jsonb_agg(to_jsonb(pz) order by pz.date, pz.slug), '[]'::jsonb) from pz),
    'bands', (select coalesce(jsonb_agg(to_jsonb(bands) order by bands.slug, bands.band), '[]'::jsonb) from bands));
$function$;
revoke all on function insights.scorecard_window(date, date, jsonb) from public, anon, authenticated;

create or replace function public.admin_scorecard(p_from date, p_to date, p_bands jsonb default null)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare len int;
begin
  perform insights.admin_check(p_from, p_to);
  len := p_to - p_from + 1;
  return insights.scorecard_window(p_from, p_to, p_bands)
    || jsonb_build_object('prev', insights.scorecard_window(p_from - len, p_from - 1, null) - 'puzzles' - 'bands',
                          'refreshed', (select max(opened_at) from insights.page_loads_mat));
end $function$;
revoke all on function public.admin_scorecard(date, date, jsonb) from public, anon;
grant execute on function public.admin_scorecard(date, date, jsonb) to authenticated;

-- ---------------------------------------------------------------- operations
create or replace function public.admin_ops()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare out jsonb;
begin
  perform insights.admin_check(null, null);
  select jsonb_build_object(
    'app_errors', jsonb_build_object(
      'day', (select count(*) from insights.app_errors where at > now() - interval '24 hours'),
      'week', (select count(*) from insights.app_errors where at > now() - interval '7 days'),
      'fatal_week', (select count(*) from insights.app_errors where at > now() - interval '7 days' and kind = 'fatal'),
      'top', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select kind, left(message, 120) as message, version, count(*) as n, max(at) as last
          from insights.app_errors where at > now() - interval '7 days'
          group by 1, 2, 3 order by n desc, last desc limit 3) x),
      'latest_version', (select version from insights.app_errors where version is not null order by at desc limit 1)),
    'lab_votes', (select coalesce(jsonb_agg(x order by x.type), '[]'::jsonb) from (
        select type, count(*) as total, count(*) filter (where vote) as yes,
          count(*) filter (where first_at > now() - interval '7 days') as new_7d,
          min(first_at)::date as first
        from insights.lab_votes group by type) x),
    'tasks', (select coalesce(jsonb_agg(x order by x.task), '[]'::jsonb) from (
        select distinct on (task) task, ran_at, ok, summary from insights.task_runs order by task, ran_at desc) x),
    'refreshed', (select max(opened_at) from insights.page_loads_mat)
  ) into out;
  return out;
end $function$;
revoke all on function public.admin_ops() from public, anon;
grant execute on function public.admin_ops() to authenticated;

-- ---------------------------------------------------------------- nightly refresh
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'admin-page-loads-refresh';
    perform cron.schedule('admin-page-loads-refresh', '20 0 * * *',
      'refresh materialized view concurrently insights.page_loads_mat');
  end if;
end $$;
