# The Daily Noodle

News, daily puzzles and games for a small group of friends and family, at
**https://dailynoodle.co.uk**. A static site served by GitHub Pages from `main`.

Start with **[SITE.md](SITE.md)**: names, addresses, sections, publishing,
and the rules that keep players' streaks and saved progress safe.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `puzzles.html`, `games.html`, `lab.html` | Section front pages; layout and logic shared in `front.css` / `front.js` |
| `reports/` | Every news piece, puzzle and game, one self-describing HTML file each (`dn:*` metas) |
| `engines/` | One shared player per puzzle type; puzzle pages in `reports/` load these |
| `feed.json` | Index of released items, built by the workflow; front pages read it |
| `dn-track.js` | Anonymous usage events to Supabase, plus the domain-move progress import |
| `admin.html` | Private stats page (magic-link sign-in) |
| `tools/` | Build steps run by `.github/workflows/build-feed.yml`, plus puzzle batch tools |
| `toolchain/` | The news production toolchain (template, gates, standards) and SQL migrations |
| `icons/`, `assets/`, `manifest.webmanifest` | App icons and install manifest |

## Publishing

Push a file to `reports/` on `main`. The **Build feed** workflow then adds the
tracker, patches share text, moves puzzles onto the shared engines, writes
link-preview tags and rebuilds `feed.json`. It also runs nightly so
forward-dated items appear on their day. Details in `SITE.md` and
`toolchain/site-sections-and-tracking.md`.

## Checks

```sh
node tools/add-done-state.js --check     # finished puzzles reopen as finished
node tools/share-v2.js --check           # one-line share text everywhere
node tools/build-feed.js                 # rebuilds feed.json locally
```
