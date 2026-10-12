# DIGI NEWS — Pre-Publish Checklist (v4)

A piece does not ship until every box is ticked. Each item maps to a rubric section (§). If a box can't be ticked, fix the piece or cut the claim — don't wave it through.

The checklist runs in two passes:

- The **editorial pass** is done at the spine checkpoint, before the build.
- The **production pass** is done at the gate step.

The editorial pass is new in v4. It exists because every failure it catches costs a rebuild if it is found later.

---

# Pass 1 — Editorial (at the spine checkpoint, before any exhibit is built)

## News value (§0)
- [ ] **Peg named, with its date.** If the source is more than 14 days old, the first paragraph says why the piece is running now.
- [ ] **Added-value sentence written.** It is one line saying what this piece tells the reader that the source's own headline does not.
- [ ] **Feed checked for the last 30 days.** If Digi News has covered the topic, this is a follow-up: it links back and leads on what changed. If nothing material changed, the piece is dropped.

## Sourcing plan (§1, §1b, §1c)
- [ ] At least one source **independent of the primary release** has been identified.
- [ ] Every figure the spine needs is in hand **from the data**, not inferred from bulletin prose. Anything not reachable is named at the checkpoint, and the requester is asked to attach it.
- [ ] If the piece will reach an adverse finding about a named organisation, its **published position** has been looked for.
- [ ] **Interest check (§14).** Does the piece cover the editor's employer, a charity of which he is a trustee, or a company in which he holds shares? If yes, a declaration is planned, and the framing has been reconsidered.

---

# Pass 2 — Production (at the gate step)

## Numbers
- [ ] Every printed figure was **computed in code**, and the printed value equals the computed value, with no hand-rounding drift. §2
- [ ] Units, base year, real-versus-nominal and per-capita basis are checked; there are no unit or denominator errors. §2
- [ ] Each pivotal or surprising figure is **corroborated by a second independent T1/T2 source**. §1
- [ ] The chosen measure was interrogated for floor/ceiling, base-rate, small-denominator and edge artifacts. §2a
- [ ] Any window the desk chose (start date, end date, peak, low) is stated in the body and tested from other dates. §2a

## Assumption firewall
- [ ] No projection, scenario or conditional ("if X…") is the headline, the standfirst or a hero stat. §3, §5a
- [ ] Projected data is a separate field, rendered dashed or hatched, and the band or scenario is captioned as such. §3
- [ ] Any "record / first / highest" in the headline is true of the **measured** data as printed, not only under an assumption. §5a

## Headline and caveat (§5a, §5b) — *new in v4*
- [ ] The caveat card was written **before** the headline was finalised.
- [ ] The strongest objection does **not** land on a specific claim in the headline or standfirst. If it did, the headline was rewritten to rest on what survives.
- [ ] The headline follows the style guide: one idea, about 12 words or fewer, and an active verb.

## Sourcing and attribution
- [ ] Every load-bearing claim has an **inline numbered citation** resolving to the footer. §1a
- [ ] Each source carries a **T1/T2/T3 badge**, and nothing load-bearing rests on opinion, advocacy or low-reliability sources. §1, §1a
- [ ] At least one cited source is independent of the primary release; otherwise the Method says why not. §1
- [ ] Causal and evaluative claims are attributed or explicitly marked as analysis, with no unsourced "causes" or "most observers". §4, §4a
- [ ] Fact and interpretation are visibly separated throughout. §4
- [ ] For any adverse finding about a named organisation, its published position is included, or its absence is stated. §1c

## Contested topics
- [ ] Positions cards are used **only** where credible sources genuinely disagree, with no manufactured balance. §5
- [ ] Both sides are steelmanned and sourced, and empirical and value disputes are labelled. §5
- [ ] A verdict is stated only where the evidence clearly points; value questions are left open; the strongest objection is noted. §5

## Uncertainty
- [ ] A **"What we don't know"** note is present, and it lists genuine unknowns, not unretrieved published data. §6, §1b
- [ ] A caveat card states the single strongest objection to the main reading. §6, §5b
- [ ] Any survey or poll reports the **sample size, margin of error, fielding dates and pollster**, and within-MoE gaps are not framed as real movement. §6a

## Disclosure, fairness and continuity — *new in v4*
- [ ] The standing **production note** is present. §12, §14
- [ ] Any **declaration of interest** is placed under the standfirst and in the footer. §14
- [ ] No wrongdoing is imputed, or speculated about, without a Tier 1 record. Share-price pieces describe and do not forecast. §16
- [ ] Prior Digi News coverage of the topic is linked in the body. Any earlier piece whose headline finding is now overturned gets a dated forward-link in its Corrections. §15
- [ ] If this is a revision of a published piece, the version bump has a dated one-line entry in Corrections. §15

## Writing (style guide)
- [ ] The first paragraph says what happened and why it matters to a reader, in plain words, before the detail.
- [ ] Number ration: no more than two figures in any sentence of the first two paragraphs. Exact figures that the prose does not need go to an exhibit or table.
- [ ] Neutral, active register; no loaded language; contested claims attributed. §4, §4a

## Charts and imagery
- [ ] Exhibits are built with the **DN toolkit**; axes are honest (zero baseline unless flagged); units are in the caption. §2, §7, §10
- [ ] Colour is not the only carrier of meaning; categorical series use the CVD-safe palette plus a legend; the accent is reserved for the subject. §8
- [ ] Images are licensed, public-domain or wire, with a credit. AI visuals are labelled as illustration. Nothing misrepresents scale, time, place or identity. §7
- [ ] One bespoke **signature exhibit** carries the piece. §10
- [ ] **No chart label clips off-canvas or overlaps another label** at 360px or 680px, as verified by the geometry gate. Any `data-dn-fit="trunc"` truncation is intentional, and the full text is in the data table. §8

## Accessibility
- [ ] Every chart has an `aria-label`, an SVG title/desc and a visually hidden **data table**. §8
- [ ] Charts are legible at 360px wide (label type ≥ ~11px); `prefers-reduced-motion` is respected; the layout is portrait-responsive. §8

## Footer and housekeeping
- [ ] **Method** explains the measures, windows, assumptions and projection basis. §12
- [ ] **Sources** are numbered, highest tier first, badged, and linked with retrieval dates where possible. §12
- [ ] The **Corrections** line is present ("None" until needed). §12, §15
- [ ] The **version line and "Figures to [date]"** are present and correct. The version uses the canonical form `v<major>.<minor>`. §12
- [ ] Length matches the tier. `dn:read` is `~N min`, with N equal to the narrative words divided by 230. The "Go deeper" tail is included only if material was deliberately omitted. §9

## Publication and feed (§13)
The piece is published by uploading the file to the site repo, and the front page builds its card from the file itself. The metadata is therefore part of the deliverable.

- [ ] The filename is **`YYYY-MM-DD-topic-slug.html`** (lowercase, hyphens, no spaces), and the date is the publication date.
- [ ] The **DN feed meta block** is present in `<head>`: `dn:headline`, `dn:standfirst`, `dn:topic`, `dn:date`, `dn:kind`, `dn:read` and `dn:statlabel` (or `dn:statlabel` is deliberately omitted).
- [ ] `dn:headline` is the `<h1>` **verbatim**, and `dn:standfirst` is plain text with no tags.
- [ ] `dn:date` equals the filename date; "Figures to" reflects data currency (`built`).
- [ ] `dn:kind` is `report`, `puzzle` or `game`.
- [ ] `dn:topic` is from the **controlled vocabulary**, tagged by what the piece is about. §13
- [ ] The **first hero stat** is ≤8 characters after tags are stripped, uses a symbol unit only, and is a measured figure. The hero grid has exactly three tiles.
- [ ] **`dn:statlabel`** is ≤14 characters, lower case and a noun, unless the first figure already carries its own noun.

## Automated gates
The gates check structure and geometry, not arithmetic and not judgement. Run them and read the output; do not rely on a remembered list of what they check.

- [ ] `node dn-preflight.js piece/init.js` returns **PREFLIGHT: PASS**, before the prose is written.
- [ ] `node dn-lint.js <final-name>.html --width 360 --date <publish-date>` returns **CLEAR**, or **PASS WITH WARNINGS** with every warning justified.
- [ ] `node dn-probe.js <final-name>.html` returns **GATE: PASS**.
- [ ] **Visual check named as outstanding** at delivery, with the specific exhibits and the plausible failure modes for the primitives used. A harness render is not a visual check.
