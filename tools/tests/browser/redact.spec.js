'use strict';
/* Redact (engines/redact.js; reports/*-word-redact-NNNN.html, Lab from 6 Nov 2026): the house start card, real taps,
   a wrong try at the full count, undo and clear, an unfinished board kept across a reload, the shared finish sheet
   with the share line and Lab address, the saved record and streak, a reopened board that logs no second finish,
   and the tracker's one start and one finish. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path'),vm=require('vm');
const FILE='reports/2026-11-06-word-redact-0010.html';
const P=vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,FILE),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')');
const cell=(p,i)=>p.locator('#grid .cell').nth(i);
const WRONG=[...Array(P.n*P.n).keys()].find(i=>!P.black.includes(i));
test('REDACT-E2E-01: start card, taps, a wrong try, undo, clear, resume after a reload, finish sheet, saves, reopen',async({phone})=>{
 const p=phone.p;await goto(phone,FILE);
 await expect(p.locator('.dn-start')).toBeVisible();
 await expect(p.locator('.dn-start-title')).toHaveText('Redact');
 await expect(p.locator('.dn-start-card p')).toContainText('becomes a crossword');
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('.dn-name #pid')).toHaveText('Redact 10');
 await expect(p.locator('#grid .cell')).toHaveCount(P.n*P.n);
 // all but one of the answer, then a wrong square: the full count is reached, it shakes and says so
 for(const i of P.black.slice(0,-1))await H.tap(p,cell(p,i));
 await H.tap(p,cell(p,WRONG));
 await expect(p.locator('#count')).toHaveText(String(P.black.length));
 await expect(p.locator('#msg')).toContainText(/Not yet|on its own|only two letters/);   // names the rule broken (6 Nov 2026)
 await H.tap(p,p.locator('#undoBtn'));await expect(cell(p,WRONG)).not.toHaveClass(/black/);
 // Clear empties the board; Undo brings the squares back
 await H.tap(p,p.locator('#clearBtn'));await expect(p.locator('#count')).toHaveText('0');
 await H.tap(p,p.locator('#undoBtn'));await expect(p.locator('#count')).toHaveText(String(P.black.length-1));
 await H.wait(p,1200);
 // an unfinished board is kept: reload, Play, the black squares are back
 await p.reload();await H.wait(p,1500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('#count')).toHaveText(String(P.black.length-1));
 await expect(p.locator('#msg')).toContainText('Carrying on');
 await H.tap(p,cell(p,P.black[P.black.length-1]));
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:5000});
 await expect(sheet.locator('.fin-kick')).toHaveText('Redact 10');await expect(sheet.locator('.fin-title')).toHaveText('Solved');
 const secs=await p.evaluate(()=>document.getElementById('statTime').textContent);
 expect(await sheet.locator('.fin-share-text').textContent()).toBe('⬛ Redact #10 — '+secs);
 expect(await sheet.locator('.fin-share-url').textContent()).toBe('dailynoodle.co.uk/'+FILE);
 await expect(sheet.locator('.fin-clock')).toContainText('In development');
 await expect(sheet.locator('.fin-redact i')).toHaveCount(P.n*P.n);
 await expect(sheet.locator('.fin-note')).toContainText('1 wrong try');
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-redact-v1')));
 expect(save.done['DP·REDA·0010'].t).toBe(secs);expect(save.done['DP·REDA·0010'].m).toBe(1);expect(save.cur).toBeUndefined();
 const streak=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-redact-streak')));
 expect(streak.streak).toBe(1);
 await p.reload();await H.wait(p,1500);
 expect(await p.evaluate(()=>document.documentElement.hasAttribute('data-dn-done'))).toBe(true);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible();
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(false);
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('REDACT-E2E-02: the tracker records one start on the first tap and one solved finish with the time',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-06T12:00:00Z')});
 await p.goto('https://dailynoodle.co.uk/'+FILE);await H.wait(p,1500);
 if(!await p.locator('script[src*="dn-track.js"]').count())await p.addScriptTag({url:'https://dailynoodle.co.uk/dn-track.js'});
 await H.wait(p,500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 for(const i of P.black)await H.tap(p,cell(p,i));
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:5000});
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,800);
 const puz=events.filter(e=>/^puzzle_/.test(e.ev)).map(e=>[e.ev,e.x.type,e.x.outcome,e.x.late]);
 expect(puz).toEqual([['puzzle_start','word-redact',undefined,undefined],['puzzle_end','word-redact','solved',undefined]]);
 expect(errors).toEqual([]);await ctx.close();
});
