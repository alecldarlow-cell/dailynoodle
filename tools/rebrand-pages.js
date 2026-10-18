/* ---------------------------------------------------------------------------
   The Daily Noodle: rebrand the visible "Digi" wording in the puzzle pages.
   18 Oct 2026, approved by Alec: plain names (Doku, Sweep, ...), "← Puzzles".

     node tools/rebrand-pages.js <mini|doku|sweep|path|link|tangle|borders> [--dry|--check|--reverse]

   Literal, byte-reversible find/replace of whole markup strings only: the
   <title>, the home-screen name and manifest, the masthead, the result
   subtitle, the back links and two sentences of copy. Nothing in a <script>
   or a comment is touched, so the "Digi Puzzles: ..." markers the tools look
   for (tools/pinwheel-regen.js, engine-shells.js) stay as they are, and so do
   ids, filenames and localStorage keys.

   Reversible: a pattern is applied to a file only if its replacement text
   does not already occur there, so --reverse (new -> old) restores the file
   byte for byte.
--------------------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');
const [TYPE, MODE = ''] = process.argv.slice(2);
const DIR = path.join(__dirname, '..', 'reports');
const NAME = { mini: 'Mini', doku: 'Doku', sweep: 'Sweep', path: 'Path', link: 'Link', tangle: 'Tangle', borders: 'Borders' }[TYPE];
const MATCH = { mini: /-crossword-mini-\d+\.html$/, doku: /-logic-doku-\d+\.html$/, sweep: /-logic-sweep(-\d+)?\.html$/, path: /-logic-path-\d+\.html$/,
  link: /-word-link-\d+\.html$/, tangle: /-word-tangle-\d+\.html$/, borders: /-geo-borders-\d+\.html$/ }[TYPE];
if (!NAME) { console.error('usage: node tools/rebrand-pages.js <mini|doku|sweep|path|link|tangle|borders> [--dry|--check|--reverse]'); process.exit(2); }

const N = NAME, OLD = TYPE === 'mini' ? 'Noodle' : 'Digi';   // the Mini already says "The Noodle Mini" (18 Oct 2026)
const GRID = TYPE !== 'tangle' && TYPE !== 'borders';   // the five with the DP masthead
const ALL = [
  GRID && [`<title>${OLD} Puzzles — The ${OLD} ${N}</title>`, `<title>${N} — Noodle Puzzles</title>`],
  !GRID && [`<title>${N} — Digi Puzzles</title>`, `<title>${N} — Noodle Puzzles</title>`],
  [`<meta name="apple-mobile-web-app-title" content="${OLD} ${N}">`, `<meta name="apple-mobile-web-app-title" content="${N}">`],
  [`"name":"${OLD} Puzzles — The ${OLD} ${N}","short_name":"${OLD} ${N}"`, `"name":"${N} — Noodle Puzzles","short_name":"${N}"`],
  GRID && TYPE !== 'mini' && ['<span class="mh-name"><b>Digi</b><span class="accent">Puzzles</span></span>', '<span class="mh-name"><b>Noodle</b><span class="accent">Puzzles</span></span>'],
  TYPE === 'path' && ['<div class="mh-name">Digi<span class="accent">Puzzles</span></div>', '<div class="mh-name">Noodle<span class="accent">Puzzles</span></div>'],
  [`<span class="mh-eyebrow">The ${OLD} ${N}</span>`, `<span class="mh-eyebrow">${N}</span>`],
  [`<div class="mh-eyebrow">The ${OLD} ${N}</div>`, `<div class="mh-eyebrow">${N}</div>`],
  [`<div class="sub" id="winSub">The ${OLD} ${N}</div>`, `<div class="sub" id="winSub">${N}</div>`],
  ['<a class="back" href="../puzzles.html">← Digi Puzzles</a>', '<a class="back" href="../puzzles.html">← Puzzles</a>'],
  ["Today's other puzzles are on the Digi Puzzles page.", "Today's other puzzles are on the Puzzles page."],
  ['added to your atlas in Borderline, on Digi Games.', 'added to your atlas in Borderline, on Noodle Games.'],
  [`<footer>The Digi ${N} · gated at build, and again on load</footer>`, `<footer>${N} · gated at build, and again on load</footer>`],
];
const PAIRS = ALL.filter(Boolean);
// every replacement must be unique to one pattern, or --reverse could not tell them apart
if (new Set(PAIRS.map(x => x[1])).size !== PAIRS.length) throw new Error('two patterns share a replacement');

const count = (s, x) => s.split(x).length - 1;
const files = fs.readdirSync(DIR).filter(f => MATCH.test(f)).sort();
let changed = 0, skipped = 0;
const used = PAIRS.map(() => 0), left = new Map();
for (const f of files) {
  const p = path.join(DIR, f), src = fs.readFileSync(p, 'utf8');
  let out = src;
  PAIRS.forEach(([a, b], i) => {
    const [from, to] = MODE === '--reverse' ? [b, a] : [a, b];
    const n = count(out, from);
    if (!n) return;
    if (count(src, to)) { skipped++; console.log(`  skip ${f}: "${to.slice(0, 60)}" already there, so this one would not reverse`); return; }
    out = out.split(from).join(to); used[i] += n;
  });
  if (MODE !== '--reverse') {   // visible "Digi" left outside scripts and comments
    const vis = out.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    for (const m of vis.matchAll(/.{0,40}\bDigi\b.{0,40}/g)) { const k = m[0].trim(); left.set(k, (left.get(k) || 0) + 1); }
  }
  if (out !== src) { changed++; if (!MODE || MODE === '--reverse') fs.writeFileSync(p, out); }
}
console.log(`${TYPE}: ${files.length} pages, ${changed} ${MODE === '--dry' || MODE === '--check' ? 'would change' : 'changed'}${skipped ? `, ${skipped} skipped` : ''}`);
PAIRS.forEach(([a], i) => { if (used[i]) console.log(`  ${String(used[i]).padStart(5)} × ${a.slice(0, 90)}`); });
if (left.size) { console.log('  visible "Digi" still in the pages:'); for (const [k, n] of [...left].sort((x, y) => y[1] - x[1]).slice(0, 15)) console.log(`  ${String(n).padStart(5)} × ${k}`); }
if (MODE === '--check' && changed) process.exit(1);
