'use strict';
const {test,expect,H,goto,fullScreenOff}=require('./support');
const cases=[
 {type:'mini',file:'crossword-mini-0100',board:'#grid',targets:'#grid .cell:not(.block),#kb .key,.cluearrow,#checkWord,#checkAll,#revealWord,#fs'},
 {type:'doku',file:'logic-doku-0098',board:'#grid',targets:'#grid .cell,#bank .tile,#toggleHints,#fs'},
 {type:'path',file:'logic-path-0093',board:'#grid',targets:'#grid .cell,#undoBtn,#hintBtn'},
 {type:'sweep',file:'logic-sweep',board:'#grid',targets:'#grid .cell,#modeDig,#modeFlag,#hint,#fs'},
 {type:'link',file:'word-link-0072',board:'#board',targets:'#board .tile,#shuffle,#clear,#submit'},
 {type:'tangle',file:'word-tangle-0013',board:'#board',targets:'#board .tile,#homeBtn,#fsPlay'},
 {type:'borders',file:'geo-borders-0015',board:'#qmap',targets:'#opts .opt,#pauseBtn,#hintBtn'},
 {type:'reckon',page:'reports/2026-10-20-quiz-reckon-0001.html',board:'#slz',targets:'#slz,#minus,#act,#plus,#pauseBtn,.navb:not([disabled])'}
];
async function reachable(p,selectors){
 const problems=await p.locator(selectors).evaluateAll(elements=>elements.flatMap(e=>{
  const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')return [];
  const at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  const bad=r.x<-.5||r.y<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5||r.width<24||r.height<24||!at||!(at===e||e.contains(at));
  return bad?[{control:e.id||e.textContent,rect:{x:r.x,y:r.y,w:r.width,h:r.height},hit:!!at&&(at===e||e.contains(at))}]:[];
 }));expect(problems).toEqual([]);
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
// Reckon: the question (and after Lock in, the verdict) must be on screen, not squeezed under the bar.
const seen=(p,sel)=>p.locator(sel).evaluate(e=>{const b=e.getBoundingClientRect();if(!b.height)return false;const at=document.elementFromPoint(b.x+Math.min(b.width/2,40),b.y+Math.min(b.height/2,10));return !!at&&(at===e||e.contains(at));});
for(const c of cases)test('MOBILE: '+c.type+' board and controls survive small phones and rotation',async({phone},testInfo)=>{
 const {p}=phone;await p.setViewportSize({width:320,height:568});await goto(phone,c.page||'reports/2026-10-19-'+c.file+'.html');
 // Chromium cannot resize its OS window while fullscreen. Use the player's
 // real setting for this browser-window rotation check.
 const own=['tangle','borders','reckon'].includes(c.type);
 if(own)await fullScreenOff(p,testInfo);
 const start=p.locator(own?'#playCard':'#dnPlay');await start.click();
 await H.wait(p,c.type==='tangle'?4000:500);await p.evaluate(()=>document.fonts.ready);await H.wait(p,200);
 await reachable(p,c.targets);
 // Real input before rotation: it must survive a layout change, and remain usable after it.
 if(c.type==='mini')await p.locator('#kb .key').filter({hasText:/^A$/}).click();
 if(c.type==='link')await p.locator('#board .tile').first().click();
 if(c.type==='tangle')await H.tap(p,p.locator('#board .tile').first());
 if(c.type==='reckon')await p.locator('#plus').click();
 const state={borders:'#opts',reckon:'#mid'}[c.type]||c.board;
 const before=await p.locator(state).textContent();
 for(const [width,height] of [[780,360],[568,320],[320,568]]){
  await p.setViewportSize({width,height});await H.wait(p,400);await reachable(p,c.targets);
  expect(await p.locator(state).textContent()).toBe(before);
  const r=await p.locator(c.board).boundingBox();
  if(c.type==='reckon'){expect(r.width).toBeGreaterThanOrEqual(240);expect(await seen(p,'#q')).toBe(true);}
  else if(c.type!=='link'){expect(r.width).toBeGreaterThanOrEqual(200);expect(r.height).toBeGreaterThanOrEqual(200);}
 }
 if(c.type==='mini'){
  expect(await p.locator('#grid .ltr').allTextContents()).toContain('A');
  await p.locator('#kb .key').filter({hasText:/^B$/}).click();expect(await p.locator('#grid .ltr').allTextContents()).toContain('B');
 }
 if(c.type==='reckon'){
  await p.setViewportSize({width:780,height:360});await H.wait(p,400);await p.locator('#act').click();await H.wait(p,900);   // lock in on its side
  for(const [width,height] of [[780,360],[568,320],[320,568]]){
   await p.setViewportSize({width,height});await H.wait(p,400);
   expect(await seen(p,'#q')).toBe(true);expect(await seen(p,'#fbV')).toBe(true);await reachable(p,'#act,#pauseBtn');
  }
 }
 if(c.type==='tangle'){
  await H.tap(p,p.locator('#board .tile').nth(1));expect(await p.locator('#board .tile.on').count()).toBe(2);
 }
 if(['mini','link'].includes(c.type)){
  // Simulate enlarged control text without compounding inherited font sizes.
  await p.locator('.controls button').evaluateAll(es=>{const sizes=es.map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const [e,n] of sizes)e.style.fontSize=n*1.5+'px';dispatchEvent(new Event('resize'));});
  await H.wait(p,400);await reachable(p,c.targets);
  expect(await p.locator('.controls button:visible').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2).map(e=>e.id))).toEqual([]);
 }
 if(c.type==='link'){
  expect(await p.locator('#board .tile.sel').count()).toBe(1);
  const clipped=await p.locator('#board .tile').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2).map(e=>e.textContent));
  expect(clipped).toEqual([]);expect(await p.locator('#board .tile').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
 }
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});

test('MOBILE: a tapped result Share button keeps its contrasting background',async({phone})=>{
 const {p}=phone;await p.setViewportSize({width:320,height:568});
 await goto(phone,'reports/2026-10-19-crossword-mini-0100.html');
 await p.evaluate(()=>localStorage.setItem('digi-mini-v1',JSON.stringify({v:1,done:{[window.DN_PUZZLE.id]:{s:60,d:'2026-10-19'}}})));
 await p.reload();await H.wait(p,1800);
 const share=p.locator('.fin-share-btn');await expect(share).toBeVisible();
 const background=await share.evaluate(e=>getComputedStyle(e).backgroundColor);
 await share.hover();await expect(share).toHaveCSS('background-color',background);
 expect(phone.errors).toEqual([]);
});
