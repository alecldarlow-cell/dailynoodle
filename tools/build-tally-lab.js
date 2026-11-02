'use strict';
/* Writes the ten boards of the Tally Lab game (reports/2026-11-02-quiz-tally.html)
   from tools/tally.js, deterministically, and re-reads the page to prove the
   boards written are the boards the page holds.

     node tools/build-tally-lab.js            # stamp the page (only the PUZZLES line changes)
     node tools/build-tally-lab.js --check    # exit 1 if the page's boards fail the gate or differ

   Boards 1–2 are gentle openers (a few rounds of cage arithmetic and singles);
   3–10 sit in one medium band: no naked pairs needed, 5–8 solver rounds. Every
   board has 8–11 cages, four to eight of them two-cell, at least two of three
   or four cells, and at least one − or ÷ clue. Seeds are fixed
   ("tally-lab-<k>"), so the same ten come out every time; the page's boards are
   frozen once players have times on them (see SITE.md › Tally). */
const fs = require('fs'), path = require('path');
const T = require('./tally.js');
const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'reports', '2026-11-02-quiz-tally.html');
const LINE = /\nconst PUZZLES=(\[.*\]);\n/;

const BANDS = [
  { k: 2, test: g => g.rounds >= 3 && g.rounds <= 4 && g.hidden <= 2 && g.pairs === 0 }, // openers
  { k: 8, test: g => g.rounds >= 5 && g.rounds <= 8 && g.hidden <= 6 && g.pairs === 0 } // the band
];
function variety(p) {
  const twos = p.cages.filter(c => c.c.length === 2).length, bigs = p.cages.filter(c => c.c.length >= 3).length;
  return p.cages.some(c => c.op === '-' || c.op === '/') && twos >= 4 && twos <= 8 && bigs >= 2 &&
    p.cages.length >= 8 && p.cages.length <= 11 && p.cages.filter(c => c.op === '=').length <= 1;
}
function make() {
  const out = [], seen = new Set();
  let k = 0;
  for (const band of BANDS) {
    let got = 0;
    while (got < band.k) {
      k++;
      const p = T.generate('tally-lab-' + k);
      if (!p || !band.test(p.grade) || !variety(p)) continue;
      const fp = T.fingerprint(p); if (seen.has(fp)) continue; seen.add(fp);
      out.push({ n: p.n, cages: p.cages, sol: p.sol, seed: p.seed, band: out.length < 2 ? 'easy' : 'medium' });
      got++;
    }
  }
  return out;
}
function read() {
  const html = fs.readFileSync(PAGE, 'utf8'), m = html.match(LINE);
  if (!m) throw new Error('PUZZLES line not found in ' + PAGE);
  return { html, puzzles: JSON.parse(m[1]) };
}
function gate(list) {
  const errs = [];
  if (list.length !== 10) errs.push('expected 10 boards, found ' + list.length);
  const fps = new Set();
  list.forEach((p, i) => {
    for (const e of T.check(p)) errs.push('board ' + (i + 1) + ': ' + e);
    const fp = T.fingerprint(p); if (fps.has(fp)) errs.push('board ' + (i + 1) + ' repeats an earlier layout'); fps.add(fp);
    const g = T.grade(p); if (g && g.pairs) errs.push('board ' + (i + 1) + ' needs a naked pair');
  });
  return errs;
}
if (require.main === module) {
  const check = process.argv.includes('--check');
  if (check) {
    const { puzzles } = read(), errs = gate(puzzles), want = make();
    if (JSON.stringify(want) !== JSON.stringify(puzzles)) errs.push('page boards differ from the generator\'s');
    if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
    console.log('Tally Lab: 10 boards pass the gate and match the generator');
  } else {
    const list = make(), errs = gate(list);
    if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
    const { html } = read();
    const next = html.replace(LINE, '\nconst PUZZLES=' + JSON.stringify(list) + ';\n');
    fs.writeFileSync(PAGE, next);
    const back = read().puzzles;
    if (JSON.stringify(back) !== JSON.stringify(list)) { console.error('re-read differs'); process.exit(1); }
    console.log('wrote 10 boards:', list.map((p, i) => (i + 1) + ':' + p.seed + ' r' + T.grade(p).rounds).join(' '));
  }
}
module.exports = { make, gate, read, LINE };
