#!/usr/bin/env node
/* Short links to today's puzzle of each type (20 Oct 2026).

   Every puzzle share ends with "dailynoodle.co.uk/<type>" (engines/finish.js),
   so a result posted anywhere gives a newcomer one tap to play. This writes
   <out>/<type>/index.html for each type: a tiny page that reads
   puzzles-today.json and replaces itself with today's puzzle of that type,
   tagged ?via=share so arrivals show in the tracker. If the list can't load
   it goes to the Puzzles page instead. It carries the site's link-preview tags
   (WhatsApp doesn't run scripts), and nothing else, so it adds no tracking of
   its own: the puzzle page records the visit.

   Games (20 Oct 2026): each published game gets one too, dailynoodle.co.uk/<slug>
   (slug from the file name, e.g. bubble-burst; ALIAS shortens a few), opening
   that game tagged ?via=share. engines/game-share.js shares these.

   Run by tools/build-site.js into _site/; nothing is committed to the repo root.
   Usage: node tools/short-links.js [outDir]      (default _site)
*/
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://dailynoodle.co.uk';
const TYPES = { mini: 'Mini', doku: 'Doku', sweep: 'Sweep', path: 'Path', link: 'Link', tangle: 'Tangle', borders: 'Borders', reckon: 'Reckon' };

function page(type, name) {
  const title = `Today's ${name} — Noodle Puzzles`;
  const desc = `Play today's ${name} on The Daily Noodle: a free daily puzzle, no sign-up.`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${ORIGIN}/puzzles.html">
<meta property="og:site_name" content="The Daily Noodle">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${ORIGIN}/${type}">
<meta property="og:image" content="${ORIGIN}/assets/share-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Daily Noodle: news, puzzles and games">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#EDEEF2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#11131A" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icons/icon-192.png">
<style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#EDEEF2;color:#141726;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){body{background:#11131A;color:#ECEEF4}a{color:#9DB8FF}}
p{margin:0 16px;text-align:center}
a{color:#2F5BD3}
</style>
</head>
<body>
<p>Opening today's ${name}… <a id="go" href="/puzzles.html?via=share">Puzzles</a></p>
<script>
(function(){
  var TYPE=${JSON.stringify(type)};
  var q=location.search.replace(/^\\?/,'');
  var tag=/(^|&)via=/.test(q)?q:('via=share'+(q?'&'+q:''));
  var fallback='/puzzles.html?'+tag;
  function go(u){try{location.replace(u);}catch(e){location.href=u;}}
  var done=false, timer=setTimeout(function(){if(!done){done=true;go(fallback);}},6000);
  try{
    fetch('/puzzles-today.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(done)return; done=true; clearTimeout(timer);
      var it=j&&Array.isArray(j.items)?j.items.filter(function(x){return x&&x.type===TYPE&&x.path;})[0]:null;
      go(it?'/'+String(it.path).replace(/^\\/+/,'')+'?'+tag:fallback);
    },function(){if(!done){done=true;clearTimeout(timer);go(fallback);}});
  }catch(e){done=true;clearTimeout(timer);go(fallback);}
})();
</script>
</body>
</html>
`;
}

const ALIAS = { 'two-dots-landscape': 'two-dots' };   // keep in step with engines/game-share.js
const GAME_RE = /^reports\/\d{4}-\d{2}-\d{2}-(?:arcade|strategy|quiz)-([a-z0-9-]+)\.html$/;
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function gamePage(link, file, name) {
  const title = escHtml(name) + ' — Noodle Games';
  const target = '/' + file;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${ORIGIN}${target}">
<meta property="og:site_name" content="The Daily Noodle">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="Play ${escHtml(name)} on The Daily Noodle: free, no sign-up.">
<meta property="og:url" content="${ORIGIN}/${link}">
<meta property="og:image" content="${ORIGIN}/assets/share-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Daily Noodle: news, puzzles and games">
<meta name="twitter:card" content="summary_large_image">
<noscript><meta http-equiv="refresh" content="0;url=${target}?via=share"></noscript>
</head>
<body>
<p><a href="${target}?via=share">Open ${escHtml(name)}</a></p>
<script>
(function(){var q=location.search.replace(/^\\?/,'');var tag=/(^|&)via=/.test(q)?q:('via=share'+(q?'&'+q:''));
try{location.replace(${JSON.stringify(target)}+'?'+tag);}catch(e){location.href=${JSON.stringify(target)}+'?'+tag;}})();
</script>
</body>
</html>
`;
}

function games(out) {
  const f = path.join(out, 'feed.json');
  if (!fs.existsSync(f)) return [];
  const feed = JSON.parse(fs.readFileSync(f, 'utf8'));
  const list = [];
  for (const it of feed.items || []) {
    if (!it || it.kind !== 'game' || it.badge) continue;
    const m = String(it.path || '').match(GAME_RE);
    if (!m || !fs.existsSync(path.join(out, it.path))) continue;
    list.push({ link: ALIAS[m[1]] || m[1], file: it.path, name: it.headline || m[1] });
  }
  return list;
}

function write(outDir) {
  const out = path.resolve(outDir);
  for (const [type, name] of Object.entries(TYPES)) {
    const dir = path.join(out, type);
    if (fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`short-links: ${type}/index.html already exists in ${out}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page(type, name));
  }
  const g = games(out);
  for (const { link, file, name } of g) {
    if (TYPES[link]) throw new Error(`short-links: game link ${link} clashes with a puzzle type`);
    const dir = path.join(out, link);
    if (fs.existsSync(dir)) throw new Error(`short-links: ${link}/ already exists in ${out}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), gamePage(link, file, name));
  }
  return Object.keys(TYPES).length + g.length;
}

module.exports = { write, TYPES, page, games, ALIAS };
if (require.main === module) {
  const n = write(process.argv[2] || '_site');
  console.log(`short-links: ${n} short link page(s) written`);
}
