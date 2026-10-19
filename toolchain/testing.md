# Testing The Daily Noodle

This is the developer guide for the automated suite introduced on 19 October 2026. Start here before changing a player, game, build tool or shared UI. The original [testing proposal](testing-proposal.md) and [history inventory](testing-history.csv) explain which shipped bugs motivated it. This guide describes what actually runs; the proposal is not a claim of complete test coverage.

## Quick start

Use Node 22 (the CI version) and npm. From the repository root:

```sh
npm ci --ignore-scripts
npm test
```

On Linux x64 this installs the exact browser, web fonts and test dependencies from `package-lock.json`. The browser is bundled in the pinned `@sparticuz/chromium` npm package; `tools/tests/chromium.js` extracts it and its fallback fonts to a versioned temporary cache. No separate browser download is required. On macOS, Windows or another architecture, install Playwright's Chromium with `npx playwright install chromium`; the behavioral tests can run there, but approve screenshot baselines on the canonical Linux environment. `PW_CHROMIUM=/absolute/path/to/chrome` overrides the binary for diagnosis or device capability checks. An override can change rendering, so do not use it to approve canonical images.

`npm test` runs every required group in order, stops at the first failed group, writes logs and a timing summary to `test-results/`, and builds `_site/` in an isolated copy. It does not edit the tracked reports, commit, push, publish, send notifications, or write to production Supabase. The only normal installation network requests are npm dependencies; browser tests serve local files and mock external services. `npm run test:live` is the separate read-only check of the real public site.

Do not update dependencies or snapshot images merely to get a green result. Find the behavior that changed, decide whether it is intended, and then update the relevant expectation and documentation.

## Commands and test layers

| Command | Purpose |
| --- | --- |
| `npm test` | Full required release suite: logic, database, content, transformed build, browser flows, visuals, puzzle regressions, offline worker and push contracts |
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

The review's unresolved multi-tab Borders/Tangle overwrite remains an explicit known issue; this suite does not claim to fix it or hide a failing regression as a pass. Add a two-tab regression when implementing its eventual repair.

Before a significant shared-UI/game release, use an available Android phone and iPhone where possible:

- Open in browser and installed standalone mode; navigate between News, Puzzles, board and a game; check browser bars, safe areas, rotation, zoom/large text and short-screen controls.
- Play a representative puzzle with real touch jitter; finish, share, return with Back, reopen, go offline and reconnect. Confirm saved progress remains and yesterday is not labelled today after midnight/resume.
- Exercise fullscreen denial/exit, native share cancellation and wake-lock pause/resume. These are platform checks, not fully modeled by a headless browser.
- Notifications remain switched off. The worker handler, crypto and hidden test panel are automated. The panel test uses the pinned browser with fake granted permission and a fake subscription; actual permission prompts and notification display are device checks. On a supported full Chromium, `DN_NATIVE_PUSH=1 PW_CHROMIUM=/path/to/full/chrome npm run test:offline` runs the strict native observation. If it is not run, the worker log explicitly says so.
- Play for feel and fairness. Review question facts, clues and News claims against sources; schemas and solvers cannot replace editorial judgment.

## Diagnose a failure and add a regression

Start with `test-results/summary.json` and the failed group's log. Browser reports are in `playwright-report/index.html`; use `npx playwright show-report` or `npx playwright show-trace <trace.zip>`. Failure attachments include page errors, first-party missing assets and a screenshot. Node assertion messages identify the temporary fixture, puzzle filename or random seed. Reproduce with the smallest command above and the same browser, date, seed and fonts.

For a new bug fix, give the test an existing proposal case ID or a clear new one. Reproduce the old fault, assert the player's observable result, then implement the fix. Prefer a logic test for a scoring/save invariant, a temporary-file integration test for tooling, a real browser action for input/lifecycle behavior, and a reviewed screenshot only for appearance. Keep test hooks limited to arranging data/terminal conditions; assert behavior through the production code path. Every required test must run deterministically and fail on its own terms; a capability not exercised must be reported as such.
