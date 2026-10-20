# Developer handover — 20 October 2026

## Delivered

- Shared London-day and first-result rules in `dn-core.js`; stale-tab history merging for Borders/Tangle and the new Reckon engine’s existing shared save path.
- Required release gates with a five-process pool: three balanced puzzle shards and two source-browser groups, then focused checks as slots free up. Every required group must pass before publication.
- Small-phone/rotation improvements and regression checks for daily puzzle controls.
- Admin publishing health: live daily URLs, consecutive future stock counts and GitHub release status. Unknown, stale or unavailable checks do not show as healthy. Reckon is the eighth daily type.
- Quiet save-failure handling for the eight shared daily engines. One inline notice appears on the results screen after a failed completion, streak or supported ongoing-round save. It never overlays play, pauses timers, moves focus or announces repeatedly. Settings/cache writes do not trigger it. Manual retry retains pending data in memory and confirms success only after all failed keys recover.

## Where to work

- [Testing and release guide](testing.md): commands, coverage, release order, limitations and device checks.
- [Publishing health](publishing-health.md): admin panel and counts-only build metadata.
- Edit `dn-core.js`, then run `node tools/sync-core.js`; commit all generated copies. Do not hand-edit bundled `dn-core:start` sections.
- Save notice UI: `engines/finish.js` and `engines/finish.css`. Engine settings writes call `persist(false)` so they cannot create a progress warning.
- Save regressions: `tools/tests/unit/core.test.js`, `tools/tests/browser/save-notice.spec.js` and `save-history.spec.js`.

## Validation and limits

Run `npm test` for the complete required release suite. `.github/workflows/build-feed.yml` prepares, tests and deploys the exact passing `_site` artifact, followed by `npm run test:live`. Use GitHub’s full workflow duration for deployment timing; individual test-group timings exclude setup, publication and queuing.

Only Tangle/Borders/Reckon currently persist unfinished rounds. The other five daily engines persist results and streaks. Pending failed writes survive only in the open tab; closing/reloading loses unsaved memory. Standalone legacy archive players, the separate Games collection, Borders’ secondary atlas collection and cloud/league submissions are outside this notice’s scope. Browser storage still cannot guarantee conflict-free simultaneous writes. Backup/cross-device sync remains deferred. Physical Android/iPhone fullscreen, native sharing and installed-mode checks remain manual.
