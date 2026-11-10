'use strict';
/* One guide page per daily puzzle type, and the links to them (10 Nov 2026).

   Run by tools/build-site.js on the built site, after puzzle-discovery (so the
   Play buttons already point at today's files) and before search-meta.
   For each type it writes  _site/how-to-play/<type>.html  from that type's
   section of how-to-play.html, so the rules, example and tip are written once,
   in how-to-play.html, and can never drift. Around the section it adds what a
   page of its own needs: a search title and description, an <h1>, a line saying
   what the puzzle is, a short "Good to know" list and links on to the archive,
   the full guide and About. The pill row links the nine pages to each other.

   how-to-play.html itself keeps working exactly as before (the cards, the
   finish sheets and the app open it at #<type>); in the built copy each section
   gains one "More about <Type>" link to its page.

   Nothing is committed: the pages exist only in _site, like the short links.
   A new daily type needs an entry in PAGES here (the unit test fails if this
   list and search-meta.js TYPES differ) and a section in how-to-play.html.

   Usage: node tools/guide-pages.js [siteDir]   (default _site)
*/
const fs = require('node:fs'), path = require('node:path');
const { TYPES } = require('./search-meta');

const ORIGIN = 'https://dailynoodle.co.uk';
const DIR = 'how-to-play';
const FREE = 'Free, no adverts, no account needed';
const DAILY = 'Every day, just after midnight UK time';
const LOGIC = 'One answer, found by logic alone';
const PAGES = {
  mini: { h1: 'Mini: a daily mini crossword', title: 'Mini: Daily Mini Crossword, Rules and How to Play',
    lede: 'A crossword small enough for a coffee break. Clues across and down, one new grid every day, free to play in your browser.',
    facts: [['Grid', 'A small crossword, five squares across'], ['Scored by', 'Your time']], aka: 'Mini crossword, quick crossword' },
  doku: { h1: 'Doku: a daily letter logic puzzle', title: 'Doku: Daily Letter Logic Puzzle, Rules and How to Play',
    lede: 'A crossword with no clues. Place every letter from the bank so that each line across and down spells a real word.',
    facts: [['Grid', 'Five by five, with some letters given'], ['Solving', LOGIC], ['Scored by', 'Your time']], aka: 'Word sudoku, clueless crossword' },
  sweep: { h1: 'Sweep: daily minesweeper with no guessing', title: 'Sweep: Daily No-Guess Minesweeper, Rules and How to Play',
    lede: 'Find the mines with logic alone. Every Sweep grid can be solved without a single guess, and there is a new one every day.',
    facts: [['Grid', 'Six by six'], ['Solving', LOGIC], ['Scored by', 'Your time, if you clear the grid']], aka: 'Minesweeper, no-guess minesweeper' },
  path: { h1: 'Path: a daily number path puzzle', title: 'Path: Daily Number Path Puzzle, Rules and How to Play',
    lede: 'One unbroken trail from 1 to 36. Join the numbers in order through every square of the grid, with a few given to start you off.',
    facts: [['Grid', 'Six by six, numbered 1 to 36'], ['Solving', LOGIC], ['Scored by', 'Your time']], aka: 'Number path, number maze' },
  link: { h1: 'Link: a daily word groups puzzle', title: 'Link: Daily Word Groups Puzzle, Rules and How to Play',
    lede: 'Sixteen words, four hidden groups of four. Find what links them, and watch out for the words that seem to fit somewhere else.',
    facts: [['Board', 'Sixteen word tiles, four groups'], ['Scored by', 'Your guesses and your time']], aka: 'Word groups, connecting words' },
  tangle: { h1: 'Tangle: a daily 90-second word grid', title: 'Tangle: Daily Word Grid Game, Rules and How to Play',
    lede: 'Search a grid of letters for as many words as you can before the clock runs out. The longer the word, the more it scores.',
    facts: [['Board', 'Four by four letters, 90 seconds'], ['Scored by', 'Points for every word found'], ['Plays', 'One round a day']], aka: 'Word grid, word search against the clock' },
  borders: { h1: 'Borders: a daily country outline quiz', title: 'Borders: Daily Country Outline Quiz, Rules and How to Play',
    lede: 'Name the country from its outline. Ten countries a day, from the easy to the obscure, with four answers to choose from.',
    facts: [['Round', 'Ten countries'], ['Scored by', 'Correct answers out of ten, and points']], aka: 'Country shapes quiz, geography quiz' },
  reckon: { h1: 'Reckon: a daily estimation quiz', title: 'Reckon: Daily Estimation Quiz, Rules and How to Play',
    lede: 'Guesstimate your way to a score. Ten numbers to estimate from all sorts of topics: the closer you get, the more you score.',
    facts: [['Round', 'Ten questions'], ['Scored by', 'Points for how close you are']], aka: 'Estimation quiz, guesstimate game' },
  tally: { h1: 'Tally: a daily calcudoku puzzle', title: 'Tally: Daily Calcudoku Puzzle, Rules and How to Play',
    lede: 'Sudoku with a maths twist. Fill a four by four grid with 1 to 4 so that every outlined cage makes its number.',
    facts: [['Grid', 'Four by four, numbers 1 to 4'], ['Solving', LOGIC], ['Scored by', 'Your time']], aka: 'Calcudoku, maths sudoku' }
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rel = type => DIR + '/' + type + '.html';

/* The <section id="type"> … </section> of the guide, whole. */
function section(guide, type) {
  const m = guide.match(new RegExp('<section class="guide-panel" id="' + type + '"[\\s\\S]*?</section>'));
  if (!m) throw new Error('guide-pages: how-to-play.html has no section for ' + type);
  return m[0];
}
function page(guide, type) {
  const meta = PAGES[type], name = TYPES[type].name, url = ORIGIN + '/' + rel(type);
  const head = guide.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i);
  const mast = guide.match(/<header class="mast">[\s\S]*?<\/header>/);
  const sections = guide.match(/<div class="sections"[\s\S]*?<\/div>/);
  if (!head || !mast || !sections) throw new Error('guide-pages: how-to-play.html has lost its head, masthead or section row');
  const description = meta.lede + (section(guide, type).includes('class="guide-example"') ? ' Rules, a worked example and a first move.' : ' Rules and a first move.');
  const headHtml = head[0]
    .replace(/<meta charset="UTF-8">/i, '<meta charset="UTF-8">\n<base href="/">')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/i, '<title>' + esc(meta.title) + ' | Daily Noodle</title>')
    .replace(/(<meta name="description" content=")[^"]*(")/, '$1' + esc(description) + '$2')
    .replace(/(<meta property="og:title" content=")[^"]*(")/, '$1' + esc(meta.h1) + ' — The Daily Noodle$2')
    .replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + esc(meta.lede) + '$2')
    .replace(/(<meta property="og:url" content=")[^"]*(")/, '$1' + url + '$2')
    .replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + url + '$2');
  if (!headHtml.includes('<base href="/">') || !headHtml.includes('href="' + url + '"')) throw new Error('guide-pages: could not address the page for ' + type);
  const chips = Object.keys(PAGES).map(t => '        <a class="chip" href="' + rel(t) + '"' + (t === type ? ' aria-current="true"' : '') + '>' + TYPES[t].name + '</a>').join('\n');
  // The section as written, with its heading promoted to the page's <h1>.
  const body = section(guide, type)
    .replace(/<section class="guide-panel" id="[^"]*" aria-labelledby="[^"]*">/, '<section class="guide-panel guide-solo" id="' + type + '" aria-labelledby="' + type + '-title">')
    .replace(/<h2 id="([^"]*)" tabindex="-1">[\s\S]*?<\/h2>/, '<h1 id="$1">' + esc(meta.h1) + '</h1>')
    .replace(/(<p class="guide-intro">)[\s\S]*?(<\/p>)/, '$1' + esc(meta.lede) + '$2');
  if (!body.includes('<h1 id="' + type + '-title">')) throw new Error('guide-pages: no heading to promote for ' + type);
  const facts = [['New puzzle', DAILY], ...meta.facts, ['Cost', FREE], ['Also known as', meta.aka]]
    .map(([k, v]) => '        <div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('\n');
  return '<!DOCTYPE html>\n<html lang="en" data-section="puzzles">\n' + headHtml + '\n<body class="guide-page">\n<div class="wrap">\n  ' + mast[0] + '\n\n'
    + '  <nav class="controls" aria-label="Sections and puzzle guides">\n    <div class="bar">\n      ' + sections[0] + '\n    </div>\n'
    + '    <div class="chips" id="guide-pills" role="group" aria-label="Puzzle type">\n' + chips + '\n    </div>\n  </nav>\n\n'
    + '  <main id="guide-content">\n    ' + body + '\n'
    + '    <section class="guide-more" aria-labelledby="facts-title">\n      <h2 id="facts-title">Good to know</h2>\n      <dl class="guide-facts">\n' + facts + '\n      </dl>\n'
    + '      <p class="guide-links"><a href="archive.html">Every past ' + name + ' in the archive ›</a></p>\n'
    + '      <p class="guide-links"><a href="how-to-play.html">How to play every puzzle ›</a></p>\n    </section>\n  </main>\n\n'
    + '  <footer class="foot">\n    <p class="privacy"><a href="puzzles.html">← All puzzles</a> · <a href="about.html">About</a> · <a href="privacy.html">Privacy</a> · <a href="mailto:contact@dailynoodle.co.uk">Contact us</a></p>\n  </footer>\n</div>\n'
    + '<script src="dn-track.js" defer></script>\n</body>\n</html>\n';
}
/* The built copy of the full guide: one link from each section to its own page. */
function linkGuide(guide) {
  let out = guide.replace(/\s*<p class="guide-links"><a href="how-to-play\/[a-z]+\.html">[^<]*<\/a><\/p>/g, '');
  for (const type of Object.keys(PAGES)) {
    const old = section(out, type);
    out = out.replace(old, old.replace(/\s*<\/section>$/, '\n      <p class="guide-links"><a href="' + rel(type) + '">More about ' + TYPES[type].name + ' ›</a></p>\n    </section>'));
  }
  return out;
}
function write(out) {
  const file = path.join(out, 'how-to-play.html');
  if (!fs.existsSync(file)) return 0;
  const guide = fs.readFileSync(file, 'utf8').replace(/\s*<p class="guide-links"><a href="how-to-play\/[a-z]+\.html">[^<]*<\/a><\/p>/g, '');
  fs.mkdirSync(path.join(out, DIR), { recursive: true });
  for (const type of Object.keys(PAGES)) fs.writeFileSync(path.join(out, rel(type)), page(guide, type));
  fs.writeFileSync(file, linkGuide(guide));
  console.log('guide-pages: ' + Object.keys(PAGES).length + ' type pages written to ' + DIR + '/');
  return Object.keys(PAGES).length;
}

module.exports = { PAGES, DIR, rel, page, linkGuide, write };
if (require.main === module) write(path.resolve(process.argv[2] || '_site'));
