-- ============================================================================
-- Sign-in sync with revisions (29 Oct 2026, plan items H2 / R3)
--
-- Adds a revision to every synced document so a client can push "this is my
-- merge of revision N" and be told, instead of silently overwriting, when
-- another phone or browser wrote in between. Additive only: the table, its
-- rows, its limits and the three existing functions (sync_pull, sync_push,
-- sync_forget, which the Play builds 0.2.0/0.3.0 call) keep working exactly
-- as before. The one change to sync_push is that each write it makes now
-- gives the row a new revision, so the new path below notices it.
--
--   sync_pull_rev()          -> {key: {doc, rev}} of everything stored for this user
--   sync_push_rev(p_saves)   p_saves = {key: {doc, rev}}, rev = the revision the
--                            doc was merged from (0 or null: a key not stored yet).
--                            Compare-and-swap, all or nothing: if any key's stored
--                            revision differs, NOTHING is stored and the answer is
--                            {"ok": false, "conflicts": {key: {doc, rev}}} (doc null,
--                            rev 0 for a key no longer stored); otherwise every doc
--                            is stored and the answer is {"ok": true, "revs": {key: rev}}.
--                            A doc identical to the stored one keeps its revision.
--
-- Revisions come from one sequence (sync.rev_seq, starting at 2; rows that
-- exist before this migration get 1). They only ever grow, and a key that is
-- deleted (sync_forget) and stored again never gets an old revision back, so a
-- client holding a stale revision can't pass the check by coincidence.
--
-- Same limits and key allow-list as sync_push: keys digi-<8 types>-v1,
-- digi-<type>-streak and noodle-board-v1 (the table's check constraints), 256 KB
-- a doc, at most 40 documents per push and 60 per user. Callable only by a
-- signed-in user (authenticated), only ever on that user's own rows.
-- Re-runnable: add column if not exists, create ... if not exists, create or replace.
-- ============================================================================

create sequence if not exists sync.rev_seq as bigint start with 2;
revoke all on sequence sync.rev_seq from public, anon, authenticated;

alter table sync.saves add column if not exists rev bigint not null default 1;
alter table sync.saves alter column rev set default nextval('sync.rev_seq');

-- The old push, unchanged in signature, answer and limits; each write now takes a new revision.
create or replace function public.sync_push(p_saves jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare u uuid := sync.me(); k text; v jsonb; n integer := 0;
begin
  if p_saves is null or jsonb_typeof(p_saves) <> 'object' then raise exception 'bad_saves'; end if;
  if (select count(*) from jsonb_object_keys(p_saves)) > 40 then raise exception 'too_many'; end if;
  for k, v in select key, value from jsonb_each(p_saves) loop
    insert into sync.saves as s (user_id, key, doc, updated_at, rev) values (u, k, v, now(), nextval('sync.rev_seq'))
    on conflict (user_id, key) do update set doc = excluded.doc, updated_at = now(), rev = nextval('sync.rev_seq')
      where s.doc is distinct from excluded.doc;
    n := n + 1;
  end loop;
  if (select count(*) from sync.saves where user_id = u) > 60 then raise exception 'too_many'; end if;
  return n;
end $$;

create or replace function public.sync_pull_rev() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(s.key, jsonb_build_object('doc', s.doc, 'rev', s.rev)), '{}'::jsonb)
  from sync.saves s where s.user_id = sync.me()
$$;

create or replace function public.sync_push_rev(p_saves jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := sync.me(); k text; v jsonb; want bigint; cur record;
  bad jsonb := '{}'::jsonb; revs jsonb := '{}'::jsonb; raced boolean := false;
begin
  if p_saves is null or jsonb_typeof(p_saves) <> 'object' then raise exception 'bad_saves'; end if;
  if (select count(*) from jsonb_object_keys(p_saves)) > 40 then raise exception 'too_many'; end if;
  for k, v in select key, value from jsonb_each(p_saves) loop
    if jsonb_typeof(v) <> 'object' or not (v ? 'doc') or jsonb_typeof(v->'doc') = 'null'
       or coalesce(jsonb_typeof(v->'rev'), 'null') not in ('number', 'null') then
      raise exception 'bad_saves';
    end if;
  end loop;

  -- 1. Check every key against what is stored, locking the stored rows until the end.
  for k, v in select key, value from jsonb_each(p_saves) loop
    want := coalesce((v->>'rev')::numeric, 0)::bigint;
    select s.doc, s.rev into cur from sync.saves s where s.user_id = u and s.key = k for update;
    if not found then
      if want <> 0 then bad := bad || jsonb_build_object(k, jsonb_build_object('doc', null, 'rev', 0)); end if;
    elsif cur.rev <> want then
      bad := bad || jsonb_build_object(k, jsonb_build_object('doc', cur.doc, 'rev', cur.rev));
    end if;
  end loop;
  if bad <> '{}'::jsonb then return jsonb_build_object('ok', false, 'conflicts', bad); end if;

  -- 2. Store them all. A new key stored by another push since step 1 undoes this block (savepoint).
  begin
    for k, v in select key, value from jsonb_each(p_saves) loop
      want := coalesce((v->>'rev')::numeric, 0)::bigint;
      if want = 0 then
        insert into sync.saves (user_id, key, doc, updated_at, rev) values (u, k, v->'doc', now(), nextval('sync.rev_seq'))
        returning rev into want;
      else
        update sync.saves s set doc = v->'doc', updated_at = now(), rev = nextval('sync.rev_seq')
          where s.user_id = u and s.key = k and s.doc is distinct from v->'doc'
          returning s.rev into want;
        if not found then select s.rev into want from sync.saves s where s.user_id = u and s.key = k; end if;
      end if;
      revs := revs || jsonb_build_object(k, want);
    end loop;
  exception when unique_violation then
    raced := true;
  end;
  if raced then
    for k, v in select key, value from jsonb_each(p_saves) loop
      want := coalesce((v->>'rev')::numeric, 0)::bigint;
      select s.doc, s.rev into cur from sync.saves s where s.user_id = u and s.key = k;
      if found and cur.rev <> want then
        bad := bad || jsonb_build_object(k, jsonb_build_object('doc', cur.doc, 'rev', cur.rev));
      end if;
    end loop;
    return jsonb_build_object('ok', false, 'conflicts', bad);
  end if;

  if (select count(*) from sync.saves where user_id = u) > 60 then raise exception 'too_many'; end if;
  return jsonb_build_object('ok', true, 'revs', revs);
end $$;

revoke all on function public.sync_pull_rev(), public.sync_push_rev(jsonb) from public, anon;
grant execute on function public.sync_pull_rev(), public.sync_push_rev(jsonb) to authenticated;
-- create or replace keeps sync_push's grants; restated so this file stands on its own.
revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;
