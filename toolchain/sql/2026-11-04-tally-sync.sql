-- Tally saves in sign-in sync (4 Nov 2026): digi-tally-v1 and digi-tally-streak join the keys sync.saves accepts.
-- Rollback: delete from sync.saves where key like 'digi-tally-%'; then restore the list without tally.

alter table sync.saves drop constraint sync_key_allowed;
alter table sync.saves add constraint sync_key_allowed check (
  key ~ '^digi-(mini|doku|sweep|path|link|tangle|borders|reckon|tally)-(v1|streak)$' or key = 'noodle-board-v1');
