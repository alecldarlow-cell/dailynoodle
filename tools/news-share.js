#!/usr/bin/env node
/* The Daily Noodle — Share button on every news piece (added 18 Oct 2026).
   Run by .github/workflows/build-feed.yml on every push and nightly.

   Keeps one marked block just before </body> of each news piece
   (dn:kind "report"):

     <!-- nn-share:start (tools/news-share.js — do not edit by hand) -->
     <style>…</style><script>…</script>
     <!-- nn-share:end -->

   At load the script adds two small "Share" buttons: one under the dateline,
   one just above the footer. A tap opens the phone's share sheet (WhatsApp,
   Messages…) with WhatsApp-ready text:

     <headline>
     <first hero stat> — <its caption>
     https://dailynoodle.co.uk/reports/<file>.html?via=share

   Where there is no share sheet (most desktops) it copies the same text.
   The ?via=share tag is picked up by dn-track.js, so visits from shared links
   show up as via=share. Taps are recorded as share_click / share_done
   (props: method native|copy, pos top|end).

   - Inline and self-contained, like the rest of a piece; built from the
     page's own headline, first hero stat and og:url at click time.
   - Idempotent: the block is rewritten only when it differs, so a change
     here reaches every piece on the next run; an unchanged file is not touched.
   - Pieces are gated (dn-lint, dn-probe) before publishing; this block is
     added afterwards and is not part of the gated build.

   Set DN_SHARE_DRY=1 to report what would change without writing.
*/
const fs = require('fs');
const path = require('path');

const DIR = 'reports';
const DRY = process.env.DN_SHARE_DRY === '1';
const START = '<!-- nn-share:start (tools/news-share.js — do not edit by hand) -->';
const END = '<!-- nn-share:end -->';
const BLOCK_RE = /<!-- nn-share:start[^>]*-->[\s\S]*?<!-- nn-share:end -->\n?/;

const CSS = [
  '.nn-share-row{margin-top:14px}',
  '.nn-share-end{margin:30px 0 6px}',
  '.nn-share{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:8px 16px 8px 13px;',
  'border:1px solid var(--hair,#E6E6E2);border-radius:999px;background:var(--paper,#fff);',
  'color:var(--accent,#1C46C2);font:600 13.5px/1 var(--body,system-ui,sans-serif);cursor:pointer;',
  '-webkit-tap-highlight-color:transparent}',
  '.nn-share:hover{background:var(--accent-soft,#ECF0FC)}',
  '.nn-share:focus-visible{outline:2px solid var(--accent,#1C46C2);outline-offset:2px}',
  '.nn-share svg{width:16px;height:16px;flex:none}',
  '@media print{.nn-share-row{display:none}}',
].join('');

// Plain ES5 so it runs on any phone the rest of the piece runs on.
const JS = String.raw`(function(){
  var d=document;
  var h1=d.querySelector('h1'); if(!h1) return;
  function txt(el){ if(!el) return ''; var c=el.cloneNode(true), s=c.querySelectorAll('sup');
    for(var i=0;i<s.length;i++) s[i].parentNode.removeChild(s[i]);
    return c.textContent.replace(/\s+/g,' ').trim(); }
  function og(p){ var m=d.querySelector('meta[property="'+p+'"]'); return m?m.content:''; }
  var head=txt(h1), stat='', hs=d.querySelector('.hs');
  if(hs){ var n=txt(hs.querySelector('.n')), l=txt(hs.querySelector('.l'));
    if(l.length>140) l=l.slice(0,137).replace(/\s+\S*$/,'')+'…';
    if(n) stat=n+(l?' — '+l:''); }
  var base=og('og:url')||location.href.split(/[?#]/)[0];
  var url=base+'?via=share', text=head+(stat?'\n'+stat:'');
  function track(e,p){ try{ if(window.digi){ window.digi.track(e,p); window.digi.flush(); } }catch(x){} }
  function copy(s){
    if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(s);
    return new Promise(function(ok,no){ var t=d.createElement('textarea'); t.value=s; t.setAttribute('readonly','');
      t.style.position='fixed'; t.style.opacity='0'; d.body.appendChild(t); t.select();
      var done=false; try{ done=d.execCommand('copy'); }catch(e){} d.body.removeChild(t); done?ok():no(); });
  }
  var ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  function make(pos){
    var b=d.createElement('button'); b.type='button'; b.className='nn-share';
    b.innerHTML=ICON+'<span aria-live="polite">Share</span>';
    var lab=b.querySelector('span'), t=0;
    function say(s){ lab.textContent=s; clearTimeout(t); t=setTimeout(function(){ lab.textContent='Share'; },2500); }
    b.addEventListener('click',function(){
      if(navigator.share){
        track('share_click',{method:'native',pos:pos});
        navigator.share({title:head,text:text,url:url})
          .then(function(){ track('share_done',{method:'native',pos:pos}); }, function(){});
      } else {
        track('share_click',{method:'copy',pos:pos});
        copy(text+'\n'+url).then(function(){ say('Copied — paste into WhatsApp');
          track('share_done',{method:'copy',pos:pos}); }, function(){ say('Couldn’t copy'); });
      }
    });
    var w=d.createElement('div'); w.className='nn-share-row'+(pos==='end'?' nn-share-end':''); w.appendChild(b);
    return w;
  }
  var dl=d.querySelector('.dateline'); if(dl) dl.parentNode.insertBefore(make('top'), dl.nextSibling);
  var ft=d.querySelector('.foot'); if(ft) ft.parentNode.insertBefore(make('end'), ft);
})();`;

const BLOCK = START + '\n<style>' + CSS + '</style>\n<script>\n' + JS + '\n</script>\n' + END + '\n';

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
  if (BLOCK_RE.test(html)) {
    out = html.replace(BLOCK_RE, BLOCK);
  } else {
    const i = html.toLowerCase().lastIndexOf('</body>');
    if (i < 0) { console.log('skip (no </body>): ' + f); skipped++; continue; }
    out = html.slice(0, i) + BLOCK + html.slice(i);
  }
  if (out !== html) {
    changed++;
    if (!DRY) fs.writeFileSync(p, out);
  }
}
console.log(`news-share: ${seen} news pieces, ${changed} ${DRY ? 'would change' : 'updated'}, ${skipped} skipped`);
