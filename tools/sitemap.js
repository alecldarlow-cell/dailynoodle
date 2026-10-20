#!/usr/bin/env node
/* sitemap.xml and robots.txt (20 Oct 2026).

   Written into the built site by tools/build-site.js, after the copy, so they
   list only what is actually published: the three front pages plus every
   feed item whose file is in the site. Forward-dated files the feed holds back
   are not in _site, so they can never be listed (answers stay hidden).
   Left out: Lab items ("In development" badge), board, admin, privacy, 404 and
   the short links (those carry noindex). robots.txt blocks nothing: admin and
   board already carry noindex, and blocking them could stop link-preview
   crawlers fetching league invite previews. Nothing is committed at the repo root.

   Usage: node tools/sitemap.js [siteDir]     (default _site; reads siteDir/feed.json)
*/
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://dailynoodle.co.uk';
const FRONT = ['', 'puzzles.html', 'games.html'];   // '' = the News front page, /

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : '');

function entries(site) {
  const feed = JSON.parse(fs.readFileSync(path.join(site, 'feed.json'), 'utf8'));
  const today = day(feed.today);
  const out = FRONT.map(p => ({ loc: ORIGIN + '/' + p, lastmod: today }));
  for (const it of feed.items || []) {
    if (!it || !it.path || it.badge) continue;
    const rel = String(it.path).replace(/^\/+/, '');
    if (!/^reports\/[^/]+\.html$/.test(rel) || !fs.existsSync(path.join(site, rel))) continue;
    out.push({ loc: ORIGIN + '/' + rel, lastmod: day(it.updated) || day(it.date) });
  }
  return out;
}

function write(site) {
  const list = entries(site);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    list.map(e => '  <url><loc>' + esc(e.loc) + '</loc>' + (e.lastmod ? '<lastmod>' + e.lastmod + '</lastmod>' : '') + '</url>').join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(site, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(site, 'robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: ' + ORIGIN + '/sitemap.xml\n');
  return list.length;
}

module.exports = { write, entries };
if (require.main === module) console.log(`sitemap: ${write(path.resolve(process.argv[2] || '_site'))} URL(s)`);
