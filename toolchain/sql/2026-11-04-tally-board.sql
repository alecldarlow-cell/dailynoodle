-- Tally on the leaderboard (4 Nov 2026). Tally is the ninth daily from Thu 5 Nov 2026: a timed puzzle ranked by
-- fastest time, so it joins the type lists only, never the ('tangle','borders','reckon') scored lists.
-- board_submit and board_day are written out in full from their live definitions (pg_get_functiondef and md5(prosrc)
-- checked against the live database on 4 Nov 2026), with Tally added. Rounds on Lab days (before 5 Nov) return false,
-- so backfills from a player's saves can't put them on a board.
-- Grants are kept by CREATE OR REPLACE. Rollback: delete from board.results where ptype = 'tally'; then rerun
-- the three statements of 2026-10-20-reckon-board.sql.

alter table board.results drop constraint results_ptype_check;
alter table board.results add constraint results_ptype_check
  check (ptype in ('mini','doku','path','sweep','link','tangle','borders','reckon','tally'));

create or replace function public.board_submit(p_player uuid, p_path text, p_outcome text,
                                               p_secs integer, p_score integer, p_mistakes integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare t text; d date; n int;
begin
  if p_player is null or not board.in_any(p_player) then return false; end if;
  if p_path !~ '^reports/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.html$' then raise exception 'bad_result'; end if;
  t := case when p_path ~ 'crossword-mini' then 'mini' when p_path ~ 'logic-doku' then 'doku'
            when p_path ~ 'logic-path' then 'path' when p_path ~ 'logic-sweep' then 'sweep'
            when p_path ~ 'word-link' then 'link' when p_path ~ 'word-tangle' then 'tangle'
            when p_path ~ 'geo-borders' then 'borders' when p_path ~ 'quiz-reckon' then 'reckon'
            when p_path ~ 'logic-tally' then 'tally' end;
  d := substr(p_path, 9, 10)::date;
  if t is null or d > board.today() or d < board.today() - 400 then raise exception 'bad_result'; end if;
  if t = 'tally' and d < date '2026-11-05' then return false; end if;   -- Lab rounds stay out: Tally joins the leagues from its first daily
  if t in ('tangle','borders','reckon') then
    if p_outcome <> 'scored' or p_score is null or p_score < 0
       or p_score > (case t when 'tangle' then 2000 when 'reckon' then 1000 else 5000 end) then raise exception 'bad_result'; end if;
  else
    if p_outcome not in ('solved','failed','revealed') then raise exception 'bad_result'; end if;
    if p_outcome = 'solved' and (p_secs is null or p_secs < 3) then raise exception 'bad_result'; end if;
    if t = 'link' and p_mistakes is not null and (p_mistakes < 0 or p_mistakes > 4) then raise exception 'bad_result'; end if;
  end if;
  if (select count(*) from board.results) >= board.lim('max_results') then return false; end if;
  insert into board.results (player, puzzle_path, ptype, puzzle_date, outcome, secs, score, mistakes)
  values (p_player, p_path, t, d, p_outcome, nullif(p_secs, 0),
          case when t in ('tangle','borders','reckon') then p_score end,
          case when t = 'link' then p_mistakes end)
  on conflict (player, puzzle_path) do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update board.leagues l set last_active = now()
    where l.id in (select league_id from board.members where player = p_player and left_at is null);
  end if;
  return n > 0;
end $function$;

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
end $function$;
