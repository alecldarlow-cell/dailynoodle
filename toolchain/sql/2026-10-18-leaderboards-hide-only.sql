-- =========================================================================
-- Leaderboards, part 2: leave, remove player and close league as HIDE-ONLY
-- (18 Oct 2026). Apply after 2026-10-18-leaderboards.sql.
-- Applied as migrations leaderboards_soft_remove_columns and
-- leaderboards_soft_remove.
--
-- Nothing is deleted. Leaving / removal mark the member row (left_at, left_by)
-- and move the nickname into left_nick, replacing it with a "~" placeholder
-- (names can't start with ~) so the name is free for someone else; the old
-- unique index on (league_id, lower(nickname)) therefore still holds.
-- Closing marks the league (closed_at). Results are never touched, and a
-- player who rejoins gets their row and results back.
--
-- This file redefines every function that reads members or leagues so that
-- left members and closed leagues are ignored. The live definitions in the
-- database are authoritative: compare with pg_get_functiondef if in doubt.
-- =========================================================================

alter table board.members add column left_at timestamptz;
alter table board.members add column left_by text check (left_by in ('self','owner','admin','closed'));
alter table board.leagues add column closed_at timestamptz;
alter table board.leagues add column closed_by text check (closed_by in ('owner','admin','empty'));
create unique index members_nick_active_uq on board.members (league_id, lower(nickname)) where left_at is null;
create index members_active on board.members (league_id) where left_at is null;
alter table board.members add column left_nick text;

create or replace function board.league_of(p_code text) returns bigint
language sql stable security definer set search_path = '' as
$$ select id from board.leagues where code = upper(btrim(coalesce(p_code, ''))) and closed_at is null $$;

create or replace function board.must_member(p_player uuid, p_code text) returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare lid bigint := board.league_of(p_code);
begin
  if lid is null then raise exception 'no_league'; end if;
  if not exists (select 1 from board.members where league_id = lid and player = p_player and left_at is null) then
    raise exception 'not_member';
  end if;
  return lid;
end $$;

create or replace function board.in_any(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from board.members m join board.leagues l on l.id = m.league_id
                 where m.player = p_player and m.left_at is null and l.closed_at is null)
$$;

-- Take a member off a league's boards, keeping the row and their nickname (in left_nick).
create or replace function board.park(lid bigint, who uuid, why text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update board.members
     set left_at = now(), left_by = why, left_nick = nickname,
         nickname = '~' || substr(md5(lid::text || who::text || clock_timestamp()::text), 1, 12)
   where league_id = lid and player = who and left_at is null;
  return found;
end $$;

-- If the owner has gone, the longest-standing current member takes over; with nobody left, close.
create or replace function board.settle_owner(lid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare nxt uuid;
begin
  if exists (select 1 from board.members m join board.leagues l on l.id = m.league_id
             where l.id = lid and m.player = l.owner and m.left_at is null) then return; end if;
  select player into nxt from board.members where league_id = lid and left_at is null order by joined_at limit 1;
  if nxt is null then update board.leagues set closed_at = now(), closed_by = 'empty' where id = lid and closed_at is null;
  else update board.leagues set owner = nxt where id = lid; end if;
end $$;

create or replace function public.board_mine(p_player uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', l.code, 'name', l.name, 'nickname', m.nickname, 'owner', l.owner = p_player,
           'members', (select count(*) from board.members x where x.league_id = l.id and x.left_at is null))
         order by m.joined_at), '[]'::jsonb)
  from board.members m join board.leagues l on l.id = m.league_id
  where m.player = p_player and m.left_at is null and l.closed_at is null
$$;

create or replace function public.board_peek(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r record;
begin
  select l.name, (select count(*) from board.members m where m.league_id = l.id and m.left_at is null) as n
    into r from board.leagues l where l.id = board.league_of(p_code);
  if not found then raise exception 'no_league'; end if;
  return jsonb_build_object('name', r.name, 'members', r.n);
end $$;

create or replace function public.board_create(p_player uuid, p_name text, p_nick text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text := board.clean(p_name, 2, 30, 'bad_name');
        nk text := board.clean(p_nick, 2, 16, 'bad_nick');
        c text; lid bigint;
begin
  if p_player is null then raise exception 'bad_player'; end if;
  if (select count(*) from board.leagues where owner = p_player and closed_at is null) >= board.lim('owned_per_player') then raise exception 'too_many_owned'; end if;
  if (select count(*) from board.members m join board.leagues l on l.id = m.league_id
      where m.player = p_player and m.left_at is null and l.closed_at is null) >= board.lim('joined_per_player') then raise exception 'too_many_joined'; end if;
  if (select count(*) from board.leagues) >= board.lim('max_leagues') then raise exception 'busy'; end if;
  perform board.gate('create');
  c := board.new_code();
  insert into board.leagues (code, name, owner) values (c, nm, p_player) returning id into lid;
  insert into board.members (league_id, player, nickname) values (lid, p_player, nk);
  return jsonb_build_object('code', c, 'name', nm);
end $$;

create or replace function public.board_join(p_player uuid, p_code text, p_nick text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid bigint := board.league_of(p_code);
        nk text := board.clean(p_nick, 2, 16, 'bad_nick');
        r record; back boolean;
begin
  if p_player is null then raise exception 'bad_player'; end if;
  if lid is null then raise exception 'no_league'; end if;
  if exists (select 1 from board.members where league_id = lid and player = p_player and left_at is null) then raise exception 'already_member'; end if;
  back := exists (select 1 from board.members where league_id = lid and player = p_player);
  if (select count(*) from board.members m join board.leagues l on l.id = m.league_id
      where m.player = p_player and m.left_at is null and l.closed_at is null) >= board.lim('joined_per_player') then raise exception 'too_many_joined'; end if;
  if (select count(*) from board.members where league_id = lid and left_at is null) >= board.lim('league_size') then raise exception 'league_full'; end if;
  if (select count(*) from board.members) >= board.lim('max_members') then raise exception 'busy'; end if;
  if exists (select 1 from board.members where league_id = lid and left_at is null and lower(nickname) = lower(nk)) then raise exception 'nick_taken'; end if;
  perform board.gate('join');
  if back then   -- rejoining: the same row comes back with the new nickname
    update board.members set nickname = nk, left_at = null, left_by = null, left_nick = null
     where league_id = lid and player = p_player;
  else
    insert into board.members (league_id, player, nickname) values (lid, p_player, nk);
  end if;
  select code, name into r from board.leagues where id = lid;
  return jsonb_build_object('code', r.code, 'name', r.name);
end $$;

create or replace function public.board_leave(p_player uuid, p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare lid bigint := board.must_member(p_player, p_code);
begin
  perform board.park(lid, p_player, 'self');
  perform board.settle_owner(lid);
  return true;
end $$;

create or replace function public.board_remove(p_player uuid, p_code text, p_nick text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare lid bigint := board.must_owner(p_player, p_code); who uuid;
begin
  select player into who from board.members
   where league_id = lid and left_at is null and lower(nickname) = lower(btrim(coalesce(p_nick, ''))) and player <> p_player;
  if who is null then return false; end if;
  return board.park(lid, who, 'owner');
end $$;

create or replace function public.board_close(p_player uuid, p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare lid bigint := board.must_owner(p_player, p_code);
begin
  update board.leagues set closed_at = now(), closed_by = 'owner' where id = lid;
  return true;
end $$;

-- board_submit, board_backfill: membership check is now board.in_any(p_player);
-- board_submit only refreshes last_active on leagues the player is still in.
-- board_day: "mem" is current members only (left_at is null).
-- admin_board: actions rename, close, reopen, remove (all hide-only) and pause;
-- the listing shows closed leagues last and left/removed nicknames.
-- Full text of these four: see the live definitions (pg_get_functiondef).

grant execute on function public.board_leave(uuid,text), public.board_remove(uuid,text,text),
  public.board_close(uuid,text) to anon, authenticated;
