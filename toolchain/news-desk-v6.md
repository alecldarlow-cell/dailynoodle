# Noodle News desk v6: the daily briefing and fewer, better deep pieces

Binding from the night of 24–25 Oct 2026 (Alec's call after the site review). It changes **what the
desk publishes and how often**. How a deep piece is researched, verified and gated is unchanged:
rubric v5, prepublish checklist v5 and style guide v2 still apply to every deep piece.

## Why
- The regulars open the News page every day (it was the site's home) but read about one piece a week:
  17 article opens in the 14 days to 24 Oct 2026, against 2 pieces a night.
- The desk repeated itself: jobs three times in 11 days, ocean temperatures two days running, five of
  eight pieces ending on the same Budget date. And it followed the data-release calendar so closely that
  it never covered the biggest UK story of the summer, the change of Prime Minister.

## What the desk publishes
1. **One briefing every night** (`reports/<date>-briefing.html`, built by `toolchain/dn-briefing.js`).
   Three to five of the day's real news stories, chosen from what the BBC, Reuters, PA, the FT, the
   Guardian and the Economist are leading on, plus decisions, votes, rulings and releases that matter to a
   UK family. Each story: a plain headline that says what happened; *what* in 1–3 short sentences; *why it
   matters*, and to whom, in 1–2; *what next* with a date when there is one; 1–3 on-the-record sources.
   It leads the News page (front.js) and is read in about two minutes.
2. **Two or three deep pieces a week** (rubric v5, full toolchain), on the most important stories, not the
   newest data. At most **3 per Monday-to-Sunday week**; aim for at least 2. Most nights publish the
   briefing only. A deep piece on a story the briefing carried that night is linked from it (`deep`).

## Repeats are a hard block
- Every deep piece carries a **story slug** (`meta.json` `"story"` → `dn:story`), the same slug for the same
  running story (`uk-labour-market`, `uk-public-finances`, `uk-budget-2026`…). `dn-briefing.js plan`
  lists the slugs already used.
- `dn-briefing.js check-deep <file>.html` must print `DESK: PASS`. It fails a piece whose story had a deep
  piece in the 14 days before, unless a **new event or decision** makes it a follow-up: then
  `meta.json` `"followup": "reports/<earlier>.html"` and a link back in the piece. It also fails once the
  week holds 3 deep pieces. The nightly task may not waive it. Its WARN for a similar headline with a
  different slug means: check whether it is the same story, and use that slug if so.
- In the briefing a story may run on consecutive days only with `developing`: what is new today (shown as
  "New today"). The builder fails it otherwise, and fails an item on a story that had a deep piece in
  the last 3 days unless it links that piece (`deep`) or says what is new.

## Writing for the family on a phone
For the briefing these are gated by the builder; for deep pieces they are the style target on top of
style guide v2:
- Short sentences: none over 30 words in the briefing; aim for an average under 20 in deep pieces.
- Headlines say what happened in one clause. No question headlines; avoid "but…" second clauses and hedges
  ("edges towards", "slowly") unless the hedge is the news.
- One number per sentence where possible; in the briefing, only the numbers the story needs.
- The explanation on the record comes before the caveat. Never write that the data cannot say why; find who
  has explained it, or leave the item out.

## The briefing, step by step (nightly)
Run `dn-briefing.js` from the **full clone** (`node <clone>/toolchain/dn-briefing.js …`), not the `~/b` copy:
it reads `reports/` to find repeats and writes the briefing there. The render check runs from `~/b` as usual.
1. `node <clone>/toolchain/dn-briefing.js plan`: the week's deep count, recent story slugs, the last briefing's
   stories.
2. Discovery as before (news agenda first, release calendar second), picking 3–5 stories for the briefing
   and deciding whether tonight carries a deep piece (cap, importance, not a repeat).
3. Write `briefing.json` (format in the header of `dn-briefing.js`), checking every fact against its source
   (no figure without a source in the item; quotes under 15 words, attributed).
4. `node <clone>/toolchain/dn-briefing.js build briefing.json` → `BRIEFING: PASS`. Then, from `~/b`,
   `node dn-render.js <clone>/reports/<date>-briefing.html` → `RENDER: PASS`; read the sheet.
5. If a deep piece is due: the full v5 build, then `node <clone>/toolchain/dn-briefing.js check-deep <file>.html` → `DESK: PASS` before pushing. Build it
   before the briefing so the briefing can link it.
6. Push the briefing (and any deep piece) to `main` as before; confirm both reach `feed.json`.
