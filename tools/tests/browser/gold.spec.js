'use strict';
// GOLD-WEB: gold stars (21 Nov 2026, Alec; SITE.md › Gold stars). A really good result, by dnCore.gold's
// rules, puts a gold star in place of the tick on Puzzles and in the Archive, and the finish sheet
// says so. Rules themselves: tools/tests/unit/gold.test.js.
const {test,expect,goto}=require('./support');
const H=require('../harness');
const feed=require('../../../feed.json');

const items=(feed.items||[]).filter(it=>it.kind==='puzzle'&&!it.badge&&it.type&&it.date&&it.id);
const of=type=>items.filter(it=>it.type===type);
async function seed(phone,by){
 await phone.ctx.addInitScript(s=>{const o=JSON.parse(s);for(const t in o)try{localStorage.setItem('digi-'+t+'-v1',JSON.stringify({v:1,done:o[t]}));}catch(e){}},JSON.stringify(by));
}
const all=(type,rec)=>Object.fromEntries(of(type).map(it=>[it.id,Object.assign({d:it.date},rec)]));

test('GOLD-WEB-01: GIVEN a perfect Borders and a slow Path WHEN Puzzles draws its cards THEN Borders wears the gold star and Path keeps its tick',async({phone})=>{
 await seed(phone,{borders:all('borders',{c:10,p:1000,secs:80,ans:[]}),path:all('path',{t:'01:30'})});
 await goto(phone,'puzzles.html');
 const b=phone.p.locator('li.puzzle-card.is-played:not([hidden]) a.card[href*="-geo-borders-"]').first();
 await expect(b.locator('.played-mark.gold svg')).toHaveCount(1);
 await expect(b.locator('.card-result.gold')).toHaveText('1000 points · 10/10 · gold star');
 const p=phone.p.locator('li.puzzle-card.is-played:not([hidden]) a.card[href*="-logic-path-"]').first();
 await expect(p.locator('.played-mark:not(.gold)')).toHaveCount(1);
 await expect(p.locator('.card-result.gold')).toHaveCount(0);
 expect(phone.errors).toEqual([]);
});

test('GOLD-WEB-02: GIVEN one gold day and one plain day WHEN a day opens in the Archive THEN only the gold result has the star',async({phone})=>{
 const day='2026-10-17',list=items.filter(it=>it.date===day),bd=list.find(it=>it.type==='borders'),mi=list.find(it=>it.type==='mini');
 expect(bd&&mi,'a Borders and a Mini on '+day).toBeTruthy();
 await seed(phone,{borders:{[bd.id]:{c:10,p:1000,on:day}},mini:{[mi.id]:{s:65,d:day}}});
 await goto(phone,'archive.html?m=2026-10');
 await H.tap(phone.p,phone.p.locator('button.ar-c[data-d="'+day+'"]'));await H.wait(phone.p,150);
 const gold=phone.p.locator('#ar-day a.ar-row[href^="'+bd.path+'"]'),plain=phone.p.locator('#ar-day a.ar-row[href^="'+mi.path+'"]');
 await expect(gold.locator('.ar-gold svg')).toHaveCount(1);
 await expect(gold.locator('.ar-tick')).toHaveCount(0);
 await expect(gold.locator('.ar-res.gold')).toContainText('gold star');
 await expect(plain.locator('.ar-tick')).toHaveCount(1);
 await expect(plain.locator('.ar-gold')).toHaveCount(0);
 expect(phone.errors).toEqual([]);
});

for(const [name,rec,want] of [['under 0:20',{t:'00:15'},true],['over 0:20',{t:'00:45'},false]])
test('GOLD-WEB-03: GIVEN a Path finished '+name+' WHEN it reopens THEN the finish sheet '+(want?'shows':'has no')+' gold star',async({phone})=>{
 const it=of('path').find(x=>x.date==='2026-10-17');   // released at the tests' pinned clock (19 Oct)
 await seed(phone,{path:{[it.id]:Object.assign({d:it.date},rec)}});
 await goto(phone,it.path);await H.wait(phone.p,1500);
 await expect(phone.p.locator('#modal.fin-open #dnFin')).toBeVisible();
 if(want){
  await expect(phone.p.locator('.fin-goldline')).toHaveText('Gold star · Under 0:20');
  await expect(phone.p.locator('.fin-gold-star svg[aria-label="Gold star"]')).toHaveCount(1);
 }else{
  await expect(phone.p.locator('.fin-goldline')).toHaveCount(0);
  await expect(phone.p.locator('.fin-gold-star')).toHaveCount(0);
 }
 expect(phone.errors).toEqual([]);
});
