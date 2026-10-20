#!/usr/bin/env node
/* Digi Puzzles — one engine per puzzle type (pilot: Mini, 15 Oct 2026).

   Every Mini used to carry its own copy of the player: ~11 KB of CSS and
   ~63 KB of script, identical in 761 of 764 files, around ~2 KB of puzzle
   data. This moves the shared part into one file per type and leaves each
   puzzle as a thin page with its data:

     engines/mini.css    the player's styles   (was the page's <style>)
     engines/mini.js     the player's script   (was the page's <script>,
                         with its data object replaced by window.DN_PUZZLE)
     reports/…-crossword-mini-0100.html
                         head + metas (feed, tracker) + body markup, then
                         <script>window.DN_PUZZLE={…}</script>
                         <script src="../engines/mini.js"></script>

   What does NOT change, by design:
   - URLs. Every puzzle keeps its file name.
   - Saved progress. The engine is the same code, so it reads and writes the
     same localStorage keys (digi-mini-v1, streaks) with the same puzzle ids.
   - The feed: build-feed.js still finds grid:[[…]] in the page.
   - Tracking: the same element ids, so dn-track.js works unchanged.

   Safety: a file is converted only if its CSS and its script (with the data
   object taken out) are byte-identical to the engine's. Anything else — the
   three July prototypes, a puzzle from a newer template — is left exactly as
   it is and reported, so it keeps working self-contained.

   Usage:  node tools/engine-shells.js mini --extract   write engines/mini.* from the newest Mini
           node tools/engine-shells.js mini              convert matching Minis to thin pages
           node tools/engine-shells.js mini --dry        report only
           node tools/engine-shells.js mini --check      exit 1 if a convertible Mini is still full-size

   To change the player later, edit engines/mini.js (or .css) once. A puzzle
   uploaded from the old self-contained template is converted on push by the
   build workflow if its player matches the engine; if not, it stays as it is.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const ENGINES = path.join(ROOT, 'engines');

// Per type: which files, and how the page declares its puzzle data. Multi-line
// objects end at the first "\n};" (inner lines are indented); single-line ones
// are the whole line.
const TYPES = {
  mini: {
    match: /^\d{4}-\d{2}-\d{2}-crossword-mini-\d+\.html$/,
    data: /\nconst SAMPLE=(\{[\s\S]*?\n\});\n/,
    dataDecl: '\nconst SAMPLE=window.DN_PUZZLE;\n',
  },
  doku: {
    match: /^\d{4}-\d{2}-\d{2}-logic-doku-\d+\.html$/,
    data: /\nconst SAMPLE = (\{[\s\S]*?\n\});\n/,
    dataDecl: '\nconst SAMPLE = window.DN_PUZZLE;\n',
  },
  sweep: {
    match: /^\d{4}-\d{2}-\d{2}-logic-sweep\.html$/,
    data: /\nconst SAMPLE=(\{[\s\S]*?\n\});\n/,
    dataDecl: '\nconst SAMPLE=window.DN_PUZZLE;\n',
  },
  link: {
    match: /^\d{4}-\d{2}-\d{2}-word-link-\d+\.html$/,
    data: /\nconst SAMPLE = (\{[\s\S]*?\n\});\n/,
    dataDecl: '\nconst SAMPLE = window.DN_PUZZLE;\n',
  },
  path: {
    match: /^\d{4}-\d{2}-\d{2}-logic-path-\d+\.html$/,
    data: /\nconst PUZZLE = (\{[\s\S]*?\n\});\n/,
    dataDecl: '\nconst PUZZLE = window.DN_PUZZLE;\n',
  },
  tangle: {
    match: /^\d{4}-\d{2}-\d{2}-word-tangle-\d+\.html$/,
    data: /\nconst PUZZLE=(\{[^\n]*\});\n/,
    dataDecl: '\nconst PUZZLE=window.DN_PUZZLE;\n',
  },
  borders: {
    match: /^\d{4}-\d{2}-\d{2}-geo-borders-\d+\.html$/,
    data: /\nconst PUZZLE=(\{[^\n]*\});\n/,
    dataDecl: '\nconst PUZZLE=window.DN_PUZZLE;\n',
  },
  // Reckon (20 Oct 2026) ships as thin pages from day one (tools/build-reckon-batch.js); listed so
  // every type is checked the same way.
  reckon: {
    match: /^\d{4}-\d{2}-\d{2}-quiz-reckon-\d+\.html$/,
    data: /\nconst PUZZLE=(\{[^\n]*\});\n/,
    dataDecl: '\nconst PUZZLE=window.DN_PUZZLE;\n',
  },
};

const STYLE = /<style>([\s\S]*?)<\/style>/;
const SCRIPT = /<script>([\s\S]*?)<\/script>/;   // the one inline (player) script

function parts(html, t) {
  const st = html.match(STYLE), sc = html.match(SCRIPT);
  if (!st || !sc) return null;
  if (html.split('<style>').length !== 2 || html.split('<script>').length !== 2) return null;
  const d = sc[1].match(t.data);
  if (!d) return null;
  return { css: st[1], js: sc[1].replace(t.data, () => t.dataDecl), data: d[1], st, sc };
}

function banner(type, from) {
  return `/* Digi Puzzles — ${type} engine. One copy serves every ${type} page in reports/.
   Extracted ${new Date().toISOString().slice(0, 10)} from ${from} by tools/engine-shells.js.
   The page supplies its puzzle as window.DN_PUZZLE before loading this file.
   Edit here to change every ${type}; keep element ids and localStorage keys
   stable (dn-track.js and players' saved progress depend on them). */\n`;
}

function engineFiles(type) {
  return { css: path.join(ENGINES, type + '.css'), js: path.join(ENGINES, type + '.js') };
}
function stripBanner(s) { return s.replace(/^\/\* Digi Puzzles — [\s\S]*?\*\/\n/, ''); }

function shell(html, p, type) {
  const head = `<link rel="stylesheet" href="../engines/${type}.css">`;
  const data = `<script>\n/* This puzzle's data. The player is ../engines/${type}.js, shared by every ${type}. */\n`
             + `window.DN_PUZZLE=${p.data};\n</script>\n<script src="../engines/${type}.js"></script>`;
  return html.replace(p.st[0], () => head).replace(p.sc[0], () => data);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const type = args[0];
  const t = TYPES[type];
  if (!t) { console.error('usage: node tools/engine-shells.js <' + Object.keys(TYPES).join('|') + '> [--extract|--dry|--check]'); process.exit(2); }
  const files = fs.readdirSync(REPORTS).filter(f => t.match.test(f)).sort();
  const ef = engineFiles(type);

  if (args.includes('--extract')) {
    // The newest full-size puzzle of this type is the reference player.
    const src = files.slice().reverse().find(f => !fs.readFileSync(path.join(REPORTS, f), 'utf8').includes(`../engines/${type}.js`));
    const p = src && parts(fs.readFileSync(path.join(REPORTS, src), 'utf8'), t);
    if (!p) { console.error('no full-size ' + type + ' to extract from'); process.exit(2); }
    fs.mkdirSync(ENGINES, { recursive: true });
    fs.writeFileSync(ef.css, banner(type, src) + p.css);
    fs.writeFileSync(ef.js, banner(type, src) + p.js);
    console.log(`wrote ${path.relative(ROOT, ef.css)} and ${path.relative(ROOT, ef.js)} from ${src}`);
    process.exit(0);
  }

  if (!fs.existsSync(ef.js)) { console.error('no engine yet: run with --extract first'); process.exit(2); }
  const engCss = stripBanner(fs.readFileSync(ef.css, 'utf8'));
  const engJs = stripBanner(fs.readFileSync(ef.js, 'utf8'));
  const CHECK = args.includes('--check'), DRY = args.includes('--dry');
  let converted = 0, already = 0, different = 0;
  const diffs = [];
  for (const f of files) {
    const p0 = path.join(REPORTS, f);
    const html = fs.readFileSync(p0, 'utf8');
    if (html.includes(`../engines/${type}.js`)) { already++; continue; }
    const p = parts(html, t);
    if (!p || p.css !== engCss || p.js !== engJs) { different++; diffs.push(f); continue; }
    converted++;
    if (!DRY && !CHECK) fs.writeFileSync(p0, shell(html, p, type));
  }
  const verb = CHECK ? 'still full-size' : DRY ? 'would convert' : 'converted';
  console.log(`${type}: ${verb} ${converted}, already on the engine ${already}, left self-contained (player differs) ${different}`);
  diffs.slice(0, 20).forEach(f => console.log('  self-contained: ' + f));
  if (CHECK && converted) process.exit(1);
}

module.exports = { TYPES, parts, shell };
