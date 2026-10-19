'use strict';
const {test,expect,H,goto}=require('./support'),games=require('./games.json');
const sizes=process.env.DN_NIGHTLY?[[360,640],[390,844],[780,360]]:[[360,640]];
for(const [w,h] of sizes)for(const g of games)test(`LAYOUT ${g.id}: controls or orientation notice at ${w}x${h}`,async({phone})=>{
 const p=phone.p;await p.setViewportSize({width:w,height:h});
 await phone.ctx.addInitScript(()=>{window.__DGTEST=true;});
 await goto(phone,'reports/'+g.file);
 // Dots deliberately asks a portrait phone to turn; test that real action
 // rather than pretending its landscape-only board is usable in portrait.
 if(w>h&&h<=500&&['lighthouse','archipelago'].includes(g.id)){await expect(p.locator('#turn')).toBeVisible();await expect(p.locator('#turn')).toContainText('Turn your phone upright');expect(phone.errors).toEqual([]);return;}
 const action=g.id==='dots'&&w<h?p.locator('#turnUp'):p.locator(g.start).first();
 await expect(action).toBeVisible();await action.scrollIntoViewIfNeeded();
 const visible=await action.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,at=document.elementFromPoint(x,y);return {inside:x>=0&&x<innerWidth&&y>=0&&y<innerHeight,hit:!!at&&(e===at||e.contains(at)),w:r.width,h:r.height};});
 expect(visible.inside).toBe(true);expect(visible.hit).toBe(true);expect(visible.w).toBeGreaterThanOrEqual(24);expect(visible.h).toBeGreaterThanOrEqual(24);
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(phone.errors).toEqual([]);
});
