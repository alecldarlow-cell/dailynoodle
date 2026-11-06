-- 6 Nov 2026: the admin page's "Archive and stats" panel (Puzzles tab).
--
-- The archive by month (archive.html, the app's Archive calendar) and Your stats
-- (stats.html, the app's Stats tab) send three anonymous events through log_events:
-- archive_open, archive_play {type, id} and stats_open. No nickname, email or
-- player id is ever sent; the anonymous visitor code is the tracker's own.
--
--   * public.admin_archive_stats(p_from, p_to): per London week (Monday first) in
--     the range, archive opens, archive plays (and by type), stats opens, and how
--     many visitors opened stats. Admin email only, as every admin_* function.
--
-- Read-only and additive: one new function; public.events is only read, through
-- insights.ev (so excluded readers stay out). Apply as migration admin_archive_stats.

create or replace function public.admin_archive_stats(p_from date, p_to date)
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
  with e as (
    select date_trunc('week', day)::date as week, event, anon_id,
      case when props->>'type' ~ '^[a-z]{3,10}$' then props->>'type' end as ty
    from insights.ev
    where day between p_from and p_to and event in ('archive_open', 'archive_play', 'stats_open')
  ),
  byty as (
    select week, jsonb_object_agg(ty, n order by ty) as by_type
    from (select week, ty, count(*) as n from e where event = 'archive_play' and ty is not null group by week, ty) x
    group by week
  ),
  wk as (
    select week,
      count(*) filter (where event = 'archive_open') as archive_opens,
      count(*) filter (where event = 'archive_play') as archive_plays,
      count(*) filter (where event = 'stats_open') as stats_opens,
      count(distinct anon_id) filter (where event = 'stats_open') as stats_visitors
    from e group by week
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'week', wk.week, 'archive_opens', wk.archive_opens, 'archive_plays', wk.archive_plays,
      'stats_opens', wk.stats_opens, 'stats_visitors', wk.stats_visitors,
      'by_type', coalesce(byty.by_type, '{}'::jsonb)) order by wk.week), '[]'::jsonb)
    into out
  from wk left join byty using (week);
  return jsonb_build_object('weeks', out);
end
$function$;

revoke all on function public.admin_archive_stats(date, date) from public, anon;
grant execute on function public.admin_archive_stats(date, date) to authenticated, service_role;
