#!/usr/bin/env node
/* The Daily Noodle — a way back to the site from every news piece (19 Oct 2026).
   Run by .github/workflows/build-feed.yml on every push and nightly, like
   tools/news-share.js and tools/news-dark.js.

   Someone who opens a piece from a WhatsApp link had no way to reach News,
   Puzzles or Games: no piece linked back. This adds, to each news piece
   (dn:kind "report"), two marked blocks of plain markup, so they are there at
   first paint with nothing shifting:

     1. Just before <header class="mast">: a "← News" link, styled like the
        puzzles' "← Puzzles", with its small <style>.
          <!-- nn-nav:start (tools/news-nav.js — do not edit by hand) --> … <!-- nn-nav:end -->
     2. Around the masthead's DN mark and NoodleNews name: a link to News,
        laid out exactly as before.
          <!-- nn-home:start (…) --><a class="nn-home" …> mark + name </a><!-- nn-home:end -->

   - Idempotent: a file is rewritten only when a block differs.
   - Pieces are gated (dn-lint, dn-probe) before publishing; these blocks are
     added afterwards and are not part of the gated build.
   - --remove takes both blocks out and puts the masthead back byte for byte.
   - --check exits 1 if any piece still needs updating (nothing is written).

   Set DN_NAV_DRY=1 to report what would change without writing.
*/
const fs = require('fs');
const path = require('path');

const DIR = 'reports';
const REMOVE = process.argv.includes('--remove');
const CHECK = process.argv.includes('--check');
const DRY = process.env.DN_NAV_DRY === '1' || CHECK;

const NAV_START = '<!-- nn-nav:start (tools/news-nav.js — do not edit by hand) -->';
const NAV_END = '<!-- nn-nav:end -->';
const NAV_RE = /<!-- nn-nav:start[^>]*-->[\s\S]*?<!-- nn-nav:end -->\n?[ \t]*/;
const HOME_START = '<!-- nn-home:start (tools/news-nav.js — do not edit by hand) -->';
const HOME_END = '<!-- nn-home:end -->';
// the masthead mark and name exactly as the house template writes them
const MARK_RE = /<div class="mono">DN<\/div>(\s*)<div class="word">Noodle<b>News<\/b><\/div>/;
const HOME_RE = /<!-- nn-home:start[^>]*--><a class="nn-home"[^>]*>([\s\S]*?)<\/a><!-- nn-home:end -->/;

const CSS = [
  // the "← News" row: the puzzles' back link, sized for a tap, tucked into the
  // masthead's own top padding so the page grows by only a few pixels
  '.nn-back{display:inline-flex;align-items:center;gap:6px;min-height:40px;margin:4px 0 -18px;',
  'font:500 15px/1 var(--body,system-ui,sans-serif);color:var(--muted,#5F636B);text-decoration:none;',
  '-webkit-tap-highlight-color:transparent}',
  '.nn-back:hover{color:var(--ink,#15171C)}',
  '.nn-back:focus-visible,.nn-home:focus-visible{outline:2px solid var(--accent,#1C46C2);outline-offset:3px;border-radius:3px}',
  // the masthead link keeps the mark and name exactly where they were
  '.nn-home{display:flex;align-items:center;gap:inherit;color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}',
  '@media print{.nn-back{display:none}}',
].join('');

const NAV = NAV_START + '<style>' + CSS + '</style>'
  + '<a class="nn-back" href="../index.html"><span aria-hidden="true">←</span> News</a>' + NAV_END + '\n  ';

function isNews(html) { return /<meta\s+name="dn:kind"\s+content="report"/i.test(html); }

function strip(html) {
  return html.replace(NAV_RE, '').replace(HOME_RE, '$1');
}
function apply(html) {
  let out = strip(html);
  const mast = out.indexOf('<header class="mast">');
  if (mast < 0 || !MARK_RE.test(out.slice(mast))) return null;
  out = out.slice(0, mast) + NAV + out.slice(mast).replace(MARK_RE, m =>
    HOME_START + '<a class="nn-home" href="../index.html" aria-label="Noodle News home">' + m + '</a>' + HOME_END);
  return out;
}

let changed = 0, skipped = 0, seen = 0;
for (const f of fs.readdirSync(DIR).filter(n => n.endsWith('.html')).sort()) {
  const p = path.join(DIR, f);
  const html = fs.readFileSync(p, 'utf8');
  if (!isNews(html)) continue;
  seen++;
  const out = REMOVE ? strip(html) : apply(html);
  if (out == null) { console.log('skip (no house masthead): ' + f); skipped++; continue; }
  if (out !== html) {
    changed++;
    if (CHECK) console.log('needs news-nav: ' + f);
    if (!DRY) fs.writeFileSync(p, out);
  }
}
console.log(`news-nav: ${seen} news pieces, ${changed} ${DRY ? 'would change' : REMOVE ? 'restored' : 'updated'}, ${skipped} skipped`);
if (CHECK && changed) process.exit(1);
