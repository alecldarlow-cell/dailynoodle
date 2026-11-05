-- Game Dailies on the leaderboard (5 Nov 2026), starting with Astro Drop. A game Daily has no daily puzzle file, so it
-- gets its own table and two functions, and the puzzle tables, points, records and the app are left exactly as they are.
-- Scores never count towards All puzzles. Rollback: drop the two functions, then drop table board.game_daily.

create table board.game_daily (
  player uuid not null,
  game text not null check (game in ('astro-drop')),
  day date not null,
  score integer not null check (score >= 0 and score <= 2000000),
  stars smallint not null default 0 check (stars between 0 and 3),
  top smallint not null default 0 check (top between 0 and 11),
  created_at timestamptz not null default now(),
  primary key (player, game, day)
);
alter table board.game_daily enable row level security;

create or replace function public.board_game_submit(p_player uuid, p_game text, p_score integer, p_stars integer, p_top integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare n int;
begin
  if p_player is null or not board.in_any(p_player) then return false; end if;
  if p_game not in ('astro-drop') or p_score is null or p_score < 0 or p_score > 2000000
     or coalesce(p_stars, 0) not between 0 and 3 or coalesce(p_top, 0) not between 0 and 11 then raise exception 'bad_result'; end if;
  if (select count(*) from board.game_daily) >= board.lim('max_results') then return false; end if;
  insert into board.game_daily (player, game, day, score, stars, top)
  values (p_player, p_game, board.today(), p_score, coalesce(p_stars, 0), coalesce(p_top, 0))
  on conflict (player, game, day) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $function$;

create or replace function public.board_game_day(p_player uuid, p_code text, p_game text, p_date date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare lid bigint := board.must_member(p_player, p_code); out jsonb;
begin
  if p_game not in ('astro-drop') then raise exception 'bad_type'; end if;
  with mem as (
    select player, nickname, joined_at from board.members where league_id = lid and left_at is null
  ), day as (
    select m.nickname, m.player = p_player as me, x.score, x.stars, x.top
    from mem m join board.game_daily x on x.player = m.player and x.game = p_game and x.day = p_date
  ), ranked as (
    select d.*, rank() over (order by d.score desc) as rk from day d
  )
  select jsonb_build_object(
    'ranked', coalesce((select jsonb_agg(jsonb_build_object('rank', rk, 'nick', nickname, 'me', me, 'score', score,
                         'stars', stars, 'top', top) order by rk, nickname) from ranked), '[]'),
    'not_yet', coalesce((select jsonb_agg(jsonb_build_object('nick', m.nickname, 'me', m.player = p_player) order by m.joined_at)
                         from mem m where not exists (select 1 from day d where d.nickname = m.nickname)), '[]'),
    'players', coalesce((select jsonb_agg(nickname order by joined_at) from mem), '[]'),
    'members', (select count(*) from mem),
    'first', coalesce((select min(x.day) from board.game_daily x join mem using (player) where x.game = p_game),
                      (select min(joined_at)::date from mem))
  ) into out;
  return out;
end $function$;

revoke all on function public.board_game_submit(uuid, text, integer, integer, integer), public.board_game_day(uuid, text, text, date) from public;
grant execute on function public.board_game_submit(uuid, text, integer, integer, integer), public.board_game_day(uuid, text, text, date) to anon, authenticated;
