# Link editing: rules and run book (19 Oct 2026)

How forthcoming Links are re-edited in place under the rules Alec agreed in the puzzle-quality
plan (Phase 2). Links 75–134 were done this way on 19 Oct 2026. The remaining ranges are run by a
scheduled task, one range per run, tracked in `toolchain/link-reedit-ledger.json`. This file is
self-contained: a fresh session with no memory of earlier chats can follow it.

## Standing rules (Alec's calls)
- Every puzzle is the same for every player on a given day. One steady difficulty (band "medium").
- Re-edit IN PLACE: same file, id, serial and date (`tools/link-reedit.js` enforces it). Never rename
  a file, id or localStorage key. Never touch a released Link: only dates at least 2 days ahead.
- Read `SITE.md` before any site-wide change and update it in the same commit. Only Link pages and the
  files named here change in these runs; never other puzzle types.
- Commits end with the two attribution lines the session's system prompt gives (Co-Authored-By and
  Claude-Session). Pull with `git pull --rebase origin main` before every push; other sessions and the
  nightly Pinwheel clean-up push too.
- Player data stays aggregated; never identify players.

## The editing rules
1. Rank 4 (hardest) is WORDPLAY (hidden word, homophone, anagram to a category, reversal,
   add/lose/change a letter, fill-in ___X or X___, "things you can ___" / "things with a ___") or a
   DECOY SET (a closed set whose members each have a strong home elsewhere: Wombles, Dad's Army).
   Never a synonym set ("Ways to ...", "Words for ...").
2. At most one synonym group, and only at rank 1 or 2; every member passes the same test sentence.
3. Check EVERY tile against EVERY label. Each group may have at most one extra candidate, and counting
   must force it out. No two tiles swappable between the same two groups. The traps ledger comes from
   this check: exactly 2–3 traps, `{"tile": "X", "not": "<group it tempts you into>"}`.
4. Labels literally true of all four, and they must not let a fifth tile in ("Animal collective nouns",
   not "Collective nouns", which lets COLLEGE in; "Kinds of dog", since TERRIER is not a breed; "In a
   Punch and Judy show", since SAUSAGES is a prop). Fill-ins use one form (all solid compounds or all
   two-word phrases). Never "Kinds of X" where X is a tile. A tile's text never appears in its own label.
5. Everyday UK adult knowledge; British spelling; no trade jargon, no US-only senses, family friendly;
   no group of names that leans on stereotypes; no real living people in decoy sets. Watch specialist
   second meanings that complete a rival group (Durham was a cattle breed; Greyhound was a ship).
6. The same rank-4 kind at most twice in any 7 consecutive days, across batch seams too (R6).
7. Every puzzle is solved cold before it ships (see the run book). A mistake not caused by a listed
   decoy sends it back.
Mechanical part of 1, 2, 4 and 6, plus freshness (no category name reused, no group sharing 3+ members
with any live group, blocked substrings such as GRAPES): `tools/link-reedit.js --check`.
Tiles: 1–10 characters, A–Z plus space, apostrophe or hyphen, UPPER CASE, 16 distinct.
The blocklist matches substrings in tiles and labels, so innocent words fail (FAGIN, SCREW, ESSEX, SUSSEX,
DICKENS, "something"): choose another word rather than arguing with the gate. Give each drafter its own
scratch subfolder. In batch-2 runs the gate also checks the live puzzles of the range itself only once
they're replaced, so drafters should also avoid names used in the forthcoming Links after the range.

## What the cold solvers taught us (Links 102–141)
- Avoid the "hard group by elimination": four rank-4 tiles that fit nothing else, with a visible link.
  Anagram rings (LISTEN/SILENT/ENLIST/TINSEL) and famous palindromes (KAYAK, RADAR) are spotted at a
  glance. A no-decoy rank 4 (shape C) is only allowed when the link is genuinely clever and hidden.
- Vary construction. The most common shape, "three groups of five candidates + one stray tile with no
  other home", is learned fast: at most a third of a batch. Prefer chains (a tile tempts from group 1
  into 2, another from 2 into 3) and rank-4 groups with one or two decoys.
  - Shape A: each rank-4 member tempts into one of the easy groups, plus one stray.
  - Shape B: decoys also run between the easier groups; rank 4 has one or two decoys.
  - Shape C: rank 4 has no decoys but a clever hidden link; the easier groups carry the cross-decoys.
- Spread the kinds: sound-alikes were overused in 102–134 (7 of 33). Keep homophones to about one in six.
- Space themes: the same category idea (rivers, fuels, fish, herbs/spices, parties, TV decoy sets...)
  at least 10 days apart; never repeat an idea from the last ~60 published Links.
- Dates worth a themed puzzle are in the ledger notes (serial s is dated 29 Oct 2026 + (s - 82) days).

## Run book: one scheduled run
1. Set up. If `/home/claude/dailynoodle` (or a clone of alecldarlow-cell/dailynoodle with push
   access) isn't there, attach the repo (add_repo with push access) and clone it. `git pull --rebase
   origin main`. Read `SITE.md`, this file and `toolchain/link-reedit-ledger.json`. Take the first plan
   entry whose status isn't "done" (start after `publishedTo` if it is "partial"). Check every serial in
   the range is dated at least 2 days ahead (`ls reports/*word-link-<serial>.html`); drop any that
   aren't from the range and say so in the report.
2. Inputs, in a scratch folder:
   - `node tools/link-existing.js --except <start>-<end> > existing.txt` (freshness list; the gate also checks live Links after the range, so leave them in);
   - recent themes: the group names of the last ~60 puzzles in `toolchain/link-batches/*.json`;
   - spares: `toolchain/link-batches/reserves.json` (flat puzzles that passed; usable after a fix).
   - Runs 4–5 (batch 2): list which live puzzles in the range break a rule (run link-reedit's rules on
     them: rank 4 "Ways to/Words for", more than one synonym group or one below rank 2, "Kinds of X" with
     X a tile). Rule-breakers are rewritten. A compliant puzzle may be kept only if it passes the
     editor's rule-3 check AND the cold solve, and R6 can place it; to keep one, build its batch item
     from the live page (`parse` in tools/build-link-batch.js) and add r4kind, shape, themes and traps.
3. Draft. Spawn three drafter subagents in parallel (prompt below), splitting the range into thirds,
   each asked for its share plus 2 spares, each steered to different subject areas so they don't
   clash (e.g. food/home/school/TV; sport/nature/music/places; books/films/history/science/work).
4. Gate each draft file: `node tools/link-reedit.js --batch <file> --check` must report errors: 0.
   (Spares need a free serial to gate against; give them any serial in the range for the check.)
5. Edit. Read every puzzle yourself: rule-3 check, labels, knowledge floor, taste, idea reuse. Fix or drop.
6. Cold solve. Write the tiles of each puzzle shuffled, one line each ("Puzzle N: T1, T2, ..."), in files
   of about 10, and spawn one strict solver subagent per file (prompt below), in parallel. A puzzle
   ships only if every solver finds its intended solution and reports no second solution, no unsettled
   extra candidate, no untrue label. Fix and re-solve, or drop. Drop "fair but flat" ones when spares allow.
7. Order. Add "themes" (short tags) to each passing puzzle, then
   `node tools/link-order.js --pool <files> --from <start> --count <n> --out final.json` (exit 0 = no
   R6 break, seams included). Re-gate final.json with `--check`.
8. Publish. `node tools/link-reedit.js --batch final.json` (writes in place; masked diff and re-parse
   are built in), then `node tools/og-tags.js`, then `npm ci --ignore-scripts` (once per clone: since
   19 Oct 2026 the smoke test uses the pinned Chromium in `node_modules` and fails with "Cannot find
   module '@sparticuz/chromium'" without it), then `node tools/tests/link-smoke.js <start> <end>` (all
   must pass), then `node tools/build-registry.js --check` and compare its ERROR lines with the run
   before your change (`git stash`): no new errors. Then `npm run test:content`, the release gate's
   puzzle check for today and the next seven days; if it fails, the site can't deploy, so don't push. Save final.json as `toolchain/link-batches/link-<start>-<end>.json`
   (3-digit serials), update the ledger (status done, or partial with publishedTo), one commit
   ("Link <start>-<end>: re-edited under the new editing rules", saying what was checked), pull
   --rebase, push.
9. If the run can't finish the whole range, publish the contiguous part that passed from the start of
   the range (partial), never a gap. Never push if the gate, the smoke test or the registry comparison
   fails. Unused good drafts go into reserves.json.
10. Report to Alec with SendUserMessage: range published, how many drafted, how many failed the cold
    solve and why (one line each), anything held back or needing his call. Plain words, short.

Run 6 (seam check): load every `toolchain/link-batches/link-*.json`, check R6 and theme spacing over
75–347 as one sequence; fix breaks only by swapping puzzles between forthcoming serials (gate,
publish, smoke and registry as above); then send Alec a final summary of the whole re-edit.

## Drafter prompt (fill in the serials, file and subject areas)
You are an expert puzzle editor drafting "Link" puzzles (like NYT Connections / the Only Connect wall)
for The Daily Noodle, a UK family puzzle site. Read toolchain/link-editing.md in the repo (rules,
lessons, shapes), the freshness list <existing.txt>, the recent-themes list <themes.txt>, and an
example of finished puzzles in toolchain/link-batches/link-102-134.json (exact JSON format). Your
serials: <A> to <B> plus 2 spares. Write a JSON array to <file>, each item {serial, band:"medium",
r4kind, shape, themes, groups:[{rank,name,members:[4]}x4], traps:[{tile,not}]}. Run the gate
(read-only): `node tools/link-reedit.js --batch <file> --check` from the repo, and fix every error.
Never edit the repo. Prefer rank-4 ideas from <subject areas>. Then do the rule-3 check honestly for
every puzzle (each tile against every label), and drop or fix any double fit or any hard group that is
four visible leftovers. Quality over quantity. Reply with one line per puzzle (serial, rank-4 idea,
kind, shape) and flag doubts.

## Cold-solver prompt
You are a strict, sharp test solver for "Link", a daily UK word puzzle like NYT Connections or the
Only Connect wall. Each puzzle has 16 tiles that split into exactly 4 hidden groups of 4; the hardest
is usually wordplay or a set whose members each look as if they belong elsewhere. The audience is UK
adults with everyday British knowledge. Read the puzzles in <file> (tiles shuffled). You have no
answers; do not look at any other file; no web search. For each puzzle report: your four groups with
short labels in submission order and confidence; every tile you were torn about; anything unfair (a
second complete solution, a group with two or more plausible extras that counting doesn't settle, an
untrue label, knowledge beyond everyday UK adults, US-only senses, poor taste); and a verdict: "fair
and good", "fair but flat", or "unfair" (why). Be a hard marker. Don't edit any files.
