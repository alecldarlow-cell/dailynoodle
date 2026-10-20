# Publishing health in admin

The Publishing section of `admin.html` checks three independent things. It starts after `admin_dashboard` confirms admin access, and has its own **Check publishing** button. Reader date and section filters do not change its dates or repeat its requests. A visible tab checks again when the London date changes; returning to the tab also checks for a date change.

## Today's live puzzles

The browser requests the current `puzzles-today.json`, requires exactly one correctly typed/id'd URL for each puzzle type on today's London date (eight with Reckon from 20 Oct 2026; the type lists are `TYPES` in `admin-health.js` and `tools/publishing-health.js`), then makes a network HEAD request to each URL. A missing, stale, duplicate or unsafe list is not reported as healthy. The count means **files responding**, not a full play-through. These requests do not load the tracker or submit puzzle results.

`sw.js` bypasses cache for requests marked `publishing-check=1`, and never caches `admin-health.js` or `publishing-health.json`. A twelve-second timeout includes JSON response bodies. Requests that cannot be confirmed are shown explicitly; there is no cached green fallback. Checks and GitHub status are independent, so an API rate limit does not disguise a broken puzzle or turn a working site red by itself.

## Future puzzle stock

`tools/publishing-health.js` scans dated puzzle files during `tools/build-site.js`, before future HTML is removed from the published artifact. It writes `publishing-health.json` **only into the assembled site**, containing:

- build time, London build date, workflow run id and release validation window;
- per-day counts of each puzzle type;
- types with inconsistent filename/date/kind/puzzle-id metadata.

It contains no future paths, puzzle ids, headlines, grids, clues or answers. Registry/developer files and future HTML remain excluded from the published site.

A complete day means exactly one file of each type with matching metadata. Future days are consecutive from tomorrow; missing, duplicate or inconsistent files stop the count. The panel names the first incomplete date and types, and lists the next eight days. It recalculates the dates when checked; a snapshot built for a different London day is labelled out of date.

This is inventory from the **last published build**, not a live read of the latest repository head. It is not a claim that the whole future batch passed every puzzle validator. The release suite validates today and the next seven days; optional nightly full-batch checks remain separate. New files or fixes appear in stock after a successful deployment.

## Release status

The browser reads the latest 20 `build-feed.yml` runs from GitHub's public REST API, without a token. It shows the latest run's state and the last successful workflow's finish timestamp, plus links to both. The snapshot also links the run that produced the live build, which can differ from a later queued or failed run.

Successful means the whole workflow, including deployment and live health checks, finished successfully. A failed workflow can fail before **or after** deployment; its status must be read alongside the live URL checks. If GitHub is unavailable or rate limited, the panel shows status unconfirmed and provides a GitHub link. It never infers a successful deployment from a successful test step, or presents test duration as total deployment time.

The page and build metadata are public static files, like the existing admin HTML. Reader figures still require the existing Supabase admin check; no database migration, secret or reader-data endpoint is introduced.

## Verification

- Unit fixtures cover consecutive stock, gaps, duplicate dates, metadata errors, London date rollover, malformed snapshots, unsafe/stale daily lists, and keeping future content out of the snapshot.
- Browser fixtures cover healthy stock/live URLs, queued/in-progress releases alongside the last success, failed URL checks, stale stock, API rate limiting, timeout/retry, sign-out and rejected admin access. Phone and desktop panel renders were inspected.
- Worker tests assert network-only health requests; the real worker suite retains its offline regressions.
- Artifact checks require a current snapshot without future content. The post-deploy read-only check confirms the public admin/script, current metadata, and both GET and HEAD responses for every one of today's puzzle URLs.
