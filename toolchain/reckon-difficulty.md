# Reckon difficulty and scoring (3 Nov 2026)

Why: 88 rounds over Reckon's first 15 days had a median of 375, and only 15% reached 500. A typical guess was about 1.8× out. Alec wants a mean of about 600 so an ordinary round feels good.

**Rules 2 (`r:2` on a page, from `RULES2_FROM` in `tools/build-reckon-batch.js`).** Zones 20% / 60% / 2.2× / 3×, points 100 / 80 / 60 / 40, and 20 for a miss. The 3× edge is unchanged; the miss zone stays uncoloured but pays 20. The table lives in `RULES` in `engines/reckon.js` and is chosen by the page, so a released day is always scored as it was played. Days without `r` keep rules 1, Ballpark's own. Ballpark itself is unchanged. A page never changes rules once released.

**Daily mix.** At least 4 of the 10 facts come from `tools/reckon-easy.json` (a pack short of other facts can make it 5); the opener is one of them. On rules 2 pages easy facts carry `t:1`. Answers sit 0.21–1.79 decades up the scale, so the wider zones stay on it.

**The easy list.** Played facts averaging 50+ points on rules 1, and unplayed ones rated to score 60+. A blind rating of the 150 played questions spotted easy ones but couldn't separate medium from hard (real averages 51, 34, 29), so there is no hard tier. On 75 held-out questions, facts rated 60+ averaged 43 points against 31. Refresh the list from `public.events` zones as facts get played.

**Extra facts.** `tools/reckon-extra-facts.json`: 65 Reckon-only easy facts, ids `<pack>:r<n>`, because Ballpark's packs stay at 100. Append only.

**Exclusions.** 39 facts left out on 3 Nov for being nearly always more than 3× out, plus body:78 from that day's fact check. They stay in Ballpark.

**Estimate.** Mean about 600, about 1 round in 6 under 500, on the guesses of 3 signed-in players scaled to all rounds. Never moving the slider averages 480 across rules 2 days. Review live scores after two weeks; change the mix first, scoring last.
