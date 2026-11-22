#!/usr/bin/env node
'use strict';
/* The bare address is the Puzzles front page (22 Nov 2026: dailynoodle.co.uk is puzzles
   only; News and Games moved to news. and games.dailynoodle.co.uk). On GitHub Pages "/"
   serves index.html, so index.html is a generated copy of puzzles.html, the one to edit.
   It differs only in og:url ("/"). Both pages' canonical is "/" (tools/search-meta.js).

   node tools/sync-home.js           write index.html from puzzles.html
   node tools/sync-home.js --check   exit 1 if index.html is out of date            */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const MARK='<!-- index.html: generated from puzzles.html by tools/sync-home.js; edit puzzles.html, then run it -->\n';
function home(src){
  const a='<meta property="og:url" content="https://dailynoodle.co.uk/puzzles.html">';
  if(!src.includes(a))throw Error('sync-home: puzzles.html has no og:url line to rewrite');
  return src.replace('<!DOCTYPE html>\n','<!DOCTYPE html>\n'+MARK).replace(a,'<meta property="og:url" content="https://dailynoodle.co.uk/">');
}
const want=home(fs.readFileSync(path.join(ROOT,'puzzles.html'),'utf8'));
const file=path.join(ROOT,'index.html');
if(process.argv.includes('--check')){
  if(fs.readFileSync(file,'utf8')!==want){console.log('sync-home: index.html is out of date with puzzles.html: run node tools/sync-home.js');process.exit(1);}
  console.log('sync-home: index.html matches puzzles.html');
}else{fs.writeFileSync(file,want);console.log('sync-home: wrote index.html');}
module.exports={home};
