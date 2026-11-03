'use strict';
/* Tally (engines/tally.js; Lab pages reports/*-logic-tally-NNNN.html, 3 Nov 2026): the house start card, the
   board through real taps, an unfinished board kept across a reload, the shared finish sheet with the share
   line and Lab address, the saved record and streak, and a reopened puzzle that logs no second finish. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path'),vm=require('vm');
const FILE='reports/2026-11-03-logic-tally-0010.html';
const P=vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,FILE),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')');
const key=(p,d)=>p.locator('#keys button').nth(d-1);
const cell=(p,i)=>p.locator('.cell').nth(i);
async function open(phone){
 await goto(phone,FILE);
 await expect(phone.p.locator('.dn-start')).toBeVisible();
}
test('TALLY-E2E-01: start card, real taps, notes, a conflict, resume after a reload, finish sheet, saves, reopen',async({phone})=>{
 const p=phone.p;await open(phone);
 await expect(p.locator('.dn-start-title')).toHaveText('Tally');
 await expect(p.locator('.dn-start-card p')).toContainText('1 to 4');
 await expect(p.locator('#timer')).toHaveText('0:00');
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('.dn-start')).toBeHidden();
 // the slim bar carries the player-facing number, not the padded id
 await expect(p.locator('.dn-name #pid')).toHaveText('Tally 10');
 // a note, then a duplicate in the row: both cells go red; undo takes it back
 await H.tap(p,cell(p,0));await H.tap(p,p.locator('#notesBtn'));await H.tap(p,key(p,1));await H.tap(p,key(p,3));await H.tap(p,p.locator('#notesBtn'));
 expect(await cell(p,0).locator('.notes span.on').count()).toBe(2);
 const d0=+P.sol[0];
 await H.tap(p,cell(p,1));await H.tap(p,key(p,d0));await H.tap(p,cell(p,0));await H.tap(p,key(p,d0));
 await expect(cell(p,0)).toHaveClass(/bad/);await expect(cell(p,1)).toHaveClass(/bad/);
 await H.tap(p,p.locator('#undoBtn'));await expect(cell(p,0)).not.toHaveClass(/bad/);
 await H.wait(p,1200);
 const clock=await p.locator('#timer').textContent();expect(clock).not.toBe('0:00');
 // an unfinished board is kept: reload shows the start card again, Play brings the entries and the clock back
 await p.reload();await H.wait(p,1500);
 await expect(p.locator('.dn-start')).toBeVisible();await expect(p.locator('#timer')).toHaveText(clock);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(cell(p,1).locator('.val')).toHaveText(String(d0));
 await expect(p.locator('#msg')).toContainText('Carrying on');
 // solve it through the keypad
 await H.tap(p,cell(p,1));await H.tap(p,p.locator('#eraseBtn'));
 for(let i=0;i<16;i++){await H.tap(p,cell(p,i));await H.tap(p,key(p,+P.sol[i]));}
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:5000});
 await expect(sheet.locator('.fin-kick')).toHaveText('Tally 10');await expect(sheet.locator('.fin-title')).toHaveText('Solved');
 const secs=await p.evaluate(()=>document.getElementById('statTime').textContent);
 expect(await sheet.locator('.fin-share-text').textContent()).toBe('🧮 Tally #10 — '+secs);
 expect(await sheet.locator('.fin-share-url').textContent()).toBe('dailynoodle.co.uk/'+FILE);   // Lab: the page itself, not a short link
 await expect(sheet.locator('.fin-clock')).toContainText('In development');
 await expect(sheet.locator('.fin-tally i')).toHaveCount(16);
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(true);
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-tally-v1')));
 expect(save.done['DP·TALLY·0010'].t).toBe(secs);expect(save.done['DP·TALLY·0010'].d).toMatch(/^\d{4}-\d{2}-\d{2}$/);expect(save.cur).toBeUndefined();
 const streak=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-tally-streak')));
 expect(streak.streak).toBe(1);expect(streak.tz).toBe('L');
 // reopened: finished, the sheet open, no tracker "on"
 await p.reload();await H.wait(p,1500);
 expect(await p.evaluate(()=>document.documentElement.hasAttribute('data-dn-done'))).toBe(true);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible();
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(false);
 await expect(p.locator('#timer')).toHaveText(secs);
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('TALLY-E2E-02: the tracker records one start on the first board tap and one solved finish with the time',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-03T12:00:00Z')});
 await p.goto('https://dailynoodle.co.uk/'+FILE);await H.wait(p,1500);
 // the publish workflow adds the tracker line to a new page; until then the test adds it the same way
 if(!await p.locator('script[src*="dn-track.js"]').count())await p.addScriptTag({url:'https://dailynoodle.co.uk/dn-track.js'});
 await H.wait(p,500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 for(let i=0;i<16;i++){await H.tap(p,cell(p,i));await H.tap(p,key(p,+P.sol[i]));}
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:5000});
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,800);
 const puz=events.filter(e=>/^puzzle_/.test(e.ev)).map(e=>[e.ev,e.x.type,e.x.outcome,e.x.late]);
 expect(puz).toEqual([['puzzle_start','logic-tally',undefined,undefined],['puzzle_end','logic-tally','solved',undefined]]);
 expect(Number.isFinite(events.find(e=>e.ev==='puzzle_end').x.secs)).toBe(true);
 expect(errors).toEqual([]);await ctx.close();
});
