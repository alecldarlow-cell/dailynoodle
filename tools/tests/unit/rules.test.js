'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const {clueProblems,norm}=require('../../check-mini-clues'),{auditPuzzle}=require('../../check-clue-leaks');
const {G,grade,threadKey,seqOf}=require('../../build-path-batch'),{read}=require('../read-puzzle');
const ROOT=path.resolve(__dirname,'../../..'),data=f=>read(path.join(ROOT,'reports',f));
test('MINI-01: clue roots, crossings and UK wording',()=>{
 assert.ok(auditPuzzle({clues:{water:'Watering the plants',plant:'Green organism'}}).some(x=>x.kind==='SELF-LEAK'));
 assert.ok(auditPuzzle({clues:{atlas:'A map of the river',river:'Watercourse'}}).some(x=>x.kind==='CROSS-LEAK'));
 assert.deepEqual(auditPuzzle({clues:{atlas:'Book of maps',river:'Watercourse'}}),[]);
 assert.ok(clueProblems('pan','A skillet').some(x=>x.kind==='AMERICAN'));
 assert.ok(clueProblems('mum','Keeping quiet about it').some(x=>x.kind==='PRONOUN'));
 assert.deepEqual(clueProblems('hat','The rabbit comes out of it'),[]);
 assert.equal(norm('Book of maps!'),norm('book of maps.'));
});
test('PATH-01: real unique board, broken thread and wrong lock',()=>{
 const p=data('2026-11-01-logic-path-0106.html');assert.equal(G.validatePath(p).pass,true);assert.deepEqual(grade(p).breaks,[]);
 const bad=JSON.parse(JSON.stringify(p));bad.solution[0][0]=bad.solution[0][1];assert.throws(()=>G.validatePath(bad));
 const lock=JSON.parse(JSON.stringify(p));lock.locked[0][2]=lock.locked[0][2]===1?2:1;assert.equal(G.validatePath(lock).pass,false);
});
test('PATH-01: dedup recognises rotation, mirror and reversal',()=>{
 const seq=seqOf(data('2026-11-01-logic-path-0106.html').solution),key=threadKey(seq);
 for(const s of [seq.slice().reverse(),seq.map(i=>(i%6)*6+5-Math.floor(i/6)),seq.map(i=>Math.floor(i/6)*6+5-i%6)])assert.equal(threadKey(s),key);
});
test('LINK: duplicate tiles and missing groups fail the gate',()=>{
 const {G}=require('../../build-link-batch'),p=data('2026-10-19-word-link-0072.html');assert.equal(G.validateLink(p).pass,true);
 const bad=JSON.parse(JSON.stringify(p));bad.groups[1].members[0]=bad.groups[0].members[0];assert.equal(G.validateLink(bad).pass,false);bad.groups.pop();assert.equal(G.validateLink(bad).pass,false);
});
test('DOKU-01: independent broader dictionary detects a deliberately ambiguous board',()=>{
 const {broadAlts}=require('../../doku-broad-check'),p=data('2026-10-19-logic-doku-0098.html');assert.equal(broadAlts(p),0);
 const loose=JSON.parse(JSON.stringify(p));for(const [r,c] of loose.locked)loose.bank.push(loose.grid[r-1][c-1]);loose.locked=[];assert.ok(broadAlts(loose,20)>0);
});
test('CITIES-02: production engine replays seed/moves exactly; illegal moves are atomic',()=>{
 const src=fs.readFileSync(path.join(ROOT,'reports/2026-10-16-strategy-ancient-cities.html'),'utf8');
 const a=src.indexOf('const AC=(function(){'),b=src.indexOf('\n})();',a)+6;assert.ok(a>=0&&b>a);
 const AC=vm.runInNewContext(src.slice(a,b)+'\nAC;',{}, {timeout:5000});
 const project=s=>JSON.stringify([s.scores,s.turn,s.offer,s.moves,s.tiles,s.over]);
 for(const seed of process.env.DN_NIGHTLY?[1,7,42,12345,20261019]:[42,20261019]){
  const s=AC.newMatch(0,seed);assert.equal(project(s),project(AC.newMatch(0,seed)));
  const before=project(s);assert.throws(()=>AC.play(s,99,999,999,0),/illegal move/);assert.equal(project(s),before);
  for(let k=0;k<12&&!s.over;k++){const m=AC.legal(s,s.offer[0])[0];assert.ok(m);AC.play(s,0,m.x,m.y,m.rots[0]);assert.ok(s.scores.every(Number.isFinite));assert.ok(s.scores.every(n=>n>=0));}
  assert.equal(project(s),project(AC.replay(0,seed,undefined,s.moves)));
 }
});
test('GLASS-01: every promised rare find fits over many seeded layouts',()=>{
 const src=fs.readFileSync(path.join(ROOT,'reports/2026-09-28-arcade-sea-glass.html'),'utf8');
 const dims=src.match(/const COLS=[^;]+;/)[0],balance=src.match(/const BAL=\{[^;]+;/)[0];
 const code=src.slice(src.indexOf('function placeFinds('),src.indexOf('/* ---------- end engine ---------- */'));
 const place=vm.runInNewContext(dims+balance+code+'\nplaceFinds;');
 for(let seed=1;seed<=(process.env.DN_NIGHTLY?2000:100);seed++){
  let state=seed;const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const found=place(rng,['a','b','c']);assert.equal(found.length,3,'seed '+seed);
  for(let i=0;i<found.length;i++){const a=found[i];assert.ok(a.r>=6&&a.r<8&&a.c>=0&&a.c<7);for(let j=0;j<i;j++)assert.ok(Math.abs(a.r-found[j].r)+Math.abs(a.c-found[j].c)>=3);}
 }
});
