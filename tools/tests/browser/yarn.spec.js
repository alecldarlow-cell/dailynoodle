'use strict';
/* Yarn, the game of the daily Tangle (reports/2026-10-24-quiz-yarn.html) */
const {test,expect,H,goto}=require('./support');
const FILE='reports/2026-10-24-quiz-yarn.html';
async function open(phone){
 await phone.ctx.addInitScript(()=>{window.__DGTEST=true;window.__yev=JSON.parse(sessionStorage.getItem('yev')||'[]');
  window.digi={track:(ev,x)=>{window.__yev.push({ev,x});sessionStorage.setItem('yev',JSON.stringify(window.__yev));}};});
 await phone.ctx.route('**/dn-track.js',r=>r.fulfill({status:200,body:''}));
 await goto(phone,FILE);
 await expect(phone.p.locator('#hPlay')).toBeVisible();
}
const ev=p=>p.evaluate(()=>window.__yev.map(e=>[e.ev,e.x.level,e.x.start||e.x.win]));
const live=p=>expect.poll(()=>p.evaluate(()=>{const s=__dg.state();return !!s.R&&s.R.state==='playing'&&!s.counting&&!s.paused;}),{timeout:6000}).toBe(true);

test('YARN-01: a word entered by tapping scores; one star clears the level and opens the next',async({phone})=>{
 await open(phone);const p=phone.p;
 await expect(p.locator('#hStatus')).toContainText('Stars at 14, 29, 42 points');
 await H.tap(p,p.locator('#hPlay'));await live(p);
 const w=await p.evaluate(()=>__dg.level(1).main.find(x=>x.length===4));
 const path=await p.evaluate(w=>__dg.pathOf(w),w);
 for(const i of path)await H.tap(p,p.locator(`.tile[data-i="${i}"]`));
 await H.tap(p,p.locator(`.tile[data-i="${path[path.length-1]}"]`));
 await expect(p.locator('#score')).toHaveText('2');
 await expect(p.locator(`#list .w[data-w="${w}"]`)).toBeVisible();
 await p.evaluate(()=>__dg.end(true));
 await expect(p.locator('#result')).toBeVisible();await expect(p.locator('#rStars .got')).toHaveCount(1);
 expect(await p.evaluate(()=>__dg.state().save.lv[1].s)).toBe(1);
 await H.tap(p,p.locator('#rNext'));await live(p);
 expect(await p.evaluate(()=>__dg.state().L.n)).toBe(2);
 expect(await ev(p)).toEqual([['game_start',1,'new'],['game_end',1,true],['game_start',2,'new']]);
});

test('YARN-02: a loss opens nothing; restart is a new round and a reload resumes the paused one',async({phone})=>{
 await open(phone);const p=phone.p;
 await H.tap(p,p.locator('#hPlay'));await live(p);
 await p.evaluate(()=>__dg.end(false));await expect(p.locator('#result')).toBeVisible();
 await expect(p.locator('#rNext')).toBeHidden();await expect(p.locator('#rVerdict')).toContainText('14 points clears this level');
 expect(await p.evaluate(()=>__dg.state().save.lv[1])).toBeUndefined();
 await H.tap(p,p.locator('#rRetry'));await live(p);
 const w=await p.evaluate(()=>__dg.level(1).main[0]);await p.evaluate(w=>__dg.submitWord(w),w);
 await H.tap(p,p.locator('#pauseBtn'));await expect(p.locator('#pauseSheet')).toBeVisible();
 await H.tap(p,p.locator('#pRestart'));await live(p);
 expect(await p.evaluate(()=>__dg.state().R.score)).toBe(0);
 await p.evaluate(w=>__dg.submitWord(w),w);
 await H.tap(p,p.locator('#pauseBtn'));
 await p.reload();await expect(p.locator('#hGo')).toHaveText('Resume');
 await H.tap(p,p.locator('#hPlay'));await live(p);
 expect(await p.evaluate(()=>__dg.state().R.found)).toEqual([w]);
 expect(await ev(p)).toEqual([['game_start',1,'new'],['game_end',1,false],['game_start',1,'retry'],['game_start',1,'retry'],['game_start',1,'resume']]);
 expect(phone.errors).toEqual([]);
});

test('YARN-03: today\'s Tangle card links to today\'s daily and reads its result',async({phone})=>{
 await phone.ctx.addInitScript(()=>{const d=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
  const t=d.year+'-'+d.month+'-'+d.day,n=String(Math.round((Date.parse(t+'T12:00:00Z')-Date.parse('2026-10-07T12:00:00Z'))/864e5)+1).padStart(4,'0');
  localStorage.setItem('digi-tangle-v1',JSON.stringify({v:1,done:{['DP·TANG·'+n]:{s:31}},days:{['DP·TANG·'+n]:{state:'done',found:['zzzz','yyyy']}}}));window.__tn=t+'-word-tangle-'+n+'.html';});
 await open(phone);const p=phone.p;
 expect(await p.locator('#dailyCard').getAttribute('href')).toBe(await p.evaluate(()=>window.__tn));
 await expect(p.locator('#dailyStatus')).toHaveText('Played today: 31 points');
 await expect(p.locator('#sWords')).toHaveText('2');
});

test('YARN-04: Back during a round opens the pause sheet instead of leaving; Back after the round leaves',async({phone})=>{
 await open(phone);const p=phone.p;const url=p.url();
 await H.tap(p,p.locator('#hPlay'));await live(p);
 await p.goBack();await expect(p.locator('#pauseSheet')).toBeVisible();expect(p.url()).toBe(url);
 expect(await p.evaluate(()=>__dg.state().R.state)).toBe('playing');
 await H.tap(p,p.locator('#pResume'));await live(p);
 await p.evaluate(()=>__dg.end(true));await expect(p.locator('#result')).toBeVisible();
 expect(await p.evaluate(()=>history.state)).toBeNull();
 expect(await ev(p)).toEqual([['game_start',1,'new'],['game_end',1,true]]);
 expect(phone.errors).toEqual([]);
});
