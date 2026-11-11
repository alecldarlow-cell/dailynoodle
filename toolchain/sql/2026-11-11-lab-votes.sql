-- Lab trial votes (11 Nov 2026, Alec's go-ahead: project doc claude/lab-in-app-brief.md).
--
-- After a Lab puzzle is solved, on the website and in the app, the player is asked one
-- question: "Should <Name> go daily?" Yes or No, one tap. This keeps those answers.
--
--   * insights.lab_votes: one row per voter per Lab type, the latest answer. The voter is
--     the signed-in account ('u:' + auth.uid()) when there is one, else the tracker's
--     anonymous visitor code ('a:' + uuid). No nickname, email or address. RLS on, no
--     grants: nothing reads it through the API.
--   * public.lab_vote(p_anon, p_type, p_vote, p_source): the only way in, callable without
--     sign-in, as log_events is. Re-voting replaces the answer. Refuses past 600 votes an
--     hour site-wide, a type that isn't a Lab slug, and a source other than web/app.
--   * public.admin_lab(p_from, p_to): per Lab type, players, starts, finishes, abandons,
--     median solve time, and the votes (yes, no, % yes, by source). Abandons sit beside the
--     votes so a high Yes from the few who finished is never read alone. Admin email only,
--     as every admin_* function. Plays come from insights.page_loads (excluded readers
--     already out); votes are counted over voters whose latest answer is in the range.
--   * The tracker slugs logic-tilt, word-redact and word-tumbler join the puzzle-type regex
--     in public.admin_dashboard and insights.puzzle_types (they showed under a blank type),
--     by substitution on the live definitions, as the Tally and Reckon patches did.
--
-- Applied to the live database 11 Nov 2026 (migrations lab_votes, then lab_votes_admin_not_anon: Supabase's
-- default grant had let anon call admin_lab, which still refused it as not_admin). Safe to re-run apart from the regex step, which checks
-- its fragments are found the expected number of times. Rollback: drop the two functions
-- and the table; the regex substitution the other way round.

create table if not exists insights.lab_votes (
  voter text not null,
  type text not null,
  vote boolean not null,
  source text not null,
  first_at timestamptz not null default now(),
  at timestamptz not null default now(),
  primary key (voter, type),
  constraint lab_votes_type check (type ~ '^[a-z]{3,12}$'),
  constraint lab_votes_source check (source in ('web', 'app'))
);
alter table insights.lab_votes enable row level security;
create index if not exists lab_votes_at on insights.lab_votes (at desc);

create or replace function public.lab_vote(p_anon uuid, p_type text, p_vote boolean, p_source text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare
  who text;
begin
  -- The Lab types on trial or once on trial. A new Lab type adds itself here.
  if p_type is null or p_type not in ('tilt', 'redact', 'tumbler') or p_vote is null
     or p_source is null or p_source not in ('web', 'app') then
    return false;
  end if;
  who := case when auth.uid() is not null then 'u:' || auth.uid()::text
              when p_anon is not null then 'a:' || p_anon::text end;
  if who is null then return false; end if;
  if (select count(*) from insights.lab_votes where at > now() - interval '1 hour') >= 600 then
    return false;
  end if;
  insert into insights.lab_votes (voter, type, vote, source)
  values (who, p_type, p_vote, p_source)
  on conflict (voter, type) do update
    set vote = excluded.vote, source = excluded.source, at = now();
  return true;
end $fn$;
revoke all on function public.lab_vote(uuid, text, boolean, text) from public;
grant execute on function public.lab_vote(uuid, text, boolean, text) to anon, authenticated;

create or replace function public.admin_lab(p_from date, p_to date)
 returns jsonb
 language plpgsql
 stable
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
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 400 then
    raise exception 'bad_range';
  end if;
  with plays as (
    select substring(item_path, '(logic-tilt|word-redact|word-tumbler)') as slug,
           anon_id, started, outcome, solve_secs
    from insights.page_loads
    where section = 'puzzles' and day between p_from and p_to
      and item_path ~ '(logic-tilt|word-redact|word-tumbler)'
  ),
  p as (
    select case slug when 'logic-tilt' then 'tilt' when 'word-redact' then 'redact' else 'tumbler' end as type,
      count(distinct anon_id) as players,
      count(distinct anon_id) filter (where started) as starters,
      count(distinct anon_id) filter (where outcome is not null) as finishers,
      count(*) filter (where started) as starts,
      count(*) filter (where outcome is not null) as finishes,
      count(*) filter (where started and outcome is null) as abandons,
      (percentile_cont(0.5) within group (order by solve_secs::double precision)
         filter (where outcome = 'solved'))::integer as median_solve_secs
    from plays group by 1
  ),
  v as (
    select type,
      count(*) filter (where vote) as yes,
      count(*) filter (where not vote) as no,
      count(*) filter (where vote and source = 'app') as yes_app,
      count(*) filter (where not vote and source = 'app') as no_app,
      count(*) filter (where vote and source = 'web') as yes_web,
      count(*) filter (where not vote and source = 'web') as no_web
    from insights.lab_votes
    where (at at time zone 'Europe/London')::date between p_from and p_to
    group by type
  ),
  t as (select unnest(array['tilt', 'redact', 'tumbler']) as type)
  select coalesce(jsonb_agg(jsonb_build_object(
      'type', t.type,
      'players', coalesce(p.players, 0), 'starters', coalesce(p.starters, 0),
      'finishers', coalesce(p.finishers, 0),
      'starts', coalesce(p.starts, 0), 'finishes', coalesce(p.finishes, 0),
      'abandons', coalesce(p.abandons, 0),
      'pct_abandoned', case when coalesce(p.starts, 0) > 0
                            then round(100.0 * p.abandons / p.starts)::int end,
      'median_solve_secs', p.median_solve_secs,
      'yes', coalesce(v.yes, 0), 'no', coalesce(v.no, 0),
      'pct_yes', case when coalesce(v.yes, 0) + coalesce(v.no, 0) > 0
                      then round(100.0 * v.yes / (v.yes + v.no))::int end,
      'app', jsonb_build_object('yes', coalesce(v.yes_app, 0), 'no', coalesce(v.no_app, 0)),
      'web', jsonb_build_object('yes', coalesce(v.yes_web, 0), 'no', coalesce(v.no_web, 0))
    ) order by t.type), '[]'::jsonb)
  into out
  from t left join p using (type) left join v using (type);
  return jsonb_build_object('from', p_from, 'to', p_to, 'types', out);
end $function$;
revoke all on function public.admin_lab(date, date) from public, anon;
grant execute on function public.admin_lab(date, date) to authenticated;

-- The three Lab slugs in the dashboard's and puzzle_types' type regex.
do $$
declare d text; c int;
  types_old text := 'quiz-reckon|logic-tally)';
  types_new text := 'quiz-reckon|logic-tally|logic-tilt|word-redact|word-tumbler)';
begin
  d := pg_get_functiondef('public.admin_dashboard(date,date,boolean)'::regprocedure);
  if position(types_new in d) = 0 then
    c := (length(d) - length(replace(d, types_old, ''))) / length(types_old);
    if c <> 1 then raise exception 'admin_dashboard: expected 1 type regex, found %', c; end if;
    execute replace(d, types_old, types_new);
  end if;

  d := pg_get_viewdef('insights.puzzle_types'::regclass);
  if position(types_new in d) = 0 then
    c := (length(d) - length(replace(d, types_old, ''))) / length(types_old);
    if c <> 2 then raise exception 'insights.puzzle_types: expected 2 type regexes, found %', c; end if;
    execute 'create or replace view insights.puzzle_types as ' || replace(d, types_old, types_new);
  end if;
end $$;
