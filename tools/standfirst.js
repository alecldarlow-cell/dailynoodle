#!/usr/bin/env node
/* The puzzle cards' one-line descriptions (dn:standfirst, copied to og:description).
   Alec, 7 Nov 2026: a hook in plain words, then what you do; no rules and few numbers
   (the rules live in How to play). The batch builders, the Pinwheel clean-up and the
   Doku tools all take their wording from here, so new days say the same thing.

     node tools/standfirst.js --apply [--from YYYY-MM-DD] [--dry]
       rewrites the two meta lines (dn:standfirst, og:description) of every forthcoming
       puzzle from --from (default tomorrow, London) in the new voice.
     node tools/standfirst.js --apply --all [--dry]
       the same for every daily puzzle page, released ones included (Alec, 7 Nov 2026:
       the Archive should match). Then rebuild the feed (node tools/build-feed.js).
     node tools/standfirst.js --sync | --check
       writes (or checks) the start pages' house-line block in the engines (see houseBlock).
     Nothing else in a file changes (masked diff), and ids, dates and paths never do. */
const fs = require('fs');
const path = require('path');

const TEXT = {
  mini: 'A crossword small enough for a coffee break. Fill every square from the clues.',
  doku: 'A crossword with no clues. Place every letter so each line spells a word.',
  sweep: 'Find the mines with logic alone. Flag them, then clear the grid.',
  path: 'One unbroken trail from 1 to 36. Tap square by square to build it.',
  tangle: 'Search for words before the clock runs out. The longer, the better.',
  borders: 'Name the country from its outline. Size, sea and shape are your clues.',
  reckon: 'Guesstimate your way to winning. What do you reckon?',
  tally: 'Sudoku with a maths twist. Can you make every cage hit its number?',
  tilt: 'Turn the maze and the ball rolls. Get it out as fast as you can.',
  redact: "There's a crossword hiding in here. Black out the letters that don't belong to find it.",
  tumbler: "Today's word is hidden in four wheels of letters. Give them a spin and close in on it.",
  cryptic: 'One cryptic clue a day. Find the definition, crack the wordplay.',
};
const WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
/* Link keeps its daily twist: how many tiles are bluffing (the traps). */
function link(n) {
  const base = 'Four hidden groups. Can you find the links?';
  if (!n) return base;
  return `${base} Today, ${n === 1 ? 'one tile is' : `${WORD[n].toLowerCase()} tiles are`} bluffing.`;
}
/* Mini: one fixed line like every other type (Alec, 7 Nov 2026, evening: the daily two-clue
   teaser didn't match the others). Whatever a clue tool passes in, the card gets the house line. */
function mini() {
  return TEXT.mini;
}

const TYPE_OF = [
  [/-crossword-mini-\d+\.html$/, 'mini'], [/-logic-doku-\d+\.html$/, 'doku'], [/-logic-sweep(?:-\d+)?\.html$/, 'sweep'],
  [/-logic-path-\d+\.html$/, 'path'], [/-word-link-\d+\.html$/, 'link'], [/-word-tangle-\d+\.html$/, 'tangle'],
  [/-geo-borders-\d+\.html$/, 'borders'], [/-quiz-reckon-\d+\.html$/, 'reckon'], [/-logic-tally-\d+\.html$/, 'tally'],
  [/-logic-tilt-\d+\.html$/, 'tilt'], [/-word-redact-\d+\.html$/, 'redact'], [/-word-tumbler-\d+\.html$/, 'tumbler'],
  [/-word-cryptic-\d+\.html$/, 'cryptic'],
  // three July 2026 pages from before the dated names
  [/^digi-path-\d+\.html$/, 'path'], [/^digi-doku-\d+\.html$/, 'doku'], [/^DP-SWEEP-\d{4}-\d{2}-\d{2}\.html$/, 'sweep'],
];
const typeOf = f => (TYPE_OF.find(([re]) => re.test(f)) || [])[1] || null;
const SF_RE = /(<meta name="dn:standfirst"\s+content=")([^"]*)(")/;
const OG_RE = /(<meta property="og:description"\s+content=")([^"]*)(")/;
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function trapCount(s) {
  const i = s.indexOf('window.DN_PUZZLE'); if (i < 0) return null;
  const m = s.slice(i).match(/traps:\s*\[([\s\S]*?)\n\s*\]/);
  return m ? (m[1].match(/\{\s*tile:/g) || []).length : 0;
}
/* The new standfirst for one page's source, or null if the type isn't covered. */
function forPage(file, s) {
  const t = typeOf(file); if (!t) return null;
  if (t === 'mini') return SF_RE.test(s) ? TEXT.mini : null;
  if (t === 'link') { const n = trapCount(s); return n == null ? null : link(n); }
  return TEXT[t];
}
/* Only the two meta lines change; og:description is kept equal to the standfirst. */
function rewrite(file, s) {
  const sf = forPage(file, s); if (sf == null) return s;
  const v = attr(sf);
  let out = s.replace(SF_RE, (m, a, b, c) => a + v + c);
  if (OG_RE.test(out)) out = out.replace(OG_RE, (m, a, b, c) => a + v + c);
  const mask = x => x.replace(SF_RE, '$1$3').replace(OG_RE, '$1$3');
  if (mask(out) !== mask(s)) throw new Error(file + ': masked diff — something beyond the two meta lines changed');
  return out;
}

function londonDay(offset = 0) {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const d = new Date(t + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}

/* The start pages' house line (Alec, 8 Nov 2026): every puzzle's open page shows its card line,
   and the old rule sentence leads How to play. The players can't require this file, so
   `--sync` writes one generated block, from TEXT and link() above, into each engine that draws
   a start page; `--check` exits 1 if a block is stale (unit STANDFIRST-06). The block works the
   line out from the puzzle itself (Link: its traps), so a page whose card line is pinned as
   reviewed legacy (Doku 32) still opens on the house line. */
const HOUSE_FILES = ['engines/house.js', 'engines/tangle.js', 'engines/borders.js', 'engines/reckon.js'];
const BLOCK_RE = /\/\* house-line:start[^]*?house-line:end \*\//;
function houseBlock() {
  const base = link(0);
  return '/* house-line:start (generated by tools/standfirst.js --sync: edit the wording there) */\n' +
    'var dnHouseLine = (function () {\n' +
    '  var TEXT = ' + JSON.stringify(TEXT) + ';\n' +
    '  var WORD = ' + JSON.stringify(WORD) + ';\n' +
    '  return function (type, P) {\n' +
    '    if (type !== \'link\') return TEXT[type] || \'\';\n' +
    '    var n = ((P && P.traps) || []).length;\n' +
    '    return n ? ' + JSON.stringify(base) + ' + \' Today, \' + (n === 1 ? \'one tile is\' : WORD[n].toLowerCase() + \' tiles are\') + \' bluffing.\' : ' + JSON.stringify(base) + ';\n' +
    '  };\n' +
    '})();\n' +
    '/* house-line:end */';
}
/* Each engine's file with its block brought up to date (throws if the file has no block). */
function syncHouse(src, file) {
  if (!BLOCK_RE.test(src)) throw new Error(file + ': no house-line block');
  return src.replace(BLOCK_RE, () => houseBlock());
}

module.exports = { TEXT, link, mini, forPage, rewrite, typeOf, houseBlock, syncHouse, HOUSE_FILES };

if (require.main === module) {
  const args = process.argv.slice(2), val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  if (args.includes('--sync') || args.includes('--check')) {
    let stale = 0;
    for (const rel of HOUSE_FILES) {
      const p = path.join(__dirname, '..', rel), src = fs.readFileSync(p, 'utf8'), out = syncHouse(src, rel);
      if (out === src) continue;
      stale++;
      if (args.includes('--sync')) { fs.writeFileSync(p, out); console.log('synced ' + rel); } else console.error('stale house line: ' + rel);
    }
    process.exit(args.includes('--check') && stale ? 1 : 0);
  }
  if (!args.includes('--apply')) { console.log('usage: node tools/standfirst.js --apply [--from YYYY-MM-DD] [--dry]'); process.exit(2); }
  const all = args.includes('--all'), from = val('--from') || londonDay(1), dry = args.includes('--dry');
  if (!all && from <= londonDay(0)) { console.error('refusing: ' + from + ' is today or earlier (use --all to include released days)'); process.exit(2); }
  const REPORTS = path.join(__dirname, '..', 'reports'), counts = {};
  const pick = f => all ? !!typeOf(f) : /^\d{4}-\d{2}-\d{2}-/.test(f) && f.slice(0, 10) >= from;
  for (const f of fs.readdirSync(REPORTS).filter(pick).sort()) {
    const t = typeOf(f); if (!t) continue;
    const p = path.join(REPORTS, f), s = fs.readFileSync(p, 'utf8'), out = rewrite(f, s);
    if (out === s) continue;
    if (!dry) {
      fs.writeFileSync(p, out);
      const back = fs.readFileSync(p, 'utf8'), want = attr(forPage(f, s));
      if ((back.match(SF_RE) || [])[2] !== want) throw new Error(f + ': re-read mismatch');
    }
    counts[t] = (counts[t] || 0) + 1;
  }
  console.log((dry ? 'would rewrite ' : 'rewrote ') + JSON.stringify(counts) + (all ? ' (every page)' : ' from ' + from));
}
