-- League records and honours (25 Oct 2026, Alec's go-ahead: "Everything", all four honour groups).
-- Applied to the live database as migration board_records.
--
-- Read-only: two new public functions and one private helper, all worked out from board.results and
-- board.members. No table, column, key or existing function changes.
--
-- Order of results is exactly board_day's (and so board_overall's): scored rounds (Tangle, Borders, Reckon)
-- by score then time; Link by mistakes then time; the rest by time. Only completed results count (solved, or a
-- scored round); a timed record needs a time.
--
--  board_records(p_player, p_code) — everything the Records tab, the record line, player cards and the crown use:
--    records   per puzzle type, the league's best result ever: who, when, the result. Ties: whoever set it first
--              (earliest puzzle day, then earliest submission) keeps it.
--    players   per current member: completed, daily wins, weekly titles, perfect days, clean sweeps,
--              longest and current streak (consecutive days with at least one puzzle finished),
--              and per type their best result and longest streak.
--    crown     last week's (Mon–Sun) champion(s).
--  Fairness rules (Claude's, 25 Oct 2026, reported to Alec):
--    - a daily win needs at least one other league player to have completed that puzzle; ties for first all win;
--    - a weekly title needs at least two players with results that week; points exactly as board_overall;
--      only finished weeks (Sunday before today) count;
--    - a perfect day = every puzzle published that day completed; "published" = every type anyone on the site
--      has a result for on that day (board.results across all leagues);
--    - a clean sweep = a perfect day where every one of those puzzles is a daily win (so each has a rival).
--  board_moment(p_player, p_path) — for the finish sheet: whether this player's result on that puzzle is a new
--    personal best (better than all their earlier-dated results of the type, and they had at least one), and
--    the leagues in which it is now the record.
--
-- Rollback: drop function public.board_records(uuid, text), public.board_moment(uuid, text), board.rec_rows(bigint, date).

create or replace function board.rec_rows(p_league bigint, p_to date)
returns table (player uuid, nickname text, puzzle_path text, ptype text, puzzle_date date, secs int, score int,
               mistakes smallint, submitted_at timestamptz, k1 int, k2 int, pos bigint, worse_rank bigint, rivals bigint)
language sql stable security definer set search_path = '' as $$
  with mem as (
    select m.player, m.nickname from board.members m where m.league_id = p_league and m.left_at is null
  ), r as (
    select x.player, mem.nickname, x.puzzle_path, x.ptype, x.puzzle_date, x.secs, x.score, x.mistakes, x.submitted_at,
           case when x.ptype in ('tangle','borders','reckon') then -coalesce(x.score, 0)
                when x.ptype = 'link' then coalesce(x.mistakes, 99) else 0 end as k1,
           coalesce(x.secs, 999999) as k2
    from board.results x join mem on mem.player = x.player
    where x.outcome in ('solved','scored') and x.puzzle_date <= p_to
  )
  select r.*,
         rank() over (partition by r.puzzle_path order by r.k1, r.k2) as pos,               -- 1 = best on that puzzle
         rank() over (partition by r.puzzle_path order by r.k1 desc, r.k2 desc) as worse_rank,  -- = board_overall's points
         count(*) over (partition by r.puzzle_path) as rivals
  from r
$$;
revoke all on function board.rec_rows(bigint, date) from public, anon, authenticated;

create or replace function public.board_records(p_player uuid, p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lid bigint := board.must_member(p_player, p_code);
        td date := board.today();
        lastwk date := td - (extract(isodow from td)::int - 1) - 7;
        out jsonb;
begin
  with rr as (
    select * from board.rec_rows(lid, td)
  ), timed as (
    select * from rr where ptype in ('tangle','borders','reckon') or secs is not null
  ), rec as (
    select distinct on (ptype) ptype, nickname, player, puzzle_date, secs, score, mistakes
    from timed order by ptype, k1, k2, puzzle_date, submitted_at
  ), best as (
    select distinct on (player, ptype) player, ptype, puzzle_date, secs, score, mistakes
    from timed order by player, ptype, k1, k2, puzzle_date, submitted_at
  ), mem as (
    select m.player, m.nickname, m.joined_at from board.members m where m.league_id = lid and m.left_at is null
  ), wins as (
    select player, puzzle_path, puzzle_date from rr where pos = 1 and rivals >= 2
  ), site as (       -- puzzles published each day: every type anyone on the site has a result for
    select x.puzzle_date, count(distinct x.ptype) as n from board.results x
    where x.puzzle_date between (select coalesce(min(puzzle_date), td) from rr) and td group by x.puzzle_date
  ), perfect as (
    select d.player, d.puzzle_date,
           bool_and(exists (select 1 from wins w where w.player = d.player and w.puzzle_path = d.puzzle_path)) as swept
    from rr d join site s on s.puzzle_date = d.puzzle_date
    group by d.player, d.puzzle_date, s.n having count(distinct d.ptype) = s.n
  ), wk as (
    select player, puzzle_date - (extract(isodow from puzzle_date)::int - 1) as wk,
           sum(worse_rank) as p, count(*) as c
    from rr group by 1, 2
  ), wkr as (
    select w.*, rank() over (partition by w.wk order by w.p desc, w.c desc) as rk,
           count(*) over (partition by w.wk) as n
    from wk w where w.wk + 6 < td
  ), titles as (
    select player, wk from wkr where rk = 1 and n >= 2
  ), days as (
    select distinct player, puzzle_date from rr
  ), runs as (
    select player, max(puzzle_date) as last_d, count(*) as n
    from (select player, puzzle_date, puzzle_date - (row_number() over (partition by player order by puzzle_date))::int as g
          from days) z group by player, g
  ), tdays as (
    select distinct player, ptype, puzzle_date from rr
  ), truns as (
    select player, ptype, max(n) as n
    from (select player, ptype, count(*) as n
          from (select player, ptype, puzzle_date,
                       puzzle_date - (row_number() over (partition by player, ptype order by puzzle_date))::int as g
                from tdays) z group by player, ptype, g) y
    group by player, ptype
  )
  select jsonb_build_object(
    'records', coalesce((select jsonb_object_agg(ptype, jsonb_build_object('nick', nickname, 'me', player = p_player,
                   'date', puzzle_date, 'secs', secs, 'score', score, 'mistakes', mistakes)) from rec), '{}'),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'nick', m.nickname, 'me', m.player = p_player,
        'completed', (select count(*) from rr where rr.player = m.player),
        'wins', (select count(*) from wins w where w.player = m.player),
        'titles', (select count(*) from titles t where t.player = m.player),
        'perfect', (select count(*) from perfect p where p.player = m.player),
        'sweeps', (select count(*) from perfect p where p.player = m.player and p.swept),
        'longest', coalesce((select max(n) from runs u where u.player = m.player), 0),
        'current', coalesce((select max(n) from runs u where u.player = m.player and u.last_d >= td - 1), 0),
        'bests', coalesce((select jsonb_object_agg(b.ptype, jsonb_build_object('date', b.puzzle_date, 'secs', b.secs,
                    'score', b.score, 'mistakes', b.mistakes)) from best b where b.player = m.player), '{}'),
        'streaks', coalesce((select jsonb_object_agg(s.ptype, s.n) from truns s where s.player = m.player), '{}')
      ) order by m.joined_at) from mem m), '[]'),
    'crown', coalesce((select jsonb_agg(m.nickname order by m.joined_at)
                       from titles t join mem m on m.player = t.player where t.wk = lastwk), '[]'),
    'crown_week', lastwk,
    'today', td
  ) into out;
  return out;
end $$;

create or replace function public.board_moment(p_player uuid, p_path text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me board.results; v1 int; v2 int; earlier int; better int; lg record; recs jsonb := '[]';
begin
  if p_player is null or p_path is null then return null; end if;
  select * into me from board.results x where x.player = p_player and x.puzzle_path = p_path;
  if not found or me.outcome not in ('solved','scored')
     or (me.ptype not in ('tangle','borders','reckon') and me.secs is null) then return null; end if;
  v1 := case when me.ptype in ('tangle','borders','reckon') then -coalesce(me.score, 0)
             when me.ptype = 'link' then coalesce(me.mistakes, 99) else 0 end;
  v2 := coalesce(me.secs, 999999);
  -- personal best: strictly better than every earlier-dated completed result of the type
  select count(*), count(*) filter (where (q.k1, q.k2) <= (v1, v2)) into earlier, better
  from (select case when x.ptype in ('tangle','borders','reckon') then -coalesce(x.score, 0)
                    when x.ptype = 'link' then coalesce(x.mistakes, 99) else 0 end as k1,
               coalesce(x.secs, 999999) as k2
        from board.results x
        where x.player = p_player and x.ptype = me.ptype and x.puzzle_date < me.puzzle_date
          and x.outcome in ('solved','scored')
          and (x.ptype in ('tangle','borders','reckon') or x.secs is not null)) q;
  -- leagues where this result is the record (ties: the earlier one keeps it)
  for lg in select l.id, l.name, l.code from board.members m join board.leagues l on l.id = m.league_id
            where m.player = p_player and m.left_at is null and l.closed_at is null order by m.joined_at loop
    if not exists (select 1 from board.rec_rows(lg.id, board.today()) o
                   where o.ptype = me.ptype and (o.ptype in ('tangle','borders','reckon') or o.secs is not null)
                     and ((o.k1, o.k2) < (v1, v2)
                          or ((o.k1, o.k2) = (v1, v2) and (o.puzzle_date, o.submitted_at) < (me.puzzle_date, me.submitted_at)))) then
      recs := recs || jsonb_build_object('code', lg.code, 'name', lg.name);
    end if;
  end loop;
  return jsonb_build_object('type', me.ptype, 'pb', earlier > 0 and better = 0, 'records', recs);
end $$;

grant execute on function public.board_records(uuid, text), public.board_moment(uuid, text) to anon, authenticated;
