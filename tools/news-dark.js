#!/usr/bin/env node
/* The Daily Noodle — dark mode for every news piece (added 18 Oct 2026).
   Run by .github/workflows/build-feed.yml on every push and nightly, like
   tools/news-share.js.

   The front pages and the puzzles follow the phone's light or dark setting;
   this makes the news pieces do the same, so moving between them doesn't
   flash. It keeps one marked block just before the first </head> of each
   news piece (dn:kind "report"):

     <!-- nn-dark:start (tools/news-dark.js — do not edit by hand) -->
     two theme-color metas, a <style>, a <script>
     <!-- nn-dark:end -->

   - The style redefines the piece's colour tokens (--canvas, --ink, --accent
     …) in the front pages' dark palette, and covers the template's few
     literal colours (the masthead tile, evidence tiers, cards, table heads).
     It only applies in dark mode, so light pages are exactly as before.
   - The script runs before the piece's chart library (DN) and, in dark mode
     only, swaps the library's colour roles (DN.colors: ink, axis, subject …)
     for dark ones and gives any light colour a chart spec names its dark
     twin (#1C46C2 → #9DB2FF and so on). It does this by catching the
     library as it is assigned to window.DN, so the gated library code is
     never edited. Categorical (Okabe-Ito) colours are left alone.
   - Idempotent: the block is rewritten only when it differs, so a change
     here reaches every piece on the next run; an unchanged file isn't touched.
   - Removing the block restores a piece byte for byte (--remove).

     node tools/news-dark.js            # add or refresh the block
     node tools/news-dark.js --dry      # report only
     node tools/news-dark.js --remove   # take it out again
*/
const fs = require('fs');
const path = require('path');

const DIR = 'reports';
const MODE = process.argv[2] || '';
const DRY = MODE === '--dry' || process.env.DN_DARK_DRY === '1';
const START = '<!-- nn-dark:start (tools/news-dark.js — do not edit by hand) -->';
const END = '<!-- nn-dark:end -->';
const BLOCK_RE = /<!-- nn-dark:start[^>]*-->[\s\S]*?<!-- nn-dark:end -->\n?/;

/* the front pages' dark palette (front.css), so the whole site is one dark */
const TOKENS = '--canvas:#11131A;--paper:#1B1E29;--ink:#ECEEF4;--muted:#A6ABBD;--faint:#80869A;--hair:#2E3344;' +
  '--accent:#8EA6FF;--accent-soft:#1C2440;--contrast:#FF7A6E;color-scheme:dark';
const RULES = [
  ['', TOKENS],                                                    // :root itself
  [' body', 'background:var(--canvas);color:var(--ink)'],
  [' .mono', 'color:#11131A'],                                     // text on the accent tile
  [' .tier.t1', 'background:#1C2440;color:#A9BBFF'],               // evidence tiers
  [' .tier.t2', 'background:#142C24;color:#7FD9A8'],
  [' .tier.t3', 'background:#2C2818;color:#D9C58A'],
  [' .unknowns,:R .caveat,:R .measure', 'background:var(--paper)'],
  [' table.tbl th', 'background:var(--paper)'],
  [' [style*="solid #ddd"]', 'border-bottom-color:var(--hair)!important'],
  [' [style*="dashed #666"]', 'border-top-color:var(--faint)!important'],
  [' .dn-nodelabel', 'stroke:var(--canvas)'],                      // label halos sit on the page
];
function rules(root) {
  return RULES.map(([sel, body]) => root + sel.replace(/:R /g, root + ' ') + '{' + body + '}').join('');
}
const CSS = '@media (prefers-color-scheme:dark){' + rules(':root:not([data-theme="light"])') + '}' + rules(':root[data-theme="dark"]');

// Plain ES5 so it runs on any phone the rest of the piece runs on.
const JS = String.raw`(function(){
  var r=document.documentElement,t=r.getAttribute('data-theme'),dark=false;
  try{dark=t==='dark'||(t!=='light'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);}catch(e){}
  if(!dark)return;
  var C={ink:'#ECEEF4',axis:'#A6ABBD',hair:'#2E3344',faint:'#80869A',paper:'#11131A',subject:'#9DB2FF',muted:'#4A5068',pos:'#9DB2FF',neg:'#FF7A6E',proj:'#80869A',band:'#1C2440'};
  var DK={'#1C46C2':'#9DB2FF','#1740A6':'#9DB2FF','#E0312A':'#FF7A6E','#15171C':'#ECEEF4','#ECF0FC':'#1C2440','#C9CCD1':'#4A5068','#E6E6E2':'#2E3344','#FFFFFF':'#11131A','#FFF':'#11131A'};
  function fix(o,n){if(!o||typeof o!=='object'||o.nodeType||n>8)return;
    if(Object.prototype.toString.call(o)==='[object Array]'){for(var i=0;i<o.length;i++)fix(o[i],n+1);return;}
    for(var k in o){if(!Object.prototype.hasOwnProperty.call(o,k))continue;var v=o[k];
      if(typeof v==='string'&&/colou?r$/i.test(k)){var u=DK[v.toUpperCase()];if(u)o[k]=u;}
      else if(v&&typeof v==='object')fix(v,n+1);}}
  var lib;
  try{Object.defineProperty(window,'DN',{configurable:true,enumerable:true,get:function(){return lib;},set:function(v){lib=v;
    if(!v||typeof v!=='object')return;
    try{if(v.colors)for(var k in C)v.colors[k]=C[k];}catch(e){}
    ['line','bars','columns','slope','scatter','rangeStrip','sankey'].forEach(function(n){var f=v[n];
      if(typeof f==='function')v[n]=function(t,spec){fix(spec,0);return f.apply(this,arguments);};});}});}catch(e){}
})();`;

const BLOCK = START + '\n<meta name="theme-color" content="#FCFCFB" media="(prefers-color-scheme: light)">\n' +
  '<meta name="theme-color" content="#11131A" media="(prefers-color-scheme: dark)">\n' +
  '<style>' + CSS + '</style>\n<script>\n' + JS + '\n</script>\n' + END + '\n';

function isNews(html) {
  return /<meta\s+name="dn:kind"\s+content="report"/i.test(html);
}

let changed = 0, skipped = 0, seen = 0;
for (const f of fs.readdirSync(DIR).filter(n => n.endsWith('.html')).sort()) {
  const p = path.join(DIR, f);
  const html = fs.readFileSync(p, 'utf8');
  if (!isNews(html)) continue;
  seen++;
  let out;
  if (MODE === '--remove') out = html.replace(BLOCK_RE, '');
  else if (BLOCK_RE.test(html)) out = html.replace(BLOCK_RE, BLOCK);
  else {
    const i = html.toLowerCase().indexOf('</head>');
    if (i < 0) { console.log('skip (no </head>): ' + f); skipped++; continue; }
    out = html.slice(0, i) + BLOCK + html.slice(i);
  }
  if (out !== html) {
    changed++;
    if (!DRY) fs.writeFileSync(p, out);
  }
}
console.log(`news-dark: ${seen} news pieces, ${changed} ${DRY ? 'would change' : MODE === '--remove' ? 'cleaned' : 'updated'}, ${skipped} skipped`);
