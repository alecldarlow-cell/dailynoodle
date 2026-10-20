-- 20 Oct 2026: where readers come from (admin Sources tab).
--
-- Alec is listing the site on communities and forums. Each post gets its own
-- tracked link (?via=<tag>); dn-track.js already records via, the in-app
-- browser (app) and the referring site (ref) on every page_view, and from
-- today also takes utm_source or ref= from the address when via is absent.
--
--   * insights.links: the tracked links made on the admin page (tag, label,
--     landing page, note). Admin-only, reached through admin_links. Archiving
--     only hides a link; nothing is deleted.
--   * public.admin_links(action, tag, label, page, note): list | add | archive
--     | restore. Returns every link.
--   * public.admin_sources(p_from, p_to): for readers whose FIRST page view
--     falls in the range, the source of that first view (first touch), with how
--     many left at once (whole history one page, nothing done: the dashboard's
--     "one-page readers", counted here rather than hidden, since a bounce from
--     a post is the answer), did something on that first visit, and came back
--     on a later day. Also visits starting in the range by source, and all-time
--     totals per tracked tag so an older post still shows what it brought.
--   Source of a page view: 'via:<tag>' if tagged, else 'app:<name>' for a named
--   in-app browser, else 'ref:<host>' (www., m., l., lm., old., out., np. and
--   new. stripped), else 'direct' (typed, bookmarks, and apps such as WhatsApp
--   that send nothing).
-- Visit data (public.events) is only read. Applied as migration admin_sources.

create table if not exists insights.links (
  tag text primary key check (tag ~ '^[a-z0-9_-]{1,24}$'),
  label text not null check (length(label) between 1 and 80),
  page text not null default '' check (page ~ '^[A-Za-z0-9_./-]{0,200}$'),
  note text not null default '' check (length(note) <= 200),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
alter table insights.links enable row level security;
revoke all on insights.links from public, anon, authenticated;

create or replace function public.admin_links(p_action text, p_tag text, p_label text, p_page text, p_note text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me text := lower(coalesce(auth.jwt()->>'email', ''));
  t text := lower(coalesce(p_tag, ''));
begin
  if me = '' or not exists (select 1 from insights.admins a where lower(a.email) = me) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_action = 'add' then
    if t !~ '^[a-z0-9_-]{1,24}$' then raise exception 'bad_tag'; end if;
    if t in ('share', 'code', 'link') then raise exception 'tag_reserved'; end if;
    if exists (select 1 from insights.links where tag = t) then raise exception 'tag_taken'; end if;
    insert into insights.links (tag, label, page, note)
      values (t, left(trim(coalesce(p_label, '')), 80), coalesce(p_page, ''), left(trim(coalesce(p_note, '')), 200));
  elsif p_action = 'archive' then
    update insights.links set archived_at = coalesce(archived_at, now()) where tag = t;
  elsif p_action = 'restore' then
    update insights.links set archived_at = null where tag = t;
  elsif p_action is distinct from 'list' then
    raise exception 'bad_action';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'label', label, 'page', page, 'note', note,
                                                       'created', created_at, 'archived', archived_at is not null)
                                    order by archived_at is not null, created_at desc)
                   from insights.links), '[]');
end $function$;
revoke all on function public.admin_links(text, text, text, text, text) from public, anon;
grant execute on function public.admin_links(text, text, text, text, text) to authenticated, service_role;

create or replace function public.admin_sources(p_from date, p_to date)
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
  pvs as (
    select anon_id, session_id, day, occurred_at,
      case when nullif(props->>'via', '') is not null then 'via:' || (props->>'via')
           when nullif(props->>'app', '') is not null then 'app:' || (props->>'app')
           when nullif(props->>'ref', '') is not null then 'ref:' || regexp_replace(lower(props->>'ref'), '^(www|m|l|lm|old|out|np|new)\.', '')
           else 'direct' end as src
    from insights.ev where event = 'page_view'
  ),
  firstpv as (
    select distinct on (anon_id) anon_id, session_id, day, src from pvs order by anon_id, occurred_at, src
  ),
  later as (select anon_id, count(distinct day) as days from insights.ev group by anon_id),
  firstvisit as (
    select f.anon_id,
      count(distinct e.pv) filter (where e.event = 'page_view') as pages,
      bool_or(e.event in ('puzzle_start', 'game_start', 'read_depth', 'card_click', 'board_open')) as acted
    from firstpv f join insights.ev e on e.anon_id = f.anon_id and e.session_id = f.session_id
    group by f.anon_id
  ),
  newr as (
    select f.src, f.anon_id, f.day, l.days, fv.pages, fv.acted,
      exists (select 1 from gh where gh.anon_id = f.anon_id) as bounced
    from firstpv f join later l using (anon_id) left join firstvisit fv using (anon_id)
  ),
  first_in as (
    select src, count(*) as new_readers,
      count(*) filter (where bounced) as left_at_once,
      count(*) filter (where acted or pages > 1) as stayed,
      count(*) filter (where days > 1) as came_back,
      round(avg(pages), 1) as pages_first_visit
    from newr where day between p_from and p_to group by src
  ),
  sess as (
    select distinct on (session_id) session_id, anon_id, day, src from pvs order by session_id, occurred_at, src
  ),
  vis as (
    select s.src, count(*) as visits, count(distinct s.anon_id) as readers,
      count(distinct s.anon_id) filter (where f.day < s.day) as returning_readers
    from sess s join firstpv f using (anon_id)
    where s.day between p_from and p_to
      and not exists (select 1 from gh where gh.anon_id = s.anon_id)
    group by s.src
  ),
  tags as (
    select substr(src, 5) as tag, count(*) as new_readers,
      count(*) filter (where bounced) as left_at_once,
      count(*) filter (where acted or pages > 1) as stayed,
      count(*) filter (where days > 1) as came_back,
      min(day) as first_day, max(day) as last_day
    from newr where src like 'via:%' group by 1
  ),
  tagvisits as (
    select substr(src, 5) as tag, count(*) as visits from sess where src like 'via:%' group by 1
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'generated_at', now(),
    'first', coalesce((select jsonb_agg(to_jsonb(first_in) order by new_readers desc) from first_in), '[]'),
    'visits', coalesce((select jsonb_agg(to_jsonb(vis) order by vis.visits desc) from vis), '[]'),
    'tags', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('visits', coalesce(v.visits, 0)))
                      from tags t left join tagvisits v using (tag)), '[]')
  ) into out;
  return out;
end $function$;
revoke all on function public.admin_sources(date, date) from public, anon;
grant execute on function public.admin_sources(date, date) to authenticated, service_role;
