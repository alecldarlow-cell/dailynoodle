'use strict';
// STATS: your stats (stats.html + dn-stats.js, SITE.md › Archive and personal stats, 6 Nov 2026).
const {test,expect,goto}=require('./support');
const H=require('../harness');
const feed=require('../../../feed.json');
const items=(feed.items||[]).filter(it=>it.kind==='puzzle'&&!it.badge&&it.type&&it.date&&it.date<'2026-10-19');
const minis=items.filter(it=>it.type==='mini').slice(-6);   // six Minis before 19 Oct
async function seed(ctx,map){await ctx.addInitScript(s=>{const o=JSON.parse(s);for(const k in o)try{localStorage.setItem(k,JSON.stringify(o[k]));}catch(e){}},JSON.stringify(map));}

test('STATS-WEB-01: GIVEN no saves WHEN the page opens THEN it invites a first puzzle and shows no figures',async({phone})=>{
 await goto(phone,'stats.html');
 await expect(phone.p.locator('.st-empty')).toContainText('Finish a puzzle');
 await expect(phone.p.locator('.st-tile')).toHaveCount(0);
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});

test('STATS-WEB-02: GIVEN Minis on the day and one catch-up WHEN shown THEN bests, medians and the split are right and nothing is written',async({phone})=>{
 const done={};minis.forEach((it,i)=>{done[it.id]={s:60+i*10,d:i===5?'2026-10-18':it.date};});
 if(minis[5].date==='2026-10-18')done[minis[5].id].d='2026-10-19';
 await seed(phone.ctx,{'digi-mini-v1':{v:1,done}});
 await phone.ctx.addInitScript(()=>{const set=Storage.prototype.setItem;window.__writes=[];Storage.prototype.setItem=function(k,v){if(/^digi-.*-(v1|streak)$/.test(k))window.__writes.push(k);return set.call(this,k,v);};});
 await goto(phone,'stats.html');
 const card=phone.p.locator('#st-mini');
 await expect(card).toContainText('6 puzzles finished');
 await expect(card.locator('dd').first()).toHaveText('1:00');
 await expect(card).toContainText('Median');
 await expect(card.locator('.st-col')).not.toHaveCount(0);
 await expect(phone.p.locator('#st-modes')).toBeVisible();
 await H.tap(phone.p,phone.p.locator('#st-modes button[data-m="archive"]'));await H.wait(phone.p,100);
 await expect(phone.p.locator('#st-mini')).toContainText('1 puzzle finished');
 await expect(phone.p.locator('#st-mini')).toContainText('Medians and charts appear after 3');
 await H.tap(phone.p,phone.p.locator('#st-modes button[data-m="day"]'));await H.wait(phone.p,100);
 await expect(phone.p.locator('#st-mini')).toContainText('5 puzzles finished');
 expect(await phone.p.evaluate(()=>window.__writes)).toEqual([]);
 expect(phone.errors).toEqual([]);
});

test('STATS-WEB-03: GIVEN December WHEN 10+ results this year THEN the year card shows and shares one line with no link',async({browser})=>{
 const ctx=await H.newPhone(browser);const p=await ctx.newPage();
 const done={};for(let i=1;i<=12;i++)done['DP·MINI·9'+String(i).padStart(3,'0')]={s:50+i,d:'2026-11-'+String(i).padStart(2,'0')};
 await seed(ctx,{'digi-mini-v1':{v:1,done}});
 await ctx.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{window.__copied=t;return Promise.resolve();}},configurable:true});});
 await p.clock.install({time:new Date('2026-12-03T12:00:00Z')});
 await p.goto('https://dailynoodle.co.uk/stats.html');await H.wait(p,1500);
 await expect(p.locator('.st-year h2')).toHaveText('Your 2026 in Noodle');
 await p.evaluate(()=>{window.matchMedia=()=>({matches:false});});
 await p.locator('#st-share').click();await H.wait(p,100);
 const t=await p.evaluate(()=>window.__copied);
 expect(t).toBe('🍜 My 2026 in Noodle — 12 puzzles · 12 days · 🔥12 best run · Mini most');
 expect(t).not.toMatch(/https?:|\.co\.uk/);
 await ctx.close();
});

test('STATS-WEB-04: GIVEN saves WHEN Puzzles opens THEN a Your stats link shows; with none it stays hidden',async({phone})=>{
 await goto(phone,'puzzles.html');
 await expect(phone.p.locator('#statslink')).toBeHidden();
 await phone.p.evaluate(m=>localStorage.setItem('digi-mini-v1',JSON.stringify({v:1,done:{[m]:{s:40,d:'2026-10-18'}}})),minis[0].id);
 await phone.p.reload();await H.wait(phone.p,1500);
 await expect(phone.p.locator('#statslink')).toBeVisible();
 await expect(phone.p.locator('#statslink')).toHaveAttribute('href','stats.html?from=puzzles');
});

test('STATS-WEB-05: GIVEN a small phone in dark mode WHEN stats open THEN stats_open is sent, nothing spills and no errors show',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{width:320,height:568,scheme:'dark',events});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const done={};minis.forEach((it,i)=>{done[it.id]={s:60+i*25,d:it.date};});
 await seed(ctx,{'digi-mini-v1':{v:1,done},'digi-tangle-v1':{v:1,done:{x:{o:'played',s:40,w:12,st:true,d:'2026-10-10'}}}});
 await p.clock.install({time:new Date('2026-10-19T12:00:00+01:00')});
 await p.goto('https://dailynoodle.co.uk/stats.html?from=puzzles');await H.wait(p,1500);
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,200);
 const open=events.find(e=>e.ev==='stats_open');
 expect(open&&open.x.from).toBe('puzzles');
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(p.locator('#st-tangle')).toContainText('Star word');
 expect(errs).toEqual([]);
 await ctx.close();
});

test('FEATURES-01: GIVEN features.json switches archive and stats off WHEN the pages open THEN their links hide and the pages go to Puzzles',async({phone})=>{
 // As published both are on.
 expect(require('../../../features.json')).toEqual({archive:true,stats:true});
 await phone.ctx.route('**/features.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({archive:false,stats:false})}));
 await phone.ctx.addInitScript(m=>localStorage.setItem('digi-mini-v1',JSON.stringify({v:1,done:{[m]:{s:40,d:'2026-10-18'}}})),minis[0].id);
 await goto(phone,'puzzles.html');
 await expect(phone.p.locator('#statslink')).toBeHidden();
 await expect(phone.p.locator('[data-feature="archive"]')).toBeHidden();
 await expect(phone.p.locator('[data-feature="stats"]')).toBeHidden();
 for(const page of ['archive.html','stats.html']){
  await phone.p.goto('https://dailynoodle.co.uk/'+page);await H.wait(phone.p,800);
  await expect(phone.p).toHaveURL(/\/puzzles\.html$/);
 }
});

test('FEATURES-02: GIVEN features.json can\'t be read WHEN Puzzles opens THEN the links stay, as switched on',async({phone})=>{
 await phone.ctx.route('**/features.json',r=>r.fulfill({status:404,body:''}));
 await goto(phone,'puzzles.html');
 await expect(phone.p.locator('[data-feature="archive"]')).toBeAttached();
 expect(await phone.p.locator('[data-feature="archive"]').evaluate(e=>e.hidden)).toBe(false);
 await phone.p.goto('https://dailynoodle.co.uk/stats.html');await H.wait(phone.p,800);
 await expect(phone.p).toHaveURL(/\/stats\.html$/);
});
