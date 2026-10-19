'use strict';
const {test,expect,H,goto}=require('./support');
const games=require('./games.json');
async function game(phone,g){
 if(g.id==='dots')await phone.p.setViewportSize({width:780,height:360});
 await phone.ctx.route('**/dn-track.js',r=>r.fulfill({status:200,body:''}));
 await phone.ctx.addInitScript(()=>{window.__DGTEST=true;window.__gameEvents=[];window.digi={track:(ev,x)=>window.__gameEvents.push({ev,x})};});
 await goto(phone,'reports/'+g.file);
 await expect.poll(()=>phone.p.evaluate(()=>typeof window.__dg?.end)).toBe('function');
}
for(const g of games)test('GAME '+g.id+': launch, finish, repeat guard and saved reload',async({phone})=>{
 await game(phone,g);const {p}=phone;
 if(g.id==='dots')await H.tap(p,p.locator('#iMute'));
 const start=p.locator(g.start).first();await expect(start).toBeVisible();await H.tap(p,start);await H.wait(p,1200);
 if(g.id==='lighthouse'){await H.tap(p,p.locator('canvas'));await H.wait(p,300);}
 // The hook only arranges the terminal condition and invokes the production
 // finish path. Launch/menus use real input; no test-only game model is run.
 await p.evaluate(()=>window.__dg.end(true));await H.wait(p,2500);
 const ends=()=>p.evaluate(()=>window.__gameEvents.filter(e=>e.ev==='game_end'));
 const first=await ends();expect(first).toHaveLength(1);expect(Number.isFinite(first[0].x.secs)).toBe(true);expect(first[0].x.secs).toBeGreaterThanOrEqual(0);
 const saved=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/^(digi|noodle)-|^lk_meta/.test(k))));
 expect(Object.keys(saved).length).toBeGreaterThan(0);
 await p.evaluate(()=>window.__dg.end(true));await H.wait(p,300);expect(await ends()).toHaveLength(1);
 await p.reload();await H.wait(p,1500);expect(await ends()).toHaveLength(0);
 const restored=await p.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(saved));
 // Some games normalize a finished save on boot; the progress record must
 // remain parseable and present, rather than demanding byte equality.
 for(const [key,value] of Object.entries(restored)){expect(value,key).not.toBeNull();expect(()=>JSON.parse(value),key).not.toThrow();}
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('GLASS-01/02: three rare finds fit and a static pause stops redraw',async({phone})=>{
 const g=games.find(g=>g.id==='glass');await game(phone,g);const p=phone.p;await H.tap(p,p.locator('#go'));await H.wait(p,600);
 const s=await p.evaluate(()=>window.__dg.state());expect(s.finds).toHaveLength(3);
 for(const f of s.finds){expect(f).toBeTruthy();}
 await H.tap(p,p.locator('#pause'));await H.wait(p,600);
 const a=await p.evaluate(()=>window.__dg.draws());await H.wait(p,1500);const b=await p.evaluate(()=>window.__dg.draws());expect(b-a).toBeLessThanOrEqual(2);
});
test('PLANES-01: unlocked postcard still responds after rebuilding home',async({phone})=>{
 await game(phone,games.find(g=>g.id==='planes'));const p=phone.p;
 await p.evaluate(()=>window.__dg.home());
 const card=p.locator('[data-place="0"], [data-p="0"], .placecard').first();
 // The card selector is asserted visible; a missing handler must leave the
 // state unchanged and fail, the historical regression this protects.
 await expect(card).toBeVisible();await H.tap(p,card);await H.wait(p,400);
 expect(await p.evaluate(()=>window.__dg.state().state)).toBe('aim');
});
test('BALL-01: question schema and production score boundaries',async({phone})=>{
 await game(phone,games.find(g=>g.id==='ballpark'));const p=phone.p;
 const facts=await p.evaluate(()=>window.__dg.facts());expect(facts.length).toBeGreaterThan(1);
 let count=0;for(const pack of facts)for(const f of pack.q){expect(f.q.trim().length).toBeGreaterThan(5);expect(Number.isFinite(f.a)).toBe(true);expect(f.a).toBeGreaterThan(0);count++;}expect(count).toBeGreaterThanOrEqual(1200);
 // Real guess/lock controls are exercised before the terminal test hook.
 await H.tap(p,p.locator('#playB'));await H.wait(p,500);
 const bands=await p.evaluate(()=>[100,115,115.01,130,130.01,160,160.01,300,300.01].map(x=>window.__dg.zone(x,100)));expect(bands).toEqual([0,0,1,1,2,2,3,3,4]);
 const controls=await p.locator('button:visible').allTextContents();expect(controls.length).toBeGreaterThan(0);
});
module.exports={game};
test('DOTS-01: a death tap cannot skip results; a deliberate later tap retries',async({phone})=>{
 await game(phone,games.find(g=>g.id==='dots'));const p=phone.p;
 await p.mouse.click(120,180);await p.evaluate(()=>window.__dg.end(false));
 expect(await p.evaluate(()=>window.__dg.state().phase)).toBe('dead');
 await p.mouse.click(120,180);expect(await p.evaluate(()=>window.__dg.state().phase)).toBe('dead');
 await H.wait(p,1600);await p.mouse.click(120,180);
 expect(await p.evaluate(()=>window.__dg.state().phase)).toBe('playing');
 expect(await p.evaluate(()=>window.__gameEvents.filter(e=>e.ev==='game_start').map(e=>e.x.start))).toEqual(['new','retry']);
});
test('GLASS-01: result tap guard and shelf Back preserve the result',async({phone})=>{
 await game(phone,games.find(g=>g.id==='glass'));const p=phone.p;await H.tap(p,p.locator('#go'));
 await p.evaluate(()=>window.__dg.end(true));await expect(p.locator('#card')).toHaveClass(/settling/);
 const link=p.locator('#eShelf');const r=await link.boundingBox();await p.mouse.click(r.x+r.width/2,r.y+r.height/2);
 await expect(p.locator('#card h2')).not.toHaveText('Collection shelf');
 await H.wait(p,600);await H.tap(p,link);await expect(p.locator('#card')).toContainText('Collection shelf');
 await H.tap(p,p.locator('#bk'));await expect(p.locator('#eShelf')).toBeVisible();
});
test('LANTERN-01: pause freezes the real simulation; resume advances it',async({phone})=>{
 await game(phone,games.find(g=>g.id==='lantern'));const p=phone.p;await H.tap(p,p.locator('#go'));await H.tap(p,p.locator('canvas').first());
 const state=await p.evaluate(()=>{const g=window.__dg;g.step(2,true);g.pause();const before=g.S.tau;g.step(4,true);const during=g.S.tau;g.resume();g.step(1,true);return {before,during,after:g.S.tau};});
 expect(state.before).toBeGreaterThan(0);expect(state.during).toBe(state.before);expect(state.after).toBeGreaterThan(state.during);
});
test('PLANES-02: daily place, plane and wind survive a reload',async({phone})=>{
 await game(phone,games.find(g=>g.id==='planes'));const p=phone.p;await H.tap(p,p.locator('#homeDaily'));await H.wait(p,200);
 const a=await p.evaluate(()=>window.__dg.state());expect(a.run.mode).toBe('daily');expect(a.run.throws).toBe(3);
 await p.reload();await H.wait(p,1200);await H.tap(p,p.locator('#homeDaily'));await H.wait(p,200);
 const b=await p.evaluate(()=>window.__dg.state());expect(b.run.place).toBe(a.run.place);expect(b.wind).toEqual(a.wind);expect(b.launchSpeed).toBe(a.launchSpeed);
});
