'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {card}=require('../../card-renderer'),{sync,bundled}=require('../../sync-cards');
test('CARDS: build and browser use one identical, up-to-date renderer',()=>{
 assert.equal(sync(true),false);
 const src=fs.readFileSync(path.join(__dirname,'../../card-renderer.js'),'utf8'),ctx=vm.createContext({});
 vm.runInContext(src,ctx);
 const feed=JSON.parse(fs.readFileSync(path.join(__dirname,'../../../feed.json'),'utf8'));
 for(const it of feed.items)for(const lab of [false,true])assert.equal(card(it,{today:feed.today,lab}),ctx.dnCards.card(it,{today:feed.today,lab}),it.path);
 const front=fs.readFileSync(path.join(__dirname,'../../../front.js'),'utf8');assert.equal(bundled(front,src),front);
});
test('CARDS: date, time and separate guide link survive static rendering',()=>{
 const item={kind:'puzzle',type:'path',headline:'Path 94',path:'reports/path.html',date:'2026-10-20',read:'~3 min',topic:'Logic',mask:'.'.repeat(36)};
 const output=card(item,{today:'2026-10-20'});
 assert.match(output,/class="card-date">Today<\/span>/);assert.match(output,/class="card-time">~3 min<\/span>/);
 assert.match(output,/<\/div><\/a><a class="card-guide" href="how-to-play.html#path"/);
 assert.match(card({...item,date:'2026-09-03'},{today:'2026-10-20'}),/3 Sept 2026/);
});
