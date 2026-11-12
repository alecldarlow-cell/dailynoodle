'use strict';
/* Reach (engines/reach.js; reports/*-logic-reach-NNNN.html, Lab build 12 Nov 2026): the house start card, real moves with
   the working strip, a refused move, undo and reset, an unfinished board kept across a reload, the shared finish sheet
   with the share line and Lab address, the saved record and streak, a reopened board that logs no second finish,
   "Show a way" ending the round as revealed, and the tracker's one start and one finish. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path'),vm=require('vm');
const FILE='reports/2026-11-12-logic-reach-0010.html';
const P=vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,FILE),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')');
const SIGN={'+':'#opAdd','-':'#opSub','*':'#opMul','/':'#opDiv'};
/* play the stored shortest way by values: find each tile on the board, then tap tile, sign, tile */
async function play(p,way){
 for(const [a,op,b] of way){
  const vals=await p.locator('#tiles .tile').evaluateAll(es=>es.map(e=>e.classList.contains('gone')?null:+e.textContent));
  const ia=vals.indexOf(a),ib=vals.findIndex((v,i)=>v===b&&i!==ia);
  await H.tap(p,p.locator('#t'+ia));await H.tap(p,p.locator(SIGN[op]));await H.tap(p,p.locator('#t'+ib));await H.wait(p,200);
 }
}
test('REACH-E2E-01: start card, moves, refusal, undo, reset, resume after a reload, finish sheet, saves, reopen',async({phone})=>{
 const p=phone.p;await goto(phone,FILE);
 await expect(p.locator('.dn-start')).toBeVisible();
 await expect(p.locator('.dn-start-title')).toHaveText('Reach');
 await expect(p.locator('.dn-how p').first()).toContainText('Make '+P.target);
 await expect(p.locator('#timer')).toHaveText('0:00');
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('.dn-name #pid')).toHaveText('Reach 10');
 await expect(p.locator('#target')).toHaveText(String(P.target));
 await expect(p.locator('#tiles .tile')).toHaveCount(6);
 // a refused move: the larger from the smaller goes below zero; nothing changes
 const vals=P.tiles,lo=vals.indexOf(Math.min(...vals)),hi=vals.indexOf(Math.max(...vals));
 await H.tap(p,p.locator('#t'+lo));await H.tap(p,p.locator('#opSub'));await H.tap(p,p.locator('#t'+hi));
 await expect(p.locator('#msg')).toContainText('below zero');
 await expect(p.locator('#working li')).toHaveCount(0);
 await H.tap(p,p.locator('#t'+lo));   // deselect
 // the first step of the way: the made tile is blue, one tile is used up, the working strip shows it
 await play(p,P.way.slice(0,1));
 const [a,op,b,v]=P.way[0];
 await expect(p.locator('#working li')).toHaveText([a+' '+{'+':'+','-':'−','*':'×','/':'÷'}[op]+' '+b+' = '+v]);
 await expect(p.locator('#tiles .tile.made')).toHaveText([String(v)]);
 await expect(p.locator('#tiles .tile.gone')).toHaveCount(1);
 // undo takes it back exactly; reset after two moves brings back the six
 await H.tap(p,p.locator('#undoBtn'));await expect(p.locator('#working li')).toHaveCount(0);
 expect(await p.locator('#tiles .tile').allTextContents()).toEqual(P.tiles.map(String));
 await play(p,P.way.slice(0,2));await expect(p.locator('#working li')).toHaveCount(2);
 await H.tap(p,p.locator('#resetBtn'));await expect(p.locator('#working li')).toHaveCount(0);
 await expect(p.locator('#tiles .tile.gone')).toHaveCount(0);
 // an unfinished board is kept: reload, Play, the moves and the clock come back
 await play(p,P.way.slice(0,2));
 const clock=await p.locator('#timer').textContent();expect(clock).not.toBe('0:00');
 await p.reload();await H.wait(p,1500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('#working li')).toHaveCount(2);
 await expect(p.locator('#msg')).toContainText('Carrying on');
 const toS=t=>{const [m,s]=t.split(':').map(Number);return m*60+s;};
 expect(toS(await p.locator('#timer').textContent())).toBeGreaterThanOrEqual(toS(clock));
 // the last step reaches the target: the sheet
 await play(p,P.way.slice(2));
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:8000});
 await expect(sheet.locator('.fin-kick')).toHaveText('Reach 10');await expect(sheet.locator('.fin-title')).toHaveText('Solved');
 const secs=await p.evaluate(()=>document.getElementById('statTime').textContent);
 expect(await sheet.locator('.fin-share-text').textContent()).toBe('🎯 Reach #10 — '+secs);
 expect(await sheet.locator('.fin-share-url').textContent()).toBe('dailynoodle.co.uk/'+FILE);   // Lab: the page itself
 await expect(sheet.locator('.fin-clock')).toContainText('In development');
 await expect(sheet.locator('.fin-reach .fin-route.way li')).toHaveCount(P.way.length);
 await expect(sheet.locator('.fin-vote')).toHaveCount(0);   // no Lab vote until public.lab_vote accepts Reach
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(true);
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-reach-v1')));
 const rec=save.done['DP·REACH·0010'];
 expect(rec.t).toBe(secs);expect(rec.n).toBe(P.way.length);expect(rec.r).toBe(false);expect(save.cur).toBeUndefined();
 const streak=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-reach-streak')));
 expect(streak.streak).toBe(1);expect(streak.tz).toBe('L');
 // reopened: finished, the sheet open, no tracker "on"
 await p.reload();await H.wait(p,1500);
 expect(await p.evaluate(()=>document.documentElement.hasAttribute('data-dn-done'))).toBe(true);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible();
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(false);
 await expect(p.locator('#timer')).toHaveText(secs);
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('REACH-E2E-02: the tracker records one start on the first tap and one solved finish with the time',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-12T12:00:00Z')});
 await p.goto('https://dailynoodle.co.uk/'+FILE);await H.wait(p,1500);
 if(!await p.locator('script[src*="dn-track.js"]').count())await p.addScriptTag({url:'https://dailynoodle.co.uk/dn-track.js'});
 await H.wait(p,500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await play(p,P.way);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:8000});
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,800);
 const puz=events.filter(e=>/^puzzle_/.test(e.ev)).map(e=>[e.ev,e.x.type,e.x.outcome,e.x.late]);
 expect(puz).toEqual([['puzzle_start','logic-reach',undefined,undefined],['puzzle_end','logic-reach','solved',undefined]]);
 expect(Number.isFinite(events.find(e=>e.ev==='puzzle_end').x.secs)).toBe(true);
 expect(errors).toEqual([]);await ctx.close();
});
test('REACH-E2E-03: Show a way asks once more, then ends the round as revealed: no streak, the way shown, the tracker says revealed',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('https://dailynoodle.co.uk/'+FILE);await H.wait(p,1500);
 if(!await p.locator('script[src*="dn-track.js"]').count())await p.addScriptTag({url:'https://dailynoodle.co.uk/dn-track.js'});
 await H.wait(p,500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await play(p,P.way.slice(0,1));
 await H.tap(p,p.locator('#wayBtn'));
 await expect(p.locator('#revealAll')).toBeVisible();await expect(p.locator('#msg')).toContainText('unsolved');
 await H.tap(p,p.locator('#revealAll'));
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:8000});
 await expect(sheet.locator('.fin-title')).toHaveText('Shown');
 await expect(sheet.locator('.fin-reach .fin-route.way li')).toHaveCount(P.way.length);
 expect(await sheet.locator('.fin-share-text').textContent()).toBe('🎯 Reach #10 — shown a way');
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-reach-v1')));
 expect(save.done['DP·REACH·0010'].r).toBe(true);
 expect(await p.evaluate(()=>localStorage.getItem('digi-reach-streak'))).toBeNull();
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,800);
 const end=events.find(e=>e.ev==='puzzle_end');expect(end&&end.x.outcome).toBe('revealed');
 expect(errors).toEqual([]);await ctx.close();
});
