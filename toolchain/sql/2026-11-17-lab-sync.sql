-- Lab saves and votes in sign-in sync (17 Nov 2026, Alec): the Lab trials' saves and streaks
-- (digi-tilt|redact|tumbler-v1 / -streak) and the Lab votes document (noodle-lab-votes-v1, the
-- answers shown on this device; the counted vote stays in insights.lab_votes) join the keys
-- sync.saves accepts, so a signed-in player's Lab status matches on the website and the app.
-- Up to 26 keys per account, inside the 40-per-push and 60-per-user limits.
-- Rollback: delete from sync.saves where key ~ '^digi-(tilt|redact|tumbler)-' or key = 'noodle-lab-votes-v1';
--           then re-run 2026-11-04-tally-sync.sql.

alter table sync.saves drop constraint sync_key_allowed;
alter table sync.saves add constraint sync_key_allowed check (
  key ~ '^digi-(mini|doku|sweep|path|link|tangle|borders|reckon|tally|tilt|redact|tumbler)-(v1|streak)$'
  or key in ('noodle-board-v1', 'noodle-lab-votes-v1'));
