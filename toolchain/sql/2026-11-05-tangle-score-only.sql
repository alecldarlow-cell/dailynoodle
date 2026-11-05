-- Tangle ranks on score alone (5 Nov 2026, Alec's call; review item 4).
-- Tangle's round is always 90 seconds, so time can't separate two players. A result copied in
-- by the backfill has no time at all (its save keeps none), and a blank ranked behind a
-- recorded time, so it lost a tie it should have drawn. Every ranking now gives Tangle one
-- tiebreak value. Results themselves don't change. Functions copied whole from their latest
-- migration; the only changes are the Tangle lines. Safe to re-run.

create or replace function public.board_day(p_player uuid, p_code text, p_type text, p_date date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare lid bigint := board.must_member(p_player, p_code); out jsonb;
begin
  if p_type not in ('mini','doku','path','sweep','link','tangle','borders','reckon','tally') then raise exception 'bad_type'; end if;
  with mem as (
    select player, nickname, joined_at from board.members where league_id = lid and left_at is null
  ), r as (
    select x.* from board.results x join mem using (player) where x.ptype = p_type and x.puzzle_date <= p_date
  ), done as (
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
             case when p_type in ('tangle','borders','reckon') then -d.score end nulls last,
             case when p_type = 'link' then d.mistakes end nulls last,
             case when p_type <> 'tangle' then d.secs end nulls last) as rk
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
end $function$;

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
           case when x.ptype = 'tangle' then 0 else coalesce(x.secs, 999999) end as k2
    from board.results x join mem using (player)
    where x.puzzle_date between wk and wk + 6 and x.puzzle_date <= p_date
  ), pts as (      -- players beaten: worse completed results, plus players who failed or revealed
    select d.player, d.puzzle_date, d.done,
           case when d.done then (select count(*) from r o where o.puzzle_path = d.puzzle_path
                                   and (not o.done or (o.k1, o.k2) > (d.k1, d.k2))) else 0 end as p
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
  v2 := case when me.ptype = 'tangle' then 0 else coalesce(me.secs, 999999) end;
  -- personal best: strictly better than every earlier-dated completed result of the type
  select count(*), count(*) filter (where (q.k1, q.k2) <= (v1, v2)) into earlier, better
  from (select case when x.ptype in ('tangle','borders','reckon') then -coalesce(x.score, 0)
                    when x.ptype = 'link' then coalesce(x.mistakes, 99) else 0 end as k1,
               case when x.ptype = 'tangle' then 0 else coalesce(x.secs, 999999) end as k2
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
           case when x.ptype = 'tangle' then 0 else coalesce(x.secs, 999999) end as k2
    from board.results x join mem on mem.player = x.player
    where x.outcome in ('solved','scored') and x.puzzle_date <= p_to
  ), lost as (       -- league players who played the puzzle and failed or revealed: every finisher beat them
    select x.puzzle_path, count(*) as n
    from board.results x join mem on mem.player = x.player
    where x.outcome not in ('solved','scored') and x.puzzle_date <= p_to
    group by x.puzzle_path
  )
  select r.*,
         rank() over (partition by r.puzzle_path order by r.k1, r.k2) as pos,               -- 1 = best on that puzzle
         rank() over (partition by r.puzzle_path order by r.k1 desc, r.k2 desc) - 1
           + coalesce((select l.n from lost l where l.puzzle_path = r.puzzle_path), 0) as worse_rank,  -- players beaten: board_overall's points
         count(*) over (partition by r.puzzle_path) as rivals
  from r
$$;
