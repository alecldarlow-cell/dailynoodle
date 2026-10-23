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
 await open(phone);const result=await phone.p.evaluate(()=>{__dg.launch(1);const g=__dg.state().game,path=__dg.route(g.relic),far=path[Math.min(10,path.length-1)],near=path[2];__dg.fixture({enemy:{...far,target:far,wait:10,stun:0}});__dg.echo();__dg.step(.6);const before=__dg.state().game.pulses[0].heard[0];__dg.fixture({enemy:{...near,target:far,wait:10}});__dg.hear();const a=__dg.state().game;__dg.fixture({enemy:{target:far}});__dg.hear();const b=__dg.state().game;return{before,a,b,far};});
 expect(result.before).toBe(false);expect(result.a.pulses[0].heard[0]).toBe(true);expect(result.a.enemies[0].alert).toBeGreaterThan(0);expect(result.a.enemies[0].target).toEqual(result.a.start);expect(result.b.enemies[0].target).toEqual(result.far);expect(phone.errors).toEqual([]);
});
test('ECHO-11: the explored map pauses play and does not discover unseen ground or exit',async({phone})=>{
 await open(phone);const p=phone.p;await H.tap(p,p.locator('#play'));
 const a=await p.evaluate(()=>__dg.state().game);expect(a.seenExit).toBe(false);
 await H.tap(p,p.locator('#map'));await expect(p.locator('#survey')).toBeVisible();const paused=await p.evaluate(()=>__dg.state().game.elapsed);
 await p.evaluate(()=>__dg.step(10));const b=await p.evaluate(()=>__dg.state().game);expect(b.elapsed).toBe(paused);expect(b.visited).toEqual(a.visited);expect(b.seenExit).toBe(false);expect(await p.evaluate(()=>__echoEvents.filter(e=>e.ev==='game_end'))).toHaveLength(0);
 await H.tap(p,p.locator('#mapBack'));expect(await p.evaluate(()=>__dg.state().phase)).toBe('play');await p.locator('#map').focus();await p.keyboard.press('Space');await expect(p.locator('#survey')).toBeVisible();await p.locator('#mapBack').focus();await p.keyboard.press('Space');expect(await p.evaluate(()=>__dg.state().phase)).toBe('play');expect(phone.errors).toEqual([]);
});
test('ECHO-12: a legacy v1 expedition resumes without losing stars, collection or position',async({phone})=>{
 await open(phone);const p=phone.p;
 const old=await p.evaluate(()=>{__dg.launch(1);const g=__dg.state().game;__dg.walkRoute(__dg.route(g.crystals[0]));__dg.save();const s=__dg.state().save;s.stars[0]=2;s.bests[0]={stars:2,score:900,secs:63,echoes:4,hearts:2};for(const k of['cooldown','invul','heard','facing','seenRelic','seenExit','seenCrystals','pulses'])delete s.current[k];for(const e of s.current.enemies)for(const k of['route','patrol','stun'])delete e[k];localStorage.setItem('digi-echo-cave-v1',JSON.stringify(s));return s;});
 await phone.ctx.addInitScript(old=>localStorage.setItem('digi-echo-cave-v1',JSON.stringify(old)),old);await p.reload();await H.wait(p,500);await H.tap(p,p.locator('#play'));const restored=await p.evaluate(()=>__dg.state());expect(restored.save.stars[0]).toBe(2);expect(restored.save.bests[0].secs).toBe(63);expect(restored.game.p).toEqual(old.current.p);expect(restored.game.hearts).toBe(old.current.hearts);expect(restored.game.enemies).toHaveLength(old.current.enemies.length);expect(restored.game.crystals.map(c=>c.taken)).toEqual(old.current.taken);expect(phone.errors).toEqual([]);
});
test('ECHO-13: save round-trip retains recharge, active sound waves and creature state',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(1);__dg.echo();__dg.step(.6);__dg.fixture({enemy:{stun:1.1,wait:1.7,patrol:9,chase:2.3,reaction:.2,repath:.1},invul:1.4});const a=__dg.snapshot(),g=__dg.restoreData(JSON.parse(JSON.stringify(a)));return{a,b:{cooldown:g.cooldown,invul:g.invul,pulses:g.pulses.map(p=>({x:p.x,y:p.y,t:p.t,heard:p.heard})),enemies:g.enemies.map(e=>({x:e.x,y:e.y,target:e.target,alert:e.alert,wait:e.wait,stun:e.stun,patrol:e.patrol,chase:e.chase,reaction:e.reaction,repath:e.repath,route:e.route}))}};});
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

test('ECHO-18: shallow wall contact carries walking speed along rock without crossing it',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(0);let wall=null;for(let y=1;y<G.h-1&&!wall;y++)for(let x=1;x<G.w-2&&!wall;x++)if([0,1].every(i=>floor(G,x+i,y)&&!floor(G,x+i,y-1)))wall={x,y};if(!wall)return{missing:true};const start={x:wall.x+.35,y:wall.y+.231};G.p={...start};const points=[];for(let i=0;i<24;i++){movePlayer(1,-.35,1/60);points.push({...G.p});}return{start,end:G.p,points,valid:points.every(p=>canStand(G,p))};});
 expect(r.missing).not.toBe(true);expect(r.valid).toBe(true);expect(r.end.x-r.start.x).toBeGreaterThan(.98);expect(Math.abs(r.end.y-r.start.y)).toBeLessThan(.08);expect(phone.errors).toEqual([]);
});
test('ECHO-19: diagonal rock cuts are passable while the solid body of the wall remains blocked',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(0);let corner=null;for(let y=1;y<G.h-1&&!corner;y++)for(let x=1;x<G.w-1&&!corner;x++)if(!floor(G,x,y)&&floor(G,x-1,y)&&floor(G,x,y-1)&&floor(G,x-1,y-1))corner={x,y};if(!corner)return{missing:true};const p={x:corner.x-.025,y:corner.y-.025};return{cut:walkable(G,corner.x+.1,corner.y+.1),solid:walkable(G,corner.x+.3,corner.y+.3),fits:canStand(G,p),oldSquareWouldBlock:!floor(G,p.x+.23,p.y+.23)};});
 expect(r.missing).not.toBe(true);expect(r.cut).toBe(true);expect(r.solid).toBe(false);expect(r.fits).toBe(true);expect(r.oldSquareWouldBlock).toBe(true);expect(phone.errors).toEqual([]);
});
test('ECHO-20: entering lamplight triggers a warned chase and standing still gets caught',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(1);const e=G.enemies[0];G.p={x:e.x-1.5,y:e.y};e.wait=10;G.invul=0;const start={x:e.x,y:e.y};__dg.step(.2);const warning={reaction:e.reaction,chase:e.chase,x:e.x,y:e.y,notice:document.querySelector('#notice span').textContent};__dg.step(.9);return{start,warning,hearts:G.hearts,enemy:{...e}};});
 expect(r.warning.chase).toBeGreaterThan(0);expect(r.warning.reaction).toBeGreaterThan(0);expect(r.warning.x).toBe(r.start.x);expect(r.warning.notice).toContain('Spotted');expect(r.hearts).toBe(2);expect(phone.errors).toEqual([]);
});
test('ECHO-21: rock blocks detection and a lost target is not tracked through a corner',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(1);const e=G.enemies[0];let pair=null;for(let a=0;a<G.tiles.length&&!pair;a++)if(G.tiles[a])for(let b=a+1;b<G.tiles.length&&!pair;b++)if(G.tiles[b]){const p={x:a%G.w+.5,y:Math.floor(a/G.w)+.5},q={x:b%G.w+.5,y:Math.floor(b/G.w)+.5};if(dist(p,q)<2.3&&!lineOfSight(G,p,q))pair={p,q};}G.p=pair.p;Object.assign(e,pair.q,{chase:0,alert:0,wait:10,stun:0});__dg.step(.1);const hidden=e.chase;const last={...pair.p};e.target=last;e.route=routeTo(G,e,last);e.chase=4;e.alert=18;e.wait=0;__dg.step(.2);const target={...e.target};return{hidden,last,target,player:G.p};});
 expect(r.hidden).toBe(0);expect(r.target).toEqual(r.last);expect(phone.errors).toEqual([]);
});
test('ECHO-22: an echo can distract a pursuer after sight is broken, but cannot override a visible player',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(1);const e=G.enemies[0],route=__dg.route(e);const origin=route[route.length-4];G.p={...origin};__dg.echo();G.p={x:e.x-1.4,y:e.y};__dg.step(.2);const visible={chase:e.chase,target:{...e.target},p:{...G.p}};let pair=null;for(const p of G.rooms)for(const q of G.rooms)if(!pair&&dist(p,q)>3&&dist(p,q)<8&&!lineOfSight(G,p,q)&&routeTo(G,q,p).length<12)pair={p,q};G.p={...pair.p};Object.assign(e,pair.q,{chase:4,stun:0,wait:0,target:{...pair.q},route:[],alert:18});G.pulses=[];G.cooldown=0;__dg.echo();const arrival=G.pulses[0].dist[cell(G,e.x,e.y)]/8;__dg.step(arrival+.12);return{visible,chase:e.chase,target:e.target,source:pair.p};});
 expect(r.visible.chase).toBeGreaterThan(0);expect(r.visible.target).toEqual(r.visible.p);expect(r.chase).toBe(0);expect(r.target).toEqual(r.source);expect(phone.errors).toEqual([]);
});
test('ECHO-23: echo ripples travel along passages, stay off rock, and offer a non-moving reduced-motion wash',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(0);__dg.echo();const p=G.pulses[0],sample=(point,t)=>{p.t=t;G.elapsed=t;terrain.waveAt=-Infinity;draw();const u=terrain.wave.width/G.w,x=Math.floor(point.x*u),y=Math.floor(point.y*u);return terrain.waveImage.data[(y*G.w*u+x)*4+3];};draw();const route=__dg.route(G.relic),near=route[1],far=route[5],rock={x:.5,y:.5};const early={near:sample(near,(p.dist[cell(G,near.x,near.y)]+.05)/8),far:sample(far,.2),rock:sample(rock,.2)};const later=sample(far,(p.dist[cell(G,far.x,far.y)]+.05)/8);S.settings.motion=true;const reduced=sample(near,1);return{early,later,reduced};});
 expect(r.early.near).toBeGreaterThan(70);expect(r.early.far).toBe(0);expect(r.early.rock).toBe(0);expect(r.later).toBeGreaterThan(70);expect(r.reduced).toBeGreaterThan(0);expect(r.reduced).toBeLessThan(50);expect(phone.errors).toEqual([]);
});

test('ECHO-24: retreating during the warning escapes the lamp and pursuit stays out of rock',async({phone})=>{
 await open(phone);const r=await phone.p.evaluate(()=>{__dg.launch(1);const e=G.enemies[0];G.p={x:e.x-1.7,y:e.y};e.wait=0;G.invul=0;let solid=0;__dg.step(.6,-1,0);const lost=!seesPlayer(e),hearts=G.hearts;const target={...e.target};G.p={...G.start};for(let i=0;i<480;i++){update(1/60);if(!canStand(G,e))solid++;}return{lost,hearts,solid,target,chase:e.chase};});
 expect(r.lost).toBe(true);expect(r.hearts).toBe(3);expect(r.solid).toBe(0);expect(r.chase).toBe(0);expect(phone.errors).toEqual([]);
});

test('ECHO-25: a creature wedged off-centre in a rock doorway works itself free',async({phone})=>{
 // Pose found by the Oct 2026 review bots: The Crystal Chambers' relic-room doorway, where both
 // the next route step and the move back to the cell centre were blocked, freezing the creature.
 await open(phone);const r=await phone.p.evaluate(()=>{const out=[];for(const p of [{x:6.26,y:3.31},{x:7.5,y:1.5}]){__dg.launch(4);const e=G.enemies[0];G.p={...p};G.invul=99;Object.assign(e,{x:4.157193872824944,y:2.821058060653488,chase:0,alert:0,wait:0,stun:0,reaction:0,route:[],target:{...p}});const start={x:e.x,y:e.y};let solid=0;for(let i=0;i<180;i++){update(1/60);if(!canStand(G,e))solid++;}out.push({moved:Math.hypot(e.x-start.x,e.y-start.y),solid});}return out;});
 for(const x of r){expect(x.moved).toBeGreaterThan(.5);expect(x.solid).toBe(0);}expect(phone.errors).toEqual([]);
});

test('ECHO-26: Crystal Chambers has a second doorway out of its relic room; seeded placements are unchanged',async({phone})=>{
 // Alec's call (22 Oct 2026 studio review): the relic room was a one-door dead end.
 await open(phone);const r=await phone.p.evaluate(()=>{const g=__dg.build(4),f=(x,y)=>g.tiles[y*g.w+x]===1;return{door:f(6,4),relic:g.relic,crystals:g.crystals.map(c=>[c.x,c.y]),enemies:g.enemies.map(e=>[e.x,e.y])};});
 expect(r.door).toBe(true);expect(r.relic).toEqual({x:6.5,y:2.5});
 expect(r.crystals).toEqual([[14.5,18.5],[14.5,10.5],[6.5,10.5],[2.5,2.5]]);expect(r.enemies).toEqual([[14.5,2.5],[18.5,6.5]]);
 expect(phone.errors).toEqual([]);
});

test('ECHO-27: Echo and Leave cave work with a second thumb while the first is walking',async({phone})=>{
 // Phones send no click for a tap made while another finger is down (found 23 Oct 2026).
 await open(phone);const p=phone.p;await p.evaluate(()=>{__dg.launch(2);});
 const cdp=await p.context().newCDPSession(p),touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y,id])=>({x,y,id}))});
 const pad=await p.locator('#walkpad').boundingBox(),wx=pad.x+40,wy=pad.y+pad.height/2,eb=await p.locator('#echo').boundingBox(),ex=eb.x+eb.width/2,ey=eb.y+eb.height/2;
 await touch('touchStart',[[wx,wy,1]]);for(let i=1;i<=5;i++){await touch('touchMove',[[wx,wy-i*9,1]]);await p.waitForTimeout(16);}
 await touch('touchStart',[[wx,wy-45,1],[ex,ey,2]]);await p.waitForTimeout(40);await touch('touchEnd',[[ex,ey,2]]);await p.waitForTimeout(80);
 expect(await p.evaluate(()=>__dg.state().game.echoes)).toBe(1);
 expect(await p.evaluate(()=>joy.id!==null)).toBe(true);
 // At the exit with the relic, Leave cave also answers a second thumb.
 // The walking thumb stays down but returns to the centre of its stick.
 await touch('touchMove',[[wx,wy,1]]);await p.waitForTimeout(120);
 await p.evaluate(()=>{G.gotRelic=true;G.p={...G.exit};checkObjects();});await expect(p.locator('#leave')).toBeVisible();
 const lb=await p.locator('#leave').boundingBox(),lx=lb.x+lb.width/2,ly=lb.y+lb.height/2;
 await touch('touchStart',[[wx,wy,1],[lx,ly,3]]);await p.waitForTimeout(40);await touch('touchEnd',[[lx,ly,3]]);
 await expect(p.locator('#resultTitle')).toHaveText('Back to daylight.');await touch('touchEnd',[[wx,wy,1]]);
 // A single tap still sends exactly one echo, and the keyboard still works.
 await p.evaluate(()=>__dg.launch(2));await p.waitForTimeout(50);await touch('touchStart',[[ex,ey,4]]);await touch('touchEnd',[[ex,ey,4]]);await p.waitForTimeout(80);
 expect(await p.evaluate(()=>__dg.state().game.echoes)).toBe(1);
 await p.evaluate(()=>{G.cooldown=0;});await p.locator('#echo').focus();await p.keyboard.press('Enter');
 expect(await p.evaluate(()=>__dg.state().game.echoes)).toBe(2);expect(phone.errors).toEqual([]);
});
