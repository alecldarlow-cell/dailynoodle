# Tally — daily launch plan (web and app)

Written Tue 3 Nov 2026. Build runs **Thu 5 Nov 2026, 22:13 London** (scheduled task "Tally daily launch"). First daily: **Fri 6 Nov 2026**.

**Status line — the run reads this first. To stop the launch, change `GO` to `HOLD`, or pause the scheduled task.**

STATUS: GO

## Alec's decisions (3 Nov 2026)
- Tally becomes the ninth daily, on web and app, with puzzles to 31 Dec 2027.
- **Numbering:** Tally 1–10 keep their ids and dates and move from Lab to Puzzles (no Lab cards remain). Tally 11–12 fill 4–5 Nov. Fri 6 Nov is **Tally 13**. The batch ends at **Tally 433 on 31 Dec 2027**.
- **App:** native player, proved by replay; the web-view bridge is the fallback if the replay is not clean.
- **App release:** Alec gives his go-ahead now for this one production update: publish it automatically once every check below passes. (Applies to the Tally launch only.)
- **Leagues:** Tally joins the leagues and the overall table from Fri 6 Nov, ranked by fastest time ("All nine puzzles").
- Alec may refine Tally before Thursday. Build on whatever is on `main` at run time, and on any later note added to this doc. Rules and look are not to be changed by the run.

## Why these dates and numbers
- Lab ids and paths can't change (players' saves depend on them), so the daily continues from 10.
- `tools/build-registry.js` reports any missing calendar day as an ERROR, so 4–5 Nov need pages. Those two are past-dated when they ship, so they appear in the archive only.
- Dry run on 3 Nov: the current generator rules give 433 distinct boards (D4 fingerprint) with no failures, at most 18 extra seeds for any serial; 254 distinct solution grids, so grids do recur but boards don't. A change to the generator rules before Thursday would need this re-proved, and the seeded ten must still match.

## Run order
Database first (additive and harmless until a client uses it), then the website, then the app. Site work must merge in time to go live: pages dated 6 Nov are held back until their day, and the nightly build usually publishes them between 2 and 4:30 am London. Aim to merge the site PR by 01:30 London on Fri 6 Nov.

### 0. Pre-flight
- Read this doc, `SITE.md` (Tally, Publishing, Automated testing, Site code ships through a pull request, Changing something site-wide), `claude/17_typespec_tally.md`, and the app's `CLAUDE.md`, `docs/port-recipe.md` and the end of `docs/log.md`.
- Stop if STATUS is not GO. Stop if `main` of either repo is red before you start.
- Use Reckon's launch as the worked example: `git grep -il reckon` in both repos lists nearly every touchpoint. Don't rely on the lists below being complete.

### 1. Database (Supabase `digi`, project gnehttjheoyutrfsvslq)
New `toolchain/sql/2026-11-05-tally-board.sql` and `-tally-insights.sql`, applied as migrations `tally_board` and `tally_insights`.
- Write each function out from its **live definition** (`pg_get_functiondef`), not from older repo files, as the Reckon migration did.
- `board.results` `ptype` check: add `tally`. `board_submit`: map `logic-tally` to `tally` (outcome `solved`, ranked on `secs`). `board_day`: accept `tally`. Find anything else with a hard-coded type list: search every function and view for `reckon`, including `board_overall`, records and the insights regexes. Tally is timed, so it is **not** added to the `('tangle','borders','reckon')` scored lists.
- Insights: add `logic-tally` to the puzzle-type regex only, not the scored regex.
- Run `tools/tests/board-db.js` against a local database first, not live. Check rollback is written in the file header.
- `sync.saves` needs no schema change unless a server-side key list says otherwise: check.

### 2. Website (one PR; `npm test` regression must be green)
**Puzzles (content, in the same PR so tests see them together).** Finish `tools/build-tally-batch.js --through D`: continues from the newest page, D4 dedup across every page including the Lab ten, re-reads from disk and re-gates, no `dn:badge`, never touches a released day. Run `--through 2027-12-31`, then `--check`. Remove `dn:badge` from Tally 1–10 (the `--check` seed comparison must still pass; board data is untouched).
**Player.** Without the badge `LAB` turns off in `engines/tally.js`, so the share uses the short link and the sheet shows the "New Tally in …" countdown. Confirm both. Check `dn:read`, the tile and the card date line.
**Daily set wiring.** `front.js`/`tools/card-renderer.js` filter pill order (… Reckon, Tally), `tools/build-registry.js` (drop `lab: true`), `tools/prepare-site.js`, `tools/engine-shells.js`, `tools/seo-check.js`, `tools/search-meta.js`, `sw.js` (thumb list, and bump `VERSION` if caching changes), an `assets/tally-thumb.svg` in the house style (light and dark, as Reckon's).
**Share links.** `tools/short-links.js`: `dailynoodle.co.uk/tally` must open today's Tally, not Puzzles. `join.html` regex. Share line stays `🧮 Tally #13 — 1:42 · 🔥n`, then the link, like the other eight. Link previews on the short page.
**How to play.** `how-to-play.html` section `#tally` and pill, in daily-set order, with a worked example of `12×`, `9+`, `3÷`, `2−` and notes; `how-to-play.js`; the "eight daily puzzles" meta copy; the How to play link on the start card and the card.
**Stats and leagues.** `dn-board.js` (`TYPES` entry with emoji 🧮 and `tv: 'logic-tally'`, path regex, saved-results reader for `digi-tally-v1`, `PUZZLE_KEY`), `dn-sync.js` `SYNC_KEY`, `board.html` (`result()`, tabs, "All nine puzzles"). `dn-track.js` already records Tally.
**Admin.** `publishing-health.js`, `admin-health.js`, `admin.html` (`TYPE_NAMES`, `TYPE_ORDER`, `ptype` regex). The morning site check reads `TYPES` from `admin-health.js`, so it picks up the ninth type by itself; its prompt says "eight" in passing, which is harmless.
**Copy.** Replace "eight" site-wide where it means the daily set (`git grep -iE "eight|8 daily"`): home meta, `dn-board.js`, `board.html`, `engines/finish.js` comments, docs.
**Tests.** `tally:*` playthroughs in `tools/tests/run.js`/`play.js`, `harness.js` type map, `tests.yml` WebKit label, `puzzle-mobile`, `puzzle-guides`, `save-history`, `save-notice`, `not-found`, `admin-health` specs, `backend.test.js`, `tools/tests/fixtures/puzzle-durations.json`. New Puzzles page screenshots are an intended design change: update baselines by the `toolchain/testing.md` procedure, inspect every changed PNG. Never edit a test, baseline or `registry-debt.json` just to go green.
**Docs.** `SITE.md` in the same commit (Tally section becomes a launched type, Filter pills, How to play, Short links, Publishing health, Saved progress, Automated testing); `toolchain/site-sections-and-tracking.md`, `toolchain/publishing-health.md`, `toolchain/testing.md`. Update project doc `claude/17_typespec_tally.md`.

**Pre-push:** `npm ci --ignore-scripts`, `node tools/tests/content.js --all`, `node tools/build-registry.js --check`, `node tools/build-tally-batch.js --check`, focused browser specs.

### 3. App (`alecldarlow-cell/Daily-noodle-app`; site first, a separate PR, `check` green)
Follow `docs/port-recipe.md`.
- **`@noodle/core`:** `PUZZLE_TYPES`, `TYPE_LABEL`, `TYPE_OF_ID` (`TALLY`), record type (`t`, `s`, `d`), `share.ts`, `streaks`, `played`, `board.ts` (add 'Tally'; vendored `dn-board.js`, `dn-move.js`, `site.js` via `scripts/vendor-site.js`), saves.
- **Key lists:** `syncEngine.ts` `SYNC_KEY`, `webview/injection.ts` `BRIDGED_KEY`, `webview/navigation.ts` short link `/tally`, `leagues/hooks/boardText.ts` (timed, not scored), `shared/played/rounds.ts` (Tally saves an unfinished round in `cur`), app-links in `app.json` **only if they don't change the native fingerprint** (see below).
- **Native player:** `src/features/puzzles/tally/` — `model.ts` (validate as `tools/tally.js check`), `oracle.ts`, `finishing.ts`, `simulate.ts`, screen on shared start card and finish sheet, grid and keypad matching the current site look, including the yellow selected square and blue matching digits; notes, erase, undo; save `cur`; clock pause; jingle; tile images `reckon-*`-style in `assets/images/tiles`.
- **Replay:** `scripts/replay/tally.js`; Alec's rule: a new native type goes on after a sample (today + next 3 days), with the full replay overnight. Add to `replay-nightly.yml`, the PR sample, `.maestro/tally.yaml`, `.maestro/today.yaml`, `docs/play-listing.md`.
- **If the replay isn't clean by about 03:30 London:** leave `enabled = false` so Tally opens in the bridge, ship that, and report it.
- GIVEN/WHEN/THEN tests, 80% coverage, `npm run check`. Append to `docs/log.md`.

### 4. App release (automatic, Alec's go-ahead above)
All must hold, in order:
1. The site PR is merged and the Build feed run for it succeeded (`reports/…-logic-tally-….json` and `/tally` exist in the deploy).
2. App PR merged and every CI run on that commit green.
3. Runtime fingerprint of `main` still equals `store/runtime.json` `android`. If it differs, a native build is needed: do not publish; tell Alec.
4. Dispatch `update-production.yml` on `main` (REST: `POST /repos/alecldarlow-cell/Daily-noodle-app/actions/workflows/update-production.yml/dispatches`) and watch it pass.

A safety check has refused this dispatch in a Claude session before (log, 27 Oct). If it's refused, do not work around it: tell Alec one tap is needed ("Run workflow" on Update production).

### 5. Verify before reporting done
- Site: `puzzles-today.json` for 6 Nov has nine items once the day's build has run; `/tally` opens Tally 13; a test finish appears nowhere in live stats (the suites block this); Puzzles shows the Tally pill and 1–10 in the archive; Lab has no Tally cards; `how-to-play.html#tally` works; `node tools/build-registry.js` has no Tally errors and runway past 400 days.
- Database: a dry `board_day` read for `tally` returns without error (SELECT only).
- App: not provable on a phone from here. List what Alec should try on the Pixel.
- A fresh-context checker subagent reviews the site and app diffs against this plan before each merge.

### 6. Rollback
- Site: revert the PR. Pages dated in the future stay held back, and removing wiring doesn't touch saves. Never change a page once its day has passed.
- Database: the rollback statements in the migration headers (`tally` rows, if any, must be deleted first or kept out of the check).
- App: publish the previous commit with Update production; `enabled = false` falls back to the bridge.
- **Stop and report rather than force:** a red check, a repo that doesn't match this plan, anything needing money or a store account, or quality you aren't happy with. A later launch beats a broken daily. If the site can't merge by about 03:00 London on Fri 6 Nov, keep going to a clean merge; the page dates mean Tally 13 simply arrives with the next build.

## After launch (not Thursday)
- Morning site check picks up the ninth type.
- Week 1: watch median time (Lab: about 2:03, 12 solves on 3 Nov) and finish rate against the other dailies.
- Google Play listing text mentions the number of puzzles in `docs/play-listing.md`; Alec updates the live listing.
