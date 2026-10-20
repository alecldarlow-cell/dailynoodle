'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {TYPES,puzzleMeta,entries,updateHtml,write}=require('../../search-meta');
const puzzle=(type='path',number=94,date='2026-10-20')=>({kind:'puzzle',type,headline:TYPES[type].name+' '+number,date,path:'reports/'+date+'-'+type+'.html'});
const html='<!doctype html><html><head><title>Old title</title><meta name="description" content="Old description"><meta name="dn:headline" content="Path 94"><meta property="og:title" content="Path 94"></head><body><h1>Path</h1><script>const puzzleId="DP·PATH·0094";</script></body></html>';

test('specific titles and rules describe the eight actual games',()=>{
 const titles={
  mini:'Mini 101 — Daily Mini Crossword | Daily Noodle',
  doku:'Doku 101 — Daily Letter Logic Puzzle | Daily Noodle',
  sweep:'Sweep 101 — Daily Minesweeper Puzzle | Daily Noodle',
  path:'Path 101 — Daily Number Path Puzzle | Daily Noodle',
  link:'Link 101 — Daily Word Groups Puzzle | Daily Noodle',
  tangle:'Tangle 101 — Daily Word Finding Puzzle | Daily Noodle',
  borders:'Borders 101 — Daily Country Outline Quiz | Daily Noodle',
  reckon:'Reckon 101 — Daily Number Estimation Quiz | Daily Noodle'
 };
 for(const [type,title] of Object.entries(titles)){
  const meta=puzzleMeta(puzzle(type,101));
  assert.equal(meta.title,title);assert.match(meta.description,/Play \w+ 101 \(2026-10-20\)/);
 }
 assert.match(puzzleMeta(puzzle('doku')).description,/letters from the bank/);
 assert.doesNotMatch(puzzleMeta(puzzle('doku')).title,/sudoku/i);
 assert.match(puzzleMeta(puzzle('tangle')).description,/ninety seconds/);
 assert.equal(puzzleMeta({kind:'report',type:'path'}),null);
 assert.equal(puzzleMeta({kind:'puzzle',type:'new-type'}),null);
});

test('uses feed numbering, including filenames without serials, and cached feed fallback',()=>{
 const sweep={...puzzle('sweep',96),path:'reports/2026-10-20-logic-sweep.html'};
 assert.match(puzzleMeta(sweep).title,/^Sweep 96 —/);
 assert.match(puzzleMeta({...puzzle(),type:undefined,headline:'Path 0094'}).title,/^Path 94 —/);
 assert.match(puzzleMeta({...puzzle(),headline:'Path'}).title,/^Path 2026-10-20 —/);
});

test('archive numbers that were reused get dates; future and Lab content are excluded',()=>{
 const items=[puzzle('doku',4,'2026-07-16'),puzzle('doku',4,'2026-07-17'),puzzle('mini',102,'2026-10-21'),{...puzzle(),badge:'In development'}];
 const pages=entries({today:'2026-10-20',items});
 assert.equal(pages.length,5);
 assert.equal(new Set(pages.map(([,m])=>m.title)).size,5);
 assert.match(pages[3][1].title,/Doku 4 \(2026-07-16\)/);
 assert.match(pages[4][1].title,/Doku 4 \(2026-07-17\)/);
 assert.equal(pages[0][1].canonical,'https://dailynoodle.co.uk/');
});

test('head metadata is escaped, unique and idempotent; page, saves and social/card copy stay intact',()=>{
 const meta={title:'Words & <numbers>',description:'Try "this" & that',canonical:'https://dailynoodle.co.uk/reports/path.html'};
 const input=html.replace('</head>',"<META CONTENT='duplicate' NAME='Description'><LINK HREF='https://old.example/' REL='canonical'></head>");
 const result=updateHtml(input,meta);
 assert.equal(result.slice(result.indexOf('</head>')),input.slice(input.indexOf('</head>')));
 assert.ok(result.includes('<meta name="dn:headline" content="Path 94">'));
 assert.ok(result.includes('<meta property="og:title" content="Path 94">'));
 assert.match(result,/<title>Words &amp; &lt;numbers&gt;<\/title>/);
 assert.match(result,/content="Try &quot;this&quot; &amp; that"/);
 assert.equal((result.match(/name="description"/g)||[]).length,1);
 assert.equal((result.match(/rel="canonical"/g)||[]).length,1);
 assert.doesNotMatch(result,/duplicate|old\.example/);
 assert.equal(updateHtml(result,meta),result);
 assert.throws(()=>updateHtml('<body>Oops</body>',meta),/no head/);
});

test('writes released metadata, preserving editorial titles/descriptions and holding future pages',()=>{
 const site=fs.mkdtempSync(path.join(os.tmpdir(),'search-meta-'));
 try{
  fs.mkdirSync(path.join(site,'reports'));
  const now=puzzle(),future=puzzle('path',95,'2026-10-21'),news={kind:'report',path:'reports/news.html'};
  for(const file of ['index.html','puzzles.html','games.html',now.path,future.path,news.path,'how-to-play.html'])fs.writeFileSync(path.join(site,file),html);
  fs.writeFileSync(path.join(site,'feed.json'),JSON.stringify({today:'2026-10-20',items:[now,future,news]}));
  assert.equal(write(site),5);
  const result=fs.readFileSync(path.join(site,now.path),'utf8');
  assert.match(result,/<title>Path 94 — Daily Number Path Puzzle \| Daily Noodle<\/title>/);
  for(const file of [future.path,'how-to-play.html'])assert.equal(fs.readFileSync(path.join(site,file),'utf8'),html);
  const editorial=fs.readFileSync(path.join(site,news.path),'utf8');
  assert.ok(editorial.includes('<title>Old title</title>'));assert.ok(editorial.includes('content="Old description"'));
  assert.match(editorial,/rel="canonical" href="https:\/\/dailynoodle.co.uk\/reports\/news.html"/);
  write(site);assert.equal(fs.readFileSync(path.join(site,now.path),'utf8'),result);
  // The already-built future file gets metadata automatically on its release day.
  fs.writeFileSync(path.join(site,'feed.json'),JSON.stringify({today:'2026-10-21',items:[now,future,news]}));
  assert.equal(write(site),6);
  assert.match(fs.readFileSync(path.join(site,future.path),'utf8'),/<title>Path 95 — Daily Number Path Puzzle \| Daily Noodle<\/title>/);

 }finally{fs.rmSync(site,{recursive:true,force:true});}
});
