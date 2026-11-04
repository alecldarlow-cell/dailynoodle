-- League points become players beaten (Alec, 4 Nov 2026). A lone finisher scored 1; now 0.
-- Each completed puzzle scores 1 for every league player who finished it with a worse result, and 1 for every
-- league player who played it and failed or revealed. Finishing alone, or last, scores 0. Ties beat nobody.
-- Points are worked out live, so past days, weekly totals and weekly titles (crowns) all follow: Alec's call.
-- Read-only: both functions keep their signatures, grants and order of results. No table or stored result changes.
-- board.rec_rows keeps the column name worse_rank (a return column can't be renamed in place); it now holds
-- players beaten, which board_records sums for weekly titles.
-- Rollback: rerun board.rec_rows from 2026-10-25-board-records.sql and board_overall from
-- 2026-10-24-board-pins-and-overall.sql.

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
revoke all on function board.rec_rows(bigint, date) from public, anon, authenticated;
