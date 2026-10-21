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
 // Walking across the doorway must not cut a crystal hunt short.
 expect(await p.evaluate(()=>__dg.state().game.ended)).toBe(false);
 await H.tap(p,p.locator('#leave'));
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
 await expect(p.locator('#play')).toBeVisible();await H.tap(p,p.locator('#play'));
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

test('ECHO-09: walking into a waiting creature costs one heart, then grants recovery time',async({phone})=>{
 await open(phone);const p=phone.p;
 const result=await p.evaluate(()=>{__dg.launch(1);const e=__dg.state().game.enemies[0];__dg.fixture({invul:0,enemy:{wait:10,stun:0}});__dg.walkRoute(__dg.route(e));const a=__dg.state().game;__dg.move(1,0,.05);const b=__dg.state().game;return{a,b};});
 expect(result.a.hearts).toBe(2);expect(result.a.invul).toBeGreaterThan(0);expect(result.b.hearts).toBe(2);expect(phone.errors).toEqual([]);
});
test('ECHO-10: moving into a passing echo hears it once, without repeated retargeting',async({phone})=>{
 await open(phone);const result=await phone.p.evaluate(()=>{__dg.launch(1);const g=__dg.state().game,path=__dg.route(g.relic),far=path[Math.min(10,path.length-1)],near=path[1];__dg.fixture({enemy:{...far,target:far,wait:10,stun:0}});__dg.echo();__dg.step(.6);const before=__dg.state().game.pulses[0].heard[0];__dg.fixture({enemy:{...near,target:far,wait:10}});__dg.hear();const a=__dg.state().game;__dg.fixture({enemy:{target:far}});__dg.hear();const b=__dg.state().game;return{before,a,b,far};});
 expect(result.before).toBe(false);expect(result.a.pulses[0].heard[0]).toBe(true);expect(result.a.enemies[0].alert).toBeGreaterThan(0);expect(result.a.enemies[0].target).toEqual(result.a.start);expect(result.b.enemies[0].target).toEqual(result.far);expect(phone.errors).toEqual([]);
});
test('ECHO-11: the explored map pauses play and does not discover unseen ground or exit',async({phone})=>{
 await open(phone);const p=phone.p;await H.tap(p,p.locator('#play'));
 const a=await p.evaluate(()=>__dg.state().game);expect(a.seenExit).toBe(false);
 await H.tap(p,p.locator('#map'));await expect(p.locator('#survey')).toBeVisible();const paused=await p.evaluate(()=>__dg.state().game.elapsed);
 await p.evaluate(()=>__dg.step(10));const b=await p.evaluate(()=>__dg.state().game);expect(b.elapsed).toBe(paused);expect(b.visited).toEqual(a.visited);expect(b.seenExit).toBe(false);expect(await p.evaluate(()=>__echoEvents.filter(e=>e.ev==='game_end'))).toHaveLength(0);
 await H.tap(p,p.locator('#mapBack'));expect(await p.evaluate(()=>__dg.state().phase)).toBe('play');expect(phone.errors).toEqual([]);
});
test('ECHO-12: a legacy v1 expedition resumes without losing stars, collection or position',async({phone})=>{
 await open(phone);const p=phone.p;
 const old=await p.evaluate(()=>{__dg.launch(1);const g=__dg.state().game;__dg.walkRoute(__dg.route(g.crystals[0]));__dg.save();const s=__dg.state().save;s.stars[0]=2;s.bests[0]={stars:2,score:900,secs:63,echoes:4,hearts:2};for(const k of['cooldown','invul','heard','facing','seenRelic','seenExit','seenCrystals','pulses'])delete s.current[k];for(const e of s.current.enemies)for(const k of['route','patrol','stun'])delete e[k];localStorage.setItem('digi-echo-cave-v1',JSON.stringify(s));return s;});
 await phone.ctx.addInitScript(old=>localStorage.setItem('digi-echo-cave-v1',JSON.stringify(old)),old);await p.reload();await H.wait(p,500);await H.tap(p,p.locator('#play'));const restored=await p.evaluate(()=>__dg.state());expect(restored.save.stars[0]).toBe(2);expect(restored.save.bests[0].secs).toBe(63);expect(restored.game.p).toEqual(old.current.p);expect(restored.game.hearts).toBe(old.current.hearts);expect(restored.game.enemies).toHaveLength(old.current.enemies.length);expect(restored.game.crystals.map(c=>c.taken)).toEqual(old.current.taken);expect(phone.errors).toEqual([]);
});
test('ECHO-13: save round-trip retains recharge, active sound waves and creature state',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(1);__dg.echo();__dg.step(.6);__dg.fixture({enemy:{stun:1.1,wait:1.7,patrol:9},invul:1.4});const a=__dg.snapshot(),g=__dg.restoreData(JSON.parse(JSON.stringify(a)));return{a,b:{cooldown:g.cooldown,invul:g.invul,pulses:g.pulses.map(p=>({x:p.x,y:p.y,t:p.t,heard:p.heard})),enemies:g.enemies.map(e=>({x:e.x,y:e.y,target:e.target,alert:e.alert,wait:e.wait,stun:e.stun,patrol:e.patrol,route:e.route}))}};});
 expect(r.b.cooldown).toBe(r.a.cooldown);expect(r.b.invul).toBe(r.a.invul);expect(r.b.pulses).toEqual(r.a.pulses);expect(r.b.enemies).toEqual(r.a.enemies);expect(phone.errors).toEqual([]);
});
test('ECHO-14: retrying yesterday’s daily preserves its date; a fresh daily uses the new London day',async({phone})=>{
 await open(phone);const p=phone.p;await p.clock.setFixedTime(new Date('2026-10-25T23:59:58Z'));await H.tap(p,p.locator('#daily'));const a=await p.evaluate(()=>__dg.state().game);expect(a.date).toBe('2026-10-25');
 await p.clock.setFixedTime(new Date('2026-10-26T00:00:03Z'));await H.tap(p,p.locator('#pause'));await H.tap(p,p.locator('#restart'));let b=await p.evaluate(()=>__dg.state().game);expect(b.date).toBe(a.date);expect(b.tiles).toEqual(a.tiles);
 await p.evaluate(()=>__dg.end(true));await H.tap(p,p.locator('#again'));expect(await p.evaluate(()=>__dg.state().game.date)).toBe(a.date);
 await p.evaluate(()=>__dg.end(true));await H.tap(p,p.locator('#resultHome'));await H.tap(p,p.locator('#daily'));expect(await p.evaluate(()=>__dg.state().game.date)).toBe('2026-10-26');expect(phone.errors).toEqual([]);
});
test('ECHO-15: a near-miss at a narrow entrance slides into it without crossing a wall',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(0);const g=__dg.state().game,f=(x,y)=>g.tiles[y*g.w+x]===1;let door=null;for(let y=1;y<g.h-1&&!door;y++)for(let x=2;x<g.w-1&&!door;x++)if(f(x,y)&&!f(x,y+1)&&!f(x,y-1)&&f(x-1,y)&&f(x-1,y+1)&&f(x-1,y-1)&&f(x+1,y))door={x,y};if(!door)return{missing:true};const start={x:door.x-.24,y:door.y+.8};__dg.fixture({p:start});__dg.move(1,0,.6);const a=__dg.state().game.p;__dg.move(0,1,3);const b=__dg.state().game.p;return{door,start,a,b,inside:f(Math.floor(b.x),Math.floor(b.y))};});
 expect(r.missing).not.toBe(true);expect(r.a.x).toBeGreaterThan(r.door.x+.3);expect(Math.abs(r.a.y-r.door.y-.5)).toBeLessThan(.28);expect(r.inside).toBe(true);expect(phone.errors).toEqual([]);
});
test('ECHO-16: explored floor does not reveal a creature’s live position in darkness',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(1);const g=__dg.state().game,e=g.enemies[0];__dg.fixture({enemy:{wait:100,stun:100}});__dg.walkRoute(__dg.route(e));__dg.walkRoute(__dg.route(g.start));return{memory:__dg.visibility(e),live:__dg.visibility(e,false)};});
 expect(r.memory).toBeGreaterThan(0);expect(r.live).toBe(0);expect(phone.errors).toEqual([]);
});
test('ECHO-17: an older tab cannot erase a cave completed in another tab',async({phone})=>{
 await open(phone);const a=phone.p;await H.tap(a,a.locator('#play'));
 const b=await phone.ctx.newPage();await b.clock.install({time:new Date('2026-10-19T12:00:00+01:00')});await b.goto('https://dailynoodle.co.uk/'+FILE);await H.tap(b,b.locator('#play'));await b.evaluate(()=>__dg.end(true));expect(await b.evaluate(()=>__dg.state().save.stars[0])).toBeGreaterThan(0);
 await a.evaluate(()=>__dg.save());const stars=await a.evaluate(()=>JSON.parse(localStorage.getItem('digi-echo-cave-v1')).stars[0]);expect(stars).toBeGreaterThan(0);expect(await a.evaluate(()=>__dg.state().save.stars[0])).toBe(stars);await b.close();expect(phone.errors).toEqual([]);
});
