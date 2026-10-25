-- ============================================================================
-- Optional sign-in sync (25 Oct 2026, Daily Noodle app plan WP7)
--
-- A signed-in player's puzzle saves, kept so they follow them between the app
-- and the website. The documents are stored exactly as the browser holds them
-- (`digi-<type>-v1`, `digi-<type>-streak`, `noodle-board-v1`); clients merge
-- with the site's own rules (first result kept, better streak wins) before
-- pushing, and run the personal-link import on pulling. Nothing about players
-- who don't sign in changes; the board schema is untouched.
--
-- Private schema `sync`, reached only through three functions, callable only
-- by a signed-in user, and only ever on that user's own rows:
--   sync_pull()            -> {key: doc} of everything stored for this user
--   sync_push(p_saves)     -> how many documents were stored; upsert by key
--   sync_forget()          -> deletes every row of this user (sign-out-everywhere
--                             and account deletion)
-- Limits: keys from a fixed pattern, at most 40 documents per push and 60 per
-- user, each at most 256 KB.
-- ============================================================================

create schema if not exists sync;
revoke all on schema sync from public, anon, authenticated;

create table if not exists sync.saves (
  user_id    uuid        not null,
  key        text        not null,
  doc        jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint sync_key_allowed check (
    key ~ '^digi-(mini|doku|sweep|path|link|tangle|borders|reckon)-(v1|streak)$' or key = 'noodle-board-v1'),
  constraint sync_doc_object check (jsonb_typeof(doc) = 'object'),
  constraint sync_doc_size check (octet_length(doc::text) <= 262144)
);
alter table sync.saves enable row level security;
revoke all on sync.saves from public, anon, authenticated;

-- The signed-in user, or an error. auth.uid() is Supabase's; it reads the JWT's sub.
create or replace function sync.me() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  return u;
end $$;
revoke all on function sync.me() from public, anon, authenticated;

create or replace function public.sync_pull() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(s.key, s.doc), '{}'::jsonb)
  from sync.saves s where s.user_id = sync.me()
$$;

create or replace function public.sync_push(p_saves jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare u uuid := sync.me(); k text; v jsonb; n integer := 0;
begin
  if p_saves is null or jsonb_typeof(p_saves) <> 'object' then raise exception 'bad_saves'; end if;
  if (select count(*) from jsonb_object_keys(p_saves)) > 40 then raise exception 'too_many'; end if;
  for k, v in select key, value from jsonb_each(p_saves) loop
    insert into sync.saves as s (user_id, key, doc, updated_at) values (u, k, v, now())
    on conflict (user_id, key) do update set doc = excluded.doc, updated_at = now()
      where s.doc is distinct from excluded.doc;
    n := n + 1;
  end loop;
  if (select count(*) from sync.saves where user_id = u) > 60 then raise exception 'too_many'; end if;
  return n;
end $$;

create or replace function public.sync_forget() returns boolean
language plpgsql security definer set search_path = '' as $$
declare u uuid := sync.me();
begin
  delete from sync.saves where user_id = u;
  return true;
end $$;

revoke all on function public.sync_pull(), public.sync_push(jsonb), public.sync_forget() from public, anon;
grant execute on function public.sync_pull(), public.sync_push(jsonb), public.sync_forget() to authenticated;
