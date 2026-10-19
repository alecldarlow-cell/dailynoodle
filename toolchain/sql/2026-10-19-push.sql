-- ==========================================================================
-- Push notifications: plumbing only, switched off (19 Oct 2026)
-- --------------------------------------------------------------------------
-- Stores a browser's push subscription against its board player id (the
-- random id in localStorage noodle-board-v1; no names, no accounts) so that
-- later, leaderboard events can notify players ("Jo beat your Mini time").
-- Nothing sends yet:
--   - board.settings 'push' {"send": false} blocks every send except a
--     reader's own self-test (board-push edge function, action 'test');
--   - no page offers notifications: the only way to subscribe is the hidden
--     test panel on board.html?push=test.
-- The push keys (VAPID) are made by the board-push edge function the first
-- time it runs and kept in board.settings 'vapid'; the private half never
-- leaves the server. Like the rest of the board, nothing is deleted: an
-- ended subscription is marked gone_at.
-- ==========================================================================

create table board.push_subs (
  id         bigint generated always as identity primary key,
  player     uuid not null,
  endpoint   text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh     text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth       text not null check (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now(),   -- last saved by the browser
  gone_at    timestamptz,                          -- unsubscribed, or the push service said it has ended
  last_sent  timestamptz,
  last_test  timestamptz,
  fails      smallint not null default 0
);
create index push_subs_player on board.push_subs (player) where gone_at is null;
alter table board.push_subs enable row level security;

insert into board.settings values ('push', '{"send": false, "subs_per_player": 5}')
on conflict (key) do nothing;

-- Only the browsers' own push services: Chrome/Android, Firefox, Safari/iOS, Edge.
create or replace function board.push_host_ok(p_endpoint text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(substring(p_endpoint from '^https://([^/:]+)/') ~
    '(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$', false)
$$;

-- ---------- called by the page (dn-push.js) and the service worker ----------

create or replace function public.board_push_save(p_player uuid, p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_player is null or not board.push_host_ok(p_endpoint) then raise exception 'bad_sub'; end if;
  select count(*) into n from board.push_subs where player = p_player and gone_at is null and endpoint <> p_endpoint;
  if n >= coalesce((board.cfg('push') ->> 'subs_per_player')::int, 5) then raise exception 'too_many'; end if;
  insert into board.push_subs (player, endpoint, p256dh, auth) values (p_player, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set player = excluded.player, p256dh = excluded.p256dh, auth = excluded.auth,
    seen_at = now(), gone_at = null, fails = 0;
  return true;
end $$;

create or replace function public.board_push_drop(p_player uuid, p_endpoint text)
returns boolean language sql security definer set search_path = '' as $$
  update board.push_subs set gone_at = now() where player = p_player and endpoint = p_endpoint and gone_at is null
  returning true
$$;

-- The browser renewed a subscription by itself (sw.js 'pushsubscriptionchange').
create or replace function public.board_push_swap(p_old text, p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not board.push_host_ok(p_endpoint) then raise exception 'bad_sub'; end if;
  update board.push_subs set endpoint = p_endpoint, p256dh = p_p256dh, auth = p_auth, seen_at = now(), gone_at = null, fails = 0
   where endpoint = p_old and not exists (select 1 from board.push_subs where endpoint = p_endpoint);
  return found;
end $$;

-- ---------- called only by the board-push edge function (service role) ----------

-- Keys: stored on first call, then always the stored ones.
create or replace function public.board_push_vapid(p_pub text default null, p_priv jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if board.cfg('vapid') is null and p_pub is not null and p_priv is not null then
    insert into board.settings values ('vapid', jsonb_build_object('pub', p_pub, 'priv', p_priv, 'made', now()))
    on conflict (key) do nothing;
  end if;
  return board.cfg('vapid');
end $$;

create or replace function public.board_push_cfg() returns jsonb
language sql stable security definer set search_path = '' as $$ select board.cfg('push') $$;

create or replace function public.board_push_targets(p_players uuid[])
returns table (id bigint, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.endpoint, s.p256dh, s.auth from board.push_subs s
   where s.player = any (p_players) and s.gone_at is null
$$;

-- One self-test a minute per player; true if this one may go.
create or replace function public.board_push_test_ok(p_player uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from board.push_subs where player = p_player and last_test > now() - interval '1 minute') then
    return false;
  end if;
  update board.push_subs set last_test = now() where player = p_player and gone_at is null;
  return found;
end $$;

create or replace function public.board_push_result(p_id bigint, p_ok boolean, p_gone boolean)
returns void language sql security definer set search_path = '' as $$
  update board.push_subs set
    last_sent = case when p_ok then now() else last_sent end,
    fails     = case when p_ok then 0 else least(fails + 1, 1000) end,
    gone_at   = case when p_gone or fails >= 9 then coalesce(gone_at, now()) else gone_at end
   where id = p_id
$$;

revoke all on function public.board_push_save(uuid, text, text, text), public.board_push_drop(uuid, text),
  public.board_push_swap(text, text, text, text), public.board_push_vapid(text, jsonb), public.board_push_cfg(),
  public.board_push_targets(uuid[]), public.board_push_test_ok(uuid), public.board_push_result(bigint, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.board_push_save(uuid, text, text, text), public.board_push_drop(uuid, text),
  public.board_push_swap(text, text, text, text) to anon, authenticated;
grant execute on function public.board_push_vapid(text, jsonb), public.board_push_cfg(), public.board_push_targets(uuid[]),
  public.board_push_test_ok(uuid), public.board_push_result(bigint, boolean, boolean) to service_role;

-- So the database can call the board-push edge function (applied separately as enable_pg_net).
create extension if not exists pg_net with schema extensions;
