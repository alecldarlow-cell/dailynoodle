-- =========================================================================
-- Leaderboards: private leagues, one daily board per puzzle (18 Oct 2026)
-- Project: digi (gnehttjheoyutrfsvslq). Applied as migration "leaderboards".
--
-- Tables live in the private `board` schema (not exposed by the API, RLS on,
-- no policies). Browsers only call the public.board_* functions below, all
-- security definer with an empty search_path, like public.log_events.
-- A player is a random id made by the browser (dn-board.js). It acts as the
-- player's key, so no function ever returns one.
--
-- No deletes, by choice (18 Oct 2026): there is no leave, remove-player or
-- close-league function, no tidy-up job, and old limit records are kept.
-- Applied as migrations leaderboards_schema, _tables, _helpers,
-- _player_functions, _limits_and_admin and _backfill.
-- =========================================================================

create schema if not exists board;
revoke all on schema board from public, anon, authenticated;

create table board.leagues (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  name        text not null check (char_length(name) between 2 and 30),
  owner       uuid not null,
  created_at  timestamptz not null default now(),
  last_active timestamptz not null default now()
);
create table board.members (
  league_id  bigint not null references board.leagues(id) on delete cascade,
  player     uuid not null,
  nickname   text not null check (char_length(nickname) between 2 and 16),
  joined_at  timestamptz not null default now(),
  primary key (league_id, player)
);
create unique index members_nick_uq on board.members (league_id, lower(nickname));
create index members_player on board.members (player);

create table board.results (
  player       uuid not null,
  puzzle_path  text not null check (puzzle_path ~ '^reports/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.html$'),
  ptype        text not null check (ptype in ('mini','doku','path','sweep','link','tangle','borders')),
  puzzle_date  date not null,
  outcome      text not null check (outcome in ('solved','failed','revealed','scored')),
  secs         int      check (secs between 1 and 86400),
  score        int      check (score between 0 and 100000),
  mistakes     smallint check (mistakes between 0 and 10),
  submitted_at timestamptz not null default now(),
  primary key (player, puzzle_path)
);
create index results_type_date on board.results (ptype, puzzle_date);

-- Abuse limits: hashed network address and time of each create/join.
create table board.attempts (
  ip_hash text not null,
  action  text not null check (action in ('create','join')),
  at      timestamptz not null default now()
);
create index attempts_at on board.attempts (at);
create index attempts_ip on board.attempts (ip_hash, action, at);

create table board.settings (key text primary key, value jsonb not null);
insert into board.settings values
  ('paused',  '{"create": false, "join": false}'),
  ('limits',  '{"ip_create_hour": 5, "ip_join_hour": 20, "site_create_day": 20, "site_join_day": 200,
                "max_leagues": 2000, "max_members": 20000, "max_results": 500000,
                "owned_per_player": 3, "joined_per_player": 10, "league_size": 50}'),
  ('ip_salt', to_jsonb(encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'utf8')), 'hex'))),
  -- anywhere in a name (rarely innocent) / only as a whole word (so Dickens, Hancock and grape pass)
  ('block_any',  '["fuck","cunt","nigger","nigga","faggot"]'),
  ('block_word', '["shit","shite","retard","wank","wanker","twat","slut","whore","rape","nazi","hitler","paki","spastic","spaz","bollocks","dick","cock","pussy","prick","bitch","bastard","arse","arsehole","asshole"]');

alter table board.leagues  enable row level security;
alter table board.members  enable row level security;
alter table board.results  enable row level security;
alter table board.attempts enable row level security;
alter table board.settings enable row level security;

-- ---------- helpers (private) ----------
create or replace function board.cfg(k text) returns jsonb
language sql stable security definer set search_path = '' as
$$ select value from board.settings where key = k $$;

create or replace function board.lim(k text) returns int
language sql stable security definer set search_path = '' as
$$ select (board.cfg('limits') ->> k)::int $$;

create or replace function board.today() returns date
language sql stable set search_path = '' as
$$ select (now() at time zone 'Europe/London')::date $$;

-- Tidy and check a nickname or league name; returns the clean text or raises.
create or replace function board.clean(t text, minlen int, maxlen int, err text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare s text := regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g');
        low text; w text;
begin
  if char_length(s) < minlen or char_length(s) > maxlen
     or s !~ '^[[:alnum:]][[:alnum:] ''’._-]*$' then
    raise exception '%', err;
  end if;
  low := lower(regexp_replace(s, '[^[:alnum:]]', '', 'g'));
  for w in select jsonb_array_elements_text(board.cfg('block_any')) loop
    if position(w in low) > 0 then raise exception '%', err; end if;
  end loop;
  if exists (select 1 from regexp_split_to_table(lower(s), '[^[:alnum:]]+') tok
             where tok in (select jsonb_array_elements_text(board.cfg('block_word')))) then
    raise exception '%', err;
  end if;
  return s;
end $$;

-- The caller's network address, hashed with a private salt.
create or replace function board.ip_hash() returns text
language plpgsql stable security definer set search_path = '' as $$
declare h json := nullif(current_setting('request.headers', true), '')::json;
        ip text;
begin
  ip := coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip',
                 nullif(btrim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''), 'unknown');
  return encode(sha256(convert_to((board.cfg('ip_salt') #>> '{}') || ip, 'utf8')), 'hex');
end $$;

-- Per-address and site-wide limits for create/join; records the attempt.
create or replace function board.gate(act text) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := board.ip_hash(); n int;
begin
  if (board.cfg('paused') ->> act)::boolean then raise exception 'paused'; end if;
  select count(*) into n from board.attempts where ip_hash = me and action = act and at > now() - interval '1 hour';
  if n >= board.lim('ip_' || act || '_hour') then raise exception 'busy'; end if;
  select count(*) into n from board.attempts where action = act and at > now() - interval '1 day';
  if n >= board.lim('site_' || act || '_day') then raise exception 'busy'; end if;
  insert into board.attempts (ip_hash, action) values (me, act);
end $$;

create or replace function board.new_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; b bytea; i int;
begin
  loop
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    c := '';
    for i in 0..7 loop c := c || substr(a, (get_byte(b, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from board.leagues where code = c);
  end loop;
  return c;
end $$;

create or replace function board.league_of(p_code text) returns bigint
language sql stable security definer set search_path = '' as
$$ select id from board.leagues where code = upper(btrim(coalesce(p_code, ''))) $$;

create or replace function board.must_member(p_player uuid, p_code text) returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare lid bigint := board.league_of(p_code);
begin
  if lid is null then raise exception 'no_league'; end if;
  if not exists (select 1 from board.members where league_id = lid and player = p_player) then
    raise exception 'not_member';
  end if;
  return lid;
end $$;

create or replace function board.must_owner(p_player uuid, p_code text) returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare lid bigint := board.must_member(p_player, p_code);
begin
  if not exists (select 1 from board.leagues where id = lid and owner = p_player) then raise exception 'not_owner'; end if;
  return lid;
end $$;

-- ---------- public functions (called by dn-board.js) ----------

create or replace function public.board_mine(p_player uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', l.code, 'name', l.name, 'nickname', m.nickname, 'owner', l.owner = p_player,
           'members', (select count(*) from board.members x where x.league_id = l.id))
         order by m.joined_at), '[]'::jsonb)
  from board.members m join board.leagues l on l.id = m.league_id
  where m.player = p_player
$$;

create or replace function public.board_peek(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r record;
begin
  select l.name, (select count(*) from board.members m where m.league_id = l.id) as n
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
  if (select count(*) from board.leagues where owner = p_player) >= board.lim('owned_per_player') then raise exception 'too_many_owned'; end if;
  if (select count(*) from board.members where player = p_player) >= board.lim('joined_per_player') then raise exception 'too_many_joined'; end if;
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
        r record;
begin
  if p_player is null then raise exception 'bad_player'; end if;
  if lid is null then raise exception 'no_league'; end if;
  if exists (select 1 from board.members where league_id = lid and player = p_player) then raise exception 'already_member'; end if;
  if (select count(*) from board.members where player = p_player) >= board.lim('joined_per_player') then raise exception 'too_many_joined'; end if;
  if (select count(*) from board.members where league_id = lid) >= board.lim('league_size') then raise exception 'league_full'; end if;
  if (select count(*) from board.members) >= board.lim('max_members') then raise exception 'busy'; end if;
  if exists (select 1 from board.members where league_id = lid and lower(nickname) = lower(nk)) then raise exception 'nick_taken'; end if;
  perform board.gate('join');
  insert into board.members (league_id, player, nickname) values (lid, p_player, nk);
  select code, name into r from board.leagues where id = lid;
  return jsonb_build_object('code', r.code, 'name', r.name);
end $$;

-- A finished puzzle. Kept only for players in a league; the first result per puzzle stands.
create or replace function public.board_submit(p_player uuid, p_path text, p_outcome text,
                                               p_secs int, p_score int, p_mistakes int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t text; d date; n int;
begin
  if p_player is null or not exists (select 1 from board.members where player = p_player) then return false; end if;
  if p_path !~ '^reports/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.html$' then raise exception 'bad_result'; end if;
  t := case when p_path ~ 'crossword-mini' then 'mini' when p_path ~ 'logic-doku' then 'doku'
            when p_path ~ 'logic-path' then 'path' when p_path ~ 'logic-sweep' then 'sweep'
            when p_path ~ 'word-link' then 'link' when p_path ~ 'word-tangle' then 'tangle'
            when p_path ~ 'geo-borders' then 'borders' end;
  d := substr(p_path, 9, 10)::date;
  if t is null or d > board.today() or d < board.today() - 400 then raise exception 'bad_result'; end if;
  -- what each type can end as, and the result it must carry
  if t in ('tangle','borders') then
    if p_outcome <> 'scored' or p_score is null or p_score < 0
       or p_score > (case t when 'tangle' then 2000 else 5000 end) then raise exception 'bad_result'; end if;
  else
    if p_outcome not in ('solved','failed','revealed') then raise exception 'bad_result'; end if;
    if p_outcome = 'solved' and (p_secs is null or p_secs < 3) then raise exception 'bad_result'; end if;
    if t = 'link' and p_mistakes is not null and (p_mistakes < 0 or p_mistakes > 4) then raise exception 'bad_result'; end if;
  end if;
  if (select count(*) from board.results) >= board.lim('max_results') then return false; end if;
  insert into board.results (player, puzzle_path, ptype, puzzle_date, outcome, secs, score, mistakes)
  values (p_player, p_path, t, d, p_outcome, nullif(p_secs, 0),
          case when t in ('tangle','borders') then p_score end,
          case when t = 'link' then p_mistakes end)
  on conflict (player, puzzle_path) do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update board.leagues l set last_active = now()
    where l.id in (select league_id from board.members where player = p_player);
  end if;
  return n > 0;
end $$;

-- One puzzle, one day, one league: ranked finishers, then the rest, then who hasn't played.
create or replace function public.board_day(p_player uuid, p_code text, p_type text, p_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lid bigint := board.must_member(p_player, p_code); out jsonb;
begin
  if p_type not in ('mini','doku','path','sweep','link','tangle','borders') then raise exception 'bad_type'; end if;
  with mem as (
    select player, nickname, joined_at from board.members where league_id = lid
  ), r as (
    select x.* from board.results x join mem using (player) where x.ptype = p_type and x.puzzle_date <= p_date
  ), done as (     -- completed = solved, or a scored round
    select player, puzzle_date from r where outcome in ('solved','scored')
  ), runs as (
    select player, max(puzzle_date) as last_d, count(*) as n
    from (select player, puzzle_date,
                 puzzle_date - (row_number() over (partition by player order by puzzle_date))::int as grp
          from done) z
    group by player, grp
  ), streak as (
    select player, max(n) as n from runs where last_d >= p_date - 1 group by player
  ), day as (
    select m.nickname, m.player = p_player as me, x.outcome, x.secs, x.score, x.mistakes,
           coalesce(s.n, 0) as streak,
           x.outcome in ('solved','scored') as done
    from mem m join r x on x.player = m.player and x.puzzle_date = p_date
    left join streak s on s.player = m.player
  ), ranked as (
    select d.*, rank() over (order by
             case when p_type in ('tangle','borders') then -d.score end nulls last,
             case when p_type = 'link' then d.mistakes end nulls last,
             d.secs nulls last) as rk
    from day d where d.done
  )
  select jsonb_build_object(
    'ranked', coalesce((select jsonb_agg(jsonb_build_object('rank', rk, 'nick', nickname, 'me', me, 'secs', secs,
                         'score', score, 'mistakes', mistakes, 'streak', streak, 'outcome', outcome) order by rk, nickname) from ranked), '[]'),
    'unranked', coalesce((select jsonb_agg(jsonb_build_object('nick', nickname, 'me', me, 'outcome', outcome, 'secs', secs,
                         'mistakes', mistakes, 'streak', streak) order by nickname) from day where not done), '[]'),
    'not_yet', coalesce((select jsonb_agg(jsonb_build_object('nick', m.nickname, 'me', m.player = p_player) order by m.joined_at)
                         from mem m where not exists (select 1 from day d where d.nickname = m.nickname)), '[]'),
    'players', coalesce((select jsonb_agg(nickname order by joined_at) from mem), '[]'),
    'members', (select count(*) from mem),
    'first', coalesce((select min(puzzle_date) from board.results x join mem using (player) where x.ptype = p_type),
                      (select min(joined_at)::date from mem))
  ) into out;
  return out;
end $$;

-- ---------- owner actions ----------
create or replace function public.board_rename(p_player uuid, p_code text, p_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare lid bigint := board.must_owner(p_player, p_code);
begin
  update board.leagues set name = board.clean(p_name, 2, 30, 'bad_name') where id = lid;
  return true;
end $$;

create or replace function public.board_new_code(p_player uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid bigint := board.must_owner(p_player, p_code); c text := board.new_code();
begin
  update board.leagues set code = c where id = lid;
  return jsonb_build_object('code', c);
end $$;

-- ---------- admin (admin.html; signed-in admins only) ----------
create or replace function board.must_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
declare me text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if me = '' or not exists (select 1 from insights.admins a where lower(a.email) = me) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end $$;

create or replace function public.admin_board(p_action text default 'list', p_code text default null,
                                              p_value text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid bigint;
begin
  perform board.must_admin();
  if p_action = 'pause' then
    if p_code not in ('create','join') then raise exception 'bad_action'; end if;
    update board.settings set value = jsonb_set(value, array[p_code], to_jsonb(p_value::boolean)) where key = 'paused';
  elsif p_action = 'rename' then
    lid := board.league_of(p_code);
    if lid is null then raise exception 'no_league'; end if;
    update board.leagues set name = board.clean(p_value, 2, 30, 'bad_name') where id = lid;
  elsif p_action <> 'list' then
    raise exception 'bad_action';
  end if;
  return jsonb_build_object(
    'paused', board.cfg('paused'),
    'today', jsonb_build_object(
      'creates', (select count(*) from board.attempts where action = 'create' and at > now() - interval '1 day'),
      'joins',   (select count(*) from board.attempts where action = 'join'   and at > now() - interval '1 day'),
      'create_cap', board.lim('site_create_day'), 'join_cap', board.lim('site_join_day')),
    'leagues', coalesce((select jsonb_agg(jsonb_build_object(
        'code', l.code, 'name', l.name, 'created', l.created_at, 'active', l.last_active,
        'owner', (select nickname from board.members m where m.league_id = l.id and m.player = l.owner),
        'players', (select jsonb_agg(nickname order by joined_at) from board.members m where m.league_id = l.id))
        order by l.created_at desc) from board.leagues l), '[]'));
end $$;

-- ---------- history back-fill (once per browser, on first joining) ----------
create or replace function public.board_backfill(p_player uuid, p_aid uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; n int := 0; ok boolean;
begin
  if p_player is null or not exists (select 1 from board.members where player = p_player) then return 0; end if;
  -- 1. results this phone remembers (preferred: they are the player's first finish, with mistakes and scores)
  if p_rows is not null and jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) <= 1500 then
    for r in select value from jsonb_array_elements(p_rows) loop
      begin
        ok := public.board_submit(p_player, r ->> 'path', r ->> 'outcome', round((r ->> 'secs')::numeric)::int,
                                  round((r ->> 'score')::numeric)::int, round((r ->> 'mistakes')::numeric)::int);
        if ok then n := n + 1; end if;
      exception when others then null;
      end;
    end loop;
  end if;
  -- 2. this browser's earlier finishes in the visit records (first finish per puzzle). The tracker id is
  --    used only for this copy and is not stored.
  if p_aid is not null then
    for r in select e.props || jsonb_build_object('path', e.item_path)
             from (select distinct on (item_path) item_path, props from public.events
                   where anon_id = p_aid and event = 'puzzle_end' and item_path like 'reports/%'
                   order by item_path, occurred_at) e loop
      begin
        ok := public.board_submit(p_player, r ->> 'path', r ->> 'outcome', round((r ->> 'secs')::numeric)::int,
                                  round((r ->> 'score')::numeric)::int, round((r ->> 'mistakes')::numeric)::int);
        if ok then n := n + 1; end if;
      exception when others then null;
      end;
    end loop;
  end if;
  return n;
end $$;

-- ---------- grants: the browser calls the board_* functions ----------
grant execute on function public.board_mine(uuid), public.board_peek(text), public.board_create(uuid,text,text),
  public.board_join(uuid,text,text), public.board_submit(uuid,text,text,int,int,int),
  public.board_day(uuid,text,text,date), public.board_rename(uuid,text,text),
  public.board_new_code(uuid,text), public.board_backfill(uuid,uuid,jsonb), public.admin_board(text,text,text) to anon, authenticated;
