# Testing The Daily Noodle

This is the developer guide for the automated suite introduced on 19 October 2026. Start here before changing a player, game, build tool or shared UI. The original [testing proposal](testing-proposal.md) and [history inventory](testing-history.csv) explain which shipped bugs motivated it. This guide describes what actually runs; the proposal is not a claim of complete test coverage.

## Quick start

Use Node 22 (the CI version) and npm. From the repository root:

```sh
npm ci --ignore-scripts
npm test
```

On Linux x64 this installs the exact browser, web fonts and test dependencies from `package-lock.json`. The browser is bundled in the pinned `@sparticuz/chromium` npm package; `tools/tests/chromium.js` extracts it and its fallback fonts to a versioned temporary cache. No separate browser download is required. On macOS, Windows or another architecture, install Playwright's Chromium with `npx playwright install chromium`; the behavioral tests can run there, but approve screenshot baselines on the canonical Linux environment. `PW_CHROMIUM=/absolute/path/to/chrome` overrides the binary for diagnosis or device capability checks. An override can change rendering, so do not use it to approve canonical images.

`npm test` runs every required group, writes logs and timing summaries to `test-results/`, and builds `_site/` in an isolated copy. Fast preflight checks and the build run first; then a bounded pool runs three balanced puzzle shards and two source-browser groups, dispatching focused checks as soon as a slot is free. At most five groups run together, with one Playwright worker per group. A failure stops new groups from starting, waits for already-running work and fails the release. It does not edit tracked reports, commit, push, publish, send notifications, or write to production Supabase. The only normal installation network requests are npm dependencies; browser tests serve local files and mock external services. `npm run test:live` is the separate read-only check of the real public site.

Do not update dependencies or snapshot images merely to get a green result. Find the behavior that changed, decide whether it is intended, and then update the relevant expectation and documentation.

## Commands and test layers

| Command | Purpose |
| --- | --- |
| `npm test` | Full required release suite: logic, database, content, transformed build, browser flows, visuals, puzzle regressions, offline worker and push contracts |
| `npm test -- --serial` | The same required checks without overlap, for timing comparison or diagnosing resource contention |
| `DN_TEST_JOBS=3 npm test` | The same checks with a smaller pool (1–5); useful on machines with less memory or CPU |
| `npm run test:unit` | Fast Node tests for puzzle gates, clue rules, symmetry, deterministic game logic, build-tool fixtures and worker notification handlers |
| `npm run test:backend` | Disposable PostgreSQL executing the actual checked-in board migrations; no server or credentials needed |
| `npm run test:content` | Registry integrity plus the current day and next seven days of puzzle data, re-read from disk |
| `node tools/tests/content.js --all` | Validate the entire forthcoming batch rather than the eight-day window |
| `npm run build:test` | Apply the publication transformations in a disposable copy, assemble `_site`, reject future files, missing card targets and developer tooling |
| `npm run test:browser` | Playwright game, layout, frontend, storage, accessibility, build and screenshot checks |
| `npm run test:puzzles` | Existing full seven-type player suite, extended by the recent Sweep Hint regressions |
| `npm run test:offline` | Real local service worker: installation, warming, network-first, offline/hung-network fallbacks and kill switch |
| `npm run test:visual` | Compare current screenshots with committed baselines; never creates missing baselines automatically |
| `npm run test:visual:update` | Explicitly create/update visual baselines for an intentional, reviewed design change |
| `npm run test:nightly` | Required suite plus all forthcoming content, larger seeded samples and the larger layout matrix |
| `npm run test:live` | Fetch public pages, shared assets, today's list and the seven puzzle URLs; no analytics events or score submissions |

For a focused Playwright run:

```sh
npm run test:browser -- --project=chromium games.spec.js -g 'DOTS-01'
npm run test:browser -- --project=chromium platform.spec.js
node tools/tests/run.js finish:link
node tools/tests/timing-dates.js
node tools/tests/offline-next.js
```

For Firefox/WebKit, install the appropriate Playwright browser first, set `DN_CROSS_BROWSER=1`, and select `--project=firefox` or `--project=webkit`. The scheduled matrix currently runs frontend/artifact/accessibility/storage contracts in these browsers. All game and seven-type solve flows currently gate on Chromium; the other engines are not presented as equivalent full-game coverage.

## Shared calendar and saved results

`dn-core.js` is the editable source for London calendar days, previous-day arithmetic, first-result storage and merging Borders/Tangle history. The seven engines, finish/start screens, front pages, board and worker use these rules. Feed/release tools require the same source directly. Storage keys, puzzle ids, record shapes and old result dates are preserved. The existing timer implementations remain covered by their regressions; this change does not replace them.

Browser entry points contain generated copies of this small helper so an engine has its dependencies synchronously, including offline, without a new script request. Do not edit a generated `dn-core:start` block. Edit `dn-core.js`, run `node tools/sync-core.js`, and commit the source and all changed copies. `node tools/sync-core.js --check` runs in pre-publication preparation and the unit suite; stale copies fail. New done-state patches also embed this source. Previously published self-contained archive players keep their existing writers, checked by `timing-dates.js`.

The five grid/tile engines read the latest storage before recording a completion and keep the first result. Borders/Tangle additionally merge stored completed ids before each persist, keep the highest best score, preserve completed Tangle day records and merge streaks without counting a day twice. Only the active Tangle round can replace its stored unfinished round; unrelated stale day records cannot roll back another tab's progress. Storage errors remain guarded so play can continue.

`core.test.js` covers midnight/DST, first-result retention, malformed/unavailable storage, streak merging, Tangle object references and bundle consistency. `save-history.spec.js` opens two real same-origin tabs before either finishes, completes different puzzles, verifies both results and reopens the first. These regressions fail against the old engines. This is a read/merge/write repair for stale tabs, not a cross-tab transaction or cloud sync: literally simultaneous writes and two tabs actively playing the same puzzle are not guaranteed conflict-free. Borders still has its existing single in-progress-round slot.

## Reckon, the eighth daily (20 Oct 2026)

Reckon (the daily of the Ballpark game, first day 26 October 2026) is covered at each layer: `unit/reckon.test.js` checks that the engine's load gate and `tools/build-reckon-batch.js`'s build gate agree on every Reckon in `reports/`, that both refuse tampered days (missing question, two from one pack, answer off its scale, hard opener, repeated fact, bad id, mismatched `dn:date`), that forthcoming days still match Ballpark's bank, and that scoring, gap wording, number formatting and the scale ladder are byte-for-byte Ballpark's; `content.js` gates the release window's Reckons with the build gate; the database test applies `toolchain/sql/2026-10-20-reckon-board.sql` (live board functions with Reckon) and its `RECKON-BOARD` case checks the 0–1,000 limit and ties broken by time; the puzzle suite's `finish:reckon`, `reckon:start-resume` and `reckon:streak-and-dark` play real rounds by touching the scale (with sensor jitter) on Reckon's own fake dates. Facts themselves are editorial: schemas cannot check them, so `toolchain/reckon-factcheck-ledger.json` records which have been checked against sources.

## Test scheduling and evidence

`tools/tests/plan.js` defines the complete required group inventory and its dependencies; `suite.js` runs it. Unit, database, content and build checks finish before parallel work starts. The first five groups are three puzzle shards plus source browser Games and Pages groups. Clock/date, worker, transformed-artifact and other short checks take the next available slot, so they no longer wait behind every source browser test. Optional nightly cross-browser work remains required when enabled. Every group is still awaited before publication. A failure stops dispatch and waits for active work before returning failure.

The default cap is five groups. `DN_TEST_JOBS=1` through `5` lowers it for constrained hosts; invalid values fail. The suite sets `DN_TEST_WORKERS=1` for each Playwright group, avoiding nested worker multiplication; standalone browser commands retain their usual default (two workers in CI, one locally). `plan.test.js` verifies the concurrency bound, immediate reuse of a free slot, complete inventory, lower caps, serial equivalence and failure propagation. The release workflow still tests and deploys the same immutable `_site` artifact.

`tools/tests/puzzle-plan.js` assigns whole named scenarios to three shards using committed estimates in `tools/tests/fixtures/puzzle-durations.json`. It places longer scenarios first into the currently lightest group, with deterministic tie-breaking. The current estimates give roughly 95 seconds per shard, replacing the previous 103/185-second split. Assignment never depends on live CI timings. Multi-day, multi-tab and multi-type scenarios stay intact; each scenario uses its own browser context. `puzzle-plan.test.js` verifies complete/disjoint/nonempty partitions, balance, determinism, new-case inclusion and CLI validation. New scenarios receive a ten-second estimate until measured; update the committed estimates from the case reports when balance changes. Do not auto-rewrite this fixture in CI.

Run a shard directly with `node tools/tests/run.js --shard=1/3`, `--shard=2/3` or `--shard=3/3`. Two-shard commands remain supported; totals from one to eight are accepted when all groups can be nonempty. `npm run test:puzzles` still runs the complete unsplit player suite; `npm test -- --serial` runs every release group sequentially. Suite shards write case names, assertion counts and durations to `test-results/puzzles-1-cases.json` through `puzzles-3-cases.json`. A standalone focused run without `DN_TEST_GROUP` writes `puzzles-cases.json`.

Source browser coverage is split by file: `games.spec.js` in `browser-games`, all other spec/test files in `browser-pages`. The inventory is read recursively from disk, including JavaScript/TypeScript spec/test naming, so a new file is included automatically. A unit check verifies the source spec inventory and group arguments. Playwright's own listed-test inventory was also compared between the unsplit run and both groups: all 50 source cases at that point were present exactly once (the mobile pass subsequently added eight). The five transformed-artifact checks remain a separate required group. Screenshot baselines and assertion behavior are unchanged. The required `puzzle-mobile.spec.js` adds eight phone/rotation/result checks; see [the mobile usability pass](mobile-usability.md) for screen sizes, changes and device-check limits.

`test-results/summary.json` retains each started group's exit code, duration and start offset. `test-results/timing.json` records elapsed wall time, summed group durations, mode, pool size and success. In parallel mode the sum exceeds wall time. Compare serial and parallel runs on the same machine without other test runs competing for resources; timings do not include GitHub queueing, dependency installation or Pages deployment.

The build group's short status is in `test-results/build.log`; transformation output is in `test-results/build-transform.log`. Separate files prevent the transformation subprocess and suite logger from overwriting each other's evidence.

The suite sets `DN_TEST_GROUP` to isolate Playwright evidence. Source reports are `test-results/browser-games/playwright.json` and `test-results/browser-pages/playwright.json`, with screenshots/traces in each group's `browser/` directory. Transformed checks use `test-results/artifact/`. HTML reports are `playwright-report/browser-games/index.html`, `playwright-report/browser-pages/index.html` and `playwright-report/artifact/index.html`. Optional cross-browser evidence has its own directory. A standalone focused browser command without this variable retains the old paths. Groups cannot erase each other's failure evidence.

## What happens before deployment

`.github/workflows/build-feed.yml` still responds to main pushes and the existing nightly publication slots. It now checks out current main, installs the locked dependencies and calls `tools/release.js`:

1. Apply `tools/prepare-site.js`: the same ordered tracker, share, engine-shell, metadata, News navigation/dark-mode and feed transformations previously listed directly in the workflow. Transformation failures and the finished-save check fail the build before publication.
2. Run the full required suite, including creation and browser smoke testing of the transformed `_site` folder. The assembler excludes forward-dated reports, package/config files, registry/published answer ledgers and developer folders. Every released feed card must target an included file.
3. Commit generated feed/report changes and push normally. If main advanced concurrently, rebase, rebuild and rerun the gates on the new revision. A rebase conflict fails visibly; there is no automatic content conflict resolution. If London midnight passes during the checks, rebuild and recheck for the new day.
4. Upload and deploy the exact `_site` artifact that passed. No source patching or artifact reassembly occurs after the checks. Run the read-only live smoke check afterwards.

A failed required step prevents Pages deployment. A failed post-deployment health check is visible in Actions and needs investigation; the workflow does not automatically revert another developer's changes. To roll back, revert the offending change (or restore the known-good source commit) and let the same gated workflow publish it. Test evidence records the released commit and London day in `test-results/release.json`.

`.github/workflows/tests.yml` runs the suite on pull requests without write permissions. At 03:17 UTC it also runs the full future-content/seed/layout checks, with separate Firefox and WebKit jobs. The manual workflow dispatch runs the required suite and browser matrix. Jobs upload logs, Playwright reports, failure screenshots and traces for 14 days, including on failure. There is no automatic retry-until-green and no automatic snapshot update in CI.

This does not configure branch protection in GitHub settings. If direct pushes are later replaced with a mandatory PR process, require the `Tests` check there as a separate repository setting. Main's publication workflow already gates deployment itself.

## Harnesses, clocks and test data

`tools/tests/harness.js` routes the site's URLs to local files, fakes the London clock, blocks service workers in puzzle tests and captures/mock-answers service calls. `newPhone()` uses a 390×844 touch viewport by default. `tap()` includes sensor-like pointer jitter so tests do not regress to idealized down/up pairs that missed old Sweep bugs. The real worker has its own localhost test because request routing alone cannot prove real offline caching.

The fake daily list is derived from the requesting page's fake London date, not the runner's real date. This matters: using a live daily list with yesterday's fixtures previously masked the stale Next-row bug. Fake clocks advance through the helper's `wait()` or explicit Playwright clock methods; real waits should be short and used only where browser/platform APIs require them. Keep DST/GMT/BST boundary cases and archived self-contained pages alongside shared-engine fixtures.

`tools/tests/read-puzzle.js` reads only the authored object literal using a quote/comment-aware scanner and a time-limited VM. It never executes the report's full browser scripts. Content validation calls the shipped gates and the independent broad Doku vocabulary checker. Path quality additions apply from 1 November 2026, and Sweep's new floor is checked for that applicable forthcoming range; historical published boards are not silently held to later rules.

Tests that need small malformed inputs create temporary directories. The build cutoff fixture intentionally changes both the instant and the host timezone: London midnight must win over the runner's local calendar. Build transformations are also checked for idempotence, intact apostrophes, and reversible News navigation. The suite's staging copy is removed after use; `_site` is the retained test artifact.

Do not use a separate toy game model to prove a property of the shipped game. Ancient Cities' deterministic replay test extracts the actual DOM-free rules engine, and Sea Glass's seeded placement test executes the actual placement function. Their fixtures deliberately include bad moves/ambiguous boards so a test cannot pass merely because its happy-path input is accepted.

## Games and their limits

`tools/tests/browser/games.json` is the explicit inventory of 11 active games. Adding a game requires a filename, a reachable primary action and a working existing `window.__dg` terminal-state hook. The browser suite clicks the real launch controls, arranges an end through the production finish path, checks one `game_end`, repeats the end to check its guard, and reloads saved progress without emitting a second result. Two Dots tests a real settings save as well, since a zero-score first loss does not need to create a best-score record.

The game tests mock `window.digi.track` at the boundary so events remain local and are easy to count. That is a game-event contract test, not proof that Supabase received an event. Tracker automation suppression is tested separately, and the existing puzzle suite captures the real tracker reader contract.

Additional targeted checks cover Two Dots' immediate-death tap and deliberate retry, Paper Planes' rebuilt postcard handler and stable daily setup, Sea Glass's three rare finds/paused redraw/end-card tap guard/Back navigation, Lantern's paused simulation, Ballpark's question schema and exact scoring bands, and Ancient Cities' seeded replay/atomic illegal moves. The layout suite checks that each game's primary action can be brought into view and hit on a small phone; nightly it expands to regular portrait and short landscape. The game that requires landscape is tested through its real turn-phone action in portrait.

This is broad foundation coverage, not an automated proof of every historical fix. Long-run game balance, all campaign branches, every upgrade combination, device fullscreen/wake-lock behavior and every historical game-specific edge case still need more targeted cases as those areas change. The original proposal's case table is the backlog of motivations, not a table of already implemented tests. Pocket Weather is removed and is not in the active inventory.

## Visual comparison and accessibility

`tools/tests/browser/visual.spec.js` has eight committed PNG baselines under `tools/tests/browser/baselines/chromium/`: shared start/results screens, Puzzles/Games fronts, Lantern at 320×568, and Campfire at 780×360, with light and dark representatives. Static comparisons use fixed content, London time, reduced motion and pinned fonts. A stable small feed fixture prevents routine daily article arrivals from invalidating a frontend layout baseline. Other browser tests still use actual repo content.

The canonical Linux browser package also supplies fixed fallback fonts; a tiny licensed DejaVu symbol subset in `tools/tests/fixtures/fonts/` supplies arrows, and a pinned Noto package supplies emoji; project web fonts come from pinned Fontsource packages and are served locally. Other games using their own external typefaces are not all included in the screenshot baseline set. Screenshot comparisons are not proof of physical-phone typography or playability. The existing painted-frame tests remain separate: freezing animation in a screenshot cannot catch a light-mode flash before dark mode applies.

For an intentional visual change:

1. Run `npm run test:visual` and inspect the failure's expected/actual/diff images and the page itself.
2. Verify font loading, fixture data, browser version and clock before deciding that a design changed.
3. Run `npm run test:visual:update` on canonical Linux only when the new appearance is intended.
4. Inspect every changed PNG, include the image diffs in review, and rerun `npm run test:visual` without update mode. Commit the baselines with the source change.

The comparison allows a small anti-aliasing tolerance (0.2% of pixels); increasing it requires evidence, not convenience. Updating snapshots in CI is prohibited. Front-page accessibility checks use axe's control/link/image labeling and ARIA rules; these are deliberately named checks, not a claim of full WCAG conformance. Keyboard/focus, large-text usability, canvas alternatives and contrast still need targeted checks and device review where not already covered.

## Database tests and source boundaries

`tools/tests/backend.test.js` starts an in-memory PGlite PostgreSQL instance, creates the hosting interfaces (`auth.jwt`, admin identities and historical event rows), then applies the real checked-in leaderboard migrations. It exercises owner/member/outsider/admin cases, first-result retention, repeat save/event backfills, leave/rejoin, removal/close and direct-table protection. A test grants SELECT in the disposable database to verify RLS itself still hides existing rows, rather than merely observing a schema permission error. It makes no network connection and needs no secrets.

This tests PostgreSQL behavior of repository SQL, not a complete hosted Supabase stack. In particular, the hide-only migration notes that some live function definitions were applied separately and are not fully reproduced in that file. The suite cannot certify parity with those unexported definitions. Before changing those functions, bring their actual deployed `pg_get_functiondef` definitions into a complete versioned migration and add cases for the intended behavior. Do not patch a test-only SQL copy to manufacture a pass. Auth service redirects, PostgREST, edge-function routing and actual push delivery require additional isolated service/device checks; none are silently simulated as a live success.

## Known debt and manual checks

`tools/tests/fixtures/registry-debt.json` lists the eight existing July/August registry findings by exact type, path, message and, where applicable, file hash. It records an owner, reason and review date. New findings, changed legacy files, expired review dates and obsolete exceptions fail. A new old-dated error is never automatically exempt. Repair the archive defect or explicitly review the exact remaining exception; do not regenerate a blanket baseline from current failures. The review deadline is 19 November 2026.

The review's stale-tab Borders/Tangle history overwrite is repaired by the shared save helper and covered by `SAVE-TABS` browser regressions. The limits of concurrent same-puzzle play and non-transactional browser storage are described above.

Before a significant shared-UI/game release, use an available Android phone and iPhone where possible:

- Open in browser and installed standalone mode; navigate between News, Puzzles, board and a game; check browser bars, safe areas, rotation, zoom/large text and short-screen controls.
- Play a representative puzzle with real touch jitter; finish, share, return with Back, reopen, go offline and reconnect. Confirm saved progress remains and yesterday is not labelled today after midnight/resume.
- Exercise fullscreen denial/exit, native share cancellation and wake-lock pause/resume. These are platform checks, not fully modeled by a headless browser.
- Notifications remain switched off. The worker handler, crypto and hidden test panel are automated. The panel test uses the pinned browser with fake granted permission and a fake subscription; actual permission prompts and notification display are device checks. On a supported full Chromium, `DN_NATIVE_PUSH=1 PW_CHROMIUM=/path/to/full/chrome npm run test:offline` runs the strict native observation. If it is not run, the worker log explicitly says so.
- Play for feel and fairness. Review question facts, clues and News claims against sources; schemas and solvers cannot replace editorial judgment.

## Diagnose a failure and add a regression

Start with `test-results/summary.json` and the failed group's log. Full-suite browser reports are in `playwright-report/<group>/index.html`; use `npx playwright show-report playwright-report/browser-games` (or `browser-pages` / `artifact`) or `npx playwright show-trace <trace.zip>`. Focused standalone commands still use `playwright-report/index.html`. Failure attachments include page errors, first-party missing assets and a screenshot. Node assertion messages identify the temporary fixture, puzzle filename or random seed. Reproduce with the smallest command above and the same browser, date, seed and fonts.

For a new bug fix, give the test an existing proposal case ID or a clear new one. Reproduce the old fault, assert the player's observable result, then implement the fix. Prefer a logic test for a scoring/save invariant, a temporary-file integration test for tooling, a real browser action for input/lifecycle behavior, and a reviewed screenshot only for appearance. Keep test hooks limited to arranging data/terminal conditions; assert behavior through the production code path. Every required test must run deterministically and fail on its own terms; a capability not exercised must be reported as such.

## Admin publishing health

The [publishing health panel](publishing-health.md) separates live URL availability, future inventory at the last published build, and complete GitHub release status. `admin-health.spec.js` covers signed-in healthy/failure/stale/rate-limit/timeout states and confirms that signed-out/rejected sessions do not start checks. `publishing-health.test.js` checks inventory and daily-list contracts; the build and live groups verify the deployed metadata. Future stock counts are not full-batch validation claims.
