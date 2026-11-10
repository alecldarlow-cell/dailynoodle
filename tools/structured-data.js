'use strict';
/* Structured data (JSON-LD) for search engines and AI answer engines (10 Nov 2026).

   Run by tools/build-site.js on the published artifact, after search-meta and
   puzzle-json, so it describes only what is actually live and never touches a
   source page. Each page gets at most one block, in <head>:

     <script type="application/ld+json" data-dn="ld">…</script>

   - Home (/):       WebSite + Organization (what the site is, who publishes it)
   - puzzles.html:   ItemList of today's daily puzzles
   - games.html:     ItemList of the published games
   - a puzzle page:  Game (name, type, rules line, date, free to play)
   - a game page:    VideoGame (browser, free)
   - a news piece:   NewsArticle (headline, dates, publisher)

   Lab items (badge) and anything dated after feed.today are skipped, as in the
   sitemap. The block is data only: nothing visible changes, and a second run
   replaces the block, so builds are repeatable. A new daily type needs no
   change here: names and rules come from search-meta.js TYPES.

   Usage: node tools/structured-data.js [siteDir]   (default _site)
*/
const fs = require('node:fs'), path = require('node:path');
const { TYPES, puzzleMeta } = require('./search-meta');

const ORIGIN = 'https://dailynoodle.co.uk';
const NAME = 'The Daily Noodle';
const IMAGE = ORIGIN + '/assets/share-card.png';
const LOGO = ORIGIN + '/icons/icon-512.png';
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'][Object.keys(TYPES).length] || String(Object.keys(TYPES).length);
const ABOUT = COUNT + ' free daily puzzles in British English, new every morning: a mini crossword, word and logic grids, geography and number quizzes. No adverts, and no account needed to play.';
const BLOCK = /\s*<script type="application\/ld\+json" data-dn="ld">[\s\S]*?<\/script>/g;

const ORG = { '@type': 'Organization', '@id': ORIGIN + '/#org', name: NAME, alternateName: 'Daily Noodle', url: ORIGIN + '/', logo: LOGO, email: 'contact@dailynoodle.co.uk' };
const PUBLISHER = { '@id': ORIGIN + '/#org' };
const day = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : '');
const live = (feed, it) => it && it.path && !it.badge && /^reports\/[\w.-]+\.html$/.test(it.path) && (!feed.today || !day(it.date) || it.date <= feed.today);
const clean = o => { for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null) delete o[k]; return o; };

function home() {
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': ORIGIN + '/#site', name: NAME, alternateName: 'Daily Noodle', url: ORIGIN + '/', description: ABOUT, inLanguage: 'en-GB', publisher: PUBLISHER },
    ORG,
    // "/" opens Puzzles (10 Nov 2026); this page's own address is /index.html, the News front page.
    { '@type': 'CollectionPage', '@id': ORIGIN + '/index.html#page', name: 'Noodle News', url: ORIGIN + '/index.html', inLanguage: 'en-GB', isPartOf: { '@id': ORIGIN + '/#site' } }
  ] };
}
function list(name, url, items) {
  return { '@context': 'https://schema.org', '@type': 'ItemList', name, url, numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.headline, url: ORIGIN + '/' + it.path })) };
}
function puzzle(it) {
  const meta = puzzleMeta(it), type = TYPES[it.type] || TYPES[String(it.headline || '').split(/\s/)[0].toLowerCase()];
  if (!meta || !type) return null;
  return clean({ '@context': 'https://schema.org', '@type': 'Game', name: it.headline, alternateName: type.title, description: type.rules,
    url: ORIGIN + '/' + it.path, datePublished: day(it.date), inLanguage: 'en-GB', genre: it.topic + ' puzzle', isAccessibleForFree: true,
    numberOfPlayers: { '@type': 'QuantitativeValue', value: 1 }, image: IMAGE, publisher: { ...ORG }, isPartOf: { '@type': 'WebSite', '@id': ORIGIN + '/#site', name: NAME, url: ORIGIN + '/' } });
}
function game(it) {
  return clean({ '@context': 'https://schema.org', '@type': 'VideoGame', name: it.headline, description: it.standfirst, url: ORIGIN + '/' + it.path,
    datePublished: day(it.date), dateModified: day(it.updated), inLanguage: 'en-GB', genre: it.topic, gamePlatform: 'Web browser', applicationCategory: 'Game',
    operatingSystem: 'Any', playMode: 'SinglePlayer', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' }, image: IMAGE, publisher: { ...ORG } });
}
function article(it) {
  const url = ORIGIN + '/' + it.path;
  return clean({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: String(it.headline || '').slice(0, 110), description: it.standfirst, url,
    mainEntityOfPage: url, datePublished: day(it.date), dateModified: day(it.updated) || day(it.date), inLanguage: 'en-GB', articleSection: it.topic,
    isAccessibleForFree: true, image: IMAGE, author: { '@type': 'Organization', name: 'Noodle News data desk', url: ORIGIN + '/' }, publisher: { ...ORG } });
}

/* Every page that gets a block, as [file, data]. */
function entries(feed) {
  const items = (feed.items || []).filter(it => live(feed, it));
  const order = Object.keys(TYPES), rank = it => { const i = order.indexOf(it.type); return i < 0 ? order.length : i; };   // the daily set's order
  const today = items.filter(it => it.kind === 'puzzle' && it.date === feed.today).sort((a, b) => rank(a) - rank(b));
  const games = items.filter(it => it.kind === 'game');
  const out = [['index.html', home()]];
  if (today.length) out.push(['puzzles.html', list("Today's daily puzzles", ORIGIN + '/puzzles.html', today)]);
  if (games.length) out.push(['games.html', list('Browser games', ORIGIN + '/games.html', games)]);
  for (const it of items) {
    const data = it.kind === 'puzzle' ? puzzle(it) : it.kind === 'game' ? game(it) : it.kind === 'report' ? article(it) : null;
    if (data) out.push([it.path, data]);
  }
  return out;
}
/* "<" can never appear raw, so nothing in a headline can close the script element. */
const serialise = data => JSON.stringify(data).replace(/</g, '\\u003c');
function updateHtml(html, data) {
  const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i);
  if (!head) throw new Error('structured-data: page has no head');
  const content = head[0].replace(BLOCK, '').replace(/\s*<\/head\s*>$/i, '\n<script type="application/ld+json" data-dn="ld">' + serialise(data) + '</script>\n</head>');
  return html.slice(0, head.index) + content + html.slice(head.index + head[0].length);
}
function write(out) {
  const feed = JSON.parse(fs.readFileSync(path.join(out, 'feed.json'), 'utf8'));
  let count = 0;
  for (const [file, data] of entries(feed)) {
    const target = path.join(out, file);
    if (!fs.existsSync(target)) continue;
    fs.writeFileSync(target, updateHtml(fs.readFileSync(target, 'utf8'), data)); count++;
  }
  console.log('structured-data: ' + count + ' published pages described for search');
  return count;
}

module.exports = { ABOUT, entries, updateHtml, serialise, write, home, puzzle, game, article };
if (require.main === module) write(path.resolve(process.argv[2] || '_site'));
