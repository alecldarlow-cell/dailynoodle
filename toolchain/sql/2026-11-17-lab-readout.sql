-- Lab trial read-out (17 Nov 2026, Alec: "someone who plays it every day is good signal").
--
-- Replaces public.admin_lab with the same arguments, checks and figures, plus, per Lab type:
--   * returners: players who started it on 2+ different days in the range; regulars: 3+ days;
--     pct_returned: returners as a share of players who started; avg_days: days played per
--     player who started.
--   * pct_finished: players who finished at least once, as a share of those who started.
--   * trial_days: days in the range on which anyone started it (how long it has had).
-- Plays come from insights.page_loads as before. Votes are still not linked to plays: a vote
-- carries its own voter code, never the tracker's visitor code (SITE.md › Lab trial votes),
-- so votes can't be split by how often the voter played.
--
-- Additive: every key admin_lab returned before is unchanged. Safe to re-run.
-- Rollback: re-run admin_lab from 2026-11-11-lab-votes.sql.

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
           anon_id, day, started, outcome, solve_secs
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
  pp as (
    select case slug when 'logic-tilt' then 'tilt' when 'word-redact' then 'redact' else 'tumbler' end as type,
      anon_id, count(distinct day) as days
    from plays where started group by 1, 2
  ),
  r as (
    select type,
      count(*) filter (where days >= 2) as returners,
      count(*) filter (where days >= 3) as regulars,
      round(avg(days)::numeric, 1) as avg_days
    from pp group by type
  ),
  d as (
    select case slug when 'logic-tilt' then 'tilt' when 'word-redact' then 'redact' else 'tumbler' end as type,
      count(distinct day) as trial_days
    from plays where started group by 1
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
      'pct_finished', case when coalesce(p.starters, 0) > 0
                           then round(100.0 * p.finishers / p.starters)::int end,
      'trial_days', coalesce(d.trial_days, 0),
      'returners', coalesce(r.returners, 0), 'regulars', coalesce(r.regulars, 0),
      'pct_returned', case when coalesce(p.starters, 0) > 0
                           then round(100.0 * coalesce(r.returners, 0) / p.starters)::int end,
      'avg_days', r.avg_days,
      'yes', coalesce(v.yes, 0), 'no', coalesce(v.no, 0),
      'pct_yes', case when coalesce(v.yes, 0) + coalesce(v.no, 0) > 0
                      then round(100.0 * v.yes / (v.yes + v.no))::int end,
      'app', jsonb_build_object('yes', coalesce(v.yes_app, 0), 'no', coalesce(v.no_app, 0)),
      'web', jsonb_build_object('yes', coalesce(v.yes_web, 0), 'no', coalesce(v.no_web, 0))
    ) order by t.type), '[]'::jsonb)
  into out
  from t left join p using (type) left join v using (type) left join r using (type) left join d using (type);
  return jsonb_build_object('from', p_from, 'to', p_to, 'types', out);
end $function$;
revoke all on function public.admin_lab(date, date) from public, anon;
grant execute on function public.admin_lab(date, date) to authenticated;
