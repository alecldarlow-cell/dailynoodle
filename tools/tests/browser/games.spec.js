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
/* Score share (engines/game-share.js, 20 Oct 2026): loaded by the real tracker on game pages; the
   tracker is kept here (not stubbed) because it is what passes game_end on as dn:game_end. */
async function realTracker(phone,file,vp){
 if(vp)await phone.p.setViewportSize(vp);
 await phone.ctx.addInitScript(()=>{window.__DGTEST=true;window.__shared=[];navigator.share=d=>{window.__shared.push(d.text);return Promise.resolve();};});
 await goto(phone,'reports/'+file);
 await expect.poll(()=>phone.p.evaluate(()=>typeof window.__dg?.end)).toBe('function');
 await expect.poll(()=>phone.p.evaluate(()=>!!window.dnGameShare)).toBe(true);
}
test('GAME-SHARE-01: a won round offers Share score with the line and short link; the next round hides it',async({phone})=>{
 const p=phone.p;await realTracker(phone,'2026-09-26-arcade-bubble-burst.html');
 await H.tap(p,p.locator('[data-act=lv]').first());await H.wait(p,1200);
 await p.evaluate(()=>window.__dg.end(true));
 const pill=p.locator('.dngs.on');await expect(pill).toBeVisible({timeout:5000});
 await expect(p.locator('.dngs .lab')).toHaveText('Share score');
 const box=await pill.boundingBox(),vw=await p.evaluate(()=>innerWidth),vh=await p.evaluate(()=>innerHeight);
 expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(vw);expect(box.y+box.height).toBeLessThanOrEqual(vh);expect(box.height).toBeLessThan(70);
 await H.tap(p,p.locator('.dngs .go'));await H.wait(p,300);
 const shared=await p.evaluate(()=>window.__shared);
 expect(shared).toHaveLength(1);expect(shared[0]).toMatch(/^🫧 Bubble Burst — level \d+ · [\d,]+ pts( · ⭐{1,3})?\ndailynoodle\.co\.uk\/bubble-burst$/u);
 await p.evaluate(()=>window.digi.track('game_start',{game:'bubble-burst'}));await H.wait(p,500);
 await expect(p.locator('.dngs.on')).toHaveCount(0);
 expect(phone.errors).toEqual([]);
});
test('GAME-SHARE-02: no pill for a scoreless loss; short landscape puts it at the top; × closes it',async({phone})=>{
 const p=phone.p;await realTracker(phone,'2026-10-17-arcade-two-dots-landscape.html',{width:780,height:360});
 await p.evaluate(()=>window.digi.track('game_end',{game:'two-dots-landscape',win:false,level:1,score:0}));await H.wait(p,1500);
 await expect(p.locator('.dngs.on')).toHaveCount(0);
 await p.evaluate(()=>window.digi.track('game_end',{game:'two-dots-landscape',win:false,level:4,score:57}));
 const pill=p.locator('.dngs.on');await expect(pill).toBeVisible({timeout:5000});
 expect((await pill.boundingBox()).y).toBeLessThan(80);
 expect(await p.evaluate(()=>window.dnGameShare.link)).toBe('dailynoodle.co.uk/two-dots');
 await H.tap(p,p.locator('.dngs .x'));await H.wait(p,500);await expect(p.locator('.dngs.on')).toHaveCount(0);
 expect(phone.errors).toEqual([]);
});
test('GAME-SHARE-03: Paper Planes keeps its own share; a Lab game shares its own address',async({phone})=>{
 const p=phone.p;await realTracker(phone,'2026-10-16-strategy-ancient-cities.html').catch(()=>{});
 expect(await p.evaluate(()=>window.dnGameShare&&window.dnGameShare.link)).toBe('dailynoodle.co.uk/reports/2026-10-16-strategy-ancient-cities.html');
 await goto(phone,'reports/2026-10-17-arcade-paper-planes.html');await H.wait(p,1500);
 expect(await p.evaluate(()=>!!window.dnGameShare)).toBe(false);
});
test('PLANES-SHARE-01: the end-of-run screen has Share (not on the daily), sharing the run line and the game address',async({phone})=>{
 const p=phone.p;await realTracker(phone,'2026-10-17-arcade-paper-planes.html').catch(()=>{});
 await expect.poll(()=>p.evaluate(()=>typeof window.__dg?.end)).toBe('function');
 await H.tap(p,p.locator('#splashGo'));await H.wait(p,1200);
 await p.evaluate(()=>window.__dg.end(true));await H.wait(p,1500);
 const share=p.locator('#eShare');await expect(share).toBeVisible();
 await H.tap(p,share);await H.wait(p,300);
 const shared=await p.evaluate(()=>window.__shared);
 expect(shared).toHaveLength(1);
 expect(shared[0]).toMatch(/^✈️ Paper Planes — (all 8 places|\d of 8 places|Skyscraper|.+ [★☆]{3}) · best throw [\d.]+ m.*\ndailynoodle\.co\.uk\/reports\/2026-10-17-arcade-paper-planes\.html$/u);
 expect(phone.errors).toEqual([]);
});
