# The Daily Noodle: site facts

Read this before any change that touches the whole site (names, addresses,
sections, publishing, saved progress, tracking). It is the one place these
facts live; the Claude Projects and scheduled tasks point here instead of
repeating them. Detail on sections, tracking, admin, share text and engines is
in `toolchain/site-sections-and-tracking.md`.

## Identity
- Name: **The Daily Noodle** (formerly Digi News / Digi Puzzles / Digi Games, renamed 18 Oct 2026).
- Address: **https://dailynoodle.co.uk** (GitHub Pages, deployed by the build workflow, HTTPS enforced; `www.` redirects to it). Domain registered and DNS-hosted at Cloudflare, records "DNS only".
- Repo: **alecldarlow-cell/dailynoodle** (this repo; renamed from `digi-news`). Publish to `main`.
- `alecldarlow-cell/digi-news` is now a separate, tiny **forwarding repo** for old links. Never build in it or publish to it. It must stay public with Pages on.
- Audience: about ten friends and family who compare puzzle results in a WhatsApp group. A hobby site, not a public publication.

## Sections
| Page | Desk | `dn:kind` | Wordmark |
| --- | --- | --- | --- |
| `index.html` | News | `report` | Noodle**News** |
| `puzzles.html` | Puzzles | `puzzle` | Noodle**Puzzles** |
| `games.html` | Games | `game` | Noodle**Games** |
| `lab.html` | Lab (unfinished items of any kind) | any, with `dn:badge` "In development" | Noodle**Lab** |

- Every piece, puzzle and game is one HTML file in `reports/`; its desk comes from `dn:kind`, not the folder.
- Front pages share `front.css` and `front.js`; each page only sets `data-section` on `<html>`.
- Brand status: front pages, privacy, admin and the app manifest say The Daily Noodle. News pieces say **Noodle News** (masthead Noodle**News**, title "<headline> — Noodle News", byline "Noodle News data desk", production note and footer), rebranded 18 Oct 2026 across all published pieces and in the toolchain (`digi-news-house-template-v3-3-3.html`, `dn-build.py`, rubric, checklist, style guide), so new pieces are built with it. Toolchain file names and the internal `DN — Digi News visualization library` marker (which `dn-build.py` and `dn-lint.js` look for) deliberately keep the old name.
- Puzzle pages: the **Mini** says Noodle from 18 Oct 2026 (masthead Noodle**Puzzles** with the DP tile, as on the front page; set name and home-screen name "The Noodle Mini" / "Noodle Mini"), patched as a literal find/replace across all 764 Mini pages, so the newest Mini page — the template for new ones — carries it. The other types' pages and templates still say Digi ("The Digi Doku", "← Digi Puzzles"); rebranding them is still parked. Either way it must keep puzzle ids, filenames, localStorage keys and the `Digi Puzzles` comment markers the tools look for (e.g. `/* ---- Digi Puzzles: Mini player` in `tools/pinwheel-regen.js`) unchanged.

## Publishing
- Push a file to `reports/` on `main`. `.github/workflows/build-feed.yml` then injects the tracker, patches share text, moves puzzles onto the shared engines, writes link-preview (Open Graph) tags from each file's `dn:*` metas (`tools/og-tags.js`), adds the Share button to every news piece (`tools/news-share.js`) and rebuilds `feed.json`. If a scheduled task pushes at the same time, the workflow rebases and retries its push.
- **The site is deployed by that workflow, not served straight from the repo** (Settings → Pages → Source: GitHub Actions). Its last steps build `_site/` with `tools/build-site.js`: site files plus `reports/` minus every forward-dated file the feed holds back. `tools/`, `toolchain/`, `.github/` and notes are never published. So a change reaches the live site only when the workflow succeeds; check Actions if something doesn't appear.
- The same workflow runs nightly around London midnight, so forward-dated files appear on their own day without a push.
- Forward-dated puzzles (answers included) are still readable in the repo itself while it is public.
- Scheduled tasks (claude.ai): **Daily news** (00:52 UTC; two news pieces, built to rubric v5: at least one pegged to an event or decision) and **Pinwheel clean-up** (02:37 London; replaces banned Mini/Doku layouts). Both clone `alecldarlow-cell/dailynoodle` and push to `main`.

## Saved progress (do not break)
- Streaks, finished puzzles and game saves live in each player's browser `localStorage` for the site's address. Keys include `noodle-board-v1` (leaderboard leagues), `digi-mini-v1`, `digi-mini-streak`, `digi-doku-v1`, `digi-sweep-v1`, `digi-sweep-streak`, `digi-path-v1`, `digi-link-v1`, `digi-link-streak`, `digi-tangle-v1`, `digi-borders-v1`, `digi-borderline-v1`. Never rename a key, a puzzle id or a puzzle's file path.
- Browser storage belongs to one address. Any future address change needs a handoff like the 18 Oct one: the forwarding repo packs the old address's storage into the link's `#dnmove=` fragment and `dn-track.js` merges it in on arrival without overwriting newer progress.

## Tracking and admin
- `dn-track.js` (loaded by every page) records anonymous events into the `digi` Supabase project (London). The database accepts the sections news, puzzles, games and site only; any other page (Lab, or a new one) is recorded as `site`. It also holds the domain-move import, which runs before the tracker and is independent of tracking opt-out.
- News pieces have two Share buttons (under the dateline, above the footer), added by `tools/news-share.js` in the build workflow, not by the toolchain. They open the phone's share sheet (or copy, on desktop) with the headline, first hero stat and the link tagged `?via=share`, and record `share_click` / `share_done` (props `method` native|copy, `pos` top|end).
- `page_view` carries `inst` (1 when opened from a home-screen icon, else 0) from 18 Oct 2026; earlier views have no `inst`.
- **Leaderboards** (18 Oct 2026): `board.html` shows private leagues' daily leaderboard per puzzle (pills by puzzle, day bar, share and invite, league settings). `dn-board.js` holds the league logic; `dn-track.js` loads it on every puzzle page, where it submits results for players in a league (the `dn:puzzle_end` browser event, fired whether or not visits are recorded) and adds "See today's board" to the result box. The Board pill leads the Puzzles topic row (`front.js`). Players are identified by a separate random id in `localStorage` key `noodle-board-v1`, not the tracker's id. Data lives in the private `board` schema of the `digi` project, reached only through `public.board_*` functions; limits, word filter and the nightly `board-tidy` job are in `toolchain/sql/2026-10-18-leaderboards.sql`. The admin page's Leagues section lists leagues, can rename them and pause sign-ups. **No deletes yet (by choice, 18 Oct 2026):** nobody can leave a league, remove a player or close a league from the site, and there is no tidy-up job; removals are done by hand in Supabase. Board events: `board_open` {from}, `board_create`, `board_join` {via}, `board_share`, `board_invite`; front pages also record `chip_click` {topic}.
- `admin.html`: magic-link sign-in. Supabase Auth allows `https://dailynoodle.co.uk/admin.html` as a redirect URL.

## Changing something site-wide
1. Update this file in the same commit as the change.
2. If a name or address changes, also check: `front.js` (`CONFIG`), `toolchain/README.md` and `toolchain/SESSION-PROTOCOL.md` (clone commands), the two scheduled tasks' prompts, Supabase Auth URLs, and the forwarding repo.
3. Keep localStorage keys, puzzle ids and file paths stable.
