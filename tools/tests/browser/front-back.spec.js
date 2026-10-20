'use strict';
// FRONT-BACK: Back from a card returns to the same topic and the same card at
// the top, from history.state (dnFront), when the browser did NOT keep the
// page in its back-forward cache (SITE.md, Sections, "Front-page behaviour").
// The front page is made ineligible for the cache (served no-store, with an
// unload listener), and every run checks that Back really loaded a fresh
// document: a window marker set before leaving must be gone and pageshow must
// not be persisted. If a cached page ever comes back, the test fails rather
// than passing on the cache.
const {test,expect,H,goto}=require('./support');

// The card at the top of the list (first one whose bottom is below the sticky
// controls), measured the way the reader sees it.
const topCard=p=>p.evaluate(()=>{
 const c=document.querySelector('.controls'),line=c?Math.max(0,c.getBoundingClientRect().bottom):0;
 for(const a of document.querySelectorAll('#feed a.card')){const r=a.getBoundingClientRect();if(r.bottom>line+1)return {href:a.getAttribute('href'),top:Math.round(r.top),line:Math.round(line)};}
 return null;
});

for(const [page,topic,nth] of [['puzzles.html','Word',14],['index.html','Science',9]])
test('FRONT-BACK: '+page+' keeps topic "'+topic+'" and the top card across Back with no back-forward cache',async({phone})=>{
 const {ctx,p}=phone;
 // the page from disk, as the harness serves it, plus no-store (never route.fetch: that goes to the network)
 const body=require('fs').readFileSync(require('path').join(H.REPO,page));
 await ctx.route('https://dailynoodle.co.uk/'+page,r=>r.fulfill({status:200,contentType:'text/html',headers:{'cache-control':'no-store'},body}));
 await ctx.addInitScript(()=>{
  window.addEventListener('unload',()=>{});
  window.addEventListener('pageshow',e=>{window.__persisted=e.persisted;});
 });
 await goto(phone,page);
 await p.locator('#chips .chip[data-topic="'+topic+'"]').click();await H.wait(p,300);
 await expect(p.locator('#chips .chip[data-topic="'+topic+'"]')).toHaveAttribute('aria-pressed','true');
 const n=await p.locator('#feed a.card').count();
 expect(n,'cards in '+topic).toBeGreaterThan(nth+5);
 // scroll so card nth sits part-way under the controls (an offset, not a card edge)
 // (repeated: cards below the screen are laid out lazily, so one jump lands short)
 for(let i=0;i<6;i++){
  const off=await p.evaluate(nth=>{const a=document.querySelectorAll('#feed a.card')[nth],c=document.querySelector('.controls');
   const d=a.getBoundingClientRect().top-c.getBoundingClientRect().bottom+23;window.scrollTo(0,window.scrollY+d);return Math.round(d);},nth);
  await H.wait(p,150);if(Math.abs(off)<1)break;
 }
 const before=await topCard(p);
 expect(before.href).toBe(await p.locator('#feed a.card').nth(nth).getAttribute('href'));
 expect(await p.evaluate(()=>window.scrollY)).toBeGreaterThan(400);
 await p.evaluate(()=>{window.__mark='kept';});
 // open the next card down, as a reader would
 const target=await p.locator('#feed a.card').nth(nth+1).getAttribute('href');
 await p.locator('#feed a.card').nth(nth+1).click();
 await p.waitForURL('**/'+target);await H.wait(p,800);
 await p.goBack();await H.wait(p,1500);
 expect(p.url()).toBe('https://dailynoodle.co.uk/'+page);
 const fresh=await p.evaluate(()=>({mark:window.__mark,persisted:window.__persisted,state:history.state&&history.state.dnFront}));
 expect(fresh.mark,'Back must load a fresh document, not the back-forward cache').toBeUndefined();
 expect(fresh.persisted).toBe(false);
 expect(fresh.state&&fresh.state.topic).toBe(topic);
 await expect(p.locator('#chips .chip[data-topic="'+topic+'"]')).toHaveAttribute('aria-pressed','true');
 await expect(p.locator('#chips .chip[data-topic="all"]')).toHaveAttribute('aria-pressed','false');
 expect(await p.locator('#feed a.card').count()).toBe(n);
 const after=await topCard(p);
 expect(after.href,'the same card is at the top').toBe(before.href);
 expect(Math.abs(after.top-before.top),'and at the same height (px)').toBeLessThanOrEqual(2);
 expect(phone.errors).toEqual([]);
});
