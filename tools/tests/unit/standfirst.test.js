const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../../standfirst'),ROOT=path.join(__dirname,'..','..','..');
/* Card descriptions in the house voice (Alec, 7 Nov 2026): a hook, then what you do; rules live in How to play. */
test('STANDFIRST-01: GIVEN the house wording THEN every type has one line of two sentences or so, short enough for three card lines',()=>{
 for(const [t,v] of Object.entries(S.TEXT)){assert.ok(v.length<=90,t+' too long: '+v.length);assert.doesNotMatch(v,/—/,t);}
 assert.match(S.TEXT.tally,/cage hit its number/);assert.doesNotMatch(S.TEXT.tally,/sum|add up/i,'Tally cages can multiply, divide or subtract');
});
test('STANDFIRST-02: GIVEN a Link THEN the trap count stays the daily twist, worded for 0, 1 and many',()=>{
 assert.equal(S.link(0),'Four hidden groups. Can you find the links?');
 assert.equal(S.link(1),'Four hidden groups. Can you find the links? Today, one tile is bluffing.');
 assert.equal(S.link(3),'Four hidden groups. Can you find the links? Today, three tiles are bluffing.');
});
test('STANDFIRST-03: GIVEN a Mini teaser THEN only a closing difficulty sentence is dropped',()=>{
 assert.equal(S.mini("Profit's opposite, and the water's edge. Medium."),"Profit's opposite, and the water's edge.");
 assert.equal(S.mini('A rock, and something hard.'),'A rock, and something hard.');
 assert.equal(S.mini('A rock, and a pebble. A medium 5x5.'),'A rock, and a pebble.');
});
test('STANDFIRST-04: GIVEN a page WHEN it is rewritten THEN only dn:standfirst and og:description change, kept equal',()=>{
 const s='<meta name="dn:standfirst" content="Old.">\n<meta property="og:description" content="Old.">\n<p>Old.</p>\nwindow.DN_PUZZLE={id:"x"};';
 const out=S.rewrite('2026-12-01-logic-tally-0040.html',s);
 assert.equal(out,s.replace(/content="Old\."/g,'content="'+S.TEXT.tally+'"'));
});
test('STANDFIRST-05: GIVEN the forthcoming puzzles THEN from 8 Nov 2026 each carries the house wording; 7 Nov and before keep theirs',()=>{
 const files=fs.readdirSync(path.join(ROOT,'reports')).filter(f=>S.typeOf(f)&&/^\d{4}-\d{2}-\d{2}-/.test(f));
 const sf=s=>(s.match(/name="dn:standfirst"\s+content="([^"]*)"/)||[])[1];
 let n=0;for(const f of files.filter(f=>f>='2026-11-08')){const s=fs.readFileSync(path.join(ROOT,'reports',f),'utf8');assert.equal(S.rewrite(f,s),s,f+' is not in the house wording');n++;}
 assert.ok(n>1000);
 assert.match(sf(fs.readFileSync(path.join(ROOT,'reports','2026-11-07-logic-path-0112.html'),'utf8')),/one path\./,'a released day is never edited');
});
