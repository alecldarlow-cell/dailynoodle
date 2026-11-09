'use strict';
/* Tumbler (engines/tumbler.js; reports/*-word-tumbler-NNNN.html, Lab from 6 Nov 2026): the house start card, real turns,
   a non-word refused, a wrong word's clues, a repeat refused, resume after a reload, the finish sheet with the share
   line and Lab address, the saved record and streak, a reopened board that logs no second finish, and the tracker. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path'),vm=require('vm');
const T=require('../../tumbler');
const FILE='reports/2026-11-06-word-tumbler-0010.html';
const P=vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,FILE),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')');
const READ=1,S=P.wheels[0].length;
/* turns to put a word on the yellow line, from the current offsets (wheels only turn down: offset decreases) */
async function make(p,word){
 for(let k=0;k<4;k++){
  for(let n=0;n<S;n++){
   const ch=await p.locator('.wheel').nth(k).locator('.tile').nth(READ).textContent();
   if(ch===word[k].toUpperCase())break;
   await H.tap(p,p.locator('#down'+(k+1)));
  }
 }
}
const OTHER=P.words.find(w=>w!==P.secret);
const NONWORD=(()=>{for(const a of P.wheels[0])for(const b of P.wheels[1])for(const c of P.wheels[2])for(const d of P.wheels[3]){const w=(a+b+c+d).toLowerCase();if(!P.words.includes(w))return w;}})();
test('TUMBLER-E2E-01: start card, turns, a non-word, a clue, a repeat, resume after a reload, finish sheet, saves, reopen',async({phone})=>{
 const p=phone.p;await goto(phone,FILE);
 await expect(p.locator('.dn-start')).toBeVisible();
 await expect(p.locator('.dn-start-title')).toHaveText('Tumbler');
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('.dn-name #pid')).toHaveText('Tumbler 10');
 await expect(p.locator('.wheel')).toHaveCount(4);
 await make(p,NONWORD);await H.tap(p,p.locator('#submitBtn'));
 await expect(p.locator('#msg')).toContainText('isn’t a word');
 await expect(p.locator('#tries .r')).toHaveCount(0);
 await make(p,OTHER);await H.tap(p,p.locator('#submitBtn'));
 await expect(p.locator('#tries .r')).toHaveCount(1);
 const want=T.feedback(OTHER,P.secret);
 expect(await p.locator('#tries .r b').evaluateAll(bs=>bs.map(b=>b.className).join(''))).toBe(want);
 await H.tap(p,p.locator('#submitBtn'));await expect(p.locator('#msg')).toContainText('already');
 await H.wait(p,1100);
 await p.reload();await H.wait(p,1500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('#tries .r')).toHaveCount(1);
 await expect(p.locator('#msg')).toContainText('Carrying on');
 await make(p,P.secret);await H.tap(p,p.locator('#submitBtn'));
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:5000});
 await expect(sheet.locator('.fin-kick')).toHaveText('Tumbler 10');await expect(sheet.locator('.fin-title')).toHaveText('Solved');
 const secs=await p.evaluate(()=>document.getElementById('statTime').textContent);
 expect(await sheet.locator('.fin-share-text').textContent()).toBe('🎛️ Tumbler #10 — '+secs+' · 2 submits');
 expect(await sheet.locator('.fin-share-url').textContent()).toBe('dailynoodle.co.uk/'+FILE);
 await expect(sheet.locator('.fin-clock')).toContainText('In development');
 await expect(sheet.locator('.fin-tumbler .word b')).toHaveCount(4);
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-tumbler-v1')));
 expect(save.done['DP·TUMB·0010'].t).toBe(secs);expect(save.done['DP·TUMB·0010'].n).toBe(2);expect(save.cur).toBeUndefined();
 expect((await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-tumbler-streak')))).streak).toBe(1);
 await p.reload();await H.wait(p,1500);
 expect(await p.evaluate(()=>document.documentElement.hasAttribute('data-dn-done'))).toBe(true);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible();
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(false);
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('TUMBLER-E2E-02: the tracker records one start on the first turn and one solved finish with the time',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-06T12:00:00Z')});
 await p.goto('https://dailynoodle.co.uk/'+FILE);await H.wait(p,1500);
 if(!await p.locator('script[src*="dn-track.js"]').count())await p.addScriptTag({url:'https://dailynoodle.co.uk/dn-track.js'});
 await H.wait(p,500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await make(p,P.secret);await H.tap(p,p.locator('#submitBtn'));
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:5000});
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,800);
 const puz=events.filter(e=>/^puzzle_/.test(e.ev)).map(e=>[e.ev,e.x.type,e.x.outcome,e.x.late]);
 expect(puz).toEqual([['puzzle_start','word-tumbler',undefined,undefined],['puzzle_end','word-tumbler','solved',undefined]]);
 expect(errors).toEqual([]);await ctx.close();
});
test('TUMBLER-E2E-03: GIVEN the solving submit WHEN the word is found THEN the line pops green and holds before the sheet; reduced motion opens it at once',async({phone})=>{
 const p=phone.p;await goto(phone,FILE);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await make(p,P.secret);
 // the beat (Alec, 9 Nov 2026): the found word is seen first, the sheet follows
 const t0=Date.now();await H.tap(p,p.locator('#submitBtn'));
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(false);
 await expect(p.locator('.tile.read.pop')).toHaveCount(4);
 expect(await p.evaluate(()=>!!JSON.parse(localStorage.getItem('digi-tumbler-v1')).done['DP·TUMB·0010'])).toBe(true);   // saved before the beat
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:5000});
 expect(Date.now()-t0).toBeGreaterThan(900);
 await expect(p.locator('.tile.read.won')).toHaveCount(4);await expect(p.locator('.tile.pop')).toHaveCount(0);
 await expect(p.locator('.tile.won:not(.read)')).toHaveCount(0);
 // reduced motion: no pop, the sheet opens on the submit
 await p.evaluate(()=>localStorage.clear());await p.emulateMedia({reducedMotion:'reduce'});
 await p.reload();await H.wait(p,1500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await make(p,P.secret);await H.tap(p,p.locator('#submitBtn'));
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:400});
 await expect(p.locator('.tile.read.pop')).toHaveCount(0);
 expect(phone.errors).toEqual([]);
});
