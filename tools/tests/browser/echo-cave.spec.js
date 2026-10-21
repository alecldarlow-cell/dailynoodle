'use strict';
const {test,expect,H,goto}=require('./support');
const FILE='reports/2026-10-21-arcade-echo-cave.html';
async function open(phone){
 await phone.ctx.addInitScript(()=>{window.__DGTEST=true;window.__echoEvents=[];window.digi={track:(ev,x)=>window.__echoEvents.push({ev,x})};});
 await phone.ctx.route('**/dn-track.js',r=>r.fulfill({status:200,body:''}));
 await goto(phone,FILE);
 await expect(phone.p.locator('#play')).toBeVisible();
}
test('ECHO-01: guided cave can be won by walking to the real relic and exit; retry stays on the cave',async({phone})=>{
 await open(phone);const p=phone.p;await H.tap(p,p.locator('#play'));await H.tap(p,p.locator('#echo'));
 expect(await p.evaluate(()=>__dg.state().game.guideStep)).toBe(1);
 await p.evaluate(()=>{const g=__dg.state().game;__dg.walkRoute(__dg.route(g.relic));});
 expect(await p.evaluate(()=>__dg.state().game.gotRelic)).toBe(true);
 expect(await p.evaluate(()=>__dg.state().game.guideStep)).toBe(2);
 await p.evaluate(()=>{const g=__dg.state().game;__dg.walkRoute(__dg.route(g.exit));});
 await expect(p.locator('#resultTitle')).toHaveText('Back to daylight.');
 expect(await p.evaluate(()=>__dg.state().save.tutorial)).toBe(true);
 expect(await p.evaluate(()=>__dg.state().save.stars[0])).toBeGreaterThanOrEqual(1);
 const events=await p.evaluate(()=>__echoEvents);expect(events.map(e=>e.ev)).toEqual(['game_start','game_end']);expect(events[1].x.win).toBe(true);
 await H.tap(p,p.locator('#again'));expect(await p.evaluate(()=>__dg.state().game.index)).toBe(0);
 expect(await p.evaluate(()=>__dg.state().round.how)).toBe('retry');expect(await p.evaluate(()=>__dg.state().game.guide)).toBe(false);
 expect(phone.errors).toEqual([]);
});
test('ECHO-02: three real damage events lose once and do not unlock another cave',async({phone})=>{
 await open(phone);const p=phone.p;await H.tap(p,p.locator('#play'));
 await p.evaluate(()=>{__dg.damage();__dg.damage();__dg.damage();__dg.end(false);});
 await expect(p.locator('#resultTitle')).toHaveText('The cave keeps its secrets.');
 const events=await p.evaluate(()=>__echoEvents.filter(e=>e.ev==='game_end'));expect(events).toHaveLength(1);expect(events[0].x.win).toBe(false);
 expect(await p.evaluate(()=>__dg.state().save.stars)).toEqual([0,0,0,0,0,0]);
 expect(await p.evaluate(()=>__dg.state().save.current)).toBeNull();expect(phone.errors).toEqual([]);
});
test('ECHO-03: echoes propagate along connected ground, recharge and fade without revealing everything permanently',async({phone})=>{
 await open(phone);const p=phone.p;await H.tap(p,p.locator('#play'));
 const facts=await p.evaluate(()=>{
  const g=__dg.state().game,far=g.crystals[0],before=__dg.visibility(far);__dg.echo();const count=__dg.state().game.echoes;__dg.echo();const immediate=__dg.state().game.echoes;__dg.step(2);const lit=__dg.visibility(far);__dg.step(6);const faded=__dg.visibility(far);return{before,count,immediate,lit,faded,cooldown:__dg.state().game.cooldown};
 });
 expect(facts.count).toBe(1);expect(facts.immediate).toBe(1);expect(facts.lit).toBeGreaterThan(facts.before);expect(facts.faded).toBe(facts.before);expect(facts.cooldown).toBe(0);expect(phone.errors).toEqual([]);
});
test('ECHO-04: a listening creature follows the sound origin, not the player',async({phone})=>{
 await open(phone);const p=phone.p;
 const facts=await p.evaluate(()=>{
  __dg.launch(1);let g=__dg.state().game;const enemy=g.enemies[0];const path=__dg.route(enemy);__dg.walkRoute(path.slice(0,-5));
  g=__dg.state().game;const origin={...g.p};__dg.echo();__dg.step(1.8);const after=__dg.state().game.enemies[0];
  return{origin,target:after.target,alert:after.alert,route:after.route,enemyStart:enemy,after};
 });
 expect(facts.alert).toBeGreaterThan(0);expect(facts.target.x).toBe(Math.floor(facts.origin.x)+.5);expect(facts.target.y).toBe(Math.floor(facts.origin.y)+.5);
 expect(Math.hypot(facts.after.x-facts.enemyStart.x,facts.after.y-facts.enemyStart.y)).toBeGreaterThan(.1);expect(phone.errors).toEqual([]);
});
test('ECHO-05: an unfinished expedition round-trips through reload and resumes as a new tracked round',async({phone})=>{
 await open(phone);const p=phone.p;await H.tap(p,p.locator('#play'));await H.tap(p,p.locator('#echo'));
 await p.evaluate(()=>{const g=__dg.state().game;__dg.walkRoute(__dg.route(g.crystals[0]));__dg.damage();__dg.save();});
 const before=await p.evaluate(()=>__dg.state().game);await p.reload();await H.wait(p,500);
 await expect(p.locator('#resumeSaved')).toBeVisible();await H.tap(p,p.locator('#resumeSaved'));
 const after=await p.evaluate(()=>__dg.state());expect(after.game.p).toEqual(before.p);expect(after.game.hearts).toBe(before.hearts);expect(after.game.crystals.map(c=>c.taken)).toEqual(before.crystals.map(c=>c.taken));expect(after.game.visited).toEqual(before.visited);
 expect(await p.evaluate(()=>__echoEvents.filter(e=>e.ev==='game_start').map(e=>e.x.start))).toEqual(['resume']);expect(phone.errors).toEqual([]);
});
test('ECHO-06: pause freezes creatures, echo recharge and expedition time; resume continues them',async({phone})=>{
 await open(phone);const p=phone.p;
 const result=await p.evaluate(()=>{__dg.launch(1);__dg.echo();__dg.step(1);__dg.pause();const a=__dg.state().game;__dg.step(5);const b=__dg.state().game;__dg.resume();__dg.step(1);const c=__dg.state().game;return{a,b,c};});
 expect(result.b.elapsed).toBe(result.a.elapsed);expect(result.b.enemies).toEqual(result.a.enemies);expect(result.b.cooldown).toBe(result.a.cooldown);expect(result.c.elapsed).toBeGreaterThan(result.b.elapsed);expect(phone.errors).toEqual([]);
});
test('ECHO-07: deterministic campaign and 100 daily layouts have connected objectives and safe starts',async({phone})=>{
 await open(phone);const p=phone.p;
 const facts=await p.evaluate(()=>{
  let checked=0,failed=[];
  const signature=g=>JSON.stringify([g.tiles,g.relic,g.exit,g.crystals,g.enemies]);
  const a=signature(__dg.daily('2026-10-25')),b=signature(__dg.daily('2026-10-25')),c=signature(__dg.daily('2026-10-26'));
  const maps=Array.from({length:6},(_,i)=>__dg.build(i));for(let i=0;i<100;i++){const d=new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10);maps.push(__dg.daily(d));}
  for(const g of maps){const start=Math.floor(g.start.y)*g.w+Math.floor(g.start.x),seen=new Set([start]),q=[start];for(let i=0;i<q.length;i++){const k=q[i],x=k%g.w,y=Math.floor(k/g.w);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*g.w+nx;if(nx>=0&&ny>=0&&nx<g.w&&ny<g.h&&g.tiles[n]&&!seen.has(n)){seen.add(n);q.push(n);}}}
   for(const p of[g.relic,g.exit,...g.crystals,...g.enemies])if(!seen.has(Math.floor(p.y)*g.w+Math.floor(p.x)))failed.push(g.seed);
   if(g.enemies.some(e=>Math.hypot(e.x-g.start.x,e.y-g.start.y)<6))failed.push(g.seed);checked++;
  }return{checked,failed,same:a===b,different:a!==c};
 });
 expect(facts.checked).toBe(106);expect(facts.failed).toEqual([]);expect(facts.same).toBe(true);expect(facts.different).toBe(true);expect(phone.errors).toEqual([]);
});
test('ECHO-08: drag input moves and releases cleanly; resize keeps all controls in view',async({phone})=>{
 await open(phone);const p=phone.p;await H.tap(p,p.locator('#play'));
 const before=await p.evaluate(()=>__dg.state().game.p);
 await p.locator('#walkpad').dispatchEvent('pointerdown',{pointerId:31,clientX:55,clientY:730,button:0});
 await p.locator('#walkpad').dispatchEvent('pointermove',{pointerId:31,clientX:55,clientY:690});await H.wait(p,500);
 await p.locator('#walkpad').dispatchEvent('pointerup',{pointerId:31});const after=await p.evaluate(()=>__dg.state().game.p);expect(after.y).toBeLessThan(before.y);
 await H.wait(p,500);expect(await p.evaluate(()=>__dg.state().game.p)).toEqual(after);
 // A test viewport resize is a rotation, not a browser full-screen exit.
 await H.tap(p,p.locator('#pause'));
 if(await p.locator('#full').isVisible()&&await p.locator('#full').getAttribute('aria-checked')==='true')await H.tap(p,p.locator('#full'));
 await H.tap(p,p.locator('#resume'));
 for(const size of[{width:320,height:568},{width:680,height:780},{width:780,height:360}]){await p.setViewportSize(size);await H.wait(p,250);expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const r=await p.locator('#echo').boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(size.height);expect(r.width).toBeGreaterThanOrEqual(44);}
 expect(phone.errors).toEqual([]);
});
