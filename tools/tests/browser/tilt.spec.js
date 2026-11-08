'use strict';
/* Tilt (engines/tilt.js; reports/*-logic-tilt-NNNN.html, Lab from 6 Nov 2026): the house start card, real turns with the
   trail and undo, an unfinished maze kept across a reload, the shared finish sheet with the share line and Lab address,
   the saved record and streak, a reopened maze that logs no second finish, and the tracker's one start and one finish. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path'),vm=require('vm');
const T=require('../../tilt');
const FILE='reports/2026-11-06-logic-tilt-0010.html';
const P=vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,FILE),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')');
/* the shortest way out as button ids: the generator's +1 turn is the maze turning left on screen */
const ROUTE=(()=>{let g=0;return T.solve(P.walls,P.n,P.start,P.exit).route.map(m=>{const d=(m.g-g+4)%4;g=m.g;return d===1?'#leftBtn':'#rightBtn';});})();
async function turnAll(p,ids){for(const id of ids){await H.tap(p,p.locator(id));await H.wait(p,1300);}}
test('TILT-E2E-01: start card, turns with a trail, undo, resume after a reload, finish sheet, saves, reopen',async({phone})=>{
 const p=phone.p;await goto(phone,FILE);
 await expect(p.locator('.dn-start')).toBeVisible();
 await expect(p.locator('.dn-start-title')).toHaveText('Tilt');
 // the open page says the house line; the rule sentence leads How to play (Alec, 8 Nov 2026)
 await expect(p.locator('.dn-start-card h2+p')).toHaveText("Turn the maze and the ball rolls. Get it out as fast as you can.");
 await expect(p.locator('.dn-how p').first()).toContainText('the clock is the score');
 await expect(p.locator('#timer')).toHaveText('0:00');
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('.dn-start')).toBeHidden();
 await expect(p.locator('.dn-name #pid')).toHaveText('Tilt 10');
 // two turns of the route: the count moves, the maze is turned, the cells passed are shaded
 await turnAll(p,ROUTE.slice(0,2));
 await expect(p.locator('#turns')).toHaveText('2');
 expect(await p.locator('#maze .cell.trail').count()).toBeGreaterThan(1);
 // a third turn the wrong way, then Undo takes it back exactly
 const trail2=await p.locator('#maze .cell.trail').count(),rot2=await p.locator('#maze').evaluate(e=>e.style.transform);
 await turnAll(p,[ROUTE[2]==='#leftBtn'?'#rightBtn':'#leftBtn']);
 await expect(p.locator('#turns')).toHaveText('3');
 await H.tap(p,p.locator('#undoBtn'));await H.wait(p,300);
 await expect(p.locator('#turns')).toHaveText('2');
 expect(await p.locator('#maze .cell.trail').count()).toBe(trail2);
 expect(await p.locator('#maze').evaluate(e=>e.style.transform)).toBe(rot2);
 const clock=await p.locator('#timer').textContent();expect(clock).not.toBe('0:00');
 // an unfinished maze is kept: reload shows the start card, Play brings the ball, the turns and the clock back
 await p.reload();await H.wait(p,1500);
 await expect(p.locator('.dn-start')).toBeVisible();
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('#turns')).toHaveText('2');
 await expect(p.locator('#msg')).toContainText('Carrying on');
 const toS=t=>{const [m,s]=t.split(':').map(Number);return m*60+s;};
 expect(toS(await p.locator('#timer').textContent())).toBeGreaterThanOrEqual(toS(clock));
 // the rest of the route, with quick taps (queued during the animation, never dropped)
 for(const id of ROUTE.slice(2)){await H.tap(p,p.locator(id));await H.wait(p,150);}
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:15000});
 await expect(sheet.locator('.fin-kick')).toHaveText('Tilt 10');await expect(sheet.locator('.fin-title')).toHaveText('Out');
 const secs=await p.evaluate(()=>document.getElementById('statTime').textContent);
 expect(await sheet.locator('.fin-share-text').textContent()).toBe('🌀 Tilt #10 — '+secs+' · '+P.par+' turns');
 expect(await sheet.locator('.fin-share-url').textContent()).toBe('dailynoodle.co.uk/'+FILE);   // Lab: the page itself
 await expect(sheet.locator('.fin-clock')).toContainText('In development');
 await expect(sheet.locator('.fin-tilt svg .route')).toHaveCount(1);
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(true);
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-tilt-v1')));
 expect(save.done['DP·TILT·0010'].t).toBe(secs);expect(save.done['DP·TILT·0010'].n).toBe(P.par);expect(save.cur).toBeUndefined();
 const streak=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-tilt-streak')));
 expect(streak.streak).toBe(1);expect(streak.tz).toBe('L');
 // reopened: finished, the sheet open, no tracker "on"
 await p.reload();await H.wait(p,1500);
 expect(await p.evaluate(()=>document.documentElement.hasAttribute('data-dn-done'))).toBe(true);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible();
 expect(await p.evaluate(()=>document.getElementById('modal').classList.contains('on'))).toBe(false);
 await expect(p.locator('#timer')).toHaveText(secs);
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('TILT-E2E-02: the tracker records one start on the first turn and one solved finish with the time',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-06T12:00:00Z')});
 await p.goto('https://dailynoodle.co.uk/'+FILE);await H.wait(p,1500);
 if(!await p.locator('script[src*="dn-track.js"]').count())await p.addScriptTag({url:'https://dailynoodle.co.uk/dn-track.js'});
 await H.wait(p,500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await turnAll(p,ROUTE);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:8000});
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,800);
 const puz=events.filter(e=>/^puzzle_/.test(e.ev)).map(e=>[e.ev,e.x.type,e.x.outcome,e.x.late]);
 expect(puz).toEqual([['puzzle_start','logic-tilt',undefined,undefined],['puzzle_end','logic-tilt','solved',undefined]]);
 expect(Number.isFinite(events.find(e=>e.ev==='puzzle_end').x.secs)).toBe(true);
 expect(errors).toEqual([]);await ctx.close();
});
