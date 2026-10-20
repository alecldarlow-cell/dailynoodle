'use strict';
const {test,expect,H,goto}=require('./support');
const feed=require('../fixtures/visual-feed.json');
const cases=[
 {id:'mini-start-390-light',file:'reports/2026-10-18-crossword-mini-0099.html',w:390,h:844,scheme:'light'},
 {id:'mini-start-360-dark',file:'reports/2026-10-18-crossword-mini-0099.html',w:360,h:640,scheme:'dark'},
 {id:'sweep-finish-390-light',file:'reports/2026-10-19-logic-sweep.html',w:390,h:844,scheme:'light',finish:true},
 {id:'sweep-finish-360-dark',file:'reports/2026-10-19-logic-sweep.html',w:360,h:640,scheme:'dark',finish:true},
 {id:'puzzles-390-light',file:'puzzles.html',w:390,h:844,scheme:'light'},
 {id:'games-360-dark',file:'games.html',w:360,h:640,scheme:'dark'},
 {id:'lantern-320-light',file:'reports/2026-09-27-arcade-lantern-drift.html',w:320,h:568,scheme:'light'},
 {id:'campfire-780-landscape',file:'reports/2026-10-16-strategy-campfire-watch.html',w:780,h:360,scheme:'dark'},
];
for(const c of cases)test('VIEW: '+c.id,async({phone})=>{
 const {p,ctx}=phone;await p.setViewportSize({width:c.w,height:c.h});await p.emulateMedia({colorScheme:c.scheme,reducedMotion:'reduce'});
 await p.clock.pauseAt(new Date('2026-10-19T12:01:00+01:00'));
 await ctx.route('**/feed.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(feed)}));
 await ctx.addInitScript(()=>{window.__DGTEST=true;});
 if(c.finish)await ctx.addInitScript(()=>localStorage.setItem('digi-sweep-v1',JSON.stringify({v:1,done:{'DP·SWEEP·2026-10-19':{o:'loss',s:14,b:7,d:'2026-10-19'}}})));
 await goto(phone,c.file);await p.evaluate(()=>document.fonts.ready);await H.wait(p,500);
 if(c.finish){await expect(p.locator('.fin-box.fin-open')).toBeVisible();await expect(p.locator('.fin-share-btn')).toHaveAccessibleName(/Share/);}
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(p).toHaveScreenshot(c.id+'.png');expect(phone.errors).toEqual([]);
});
