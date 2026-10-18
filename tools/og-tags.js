#!/usr/bin/env node
/* The Daily Noodle — link-preview tags on every piece, puzzle and game.
   Run by .github/workflows/build-feed.yml on every push and nightly.

   When someone pastes a link into WhatsApp (or anywhere that shows previews),
   the preview card reads Open Graph tags. This keeps one marked block of them
   in each file's <head>, built from the piece's own dn:* metas:

     <!-- og:start (tools/og-tags.js — do not edit by hand) -->
     <meta property="og:title" ...> description, url, image, site name, type
     <!-- og:end -->

   - Idempotent: the block is rewritten only when it differs, so a changed
     headline or standfirst (e.g. a puzzle replaced in place) is picked up on
     the next run, and an unchanged file is never touched.
   - Values are copied from the dn:* content attributes exactly as written
     (already HTML-escaped there), so nothing is escaped twice.
   - Image: the site icon. Thumbnails are SVG, which preview cards don't show.
   - Not part of the in-page Share button, which stays text-only.

   Set DN_OG_DRY=1 to report what would change without writing.
*/
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://dailynoodle.co.uk';
const IMAGE = ORIGIN + '/icons/icon-512.png';
const SITE = 'The Daily Noodle';
const DIRS = ['reports'];
const DRY = process.env.DN_OG_DRY === '1';
const START = '<!-- og:start (tools/og-tags.js — do not edit by hand) -->';
const END = '<!-- og:end -->';
const BLOCK_RE = /<!-- og:start[^>]*-->[\s\S]*?<!-- og:end -->\n?/;

function metaRaw(html, name) {
  const re = new RegExp('<meta\\s+name="' + name + '"\\s+content="([^"]*)"', 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function block(file, html) {
  const headline = metaRaw(html, 'dn:headline');
  if (!headline) return null;                      // not a feed item: leave alone
  const standfirst = metaRaw(html, 'dn:standfirst');
  const kind = metaRaw(html, 'dn:kind');
  const lines = [
    START,
    '<meta property="og:site_name" content="' + SITE + '">',
    '<meta property="og:type" content="' + (kind === 'report' ? 'article' : 'website') + '">',
    '<meta property="og:title" content="' + headline + '">',
    standfirst ? '<meta property="og:description" content="' + standfirst + '">' : '',
    '<meta property="og:url" content="' + ORIGIN + '/' + file + '">',
    '<meta property="og:image" content="' + IMAGE + '">',
    '<meta name="twitter:card" content="summary">',
    END,
  ].filter(Boolean);
  return lines.join('\n') + '\n';
}

let scanned = 0, written = 0, skipped = 0;
for (const dir of DIRS) {
  const abs = path.join(process.cwd(), dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs)) {
    if (!/\.html?$/i.test(name)) continue;
    scanned++;
    const p = path.join(abs, name);
    const html = fs.readFileSync(p, 'utf8');
    const want = block(dir + '/' + name, html);
    if (!want) { skipped++; continue; }
    let out;
    if (BLOCK_RE.test(html)) {
      out = html.replace(BLOCK_RE, want);
    } else {
      const i = html.toLowerCase().indexOf('</head>');
      if (i < 0) { skipped++; continue; }
      out = html.slice(0, i) + (html[i - 1] === '\n' ? '' : '\n') + want + html.slice(i);
    }
    if (out === html) continue;
    written++;
    if (DRY) { if (written <= 5) console.log('  would update ' + dir + '/' + name); }
    else fs.writeFileSync(p, out);
  }
}
console.log(`og-tags: ${scanned} scanned, ${written} ${DRY ? 'would be ' : ''}updated, ${skipped} skipped`);
