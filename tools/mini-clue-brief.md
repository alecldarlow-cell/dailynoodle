# Mini clue editing brief (Noodle Puzzles)

For editors working a batch prepared by `tools/mini-clue-batch.js --prep`. The rules come from the puzzle-quality framework (Mini clue rules, Phase 3, agreed 19 Oct 2026).

The Mini is a 5×5 daily crossword for a small British audience (friends and family who compare times on WhatsApp). Every grid is a steady "medium": a plain definition with at most a slight angle, solved in about a minute and a half. You change clue text and, when needed, the standfirst. You never change the grid.

## Light touch: what to change

- **Every clue marked ⚑ MUST CHANGE.** If a `BANK` clue is listed and it is good (it passes the tests below and suits this grid), use it word for word: that's the cheapest fix. Otherwise write a new clue.
- **Any other clue that fails a test below.** Read every clue, but if it passes, leave it alone. Don't rewrite good clues for taste.
- **New grids** (marked `NEW GRID`): write every clue and a standfirst.

## The tests

1. **Substitution.** The answer drops into a sentence in place of the clue: same part of speech, number, tense and person. TOE ≠ "There are ten of them"; HAD ≠ "Been taken for a ride".
2. **Idiom-bound words get a blank.** Use exactly three underscores standing for exactly the answer: "Keep ___ (say nothing)" for MUM. At most two blanks per grid. A blank must not fit a second common answer of the same length ("Iron ___" fits ORE and AGE: avoid).
3. **No stray "it"/"them".** Verb clues are bare ("Finish off", not "Finish it off").
4. **No padding.** No "in a word", "plainly", "all told", "plural", "with up/from".
5. **British.** Spelling, words and idiom (Mum, autumn, frying pan, "ready, steady, go", "13 to 19", football). No US-only meanings, no baseball.
6. **True.** Facts, proverbs, quotations and titles must be right. If unsure, don't use it. (A bout is the whole contest, not a round; Sir goes before a first name.)
7. **No leaks.** A clue must not contain its answer or its root, or another answer in the grid.
8. **No repeats.** Never use a clue listed under "don't reuse (within a year)", and don't repeat a clue for the same answer elsewhere in your batch, or near-copy one.
9. **Play without extra difficulty.** Each grid needs one or two (never more) misdirection or double-definition clues, on entries whose letters are all crossed: PRIDE "What comes before a fall, or a group of lions"; MAT "One that gets walked all over". If a kept clue already does this, just list it in `md`; otherwise make one of the clues you are changing anyway the playful one. The rest of the grid stays plain.
10. **Breakfast test and house style.** Family-friendly. Sentence case, usually 2 to 7 words (10 at most), no full stop at the end. Single quotes only; no double quotes, braces, backslashes, <, > or &.

## Standfirst

`<phrase>, and <phrase>. Medium.`: two of the grid's final clues as noun phrases. Leave it alone unless it quotes a clue you changed (the validator tells you), or the grid is new. It must not contain any answer from the grid.

## Output: changes only

```json
[{"file":"2027-01-20-crossword-mini-0193.html",
  "clues":{"order":"…","die":"Perish"},
  "md":["order"],
  "standfirst":"…, and …. Medium."}]
```

- `clues`: only the answers you changed (every answer for a new grid).
- `md`: always, the grid's one or two misdirection/double-definition answers.
- `standfirst`: only when it changes.
- Include every puzzle in your sheet, even one where you changed nothing (just `file` and `md`).

Run `node tools/mini-clue-batch.js --validate <batch dir> <your output>` until it reports 0 problems, then re-read your changes once as a solver.
