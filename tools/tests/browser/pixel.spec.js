'use strict';
/* Pixel (engines/pixel.js; reports/*-logic-pixel-NNNN.html, Lab build 12 Nov 2026): the house start card, real taps
   (fill, ✕, clear), a drag that paints a line, the Fill/Mark toggle, undo, Check (counted), an unfinished board kept
   across a reload, the picture's reveal and the shared finish sheet with the share line and Lab address, the saved
   record and streak, a reopened board that logs no second finish, and the tracker's one start and one finish. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path'),vm=require('vm');
const FILE='reports/2026-11-12-logic-pixel-0010.html';
const P=vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,FILE),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')');
const N=P.n,FILLED=[...P.sol].map((v,i)=>v==='1'?i:-1).filter(i=>i>=0),BLANK=[...P.sol].map((v,i)=>v==='0'?i:-1).filter(i=>i>=0);
const cell=(p,i)=>p.locator('#grid .cell').nth(i);
/* a full row of the picture to drag across (the umbrella's 8 rows), and the rest of the picture to tap */
const ROW=[...Array(N).keys()].find(r=>P.rows[r].length===1&&P.rows[r][0]===N);
async function drag(p,a,b){const A=await cell(p,a).boundingBox(),Bb=await cell(p,b).boundingBox();
 await p.mouse.move(A.x+A.width/2,A.y+A.height/2);await p.mouse.down();
 for(let k=1;k<=6;k++)await p.mouse.move(A.x+A.width/2+(Bb.x-A.x)*k/6,A.y+A.height/2+(Bb.y-A.y)*k/6);
 await p.mouse.up();}
test('PIXEL-E2E-01: start card, fill, ✕, clear, drag, toggle, undo, check, resume after a reload, reveal, sheet, saves, reopen',async({phone})=>{
 const p=phone.p;await goto(phone,FILE);
 await expect(p.locator('.dn-start')).toBeVisible();
 await expect(p.locator('.dn-start-title')).toHaveText('Pixel');
 await expect(p.locator('.dn-start-card h2+p')).toHaveText('Fill the squares the number clues call for, and a picture appears.');
 await expect(p.locator('.dn-start-art img')).toHaveAttribute('src','../assets/pixel-thumb.svg');
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('.dn-name #pid')).toHaveText('Pixel 10');
 await expect(p.locator('#grid .cell')).toHaveCount(N*N);
 await expect(p.locator('#rowClues .clue')).toHaveCount(N);await expect(p.locator('#colClues .clue')).toHaveCount(N);
 // tap cycles blank → filled → ✕ → blank
 const b=BLANK[0];
 await H.tap(p,cell(p,b));await expect(cell(p,b)).toHaveClass(/\bon\b/);
 await H.tap(p,cell(p,b));await expect(cell(p,b)).toHaveClass(/\bx\b/);
 await H.tap(p,cell(p,b));await expect(cell(p,b)).not.toHaveClass(/\bon\b|\bx\b/);
 // Mark: every tap is a ✕
 await H.tap(p,p.locator('#crossMode'));await expect(p.locator('#crossMode')).toHaveAttribute('aria-pressed','true');
 await H.tap(p,cell(p,b));await expect(cell(p,b)).toHaveClass(/\bx\b/);
 await H.tap(p,p.locator('#fillMode'));
 // a drag along the full row fills it, the row's clue greys, and one Undo takes the whole drag back
 await drag(p,ROW*N,ROW*N+N-1);
 for(let c=0;c<N;c++)await expect(cell(p,ROW*N+c)).toHaveClass(/\bon\b/);
 await expect(p.locator('#rowClues .clue').nth(ROW)).toHaveClass(/done/);
 await H.tap(p,p.locator('#undoBtn'));await expect(cell(p,ROW*N+N-1)).not.toHaveClass(/\bon\b/);
 await drag(p,ROW*N,ROW*N+N-1);
 // a wrong square, then Check: it is flagged and the check is counted
 const wrong=BLANK.find(i=>i!==b);await H.tap(p,cell(p,wrong));
 await H.tap(p,p.locator('#checkBtn'));await expect(p.locator('#msg')).toContainText('One square is wrong');
 await expect(cell(p,wrong)).toHaveClass(/wrong/);
 await H.tap(p,cell(p,wrong));await H.tap(p,cell(p,wrong));   // filled → ✕ → blank
 await H.wait(p,1200);
 // an unfinished board is kept: reload, Play, the row is still filled
 await p.reload();await H.wait(p,1500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('#msg')).toContainText('Carrying on');
 await expect(cell(p,ROW*N+N-1)).toHaveClass(/\bon\b/);
 const rest=FILLED.filter(i=>Math.floor(i/N)!==ROW);
 for(const i of rest)await H.tap(p,cell(p,i));
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:5000});
 await expect(p.locator('#grid .cell.shown')).toHaveCount(FILLED.length);   // the picture, in colour
 await expect(sheet.locator('.fin-kick')).toHaveText('Pixel 10');await expect(sheet.locator('.fin-title')).toHaveText('Solved');
 const secs=await p.evaluate(()=>document.getElementById('statTime').textContent);
 expect(await sheet.locator('.fin-share-text').textContent()).toBe('🖼️ Pixel #10 — '+secs);
 expect(await sheet.locator('.fin-share-url').textContent()).toBe('dailynoodle.co.uk/'+FILE);
 await expect(sheet.locator('.fin-clock')).toContainText('In development');
 await expect(sheet.locator('.fin-pixel i')).toHaveCount(N*N);
 await expect(sheet).toContainText(P.name);
 await expect(sheet.locator('.fin-note')).toContainText('Checks used: 1.');
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-pixel-v1')));
 expect(save.done['DP·PIXEL·0010'].t).toBe(secs);expect(save.done['DP·PIXEL·0010'].c).toBe(1);expect(save.cur).toBeUndefined();
 const streak=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-pixel-streak')));
 expect(streak.streak).toBe(1);
 await p.reload();await H.wait(p,1500);
 expect(await p.evaluate(()=>document.documentElement.hasAttribute('data-dn-done'))).toBe(true);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible();
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(false);
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('PIXEL-E2E-02: the tracker records one start on the first tap and one solved finish with the time and the check',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-12T12:00:00Z')});
 await p.goto('https://dailynoodle.co.uk/'+FILE);await H.wait(p,1500);
 if(!await p.locator('script[src*="dn-track.js"]').count())await p.addScriptTag({url:'https://dailynoodle.co.uk/dn-track.js'});
 await H.wait(p,500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await H.tap(p,cell(p,FILLED[0]));await H.tap(p,p.locator('#checkBtn'));
 for(const i of FILLED.slice(1))await H.tap(p,cell(p,i));
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:5000});
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,800);
 const puz=events.filter(e=>/^puzzle_/.test(e.ev)).map(e=>[e.ev,e.x.type,e.x.outcome,e.x.late]);
 expect(puz).toEqual([['puzzle_start','logic-pixel',undefined,undefined],['puzzle_end','logic-pixel','solved',undefined]]);
 expect(events.find(e=>e.ev==='puzzle_end').x.checks).toBe(1);
 expect(errors).toEqual([]);await ctx.close();
});
