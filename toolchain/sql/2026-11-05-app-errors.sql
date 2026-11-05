-- The app's error log (5 Nov 2026, Alec's go-ahead; app review item 2).
-- A crash on a tester's phone otherwise reaches nobody. `insights.app_errors` keeps what broke,
-- never who: no visitor code, player id, email or address. `log_app_error` is the only way in
-- and is callable without sign-in, as `log_events` is, so it cuts every text to length, refuses
-- past 300 rows an hour site-wide and keeps 90 days. Nothing can read the table through the API;
-- the morning site check reads it with SELECT. Safe to re-run.
create table if not exists insights.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,
  message text not null,
  stack text,
  screen text,
  version text,
  update_id text,
  platform text
);
alter table insights.app_errors enable row level security;
create index if not exists app_errors_at on insights.app_errors (at desc);

create or replace function public.log_app_error(p jsonb)
returns boolean language plpgsql security definer set search_path = '' as $fn$
begin
  if jsonb_typeof(p) <> 'object' or coalesce(p->>'kind', '') !~ '^[a-z_]{3,20}$'
     or coalesce(p->>'message', '') = '' then
    return false;
  end if;
  if (select count(*) from insights.app_errors where at > now() - interval '1 hour') >= 300 then
    return false;
  end if;
  delete from insights.app_errors where at < now() - interval '90 days';
  insert into insights.app_errors (kind, message, stack, screen, version, update_id, platform)
  values (p->>'kind', left(p->>'message', 300), left(p->>'stack', 1500), left(p->>'screen', 100),
          left(p->>'version', 20), left(p->>'update', 20), left(p->>'platform', 20));
  return true;
end $fn$;
revoke all on function public.log_app_error(jsonb) from public;
grant execute on function public.log_app_error(jsonb) to anon, authenticated;
