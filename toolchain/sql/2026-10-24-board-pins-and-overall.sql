-- Leagues on any browser with a PIN, and the all-puzzles table (24 Oct 2026, Alec's go-ahead after the site review).
-- Applied to the live database as migration board_pins_and_overall.
--
-- Why: on an iPhone, Safari, each home-screen icon and the browser inside WhatsApp keep separate storage, so a
-- player who joined in one place was in no league where they actually played. The 21 Oct personal link
-- (dn-board.js moveLink) was never used (no board_key events by 24 Oct). Now a player sets a 4-digit PIN, and in
-- any other browser opens the league's invite link (or types its code), picks their nickname and enters the PIN.
-- The server then hands that browser the player's board id. This is the one deliberate exception to "no function
-- ever returns a player id": it is gated by the PIN, by a lock after 5 wrong PINs (1 hour) and by the per-address
-- and site-wide attempt limits (board.gate 'claim'). A PIN is only 4 digits, so the limits, not the hash, are what
-- protect it; it is stored salted and hashed all the same, and never returned.
-- A player who never set a PIN, or forgot it, is let back in by the league's owner ("Let back in": anyone may
-- claim that nickname without a PIN for 24 hours, once), and then sets a new PIN.
--
-- board_overall: one table across all eight daily puzzles for a day and its Monday-to-Sunday week. Each puzzle
-- a player completed (solved, or a scored round) earns 1 point plus 1 for each league player whose completed
-- result on that puzzle was worse, using exactly board_day's order (score then time; Link mistakes then time;
-- time).
-- Ties earn the same. Failed or revealed rounds count as played, with no points.
--
-- board_mine and board_peek are written out in full from their live definitions (pg_get_functiondef, 24 Oct 2026)
-- with the additions marked, so this file is their complete current source. Grants are kept by CREATE OR REPLACE.
-- Nothing is deleted. Rollback: drop the four new public functions, board.pin_digest and board.pins, drop the
-- members.claim_until column, restore the two definitions below without the marked lines and the attempts check
-- without 'claim'.

alter table board.attempts drop constraint attempts_action_check;
alter table board.attempts add constraint attempts_action_check check (action in ('create','join','claim'));

update board.settings set value = value || '{"ip_claim_hour": 10, "site_claim_day": 300}'::jsonb where key = 'limits';

create table board.pins (
  player       uuid primary key,
  salt         text not null,
  digest       text not null,
  fails        smallint not null default 0,
  locked_until timestamptz,
  set_at       timestamptz not null default now()
);
alter table board.pins enable row level security;

alter table board.members add column claim_until timestamptz;

create or replace function board.pin_digest(p_salt text, p_pin text) returns text
language sql immutable set search_path = '' as
$$ select encode(sha256(convert_to(p_salt || ':' || p_pin, 'utf8')), 'hex') $$;

-- live definition + 'pin' (24 Oct 2026)
create or replace function public.board_mine(p_player uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', l.code, 'name', l.name, 'nickname', m.nickname, 'owner', l.owner = p_player,
           'members', (select count(*) from board.members x where x.league_id = l.id and x.left_at is null),
           'pin', exists (select 1 from board.pins p where p.player = p_player))      -- 24 Oct 2026
         order by m.joined_at), '[]'::jsonb)
  from board.members m join board.leagues l on l.id = m.league_id
  where m.player = p_player and m.left_at is null and l.closed_at is null
$function$;

-- live definition + 'players' (24 Oct 2026): the nicknames, for the "Already in this league?" picker.
-- Anyone with the code can already join and see them on the board.
create or replace function public.board_peek(p_code text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare r record;
begin
  select l.id, l.name, (select count(*) from board.members m where m.league_id = l.id and m.left_at is null) as n
    into r from board.leagues l where l.id = board.league_of(p_code);
  if not found then raise exception 'no_league'; end if;
  return jsonb_build_object('name', r.name, 'members', r.n,
    'players', coalesce((select jsonb_agg(m.nickname order by m.joined_at) from board.members m       -- 24 Oct 2026
                          where m.league_id = r.id and m.left_at is null), '[]'::jsonb));
end $function$;

-- Set or change this player's PIN. Holding the board id is the proof; no old PIN needed.
create or replace function public.board_pin_set(p_player uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare s text := encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'utf8')), 'hex');
begin
  if p_player is null or not board.in_any(p_player) then raise exception 'not_member'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then raise exception 'bad_pin_format'; end if;
  insert into board.pins (player, salt, digest) values (p_player, s, board.pin_digest(s, p_pin))
  on conflict (player) do update set salt = excluded.salt, digest = excluded.digest,
                                     fails = 0, locked_until = null, set_at = now();
  return true;
end $$;

-- Play as yourself in this browser too: league code, nickname, PIN. Returns {ok, error?} rather than raising
-- after the attempt is recorded, so failed tries count towards the limits.
create or replace function public.board_claim(p_code text, p_nick text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid bigint := board.league_of(p_code);
        lg record; m record; pn record; open boolean;
begin
  select id, code, name, closed_at into lg from board.leagues where id = lid;
  if lid is null or lg.closed_at is not null then raise exception 'no_league'; end if;
  perform board.gate('claim');
  select player, nickname, claim_until into m from board.members
   where league_id = lid and left_at is null and lower(nickname) = lower(btrim(coalesce(p_nick, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'no_player'); end if;
  open := m.claim_until is not null and m.claim_until > now();
  select * into pn from board.pins where player = m.player;
  if not open then
    if pn.player is null then return jsonb_build_object('ok', false, 'error', 'no_pin'); end if;
    if pn.locked_until is not null and pn.locked_until > now() then
      return jsonb_build_object('ok', false, 'error', 'pin_locked');
    end if;
    if coalesce(p_pin, '') !~ '^[0-9]{4}$' or board.pin_digest(pn.salt, p_pin) <> pn.digest then
      update board.pins set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
                            locked_until = case when fails + 1 >= 5 then now() + interval '1 hour' else locked_until end
       where player = m.player;
      return jsonb_build_object('ok', false, 'error', 'bad_pin');
    end if;
    update board.pins set fails = 0, locked_until = null where player = m.player;
  else
    update board.members set claim_until = null where league_id = lid and player = m.player;
  end if;
  return jsonb_build_object('ok', true, 'player', m.player, 'code', lg.code, 'name', lg.name,
                            'nick', m.nickname, 'needs_pin', open or pn.player is null);
end $$;

-- Owner: let a player back in without their PIN, once, within 24 hours (they then set a new one).
create or replace function public.board_let_back(p_player uuid, p_code text, p_nick text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare lid bigint := board.must_owner(p_player, p_code);
begin
  update board.members set claim_until = now() + interval '1 day'
   where league_id = lid and left_at is null and player <> p_player
     and lower(nickname) = lower(btrim(coalesce(p_nick, '')));
  return found;
end $$;

-- All eight puzzles: the day and its Monday-to-Sunday week, for one league.
create or replace function public.board_overall(p_player uuid, p_code text, p_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lid bigint := board.must_member(p_player, p_code);
        wk date := p_date - (extract(isodow from p_date)::int - 1);
        out jsonb;
begin
  if p_date is null then raise exception 'bad_date'; end if;
  with mem as (
    select player, nickname, joined_at from board.members where league_id = lid and left_at is null
  ), r as (
    select x.player, x.puzzle_path, x.ptype, x.puzzle_date, x.outcome in ('solved','scored') as done,
           case when x.ptype in ('tangle','borders','reckon') then -coalesce(x.score, 0)
                when x.ptype = 'link' then coalesce(x.mistakes, 99) else 0 end as k1,
           coalesce(x.secs, 999999) as k2
    from board.results x join mem using (player)
    where x.puzzle_date between wk and wk + 6 and x.puzzle_date <= p_date
  ), pts as (      -- 1 for completing, plus 1 per completed result strictly worse than yours
    select d.player, d.puzzle_date, d.done,
           case when d.done then 1 + (select count(*) from r o where o.puzzle_path = d.puzzle_path and o.done
                                       and (o.k1, o.k2) > (d.k1, d.k2)) else 0 end as p
    from r d
  ), tot as (
    select m.nickname, m.player = p_player as me, m.joined_at,
           coalesce(sum(t.p) filter (where t.puzzle_date = p_date), 0) as dp,
           count(t.player) filter (where t.puzzle_date = p_date) as dn,
           count(t.player) filter (where t.puzzle_date = p_date and t.done) as dd,
           coalesce(sum(t.p), 0) as wp, count(t.player) as wn, count(t.player) filter (where t.done) as wd
    from mem m left join pts t on t.player = m.player
    group by m.nickname, m.player, m.joined_at
  )
  select jsonb_build_object(
    'day', coalesce((select jsonb_agg(jsonb_build_object('rank', rk, 'nick', nickname, 'me', me, 'points', dp,
                       'played', dn, 'completed', dd) order by rk, nickname)
                     from (select *, rank() over (order by dp desc, dd desc) rk from tot where dn > 0) z), '[]'),
    'week', coalesce((select jsonb_agg(jsonb_build_object('rank', rk, 'nick', nickname, 'me', me, 'points', wp,
                       'played', wn, 'completed', wd) order by rk, nickname)
                      from (select *, rank() over (order by wp desc, wd desc) rk from tot where wn > 0) z), '[]'),
    'not_yet', coalesce((select jsonb_agg(jsonb_build_object('nick', nickname, 'me', me) order by joined_at)
                         from tot where dn = 0), '[]'),
    'week_from', wk, 'week_to', wk + 6,
    'players', coalesce((select jsonb_agg(nickname order by joined_at) from mem), '[]'),
    'members', (select count(*) from mem),
    'first', coalesce((select min(puzzle_date) from board.results x join mem using (player)),
                      (select min(joined_at)::date from mem))
  ) into out;
  return out;
end $$;

grant execute on function public.board_pin_set(uuid, text), public.board_claim(text, text, text),
  public.board_let_back(uuid, text, text), public.board_overall(uuid, text, date) to anon, authenticated;
