-- ============================================================================
-- Delete my account (29 Oct 2026, plan item G2; Alec approved account deletion 28 Oct)
--
-- Lets a signed-in player delete their own sign-in account from the website's
-- account card or the app's Account screen, instead of emailing a request:
--   sync_delete_account()  -> true; deletes the caller's synced copy (sync.saves)
--                             and then the caller's own auth user. Nothing else.
-- Supabase removes the user's identities, sessions and refresh tokens with it
-- (their foreign keys to auth.users cascade). League data is NOT linked to the
-- sign-in account (it hangs off the board's own random player id), so a player's
-- leagues and results there stay, as privacy.html says.
--
-- Callable only by a signed-in user (authenticated), revoked from public and anon,
-- and only ever on auth.uid()'s own rows. Calling it again (or with a token whose
-- user is already gone) deletes nothing and still answers true.
-- Needs toolchain/sql/2026-10-25-sync.sql (schema sync, sync.me()).
-- ============================================================================

create or replace function public.sync_delete_account() returns boolean
language plpgsql security definer set search_path = '' as $$
declare u uuid := sync.me();   -- raises not_signed_in when auth.uid() is null
begin
  delete from sync.saves where user_id = u;
  delete from auth.users where id = u;
  return true;
end $$;

revoke all on function public.sync_delete_account() from public, anon;
grant execute on function public.sync_delete_account() to authenticated;
