-- =========================================================================
-- Delete my account, from inside the app (28 Nov 2026; app issue #188, Alec's go-ahead 27 Nov 2026).
-- Migration name: account_delete. NOT YET APPLIED: run it on a Supabase branch (or a restored copy) of live
-- data first, with toolchain/sql/checks/account-delete-preflight.sql before and after, then take a backup and
-- apply to live (see the site PR for the restore steps).
--
-- Additive: one new function, public.account_delete(), and its grants. No existing table, policy or
-- function changes. Rollback: drop function public.account_delete();
--
-- What it does, for the signed-in caller only (auth.uid(); it takes no argument, so it can never be pointed
-- at someone else):
--   * League results are kept, anonymised (Alec, 27 Nov 2026: points are players beaten, so removing rows
--     would change other players' history). The board player named in the caller's own synced league
--     document (sync.saves 'noodle-board-v1' .pid) gets a fresh random id on every row that carries it
--     (board.members, board.results, board.game_daily, board.leagues.owner), so nothing links those rows to
--     the person any more: no user id, no email, no board id anyone holds. On each league they still play in,
--     the nickname becomes "Former player" ("Former player 2", ... when the league already has one); a league
--     they had left keeps its "~" placeholder (renewed) and loses the old name (left_nick). The row stays on
--     the boards, so everyone's points, past tables and weekly titles are unchanged.
--   * A league they owned passes to its longest-standing current member who isn't a former player, as on
--     leaving (board.settle_owner); with nobody else, the fresh id keeps it and the league stays as it is.
--   * Their league PIN (board.pins) and web push subscriptions (board.push_subs) are deleted: they are keys
--     and addresses, not shared history.
--   * If another account's synced league document names the same board player, the league rows are left
--     alone (that player still has them on the other account) and the answer says board = 'shared'.
--   * Their synced copy (sync.saves), their signed-in Lab votes (insights.lab_votes voter 'u:<id>') and their
--     sign-in (auth.users, with Supabase's own sessions and identities) are deleted.
-- Running it twice is harmless: the second call finds nothing and answers ok.
-- Nothing here deletes from a shared table (board.leagues, board.members, board.results, board.game_daily),
-- so no ON DELETE CASCADE can reach one; tools/tests/unit/account-delete.test.js checks both.
-- =========================================================================

create or replace function public.account_delete() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u      uuid := sync.me();          -- the signed-in caller, or not_signed_in
  doc    jsonb;
  pid    uuid;
  newp   uuid;
  m      record;
  nk     text;
  i      int;
  lid    bigint;
  heir   uuid;
  result text := 'none';
  n_rows int := 0;
  n      int;
begin
  select s.doc into doc from sync.saves s where s.user_id = u and s.key = 'noodle-board-v1';
  if doc is not null and jsonb_typeof(doc) = 'object'
     and coalesce(doc->>'pid', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    pid := lower(doc->>'pid')::uuid;
  end if;

  if pid is not null and exists (select 1 from sync.saves o
                                  where o.key = 'noodle-board-v1' and o.user_id <> u and lower(o.doc->>'pid') = pid::text) then
    result := 'shared';
    pid := null;
  end if;

  if pid is not null and (exists (select 1 from board.members where player = pid)
                          or exists (select 1 from board.results where player = pid)
                          or exists (select 1 from board.game_daily where player = pid)
                          or exists (select 1 from board.leagues where owner = pid)
                          or exists (select 1 from board.pins where player = pid)
                          or exists (select 1 from board.push_subs where player = pid)) then
    result := 'anonymised';
    newp := gen_random_uuid();

    for m in select league_id, left_at from board.members where player = pid order by league_id for update loop
      if m.left_at is null then
        nk := 'Former player'; i := 1;
        while exists (select 1 from board.members x where x.league_id = m.league_id and lower(x.nickname) = lower(nk)) loop
          i := i + 1;
          if i > 99 then raise exception 'former_names_full'; end if;
          nk := 'Former player ' || i;
        end loop;
      else
        nk := '~' || substr(md5(gen_random_uuid()::text), 1, 12);
      end if;
      update board.members set player = newp, nickname = nk, left_nick = null, claim_until = null
       where league_id = m.league_id and player = pid;
    end loop;

    for lid in select id from board.leagues where owner = pid for update loop
      select x.player into heir from board.members x
       where x.league_id = lid and x.left_at is null and x.player <> newp
         and x.nickname !~ '^Former player( [0-9]+)?$'
       order by x.joined_at, x.player limit 1;
      update board.leagues set owner = coalesce(heir, newp) where id = lid;
    end loop;

    update board.results    set player = newp where player = pid;
    update board.game_daily set player = newp where player = pid;
    delete from board.pins      where player = pid;
    delete from board.push_subs where player = pid;
  end if;

  delete from sync.saves where user_id = u;
  get diagnostics n = row_count; n_rows := n_rows + n;
  delete from insights.lab_votes where voter = 'u:' || u::text;
  get diagnostics n = row_count; n_rows := n_rows + n;
  delete from auth.users where id = u;
  get diagnostics n = row_count; n_rows := n_rows + n;

  return jsonb_build_object('ok', true, 'board', result, 'deleted', n_rows);
end $$;

revoke all on function public.account_delete() from public, anon;
grant execute on function public.account_delete() to authenticated;
