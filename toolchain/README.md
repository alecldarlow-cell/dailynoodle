# DN toolchain

Everything a Noodle News build session needs, so a run outside the claude.ai Project
(scheduled, unattended, or a fresh sandbox) can bootstrap from this repo alone.
The Project's knowledge files are the editing copies; this folder mirrors them.

Node 18+ and Python 3. The gates need only jsdom; the render check (`dn-render.js`)
also needs a real browser, installed from npm by the bootstrap: `playwright-core` and
`@sparticuz/chromium` at the versions in the repo's `package.json` (the site's tests
use the same browser), plus the piece's two web fonts from `@fontsource`. About 120 MB
and 15 seconds.

## Files

| File | What it is | When it's used |
|---|---|---|
| `digi-news-house-template-v3-3-3.html` | House template: chrome, CSS tokens and the embedded DN chart library. **Canonical.** | Never read; `dn-build.py` and `dn-preflight.js` splice from it |
| `dn-build.py` | Assembler. Splices `piece/` into the template; owns the masthead, `<title>`, the production note, Corrections (from `meta.corrections`; refuses a bumped version with no entry), "Figures to", version line and filename | Build step 6 |
| `dn-preflight.js` | Geometry + silent-failure gate on `piece/init.js` alone, before prose is written | Build step 4 |
| `dn-lint.js` | Structural gate on the assembled file: sourcing, a11y, self-containment, footer, feed meta, tile, honesty slots, presentation contracts | Build step 7 |
| `dn-probe.js` | Geometry gate on the assembled file at 360px and 680px | Build step 7 |
| `dn-render.js` | Real-browser render check (20 Oct 2026): the assembled piece in the site's pinned Chromium with its own fonts and the site's additions (Share, back-to-News, dark mode), at 360px and 680px, light and dark. Fails on clipped or lost-word labels, sideways scroll, undrawn exhibits, script errors; warns on overlaps, dashed reference lines through labels, small or faint text, shortened labels; writes one screenshot sheet per exhibit to `render/<slug>/` to look at | Build step 8 |
| `dn-harness.js` | jsdom loader with the toolkit's polyfills. Required by the three gates; also usable for bespoke checks (`loadPiece()` → `charts()` / `render(w)` / `errors`; always `close()`) | Library |
| `dn-briefing.js` | The desk plan, the daily briefing builder and the deep-piece repeat/cap gate (24 Oct 2026; `news-desk-v6.md`). Run from the full clone, since it reads `reports/` | Every nightly run |
| `dn-redate.js` | Moves an already-shipped piece to a new date; refuses on date-dependent content | Redates only |
| `DN-API.md` | Chart toolkit reference: primitives, spec fields, label budgets, silent failures, markup contracts. Replaces reading the template | Read once per build |
| `SESSION-PROTOCOL.md` | Build order, context discipline, bootstrap, the two dates, redating | Read first |
| `news-desk-v6.md` | **What the desk publishes** (24 Oct 2026): one briefing a night, 2–3 deep pieces a week, story slugs and the repeat block, plain English | Read first, every run |
| `digi-news-standards-rubric-v5.md` | Binding editorial standards: news value, source tiers, going to the data, assumption firewall, caveat test, news spine, context floor, accessibility floor, length tiers, footer, disclosure, continuity, fairness | §0–§0a, §1d, §4b and §6–§6b at the editorial gate (step 0); the rest only on a contested call |
| `digi-news-prepublish-checklist-5.md` | Pre-publish checklist in two passes, mapped to rubric sections | Pass 1 at the spine checkpoint; pass 2 at the gate step |
| `digi-news-style-guide-v2.md` | Headlines, standfirsts, the first two paragraphs, number ration, register | Build step 5, before the headline |
| `addendum-digi-reporter.md` | The `dn:statlabel` tile-kicker rule (also gated by the linter) | Only if a kicker call is unclear |
| `site-sections-and-tracking.md` | Site sections (`report`/`puzzle`/`game`), the tracker-line exception, admin | When publishing or rebuilding a shipped piece |

Not here, by design: the project instructions (they live in the claude.ai Project),
any per-piece `verify.js` (written fresh for each piece), and any secret.

## Bootstrap

Working directory `~/b`. Sparse clone, so only `toolchain/` and `tools/` (which `dn-render.js` uses to apply the site's own additions) are checked out:

```bash
mkdir -p ~/b && cd ~/b \
  && git clone -q --depth 1 --filter=blob:none --sparse \
       https://github.com/alecldarlow-cell/dailynoodle.git repo \
  && git -C repo sparse-checkout set toolchain tools \
  && cp repo/toolchain/dn-*.js repo/toolchain/dn-build.py repo/toolchain/DN-API.md \
       repo/toolchain/digi-news-house-template-v3-3-3.html . \
  && npm install --silent --no-audit --no-fund jsdom playwright-core@1.62.1 \
       @sparticuz/chromium@153.0.0 @fontsource/archivo@5.3.0 @fontsource/inter@5.3.0 \
  && mkdir -p piece
```

Standards docs stay in `~/b/repo/toolchain/` and are read from there on demand.
To pull a shipped piece for context or a rebuild:
`git -C ~/b/repo show HEAD:reports/<file>.html > <file>.html`.

## Build sequence

All commands run from `~/b`. Pipe gate output through `tail`.

1. **`verify.js`** — compute every derived figure in Node from the sourced inputs and
   print the locked outputs. Printed figures in the piece must equal these.
2. **Spine checkpoint** — one block to the desk: the so-what sentence, the four-part news spine (what happened → why → why it matters → what happens next) with a source for each, and whether the data spine was confirmed or changed and why.
3. **`piece/init.js`** — chart init body, no `<script>` wrapper. Build from `DN-API.md`.
4. **Preflight** — `node dn-preflight.js piece/init.js` → must print `PREFLIGHT: PASS`.
5. **Prose** — `piece/body.html` (from `<div class="head">` to the last `</section>`),
   `piece/footer.html` (Method and Sources divs only), `piece/meta.json`:
   ```json
   { "headline": "…", "standfirst": "…", "topic": "Science", "date": "YYYY-MM-DD",
     "kind": "report", "read": "~4 min", "slug": "topic-slug", "version": "v1.0",
     "statlabel": "optional, <=14 chars", "built": "optional, data-currency date",
     "story": "running-story-slug (required from 25 Oct 2026; see news-desk-v6.md)",
     "followup": "optional: reports/<earlier piece>.html, only for a follow-up on a new event" }
   ```
6. **Assemble** — `python3 dn-build.py --piece piece` → writes `YYYY-MM-DD-slug.html`.
   Never patch the output; edit `piece/` and rebuild.
7. **Lint** — `node dn-lint.js <file>.html --width 360 --date <dn:date>` → `CLEAR`, or
   `PASS WITH WARNINGS` with each warning justified.
   **Probe** — `node dn-probe.js <file>.html` → `GATE: PASS`.
8. **Render and look** — `node dn-render.js <file>.html | tail -25` → `RENDER: PASS`,
   or `PASS WITH WARNINGS` with each warning judged. Then **Read every sheet it
   lists** (`render/<slug>/sheet-*.png`: each exhibit at 360px light and dark and
   680px light, and the top of the piece) and look for what no rule catches. Fix in
   `piece/` and rebuild. Confirm lint's §8 lines (aria-label, SVG title, hidden data
   table on every chart) and that colour is never the sole carrier. If `dn-render.js`
   can't run (exit 2), hand over the **visual check as outstanding** instead, naming
   the exhibits and the failure modes to look at. A jsdom render is never a visual check.

Chained, steps 6–8 (then Read the sheets):

```bash
python3 dn-build.py --piece piece && F=$(ls -t 20*.html | head -1) \
  && node dn-lint.js "$F" --width 360 --date "${F:0:10}" | tail -8 \
  && node dn-probe.js "$F" | tail -4 \
  && node dn-render.js "$F" | tail -25
```

## Publishing

Copy the file into `reports/` of a clone and push to `main`; the site's
`build-feed.yml` workflow injects the tracker line, rebuilds `feed.json`, runs
the site's full test suite and deploys only if it passes (since 19 Oct 2026;
`toolchain/testing.md`). That usually takes under 10 minutes, and a failure anywhere on
the site holds the piece back too. So a push is not publication. To confirm it
went live:

```bash
git -C ~/b/repo fetch -q origin main \
  && git -C ~/b/repo show origin/main:feed.json | grep -c "<file>"   # 1 = live
```

The workflow commits the rebuilt `feed.json` only after every test passes, and
deploys straight after, so the piece appearing there means it is live (opening
`https://dailynoodle.co.uk/reports/<file>` confirms it too). If it hasn't
appeared about 20 minutes after the push, report it as pushed but not live, with
the commit link. Never re-push, or edit tests or other files, to force it
through.
Push credentials are never stored in this repo — supply a token at run time
(for example from an environment secret written to `~/.dn/token`, mode 600) and
never echo it.
