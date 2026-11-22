#!/usr/bin/env node
'use strict';
/* Forwarding pages for the news pieces and games that moved to their own sites
   on 22 Nov 2026, when dailynoodle.co.uk became puzzles only (SITE.md › Sections).

   News  → https://news.dailynoodle.co.uk/<same path>
   Games → https://games.dailynoodle.co.uk/<same path>

   GitHub Pages has no server redirects, so each old path keeps a tiny page that
   forwards with location.replace (a meta refresh when scripts are off) and names the new
   address as canonical, so search engines move the page across.

   Saved progress belongs to one address, so a game's forwarding page packs this
   browser's game saves (the keys in GAME_KEYS, plus the tracker id) into the
   link's #dnmove= fragment (never sent to a server), the same hand-off the
   October domain move used. The hand-off lands on the games site's front page
   (?go=<path>), which writes no saves of its own. w:1 (22 Nov 2026) marks it as a move from here: the first
   one to arrive in a browser wins outright on the games site (anything there was a fresh save started before
   the real progress came across); later ones merge. ?restore on a game's old link (22 Nov 2026) sends
   only that game's own saves (OWN) with w:2, which the games site writes over whatever it has: for a player
   whose real progress was lost under a fresh save there (Yarn writes its in-memory save when the page hides). Otherwise dn-track.js there merges them in
   without overwriting newer progress, then the page goes on to the game. (Landing
   on the game itself would not work: a game writes its fresh save on load, before
   the tracker runs, and the merge keeps the newer-looking fresh one.) Puzzle saves
   never leave this site.

   node tools/moved-pages.js           write every forwarding page
   node tools/moved-pages.js --check   exit 1 if any page differs from what it would write */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const LIST=require('./moved-pages.json');
const GAME_KEYS=['digi-bubble-burst-v2','lk_meta_v3','lk_run_v3','digi-lantern-drift-v1','digi-sea-glass-v1','digi-sea-glass-v1-run',
 'digi-borderline-v1','digi-archipelago-v1','digi-archipelago-run-v1','digi-ballpark-v1','digi-ancient-cities-v1','digi-campfire-watch-v1',
 'campfire-watch-bests-v1','digi-paper-planes-v1','digi-two-dots-landscape-v1','digi-echo-cave-v1','digi-yarn-v1','digi-astro-drop-v1',
 'digi-inkline-v1','digi-astro-drop-quake-v1'];
const SPECIAL={'lighthouse-keeper':['lk_meta_v3','lk_run_v3']};
function own(file){const slug=file.replace(/^\d{4}-\d{2}-\d{2}-[a-z]+-/,'').replace(/\.html$/,'');
  return SPECIAL[slug]||GAME_KEYS.filter(k=>k.indexOf(slug)>=0);}
function page(file,host,game){
  const url='https://'+host+'/reports/'+file;
  const pack=game?`var d={},R=/[?&]restore(=|&|$)/.test(location.search),K=R?${JSON.stringify(own(file))}:${JSON.stringify(GAME_KEYS)};try{K.forEach(function(k){var v=localStorage.getItem(k);if(v!=null)d[k]=v;});if(localStorage.getItem('digi.optout')!=='1'){var a=localStorage.getItem('digi.aid');if(a)d['digi.aid']=a;}}catch(e){}
if(Object.keys(d).length){var j=JSON.stringify({v:1,w:R?2:1,d:d,h:location.hash||''});location.replace('https://${host}/?go='+encodeURIComponent('reports/${file}')+'#dnmove='+btoa(unescape(encodeURIComponent(j))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''));return;}`:'';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<!-- moved-page: forwarding page written by tools/moved-pages.js; do not edit by hand -->
<title>Moved — The Daily Noodle</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${url}">
<noscript><meta http-equiv="refresh" content="0; url=${url}"></noscript>
<script>(function(){var h=location.hash||'';
${pack}
location.replace(${JSON.stringify(url)}+location.search+h);})();</script>
</head><body><p>This ${game?'game':'piece'} has moved to <a href="${url}">${host}</a>.</p></body></html>
`;}
const check=process.argv.includes('--check');let bad=0,n=0;
for(const [kind,host,game] of [['news','news.dailynoodle.co.uk',false],['games','games.dailynoodle.co.uk',true]])
  for(const f of LIST[kind]){const p=path.join(ROOT,'reports',f),want=page(f,host,game);n++;
    const have=fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;
    if(have!==want){if(check){bad++;console.log('moved-pages: '+f+' is not the forwarding page');}else fs.writeFileSync(p,want);}}
if(check&&bad){console.log(bad+' of '+n+' forwarding pages out of date: run node tools/moved-pages.js');process.exit(1);}
console.log('moved-pages: '+n+' forwarding pages '+(check?'ok':'written'));
module.exports={GAME_KEYS,own};
