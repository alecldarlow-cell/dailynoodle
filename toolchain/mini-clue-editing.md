# Mini clue editing: rules and run book (20 Oct 2026)

How forthcoming Minis get their clues edited in place under the rules Alec agreed in the
puzzle-quality plan (Phase 3). Minis 22 Oct 2026 to 19 Apr 2027 were done this way on 19 and
20 Oct 2026. The rest run as scheduled tasks, one 90-day range per run, tracked in
`toolchain/mini-clue-ledger.json`. This file is self-contained: a fresh session with no memory of
earlier chats can follow it.

## Standing rules (Alec's calls)
- One steady difficulty (band "medium"); every puzzle the same for every player on a given day.
- Edit IN PLACE: same file, id, serial, date and band. Clue text only (plus `dn:standfirst` and
  `og:description` when they quote a changed clue), except the few grids regenerated to clear
  answer-reuse breaches. Never rename a file, id or localStorage key. Never touch a Mini dated less
  than 2 days ahead. Never touch other puzzle types.
- Repeats: the same answer with the same clue text is not allowed within 365 days either side
  (Alec, 19 Oct 2026: keep a year). Further apart is fine. Different clues for the same answer may
  come back as often as the answer itself may.
- Efficient, light touch (Alec, 19 Oct 2026): change what fails, keep good clues, reuse a good
  BANK clue (same answer, last used more than a year away) rather than writing a new one.
- Redating (swapping puzzle contents between dates) was tried and doesn't help: keeping the answer
  reuse ladder, it cleared 1 of 746 repeat pairs. Don't redate.
- Commits end with the two attribution lines the session's system prompt gives. Pull with
  `git pull --rebase origin main` before every push; other sessions and the build bot push too.

## The clue rules
The editors' brief is `tools/mini-clue-brief.md` (substitution test, blanks for idiom-bound words,
no stray it/them, no padding, British, true, no leaks, no repeats, one or two misdirection or
double-definition clues per grid on fully crossed entries, breakfast test, house style, standfirst
format, changes-only output). The mechanical half is `tools/check-mini-clues.js`, which includes
`tools/check-clue-leaks.js`.

## What earlier batches taught us
- Editors in parallel sheets often pick the same clue for the same answer ("Get on in years" for
  AGE twice, "Dead heat" for TIE twice); `--merge` lists near-duplicates. Check every fix you choose
  against that entry's "don't reuse" list in pkg.json before using it.
- Blanks must not fit a second common answer ("Iron ___": ORE or AGE; "That's a big ___": ASK or ONE).
  The blind solve catches these: a new clue the solver missed with a confident wrong answer of the
  same length usually means a second answer fits.
- Close plain synonyms are fine for a medium Mini (crossings settle "Long for": WANT/PINE), but a
  clue where a second answer fits equally well (THEY/THEM for "Those people") is not.
- Facts the reviewers caught: a war is not a big battle; "Eight seconds on the bull" is one ride,
  not a rodeo; part-for-whole is the usual failure.
- Weak fill to keep out of regenerated grids: crosswordese (LEA, SERA, ANODE, ADOBE), US spellings
  (EDEMA, EON, AGING), slang (GONNA), archaic words (HATH, THINE), unit symbols (MOL), breakfast-test
  words (BALLS), weak comparatives (TRUER), near-twins in one grid (LOSE/LOST) or days apart
  (KEY then KEYS). Most are vetoed in tools/pinwheel-regen.js; use `--exclude` for the rest.
- Editors run 60 to 90 minutes each. A usage limit can stop subagents; resume them with a message
  once it lifts, or publish the contiguous finished part (see step 10).

## Run book: one scheduled run
1. Set up. If no clone of alecldarlow-cell/dailynoodle with push access is present, attach the repo
   (add_repo with push access) and clone it to /home/claude/dailynoodle. `git pull --rebase origin
   main`, then `npm ci --ignore-scripts` (the Chromium smoke test and browser tests need it). Read
   `SITE.md`, this file, `tools/mini-clue-brief.md` and `toolchain/mini-clue-ledger.json`. Take the
   first plan entry whose status isn't "done" (start the day after `publishedTo` if it is "partial").
   Every Mini in the range must be dated at least 2 days ahead; drop any that aren't and say so.
   Work in a scratch folder DIR outside the repo. Record `node tools/build-registry.js --check` output.
2. Grids. `node tools/pinwheel-regen.js --plan DIR/gap-plan.json --gaps --from A --until B --seed
   <run date as YYYYMMDD> --secs 120`. Read every fill (answers listed per grid) and re-run with
   `--exclude w,w` until none is weak (see the list above). If it says nothing to do, there are no
   grids to regenerate.
3. Prepare. `node tools/mini-clue-batch.js --prep A B DIR --plan DIR/gap-plan.json --sheets 3`
   (omit `--plan` if there are no grids).
4. Edit. Spawn three editor subagents in parallel (prompt below), one per sheet, each writing
   DIR/outN.json and validating it with `--validate`.
5. Review the editors' work yourself: `node tools/mini-clue-batch.js --show DIR DIR/outN.json` for
   each sheet. Check every change (substitution, facts, British idiom, fairness, a blank fitting two
   answers, near-copies of clues on other days). Fixes go in DIR/fixes.json, same format as the
   editors' output (`[{"file": ..., "clues": {...}, "standfirst": ...}]`); later files win in the merge.
6. Merge. `node tools/mini-clue-batch.js --merge DIR DIR/out1.json DIR/out2.json DIR/out3.json
   DIR/fixes.json` must report 0 problems; fix and re-merge until it does.
7. Fresh eyes. `--review-sheets DIR 2`, then two reviewer subagents in parallel (prompt below) on
   DIR/review1.txt and review2.txt, writing review1.out.json and review2.out.json. And `--blind DIR`,
   then two blind-solver subagents in parallel (prompt below; a smaller model such as sonnet is fine)
   on DIR/blind-old.txt and DIR/blind-new.txt, writing blind-old.ans.txt and blind-new.ans.txt; then
   `--blind-score DIR`. The new wording must not be harder: its clue-alone solve rate should be at
   least the old one's (batches so far: 93.5 to 94.5%, 87.4 to 93.0%). Put every reviewer failure
   you agree with, and any missed clue where a second answer fits, into fixes.json; re-merge to 0.
8. Apply. `git pull --rebase origin main`; `node tools/pinwheel-regen.js --apply
   DIR/regen-filled.json` (if there are grids); `node tools/mini-reclue.js --apply DIR/edits.json`.
   Both re-gate from disk and refuse (writing nothing) on any problem.
9. Verify, all must pass:
   - `node tools/check-clue-leaks.js --from A --to B` and `node tools/check-mini-clues.js --from A
     --to B`: 0. Also `node tools/check-mini-clues.js --from 2026-10-22 --to B`: still 0.
   - `node tools/build-registry.js --check`: the same ERROR lines as in step 1; the Mini ladder
     count may only fall. `node tools/pinwheel-regen.js --plan DIR/none.json --gaps --from A
     --until B` must find no breaches.
   - Masked diff: `git diff -U0 -- reports/` changes only clue lines, `grid:` lines of regenerated
     Minis, `dn:standfirst` and `og:description`.
   - `node tools/mini-clue-batch.js --smoke DIR` (every page opens with the new clues; three played
     to the end), `node tools/tests/run.js mini` (all pass), `npm run test:content` (the release
     gate: if it fails the site can't deploy, so don't push).
10. Commit and push. One commit for the regenerated grids (if any) and one for the clue edits plus
   the ledger entry (status "done", commits, a one-line stats string). `git pull --rebase origin
   main` before each push. If the run can't finish the whole range to standard, apply and push only
   the contiguous finished part from the start of the range (status "partial", `publishedTo`),
   never a gap. Never push if a gate fails; never force-push.
11. Report to Alec with SendUserMessage, plain and short: the dates done; clues changed (flagged,
   other, from the bank) and kept; grids regenerated; reviewer failures; blind solve old against
   new; five before/after examples; anything held back or needing his call; commit links.

If every plan entry is "done", change nothing and just say so. After run 6, also say the Mini part
of Phase 3 is finished.

## Editor prompt (fill in N and DIR)
You are the clue editor for a British daily mini crossword. Read the brief at
/home/claude/dailynoodle/tools/mini-clue-brief.md and follow it exactly (light touch: change what
must change, keep good clues, prefer good BANK clues, changes-only output). Your sheet is
DIR/sheetN.txt. Write your output to DIR/outN.json and validate with: cd /home/claude/dailynoodle &&
node tools/mini-clue-batch.js --validate DIR DIR/outN.json — until it reports 0 problems. Do not
modify anything under /home/claude/dailynoodle. Final message: output path, the validator's last
line, how many clues you changed, and at most five clues you were unsure about.

## Reviewer prompt (fill in the sheet and output paths)
You are a fresh editor checking clues for The Daily Noodle's Mini, a 5×5 daily crossword for a small
British audience. Every grid is a steady "medium": plain definitions with at most a slight angle,
plus one or two clues per grid that are a fair misdirection or double definition (marked
[misdirection/double definition]). Your sheet lists the clues that changed, each with its ANSWER,
plus changed standfirsts (a one-line teaser quoting two of the grid's clues). Check each against:
1. Substitution: the answer drops into a sentence in place of the clue (same part of speech,
number, tense, person); a blank (___) stands for exactly the answer. 2. Accuracy: every fact,
proverb, quotation, title and definition is true (a bout is a whole contest, not a round; Sir goes
before a first name). 3. British English: spelling, words and idiom; nothing US-only. 4. Fairness:
an everyday solver gets it with the crossings; a misdirection is literally true both ways; nothing
obscure; no second answer of the same length that fits equally well. 5. Breakfast test.
6. Standfirst: reads naturally and quotes its clues accurately. Be strict but don't nitpick style.
For each failure suggest a replacement (2 to 7 words, British, no double quotes, no full stop, not
containing the answer or any other answer in the grid). Write a JSON array of failures only,
`[{"file":"…","answer":"…","clue":"…","problem":"…","suggestion":"…"}]` (answer "standfirst" for a
standfirst), `[]` if all pass, to <output path>. Use only your sheet; open no other file. Final
message: path, how many you checked, how many failed.

## Blind-solver prompt (fill in the sheet and output paths)
Each line of <sheet> is one clue from a British mini crossword: `ID | letter count | clue`. You see
no grid and no crossing letters. For every line, write the single answer you would pencil in on
first reading, as an ordinary British solver doing a quick puzzle over breakfast: go with your first
good idea. Give a confidence: sure, likely or guess; if nothing comes, write ? and guess. Write a
plain-text file <output path>, one line per clue in the same order: `ID | ANSWER | confidence`
(capitals, exactly the letter count). Use only the sheet; open no other file and don't search.
Final message: the output path and the number of lines written.
