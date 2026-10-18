# Digi site: sections, reader tracking and admin (set up 26 Sep 2026)

The site is now The Daily Noodle at dailynoodle.co.uk, repo alecldarlow-cell/dailynoodle (renamed from digi-news, 18 Oct 2026). Start with `SITE.md` at the repo root for names, addresses, publishing and saved-progress rules; this file holds the detail. Where this conflicts with older notes on the front page or dn:kind, this is current.

## Three sections
- `index.html` = Digi News (kind `report`, blue #1C46C2), `puzzles.html` = Digi Puzzles (kind `puzzle`, green #0E7A4B), `games.html` = Digi Games (kind `game`, purple #6A2BC9).
- Shared layout lives in `front.css` and `front.js` at the repo root; each page only sets `data-section` on `<html>`.
- A file's section comes from its `dn:kind` meta, not its folder. Everything (reports, puzzles, games) still lives in `reports/`.
- `dn:kind` now accepts `report | puzzle | game`. Game topics: `Arcade`, `Strategy`, `Quiz`.

## Reader tracking
- `dn-track.js` (repo root) records anonymous events into the `digi` Supabase project (London, eu-west-2) via one write-only function `public.log_events`.
- The nightly/push workflow `build-feed.yml` runs `tools/inject-tracker.js` first, which adds `<script src="../dn-track.js" defer></script>` before `</body>` of every file in `reports/` that lacks it. Do NOT add it by hand; do NOT remove it from live files.
- Rubric exception agreed by Alec: the tracker line is the one permitted non-self-contained dependency. It is optional at runtime. If dn-lint flags it on a rebuilt shipped piece, strip the line before the gates; the workflow re-adds it on upload.
- Automatic: page_view, page_exit (time on page, depth), card_click, read_depth, exhibit_view (figure.exhibit), source_click, puzzle_start / puzzle_end (all puzzle types, detected from the #winModal / #modal result box and #winTitle).
- Tracker v3 (15 Oct 2026, MI audit): puzzle_start only counts a tap inside the play area (`PLAY_AREA` in dn-track.js: #grid, #board, #bank, #kb, clues, #playCard, #resumeBtn, #opts, #qmap) or typing. **A new puzzle type must put its play area in one of those ids, or add its id to `PLAY_AREA`.** A finish with no recorded start logs a flagged `late:true` start, so gaps show up in the data.
- puzzle_end carries the result where a type has one: Tangle `score` + `words` (from #rBig, #rWords), Borders `got` / `of` + `score` (from #rBig "7 of 10", #rPts), Link `mistakes` (#pips .pip.gone). Tangle and Borders end as outcome `scored`, never solved/failed. **Keep those ids if the result boxes are redesigned.**
- page_view carries `via` (from `?via=` on a link) and `app` (in-app browser name) because apps send no referrer.
- page_view carries `inst` (1 = opened from a home-screen icon) from 18 Oct 2026. News pieces record `share_click` / `share_done` from the Share buttons (`tools/news-share.js`).
- Reporting logic for these is in `toolchain/sql/2026-10-15-mi-audit-fixes.sql` (applied to Supabase as migration `mi_audit_fixes`).
- Games must call the tracker themselves: `window.digi&&digi.track('game_start',{game:'<slug>',...})` when a round starts and `digi.track('game_end',{game:'<slug>',win:true|false,...})` when it ends. Lighthouse Keeper already does.
- Link previews: `tools/og-tags.js` keeps a marked `<!-- og:start … og:end -->` block of Open Graph tags in every file's `<head>`, built from its dn:* metas. Like the tracker line, it is added by the workflow: don't add it by hand, and if dn-lint flags it on a rebuilt shipped piece, strip it before the gates.
- Opt-out: footer "Don't record my visits" switch and `privacy.html`; GPC / Do Not Track respected.

## Admin
- `admin.html` (linked in front-page footers): email magic-link sign-in; data only for emails in `insights.admins` (the two admin addresses; not listed here because this repo is public).
- "This device: counted / excluded" at the top of the admin page adds or removes the browser you're on from `insights.excluded_readers` (`public.admin_exclude_device`). Use it on every phone, tablet or laptop you test with.
- Figures come from `public.admin_dashboard(p_from, p_to)`; reporting views live in the private `insights` schema. `insights.excluded_readers` removes Alec's own test browsers from all figures.
- Retention: raw events 13 months, then rolled into `public.daily_stats` by the nightly `digi-roll-up-old-events` cron job.
- Plan doc: "Digi reader data plan" (Claude Docs).

## Share text (digi-share-v2, 15 Oct 2026)
- Every puzzle shares one line, "emoji Name #N — result", no link and no "made with Digi Puzzles": ✏️ Mini, 🔢 Doku, 〰️ Path, 💣/💥 Sweep, 🔗 Link (one square per guess, ❌ for a miss), 🌍 Borders, 🧶 Tangle (unchanged). A streak of 2+ adds "· 🔥n".
- `tools/share-v2.js` patches both share paths (result box and saved-result revisit) and runs in the build workflow, so a puzzle uploaded from an older template is patched on push. Update the templates in the Digi Puzzles project to match when convenient.

## Shared engines (15 Oct 2026)
- Every puzzle type has one player in `engines/`: `mini`, `doku`, `sweep`, `link`, `path`, `tangle`, `borders` (.js + .css). Each puzzle in `reports/` is a thin page (metas, markup, `window.DN_PUZZLE={…}`) that loads its type's engine. reports/ went from ~227 MB to ~44 MB.
- URLs, puzzle ids and localStorage keys are unchanged, so players keep streaks and finished puzzles. Tested per type: progress saved on the old self-contained page reopens finished on the engine page; pages render pixel-identical; tracking and share text unchanged; rebuilt feed.json identical.
- To change every puzzle of a type, edit `engines/<type>.js` once. Keep element ids (dn-track.js) and localStorage keys (saved progress) stable.
- `tools/engine-shells.js <type>` converts a puzzle only if its player is byte-identical to the engine, and runs for every type in the build workflow, so puzzles uploaded from the old self-contained templates are converted on push. Left self-contained on purpose (older players, all in the past): 3 July Minis, 3 July Dokus, 30 July Sweeps, Tangles 0001–0009, Borders 0001–0002.
- When a template changes in a Digi Puzzles project, port the change into `engines/<type>.js` too; otherwise new uploads from the new template stay self-contained (they still work, they just don't share the engine).
- `add-done-state.js --check` and `share-v2.js --check` look for their markers in the engine for thin pages.

## Trimmed controls (15 Oct 2026)
- Hidden in each `engines/<type>.css` (the engine binds to the ids, so the elements stay in the markup): Mini — Reveal all, Reset, on-screen-keys toggle, difficulty picker, New grid; Doku — Reveal all, Reset, Play again; Sweep — Reveal all, Restart, Flag check toggle (stays on); Path — Reset. The build-note `<footer>` is hidden on every type.
- Mini phone layout (18 Oct 2026, Alec): in app mode the clue bar sits directly above the keyboard (the engine moves `.cluebox` out of `<main>` to just before `#kb`; ids unchanged), and Check word / Check all / Reveal word / fullscreen sit in one row under the meta line, above the grid. Once solved, Check and Reveal hide (`body.win`), leaving an ordinary-sized Share result. 18px extra bottom padding keeps the keys clear of the gesture bar in fullscreen. Desktop layout unchanged.
