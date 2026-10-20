'use strict';
const {test,expect,H,goto}=require('./support');
const types=['mini','doku','sweep','path','link','tangle','borders','reckon'];
const names=['Mini','Doku','Sweep','Path','Link','Tangle','Borders','Reckon'];
const fixture={built:'2026-10-19T12:00:00Z',items:types.map((type,i)=>({
 kind:'puzzle',type,headline:names[i]+' 1',standfirst:'A daily puzzle to work out.',
 topic:i===0?'Crossword':'Logic',date:'2026-10-19',read:'~3 min',
 path:'reports/guide-fixture-'+type+'.html',mask:'.'.repeat(36)
}))};
async function feed(phone,items=fixture.items){
 await phone.ctx.route('**/feed.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...fixture,items})}));
}
for(const width of [320,390])for(const scheme of ['light','dark'])
test('GUIDES: card date, duration and separate help target at '+width+' '+scheme,async({phone})=>{
 const p=phone.p;await p.setViewportSize({width,height:844});await p.emulateMedia({colorScheme:scheme});
 // Include a long archive date and an old feed without a type field.
 const items=fixture.items.map(x=>({...x}));items[3].date='2026-09-03';items[3].read='~10 min';delete items[3].type;
 await feed(phone,items);await goto(phone,'puzzles.html');
 await expect(p.locator('#feed .card-guide')).toHaveCount(8);
 for(let i=0;i<types.length;i++){
  const row=p.locator('#feed > li').nth(i);
  await expect(row.locator('.card-time')).toHaveText(i===3?'~10 min':'~3 min');
  await expect(row.locator('.card-date')).toHaveText(i===3?'3 Sept 2026':'Today');
  await expect(row.locator('.meta .t')).toHaveCount(0);
  await expect(row.locator('.card-guide')).toHaveAttribute('href','how-to-play.html#'+types[i]);
  await expect(row.locator('a.card .card-guide')).toHaveCount(0);
  await row.scrollIntoViewIfNeeded();await H.wait(p,100);
  const geometry=await row.evaluate(el=>{
   const a=el.querySelector('.card-guide'),g=a.getBoundingClientRect();
   const fields=[...el.querySelectorAll('.card-date,.card-time')].map(x=>x.getBoundingClientRect());
   return {clear:fields.every(r=>g.right<=r.left||g.left>=r.right||g.bottom<=r.top||g.top>=r.bottom),
    width:g.width,height:g.height,hit:document.elementFromPoint(g.left+g.width/2,g.top+g.height/2)===a};
  });
  expect(geometry.clear).toBe(true);expect(geometry.hit).toBe(true);
  expect(geometry.width).toBeGreaterThanOrEqual(24);expect(geometry.height).toBeGreaterThanOrEqual(24);
 }
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(phone.errors).toEqual([]);
});
test('GUIDES: matching pill, history, reload and the play link remain independent',async({phone})=>{
 const {p,ctx}=phone;await feed(phone);await goto(phone,'puzzles.html');
 await p.locator('#chips [data-topic="Path"]').click();
 const target=await p.locator('#feed a.card').getAttribute('href');
 await p.locator('#feed .card-guide').click();await p.waitForURL('**/how-to-play.html#path');await H.wait(p,300);
 await expect(p.locator('.guide-panel:visible')).toHaveCount(1);
 await expect(p.locator('#path')).toBeVisible();
 await expect(p.locator('#guide-pills [href="#path"]')).toHaveAttribute('aria-current','true');
 await expect(p.locator('#path .guide-play')).toHaveAttribute('href',/^\/reports\/[\w.-]+logic-path[\w.-]*\.html\?via=how-to-play$/);
 await p.locator('#guide-pills [href="#tangle"]').click();
 await expect(p.locator('#tangle')).toBeVisible();
 await p.goBack();await H.wait(p,200);await expect(p.locator('#path')).toBeVisible();
 await p.reload();await H.wait(p,300);await expect(p.locator('#path')).toBeVisible();
 await p.goBack();await H.wait(p,600);
 await expect(p.locator('#chips [data-topic="Path"]')).toHaveAttribute('aria-pressed','true');
 await expect(p.locator('#feed .card-time')).toHaveText('~3 min');
 await ctx.route('**/reports/guide-fixture-*.html',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Puzzle</title><p>Opened the puzzle</p>'}));
 await p.locator('#feed .hl').click();await p.waitForURL('**/'+target);
 expect(phone.errors).toEqual([]);
});
test('GUIDES: all pills work on phones in both themes, including direct links and keyboard activation',async({phone},testInfo)=>{
 const p=phone.p;
 for(const scheme of ['light','dark']){
  await p.emulateMedia({colorScheme:scheme});
  for(const width of [320,390]){
   await p.setViewportSize({width,height:844});await goto(phone,'how-to-play.html#path');
   for(const type of types){
    await p.locator('#guide-pills [href="#'+type+'"]').click();
    await expect(p.locator('.guide-panel:visible')).toHaveCount(1);
    await expect(p.locator('#'+type)).toBeVisible();
    expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
   await p.locator('#guide-pills [href="#path"]').focus();await p.keyboard.press('Enter');
   await expect(p.locator('#path')).toBeVisible();
  }
  await p.evaluate(()=>document.fonts.ready);
  const preview=await p.screenshot({fullPage:true,scale:'css'});
  await testInfo.attach('path-guide-'+scheme,{body:preview,contentType:'image/png'});
 }
 expect(phone.errors).toEqual([]);
});
test('GUIDES: readable rules and real hash links even without the guide script',async({phone})=>{
 await phone.ctx.route('**/how-to-play.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
 await phone.ctx.route('**/front.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
 await goto(phone,'puzzles.html');
 await phone.p.getByRole('link',{name:'How to play',exact:true}).click();
 await expect(phone.p).toHaveTitle('How to play our daily puzzles — The Daily Noodle');
 await expect(phone.p.locator('meta[name="description"]')).toHaveAttribute('content',/Mini, Doku, Sweep, Path, Link, Tangle, Borders and Reckon/);
 await expect(phone.p.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
 await expect(phone.p.locator('.guide-panel:visible')).toHaveCount(8);
 await expect(phone.p.locator('link[rel="canonical"]')).toHaveAttribute('href','https://dailynoodle.co.uk/how-to-play.html');
 for(const type of types){
  await expect(phone.p.locator('#'+type+' ol li')).toHaveCount(3);
  await expect(phone.p.locator('#guide-pills [href="#'+type+'"]')).toHaveCount(1);
 }
 expect(phone.errors).toEqual([]);
});
