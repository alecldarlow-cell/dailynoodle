-- 20 Oct 2026: the admin reporting as deployed. A RECORD, NOT A MIGRATION.
--
-- Do not apply this to the live database. It reproduces what is live in the
-- `digi` Supabase project (gnehttjheoyutrfsvslq) after migration
-- admin_news_list_as_site (20261020055035), read on 20 Oct 2026 with read-only
-- queries only: pg_get_functiondef, pg_get_viewdef, information_schema.columns,
-- pg_constraint, pg_index, pg_class.relacl/relrowsecurity and pg_proc.proacl.
--
-- Why it exists: the function bodies were already in the repo, but what they
-- read was not. insights.ev (events minus excluded readers, with the London
-- day) had never been checked in; insights.page_loads was only on record as
-- the 15 Oct version plus a text substitution (2026-10-20-reckon-insights.sql);
-- and insights.admins, insights.excluded_readers and public.events existed only
-- in the live database. tools/tests/backend.test.js applies this file to a
-- disposable PGlite database so the admin cases run against these exact
-- definitions.
--
-- Comparison with the repo (md5 of the live text):
--   admin_dashboard(date,date,boolean)  body identical to 2026-10-20-admin-news-list-as-site.sql
--   admin_dashboard(date,date)          body identical to 2026-10-19-admin-hide-one-page-readers.sql
--   admin_exclude_device(uuid,boolean)  body identical to 2026-10-15-mi-audit-fixes.sql
--   insights.page_loads                 = 2026-10-15-mi-audit-fixes.sql with the Reckon substitution
--   insights.ev, the three tables       not in the repo before this file
-- Function and view text below is pg_get_functiondef / pg_get_viewdef output,
-- byte for byte. The table definitions are rebuilt from the catalog (columns,
-- defaults, identity, constraints, indexes), not a pg_dump; the live tables
-- may differ in storage details that do not affect behaviour.
-- Grants are the live ACLs (relacl / proacl). insights has USAGE for postgres
-- only, so the tables and views are reachable solely through the
-- SECURITY DEFINER functions. public.events has RLS on and no policies; the
-- tracker writes through its own function, outside this file's scope.
-- The other insights views (card_clicks, daily, items, game_runs,
-- puzzle_types, readers, referrers, retention, section_mix) are not used by
-- these functions and are not reproduced here.

create schema if not exists insights;
revoke all on schema insights from public;

create table public.events (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  anon_id     uuid not null,
  session_id  uuid not null,
  user_id     uuid,
  section     text not null,
  event       text not null,
  item_path   text,
  props       jsonb not null default '{}'::jsonb,
  schema_v    smallint not null default 1,
  constraint events_event_check check ((event ~ '^[a-z_]{3,40}$'::text)),
  constraint events_item_path_check check ((length(item_path) <= 200)),
  constraint events_props_check check (((jsonb_typeof(props) = 'object'::text) AND (pg_column_size(props) < 2048))),
  constraint events_section_check check ((section = ANY (ARRAY['news'::text, 'puzzles'::text, 'games'::text, 'site'::text])))
);
create index events_occurred_at_idx on public.events using btree (occurred_at);
create index events_item_event_idx on public.events using btree (item_path, event);
create index events_anon_idx on public.events using btree (anon_id, occurred_at);
alter table public.events enable row level security;
revoke all on table public.events from public, anon, authenticated;
grant all on table public.events to service_role;

create table insights.admins (email text not null primary key);
alter table insights.admins enable row level security;
revoke all on table insights.admins from public, anon, authenticated, service_role;

create table insights.excluded_readers (anon_id uuid not null primary key, note text);
alter table insights.excluded_readers enable row level security;
revoke all on table insights.excluded_readers from public, anon, authenticated, service_role;

-- pg_get_viewdef prints public.events as "events"; resolve it in public.
set search_path to public;

create or replace view insights.ev as
 SELECT id,
    occurred_at,
    anon_id,
    session_id,
    user_id,
    section,
    event,
    item_path,
    props,
    schema_v,
    ((occurred_at AT TIME ZONE 'Europe/London'::text))::date AS day,
    (props ->> 'pv'::text) AS pv
   FROM events e
  WHERE (NOT (EXISTS ( SELECT 1
           FROM insights.excluded_readers x
          WHERE (x.anon_id = e.anon_id))));
revoke all on table insights.ev from public, anon, authenticated, service_role;

create or replace view insights.page_loads as
 SELECT pv,
    min(item_path) AS item_path,
    min(section) AS section,
    (min((anon_id)::text))::uuid AS anon_id,
    min(occurred_at) AS opened_at,
    min(day) AS day,
    max((props ->> 'topic'::text)) FILTER (WHERE (event = 'page_view'::text)) AS topic,
    bool_or(((props ->> 'new'::text))::boolean) FILTER (WHERE (event = 'page_view'::text)) AS new_reader,
    max(((props ->> 'secs'::text))::integer) FILTER (WHERE (event = 'page_exit'::text)) AS secs,
    GREATEST(max(((props ->> 'depth'::text))::integer) FILTER (WHERE (event = 'page_exit'::text)), max(((props ->> 'pct'::text))::integer) FILTER (WHERE (event = 'read_depth'::text))) AS depth,
    count(*) FILTER (WHERE (event = 'exhibit_view'::text)) AS charts_seen,
    count(*) FILTER (WHERE (event = 'source_click'::text)) AS sources_opened,
    (bool_or((event = ANY (ARRAY['puzzle_start'::text, 'game_start'::text]))) AND (NOT (bool_or((event = 'puzzle_start'::text)) AND (NOT bool_or(((event = 'puzzle_start'::text) AND (props ? 'tv'::text)))) AND (NOT bool_or((event = 'puzzle_end'::text))) AND (COALESCE(max(((props ->> 'secs'::text))::integer) FILTER (WHERE (event = 'page_exit'::text)), 0) < 15)))) AS started,
        CASE
            WHEN (bool_or((event = 'puzzle_end'::text)) AND (min(item_path) ~ '(word-tangle|geo-borders|quiz-reckon)'::text)) THEN 'scored'::text
            ELSE max((props ->> 'outcome'::text)) FILTER (WHERE (event = 'puzzle_end'::text))
        END AS outcome,
    max(((props ->> 'secs'::text))::integer) FILTER (WHERE (event = 'puzzle_end'::text)) AS solve_secs,
    max(((((props ->> 'checks'::text))::integer + ((props ->> 'reveals'::text))::integer) + ((props ->> 'hints'::text))::integer)) FILTER (WHERE (event = 'puzzle_end'::text)) AS help_used,
    max(
        CASE
            WHEN ((props ->> 'score'::text) ~ '^-?\d{1,7}$'::text) THEN ((props ->> 'score'::text))::integer
            ELSE NULL::integer
        END) FILTER (WHERE (event = 'puzzle_end'::text)) AS score,
    max(
        CASE
            WHEN ((props ->> 'got'::text) ~ '^\d{1,5}$'::text) THEN ((props ->> 'got'::text))::integer
            ELSE NULL::integer
        END) FILTER (WHERE (event = 'puzzle_end'::text)) AS got,
    max(
        CASE
            WHEN ((props ->> 'of'::text) ~ '^\d{1,5}$'::text) THEN ((props ->> 'of'::text))::integer
            ELSE NULL::integer
        END) FILTER (WHERE (event = 'puzzle_end'::text)) AS of_n,
    max(
        CASE
            WHEN ((props ->> 'words'::text) ~ '^\d{1,5}$'::text) THEN ((props ->> 'words'::text))::integer
            ELSE NULL::integer
        END) FILTER (WHERE (event = 'puzzle_end'::text)) AS words,
    max(
        CASE
            WHEN ((props ->> 'mistakes'::text) ~ '^\d{1,3}$'::text) THEN ((props ->> 'mistakes'::text))::integer
            ELSE NULL::integer
        END) FILTER (WHERE (event = 'puzzle_end'::text)) AS mistakes
   FROM insights.ev
  WHERE ((pv IS NOT NULL) AND (item_path <> ALL (ARRAY['index.html'::text, 'puzzles.html'::text, 'games.html'::text, 'privacy.html'::text])))
  GROUP BY pv;
revoke all on table insights.page_loads from public, anon, authenticated, service_role;

reset search_path;

CREATE OR REPLACE FUNCTION public.admin_dashboard(p_from date, p_to date, p_ghosts boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  ev as (select e.*, case when e.item_path = 'index.html' then 'site' else e.section end as rsec
         from insights.ev e where day between p_from and p_to
         and (p_ghosts or not exists (select 1 from gh where gh.anon_id = e.anon_id))),
  pl as (select *, item_path ~ '(word-tangle|geo-borders|quiz-reckon)' as is_scored from insights.page_loads p where day between p_from and p_to
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
      (select count(*) from pl where section = 'news') as article_opens,
      (select count(distinct anon_id) from pl where section = 'news') as article_readers,
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
      count(distinct e.anon_id) filter (where e.rsec = 'news') as news,
      count(distinct e.anon_id) filter (where e.rsec = 'puzzles') as puzzles,
      count(distinct e.anon_id) filter (where e.rsec = 'games') as games,
      count(*) filter (where e.event = 'puzzle_end' and e.props->>'outcome' = 'solved'
                         and e.item_path !~ '(word-tangle|geo-borders|quiz-reckon)') as solved
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
    select substring(item_path from '(crossword-mini|logic-doku|logic-path|logic-sweep|word-link|geo-borders|word-tangle|quiz-reckon)') as type,
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
    select rsec as section, count(distinct anon_id) as readers, count(distinct pv) filter (where event = 'page_view') as page_loads
    from ev where rsec in ('news','puzzles','games') group by rsec
  ),
  mixes as (
    select concat_ws(' + ', case when n then 'News' end, case when p then 'Puzzles' end, case when g then 'Games' end) as mix, count(*) as readers
    from (select anon_id, bool_or(rsec='news') n, bool_or(rsec='puzzles') p, bool_or(rsec='games') g
          from ev group by anon_id) r
    where n or p or g group by 1
  ),
  fronts as (
    select item_path as page, count(distinct anon_id) as readers, count(distinct pv) as page_loads
    from ev where event = 'page_view' and item_path in ('index.html', 'puzzles.html', 'games.html') group by 1
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
    'front_pages', coalesce((select jsonb_agg(to_jsonb(fronts)) from fronts), '[]'),
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

CREATE OR REPLACE FUNCTION public.admin_dashboard(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select public.admin_dashboard(p_from, p_to, false) $function$;
revoke all on function public.admin_dashboard(date, date) from public, anon;
grant execute on function public.admin_dashboard(date, date) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_exclude_device(p_anon uuid, p_exclude boolean DEFAULT NULL::boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
grant execute on function public.admin_exclude_device(uuid, boolean) to authenticated, service_role;
