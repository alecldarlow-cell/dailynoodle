#!/usr/bin/env node
/* The Daily Noodle — assemble the folder GitHub Pages publishes.

   Run by .github/workflows/build-feed.yml after the feed is built:

     DN_HELD_OUT=held.txt node tools/build-feed.js   # feed + list of held files
     node tools/build-site.js held.txt               # -> _site/

   The repo holds a year or more of forward-dated puzzles, answers included.
   Publishing the repo as-is put all of them on the live site. Instead, Pages
   now deploys _site/, which contains:

     - every site file at the root (pages, CSS, JS, feed.json, manifest)
     - icons/, assets/, engines/
     - reports/ minus every file the feed builder held back (dated after today
       in Europe/London), so a puzzle appears on the site on its own day

   and leaves out everything that isn't the site: tools/, toolchain/ (the news
   production kit and SQL), .github/, notes (*.md) and repo housekeeping.

   The nightly runs of the workflow release each day's files after midnight.
   Usage: node tools/build-site.js <held-list> [out-dir]
*/
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const heldFile = process.argv[2];
const OUT = path.resolve(ROOT, process.argv[3] || '_site');

if (!heldFile || !fs.existsSync(heldFile)) {
  console.error('build-site: pass the held list written by build-feed.js (DN_HELD_OUT)');
  process.exit(1);
}
const held = new Set(fs.readFileSync(heldFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean));

// Folders published whole, except reports/ which is filtered.
const DIRS = ['icons', 'assets', 'engines', 'reports'];
// Never published.
const SKIP_ROOT = new Set(['.git', '.github', 'tools', 'toolchain', 'node_modules', '_site', 'CNAME', '.gitignore', 'package.json', 'package-lock.json', 'playwright.config.js', 'registry.json', 'published.json']);
const SKIP_EXT = /\.(md|txt|py|pyc|sql|log)$/i;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let copied = 0, withheld = 0;
function copy(rel) {
  const dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), dst);
  copied++;
}

for (const name of fs.readdirSync(ROOT)) {
  if (SKIP_ROOT.has(name) || name === path.basename(heldFile)) continue;
  const stat = fs.statSync(path.join(ROOT, name));
  if (stat.isDirectory()) {
    if (!DIRS.includes(name)) continue;
    for (const file of fs.readdirSync(path.join(ROOT, name))) {
      const rel = name + '/' + file;
      if (!fs.statSync(path.join(ROOT, rel)).isFile()) continue;
      if (held.has(rel)) { withheld++; continue; }
      copy(rel);
    }
  } else if (name.startsWith('.') ? name === '.nojekyll' : !SKIP_EXT.test(name)) {
    copy(name);
  }
}

// Every held file must be one the repo actually has; a mismatch means the two
// tools disagree about paths, so fail rather than publish answers by accident.
for (const rel of held) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    console.error(`build-site: held path not found in repo: ${rel}`);
    process.exit(1);
  }
  if (fs.existsSync(path.join(OUT, rel))) {
    console.error(`build-site: held file was published: ${rel}`);
    process.exit(1);
  }
}
// Short links (dailynoodle.co.uk/mini …) that every puzzle share ends with; see tools/short-links.js.
require('./short-links').write(OUT);
// Search titles, descriptions and self-canonicals; source puzzle/card data stays intact.
require('./search-meta').write(OUT);
// sitemap.xml + robots.txt from what was actually published; see tools/sitemap.js.
require('./sitemap').write(OUT);
if (!fs.existsSync(path.join(OUT, 'index.html')) || !fs.existsSync(path.join(OUT, 'feed.json'))) {
  console.error('build-site: index.html or feed.json missing from the site');
  process.exit(1);
}
// Every card in the feed must open: its file has to be in the site.
const feed = JSON.parse(fs.readFileSync(path.join(OUT, 'feed.json'), 'utf8'));
const missing = (feed.items || []).map(i => i.path).filter(p => p && !fs.existsSync(path.join(OUT, p)));
if (missing.length) {
  console.error(`build-site: ${missing.length} feed item(s) not in the site, e.g. ${missing.slice(0, 3).join(', ')}`);
  process.exit(1);
}

// Publish counts and dates only; future puzzle content stays in the repository.
fs.writeFileSync(path.join(OUT,'publishing-health.json'),JSON.stringify(require('./publishing-health').snapshot(ROOT),null,1)+'\n');

console.log(`build-site: ${copied} file(s) published to ${path.relative(ROOT, OUT) || OUT}, ${withheld} held back until their day`);
