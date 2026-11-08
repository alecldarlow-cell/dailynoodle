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
test('STANDFIRST-03: GIVEN any Mini (Alec, 7 Nov 2026, evening) THEN its card line is the one house line, whatever a clue tool passes in',()=>{
 assert.equal(S.TEXT.mini,'A crossword small enough for a coffee break. Fill every square from the clues.');
 assert.equal(S.mini("Profit's opposite, and the water's edge. Medium."),S.TEXT.mini);
 assert.equal(S.mini(''),S.TEXT.mini);
 const s='<meta name="dn:standfirst" content="A rock, and a pebble.">\n<meta property="og:description" content="A rock, and a pebble.">';
 assert.equal(S.rewrite('2026-12-01-crossword-mini-0150.html',s),s.replace(/A rock, and a pebble\./g,S.TEXT.mini));
});
test('STANDFIRST-04: GIVEN a page WHEN it is rewritten THEN only dn:standfirst and og:description change, kept equal',()=>{
 const s='<meta name="dn:standfirst" content="Old.">\n<meta property="og:description" content="Old.">\n<p>Old.</p>\nwindow.DN_PUZZLE={id:"x"};';
 const out=S.rewrite('2026-12-01-logic-tally-0040.html',s);
 assert.equal(out,s.replace(/content="Old\."/g,'content="'+S.TEXT.tally+'"'));
});
test('STANDFIRST-05: GIVEN every daily puzzle page, released ones too (Alec, 7 Nov 2026: the Archive matches) THEN each carries the house wording',()=>{
 // pages pinned by hash as reviewed legacy (registry-debt.json) keep their text: editing them needs a re-review
 const pinned=new Set(require('../fixtures/registry-debt.json').filter?.(e=>e&&e.sha256).map(e=>e.file)||[]);
 const files=fs.readdirSync(path.join(ROOT,'reports')).filter(f=>S.typeOf(f)&&!pinned.has(f));
 let n=0;for(const f of files){const s=fs.readFileSync(path.join(ROOT,'reports',f),'utf8');assert.equal(S.rewrite(f,s),s,f+' is not in the house wording');n++;}
 assert.ok(n>5500);
 const feed=require('../../../feed.json'),path_=feed.items.find(i=>i.type==='path');
 assert.equal(path_.standfirst,S.TEXT.path,'the feed is rebuilt from the pages');
});
/* Start pages (Alec, 8 Nov 2026): every open page says the house line; the rule sentence leads How to play. */
test('STANDFIRST-06: GIVEN the engines that draw a start page THEN each carries the house-line block generated from this wording, up to date',()=>{
 for(const rel of S.HOUSE_FILES){const src=fs.readFileSync(path.join(ROOT,rel),'utf8');
  assert.ok(src.includes(S.houseBlock()),rel+' house-line block is stale: run node tools/standfirst.js --sync');}
});
test('STANDFIRST-07: GIVEN every engine puzzle page WHEN its open page works out the house line THEN it is the card line standfirst.js gives it (Link: the day\'s trap count), and the house line on a pinned legacy page',()=>{
 const vm=require('node:vm'),{parseDnPuzzle}=require('../../puzzle-json');
 const line=vm.runInNewContext(S.houseBlock()+';dnHouseLine');
 const pinned=new Set(require('../fixtures/registry-debt.json').filter?.(e=>e&&e.sha256).map(e=>e.file)||[]);
 const seen={};let n=0;
 for(const f of fs.readdirSync(path.join(ROOT,'reports'))){const t=S.typeOf(f);if(!t)continue;
  const s=fs.readFileSync(path.join(ROOT,'reports',f),'utf8');if(!s.includes('window.DN_PUZZLE'))continue;
  const P=parseDnPuzzle(s,f);if(!P)continue;
  const want=pinned.has(f)?(t==='link'?S.link((P.traps||[]).length):S.TEXT[t]):S.forPage(f,s);
  assert.equal(line(t,P),want,f);seen[t]=(seen[t]||0)+1;n++;}
 for(const t of ['mini','doku','sweep','path','link','tangle','borders','reckon','tally'])assert.ok(seen[t]>0,'no '+t+' pages checked');
 assert.ok(n>5000,'checked '+n);
 const d32=fs.readFileSync(path.join(ROOT,'reports/2026-08-14-logic-doku-0032.html'),'utf8');
 assert.equal(line('doku',parseDnPuzzle(d32,'d32')),'A crossword with no clues. Place every letter so each line spells a word.','Doku 32 opens on the house line, not its pinned card line');
 assert.equal(line('link',{traps:[{},{},{}]}),'Four hidden groups. Can you find the links? Today, three tiles are bluffing.');
 assert.equal(line('link',{traps:[{}]}),'Four hidden groups. Can you find the links? Today, one tile is bluffing.');
});
