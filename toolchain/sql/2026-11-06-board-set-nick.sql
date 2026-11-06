-- Change your nickname in a league (6 Nov 2026, Alec's call). Same name rules as joining; results
-- are keyed by player, so they stay. Rollback: drop function public.board_set_nick(uuid, text, text).
create or replace function public.board_set_nick(p_player uuid, p_code text, p_nick text) returns text
language plpgsql security definer set search_path = '' as $fn$
declare lid bigint := board.must_member(p_player, p_code);
        nk text := board.clean(p_nick, 2, 16, 'bad_nick');
begin
  if exists (select 1 from board.members where league_id = lid and left_at is null
             and player <> p_player and lower(nickname) = lower(nk)) then
    raise exception 'nick_taken';
  end if;
  update board.members set nickname = nk where league_id = lid and player = p_player and left_at is null;
  return nk;
end $fn$;
revoke all on function public.board_set_nick(uuid, text, text) from public;
grant execute on function public.board_set_nick(uuid, text, text) to anon, authenticated;
