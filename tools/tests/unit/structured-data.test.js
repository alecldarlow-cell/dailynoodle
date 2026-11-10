'use strict';
// JSON-LD written into the built site's <head>; tools/structured-data.js (SITE.md › Structured data).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {entries,updateHtml,write,serialise}=require('../../structured-data');
const FEED={today:'2026-11-10',items:[
 {kind:'puzzle',type:'tally',topic:'Logic',headline:'Tally 15',date:'2026-11-10',path:'reports/tally.html'},
 {kind:'puzzle',type:'mini',topic:'Crossword',headline:'Mini 121',date:'2026-11-09',path:'reports/mini-old.html'},
 {kind:'puzzle',type:'mini',topic:'Crossword',headline:'Mini 122',date:'2026-11-10',path:'reports/mini.html'},
 {kind:'puzzle',type:'mini',topic:'Crossword',headline:'Mini 123',date:'2026-11-11',path:'reports/mini-future.html'},
 {kind:'puzzle',type:'tilt',topic:'Logic',headline:'Tilt 3',date:'2026-11-10',path:'reports/tilt.html',badge:'In development'},
 {kind:'game',topic:'Arcade',headline:'Paper Planes',standfirst:'Fold, throw, glide.',date:'2026-10-30',updated:'2026-11-02',path:'reports/planes.html'},
 {kind:'report',topic:'Economy',headline:'Rents </script> & "wages"',standfirst:'What the figures show.',date:'2026-11-08',updated:'',path:'reports/news.html'}
]};
const block=html=>JSON.parse(html.match(/<script type="application\/ld\+json" data-dn="ld">([\s\S]*?)<\/script>/)[1]);
test('STRUCT-01 every released page is described once; held and Lab pages never are',()=>{
 const map=new Map(entries(FEED));
 assert.deepEqual([...map.keys()],['index.html','puzzles.html','games.html','reports/tally.html','reports/mini-old.html','reports/mini.html','reports/planes.html','reports/news.html']);
 assert.deepEqual(map.get('index.html')['@graph'].map(n=>n['@type']),['WebSite','Organization']);
 const today=map.get('puzzles.html');
 assert.deepEqual(today.itemListElement.map(e=>e.name),['Mini 122','Tally 15'],'the daily order, whatever the feed order');
 assert.match(map.get('index.html')['@graph'][0].description,/^Nine free daily puzzles/);
});
test('STRUCT-02 a puzzle is a free Game with its type and rules line; a game and a news piece keep their own words',()=>{
 const map=new Map(entries(FEED)),tally=map.get('reports/tally.html'),planes=map.get('reports/planes.html'),news=map.get('reports/news.html');
 assert.equal(tally['@type'],'Game');assert.equal(tally.name,'Tally 15');assert.equal(tally.alternateName,'Daily Number Logic Puzzle');
 assert.equal(tally.datePublished,'2026-11-10');assert.equal(tally.isAccessibleForFree,true);assert.match(tally.description,/cage/);
 assert.equal(planes['@type'],'VideoGame');assert.equal(planes.description,'Fold, throw, glide.');assert.equal(planes.dateModified,'2026-11-02');
 assert.equal(news['@type'],'NewsArticle');assert.equal(news.headline,'Rents </script> & "wages"');
 assert.equal(news.dateModified,'2026-11-08','an unrevised piece is modified on its publication day');
 assert.equal(news.mainEntityOfPage,'https://dailynoodle.co.uk/reports/news.html');
});
test('STRUCT-03 the block goes in the head only, cannot be closed by a headline, and a second run changes nothing',()=>{
 const html='<html><head><title>T</title>\n</head><body><p>Play</p></body></html>',data=new Map(entries(FEED)).get('reports/news.html');
 const once=updateHtml(html,data),twice=updateHtml(once,data);
 assert.equal(once,twice);assert.equal((once.match(/application\/ld\+json/g)||[]).length,1);
 assert.equal(once.slice(once.indexOf('</head>')),html.slice(html.indexOf('</head>')),'body unchanged');
 assert.ok(!serialise(data).includes('<'));assert.equal(block(once).headline,'Rents </script> & "wages"');
 assert.throws(()=>updateHtml('<body></body>',data),/no head/);
});
test('STRUCT-04 write() describes the pages that exist and skips the ones that are missing',t=>{
 const site=fs.mkdtempSync(path.join(os.tmpdir(),'ld-'));t.after(()=>fs.rmSync(site,{recursive:true,force:true}));
 fs.mkdirSync(path.join(site,'reports'));fs.writeFileSync(path.join(site,'feed.json'),JSON.stringify(FEED));
 for(const f of ['index.html','puzzles.html','reports/tally.html','reports/mini-future.html','reports/tilt.html'])fs.writeFileSync(path.join(site,f),'<html><head><title>x</title></head><body></body></html>');
 assert.equal(write(site),3);
 assert.equal(block(fs.readFileSync(path.join(site,'reports/tally.html'),'utf8')).url,'https://dailynoodle.co.uk/reports/tally.html');
 for(const f of ['reports/mini-future.html','reports/tilt.html'])assert.doesNotMatch(fs.readFileSync(path.join(site,f),'utf8'),/ld\+json/);
});
