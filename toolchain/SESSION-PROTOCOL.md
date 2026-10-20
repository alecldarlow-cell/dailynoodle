# DN session protocol

The build standards are in the project instructions and the rubric. This file is
only about **what to read, when, and how much** — the context discipline.

The reason it matters: in an agentic build every tool call re-processes the
accumulated context. A token spent at turn 3 is carried through the fifty turns
that follow; a token spent at turn 45 is carried through five. The expensive reads
are therefore the *early* ones, and the two biggest — the binding documents and the
house template — both happen in the first ten turns of every build.

---

## Startup: read almost nothing

| Artefact | When to read it |
|---|---|
| Project instructions | already in context — free |
| `DN-API.md` | once, at the top of a build |
| House template | **never** — `dn-build.py` splices it; `DN-API.md` documents it |
| Standards rubric (latest version) | **§0–§0a, §1d, §4b and §6–§6b at step 0** (the so-what, news spine, context floor, explanation search, caveat proportion, what happens next — about 120 lines); the rest **only on a contested call** |
| Prepublish checklist (latest version) | **pass 1 (editorial) at the spine checkpoint; pass 2 (production) at the gate step** — never at startup |
| Headline & style guide | **at step 5, before writing the headline and first two paragraphs** — §1–§4 only |
| Reporter addendum | never as a read — its one rule (`dn:statlabel`) is in the instructions and gated by the linter |
| `toolchain/README.md` | only when bootstrapping without the Project (unattended runs) |

The rubric, checklist and addendum are still binding. They are not still *readable
per build*. The operative constraints are already restated in the project
instructions; the source documents carry rationale, worked examples and edge-case
adjudication that a routine build does not consult. Read them when something is
actually contested, and say that you did.

Bootstrap in one call. The toolchain lives in the repo's `toolchain/` folder, so a
fresh clone is all a session needs — inside the Project or out of it. The clone is
sparse: only `toolchain/` and `tools/` are checked out, not the 200+ MB `reports/`
back catalogue. The npm line adds the real browser and fonts `dn-render.js` needs.

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

Inside the Project, read the rubric, checklist and style guide from **project
knowledge** (the highest-versioned copy), on demand and never at startup. The copies
in `~/b/repo/toolchain/` are for unattended runs outside the Project, and can lag
project knowledge until the repo is synced. If the two disagree, project knowledge
wins; say so in the reply.

**30-day duplicate check** (rubric §0). One call; it needs only `feed.json`, not the
back catalogue:

```bash
git -C ~/b/repo show HEAD:feed.json | python3 -c "import json,sys; \
k=[w.lower() for w in sys.argv[1:]]; \
[print(i['date'], i['headline']) for i in json.load(sys.stdin)['items'] \
 if i['kind']=='report' and any(w in (i['headline']+' '+i['standfirst']).lower() for w in k)]" \
  KEYWORD1 KEYWORD2
```

Any hit in the last 30 days makes the piece a follow-up, or drops it.

Pull back-catalogue context **only** when it is actually needed — checking whether
a story has run, or rebuilding a shipped piece. Not by default. One file:
`git -C ~/b/repo show HEAD:reports/<file>.html > <file>.html`. The whole folder:
`git -C ~/b/repo sparse-checkout add reports`.

---

## Research: bound the big fetches

The single largest line item on a research-heavy build, and the one place where
saving tokens can cost you sourcing.

- **Bounded fetch first.** Pass a token limit and read the extract. Re-fetch
  targeted sections only if the figure you need isn't there.
- **Re-fetch when the extract falls short — actually do it.** The Reuters DNR piece
  needed the full PDF because the executive summary genuinely lacked the 46-market
  2021 comparison. The rule only works if the fallback is used rather than written
  around. Never infer a figure the extract didn't give you.
- The sandbox network allowlist covers GitHub, npm and PyPI only. A source PDF
  cannot be pulled down and grepped locally; bounded fetching is the only lever.
- Search before fetching a cold URL — fetch reliability is much better for URLs
  that have already appeared in a search result.
- **Go to the tables (rubric §1b), and know where that fails.** Spreadsheet
  downloads (e.g. ONS `.xlsx` reference tables) fail through the fetch tool, and
  the shell cannot reach the publisher. When the spine needs a series that is only
  in the tables, ask the desk to attach the file at the spine checkpoint, and name
  the gap honestly if they can't.
- **Earlier editions are a partial fallback, not a free series.** Previous editions
  of a bulletin often state the same breakdown for their own year. That yields a
  cross-edition comparison, but check for reweighting or method breaks between
  editions first. The ONS reweighted its 2020–23 smoking estimates, so the 2023
  edition's 11.9% became 11.1% in the next. Prefer editions on the same basis, and
  put any break in the caveat card.

- **Context research is not optional *(v5)*.** After the primary release, spend a
  second round of searches on the story around it: what the responsible department,
  regulator or producer said; any target, deadline, policy change or event that
  coincides with the change; Tier 2 analysis (think tanks, the OBR, learned
  societies); and Tier 3 coverage of the same release, for explanations and
  on-record reactions. Budget roughly as many searches for context as for the data.
  The explanation found here is what turns a bulletin rewrite into a news piece
  (rubric §4b). A piece that says "the data cannot say why" when the Health
  Foundation, the minister or the release itself has said why is wrong, not cautious.

---

## Build order

The gate moves to the front. Geometry failures are decidable from the chart spec
alone, so there is no reason to discover them after the prose is written.

```
0  EDITORIAL GATE   peg + date, added-value sentence, so-what sentence,
                    30-day feed check, interests; then CONTEXT RESEARCH
                    (explanations on the record, positions, next step)
1  verify.js        compute every derived figure, lock the outputs
2  SPINE CHECKPOINT one block to the desk + checklist pass 1 (editorial):
                    spine (confirmed / changed because Y), peg and date,
                    added-value sentence, so-what sentence, the news spine
                    (what happened → why → why it matters → what next) with
                    a source for each, independent source, data to attach,
                    interest to declare, prior DN piece to link
3  piece/init.js    author the exhibits
4  dn-preflight.js  geometry + silent-failure check, before any prose
5  piece/body.html  author the prose against exhibits already known to fit;
                    style guide §1–§4 first; caveat card before headline (§5b)
   piece/footer.html
   piece/meta.json
6  dn-build.py      assemble
7  dn-lint.js + dn-probe.js
8  dn-render.js     real-browser render at 360/680, light and dark;
                    then Read every sheet it writes
9  copy to outputs, present_files
```

**Steps 0 and 2 are not optional.** Step 0 decides whether there is a piece at all.
A bulletin rewritten in the bulletin's order is not one, and nor is a topic run in
the last 30 days with nothing new. On five pieces the pitch premise failed verification and
the story was rebuilt around what survived — correct behaviour, but twice the desk
learned about it only after the file was built and gated. One sentence at step 2
costs a sentence; the same news at step 7 costs a rebuild.

**Step 8 is not optional either.** Both gates are structural. The undersea-cable
sankey passed lint and geometry cleanly while implying a parent-child relationship
the data did not support — an editorial error wearing a rendering costume, caught
only by looking at it.

**And step 8 is a real render** (since 20 Oct 2026). `node dn-render.js <file>.html`
opens the piece in the Chromium build the site's tests pin, with its own web fonts
(Archivo and Inter, served from pinned npm copies because the sandbox can't reach
Google Fonts), after the site's own additions (Share buttons, back-to-News link,
dark mode), at 360px and 680px in light and dark. It fails on what jsdom cannot
see: labels cut off at a chart's edge or the screen's, a page wider than the phone,
a hero figure clipped, an exhibit that didn't draw, a shortened label that lost
words or kept nothing readable, script errors. It warns on overlapping labels,
dashed reference lines running through labels,
labels sitting outside the chart, chart text under 10.5px, text too faint for its
background in either theme, and every shortened label. Then it writes one sheet per
exhibit (360 light and dark side by side, 680 light below) and one of the top of the
piece.

The measurements say where to look; they are not the check. **Read every sheet** and
look for what no rule catches: a chart that implies something the data doesn't (the
sankey above), dead white space between a chart and its caption, a legend that
doesn't match its marks, a label stub that reads badly, a series that vanishes in
dark mode. Fix in `piece/` and rebuild, then re-run and Read only the sheets for the
exhibits you changed.

At delivery, say what you looked at and what you found ("rendered at 360 and 680,
light and dark; sheets for ex01–ex03 read; ex02 legend fixed"). It is a real browser,
not a phone (no browser bars, Linux font rendering), so say "rendered check", not
"device check". If `dn-render.js` can't run (exit 2: install or browser failure),
fall back to the old form: tell the desk plainly that the visual check is
outstanding and which exhibits and failure modes to look at.

Never describe a jsdom render (`dn-harness.js`) as a visual check. jsdom models no
font metrics, layout or paint; describing its output as a visual check is how three
defects reached publication, and jsdom-only checking is how a bar label that had
silently lost its middle words ("Government, money" for "Government, end-2030s,
today's money") went live on 20 Oct 2026.

---

## Context hygiene during the build

- **Read the render sheets once, at step 8.** Each image costs context. After a fix,
  re-run `dn-render.js` and Read only the sheets for the exhibits you changed.
- **Never read the assembled HTML back into context.** After `dn-build.py` runs, the
  file is touched only by scripts. Authored parts live in `piece/` and are edited
  there, then rebuilt — never patched in place in the output.
- **Always pipe gate output through `tail`.** Full lint output is ~25 lines of
  passes you do not need to re-read.
- **Chain shell steps.** One call running build + lint + probe costs a fraction of
  three calls, because each call re-sends everything before it.
- **Do not echo authored copy back** in the reply. The desk reads the rendered file.

---

## Post-delivery work goes in a fresh chat

The largest single saving available, and a workflow change rather than a tooling one.

At least four pieces had substantive revision rounds after filing — a lay-reader
rewrite, a third exhibit, an added causal paragraph, a follow-up literature
discussion. Every turn of those re-processed the entire build that preceded them:
the research, the source fetches, the splices, the gate runs.

Filing the piece, then opening a new chat and uploading the HTML, costs one upload
and drops the carried context to near zero. On a second-round revision it avoids
something like a third of the original build's cost.

The same applies in reverse: discovery and commission are already separate chats.
Keep them that way.

---

## The two dates

`meta.json` carries two, and they mean different things.

| Field | Meaning | Drives |
|---|---|---|
| `date` | **publication** | filename, masthead kicker, `dn:date`, feed sort order |
| `built` | **data currency** | the footer "Figures to" line. Defaults to `date` |

For a same-day piece, omit `built`. For a future-dated piece set `built` to the day
the figures were actually compiled, and the footer will say so.

Publication may lead compilation. It may never trail it: `dn-build.py` refuses to
write if `built` is later than `date`, and the linter errors on the same condition.
A piece cannot claim figures more current than the day it was written.

A lag of more than 14 days draws a note from the linter — not a failure, but a prompt
to re-check anything fast-moving. A genomics paper does not go stale in a fortnight;
CPI, polling, market data and live conflict counts do.

## Redating

Prefer editing `piece/meta.json` and re-running `dn-build.py` — it regenerates the
masthead kicker, the `<title>`, the footer line, the version stamp and the filename
from one field.

For a piece that has already shipped, `dn-redate.js` does the four mechanical edits,
leaves source retrieval dates alone, and refuses to write if it finds date-dependent
content — a decimal-year value sitting on the old build date, a caption counting
days to "today", or the old date appearing outside a retrieval note. That last class
is real: a redate once required recomputing a rangeStrip end value and rewriting its
caption from "two days wide" to "three days wide".
