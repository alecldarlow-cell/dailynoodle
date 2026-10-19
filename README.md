# The Daily Noodle

News, daily puzzles and games for a small group of friends and family, at
**https://dailynoodle.co.uk**. A static site on GitHub Pages, deployed from `main` by the Build feed workflow.

Start with **[SITE.md](SITE.md)**: names, addresses, sections, publishing,
and the rules that keep players' streaks and saved progress safe.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `puzzles.html`, `games.html`, `lab.html` | Section front pages; layout and logic shared in `front.css` / `front.js` |
| `reports/` | Every news piece, puzzle and game, one self-describing HTML file each (`dn:*` metas) |
| `engines/` | One shared player per puzzle type; puzzle pages in `reports/` load these |
| `dn-core.js` | Shared London-date/save rules; edit here, then run `node tools/sync-core.js` to update bundled browser copies |
| `feed.json` | Index of released items, built by the workflow; front pages read it |
| `dn-track.js` | Anonymous usage events to Supabase, plus the domain-move progress import; registers `sw.js` |
| `sw.js` | Service worker: offline copies of pages already opened and of today's puzzles (network first); shows push notifications |
| `dn-push.js` | Hidden notifications test panel, loaded only by `board.html?push=test` (notifications are switched off) |
| `admin.html` | Private stats page (magic-link sign-in) |
| `tools/` | Build steps run by `.github/workflows/build-feed.yml`, plus puzzle batch tools |
| `toolchain/` | The news production toolchain (template, gates, standards) and SQL migrations |
| `icons/`, `assets/`, `manifest.webmanifest` | App icons and install manifest |

## Publishing

Push a file to `reports/` on `main`. The **Build feed** workflow then adds the
tracker, patches share text, moves puzzles onto the shared engines, writes
link-preview tags, rebuilds `feed.json`, and deploys the site: everything
except forward-dated files and the `tools/` and `toolchain/` folders. It also
runs nightly so forward-dated items appear on their day. Details in `SITE.md` and
`toolchain/site-sections-and-tracking.md`.

## Testing

Run `npm ci --ignore-scripts` then `npm test`. The suite gates Pages deployment and
includes logic, content, database, browser, offline and visual checks.
See [the developer testing guide](toolchain/testing.md) for focused commands,
coverage boundaries, CI behavior and how to add a regression.

## Individual checks

```sh
node tools/add-done-state.js --check     # finished puzzles reopen as finished
node tools/share-v2.js --check           # one-line share text everywhere
node tools/build-feed.js                 # rebuilds feed.json locally
node tools/tests/sw.js                   # service worker: offline, today's puzzles, push, kill switch
node tools/tests/offline-next.js         # interrupted offline batches and dated Next-puzzle links
node tools/tests/timing-dates.js         # start-card clocks, saved times and London completion dates
node tools/tests/push-crypto.mjs         # push encryption and signing (toolchain/edge/board-push)
node tools/tests/push-panel.js           # the hidden notifications test panel
```

Testing expansion proposal and full-history inventory: [toolchain/testing-proposal.md](toolchain/testing-proposal.md). See [the developer testing guide](toolchain/testing.md) for the implemented suite and remaining coverage limits.
