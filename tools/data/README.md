# tools/data — game data the puzzle tools still use

On 22 Nov 2026 Noodle Games moved to its own site and repo (games.dailynoodle.co.uk,
`alecldarlow-cell/dailynoodle-games`). Two daily puzzles take data from a game:

- `ballpark.html` — Ballpark's fact bank (`const PACKS=` / `const TOUR=`), which the daily
  Reckon shares (`tools/build-reckon-batch.js`, `tools/apply-ballpark-fixes.js`).
- `yarn.html` — Yarn's level boards and word lists, which the daily Tangle must never
  repeat and keeps its word rule in step with (`tools/yarn-*.js`, `tools/tests/unit/yarn.test.js`).

These are copies of the game pages as they were at the split; they are not published.
The live games are in the games repo. When Ballpark's bank or Yarn's levels change there,
copy the page here too (and the reverse for a fix made here), so the two stay in step.
