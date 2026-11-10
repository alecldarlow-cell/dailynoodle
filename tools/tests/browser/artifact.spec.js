'use strict';
const fs=require('node:fs'),path=require('node:path');
const {test,expect,H,goto}=require('./support');
const ROOT=path.resolve(__dirname,'../../..');
// Source-only browser runs remain usable; the suite also runs this against
// the freshly transformed _site with DN_TEST_ROOT set in a separate process.
for(const page of ['index.html','puzzles.html','games.html'])test('BUILD/FRONT: '+page+' has cards and every card opens',async({phone})=>{
 const file=path.join(H.REPO,'puzzles-today.json'),day=JSON.parse(fs.readFileSync(file)).today;
 await phone.p.clock.setSystemTime(new Date(day+'T12:00:00Z'));await goto(phone,page);
 const cards=phone.p.locator('a.card');expect(await cards.count()).toBeGreaterThan(0);
 const links=await cards.evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 for(const link of links){const rel=new URL(link,'https://dailynoodle.co.uk/').pathname.slice(1);expect(fs.existsSync(path.join(H.REPO,rel)),rel).toBe(true);}
 await cards.first().click();await H.wait(phone.p,1000);expect(phone.p.url()).toContain('/reports/');
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('FRONT-01: offline feed gives a retry action and reconnect repairs it',async({phone})=>{
 let offline=true;await phone.ctx.route('**/feed.json',r=>offline?r.abort():r.fulfill({path:path.join(H.REPO,'feed.json'),contentType:'application/json'}));
 await goto(phone,'puzzles.html');await expect(phone.p.getByRole('button',{name:'Try again'})).toBeVisible();
 offline=false;await phone.p.evaluate(()=>dispatchEvent(new Event('online')));await H.wait(phone.p,600);
 expect(await phone.p.locator('a.card').count()).toBeGreaterThan(0);expect(phone.errors).toEqual([]);
});
test('BUILD: manifest retains standalone and correct site identity',async()=>{
 const m=JSON.parse(fs.readFileSync(path.join(H.REPO,'manifest.webmanifest')));expect(m.display).toBe('standalone');expect(m.name).toMatch(/Noodle/);
});

test('SEO/FRONT: static cards and the enhanced list have identical markup',async({phone})=>{
 test.skip(!process.env.DN_TEST_ROOT,'Published artifact is checked in the artifact group');
 const feed=JSON.parse(fs.readFileSync(path.join(H.REPO,'feed.json'),'utf8'));
 const items=feed.items.filter(it=>it.kind==='puzzle'&&!/^\s*in development\s*$/i.test(it.badge||''));
 await phone.p.clock.setSystemTime(new Date(feed.today+'T12:00:00Z'));
 await phone.ctx.route('**/front.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
 await goto(phone,'puzzles.html');
 await expect(phone.p.locator('#feed a.card')).toHaveCount(items.length);
 const before=await phone.p.locator('#feed > li').evaluateAll(es=>es.map(e=>e.outerHTML));
 const links=await phone.p.locator('#feed a.card').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 // the day's set first in the daily order, then older cards (hidden) in feed order (7 Nov 2026)
 expect(links).toEqual(require('../../card-renderer').daySet(items,feed.today).items.map(it=>it.path));
 await phone.ctx.unroute('**/front.js');
 await Promise.all([phone.p.waitForResponse('**/feed.json'),phone.p.reload()]);
 await phone.p.waitForFunction(()=>document.getElementById('feed').innerHTML.startsWith('<li'));
 const after=await phone.p.locator('#feed > li').evaluateAll(es=>es.map(e=>e.outerHTML));
 expect(after).toEqual(before);expect(phone.errors).toEqual([]);
});
test('SEO/GUIDES: static guide buttons point directly to the published daily files',async()=>{
 test.skip(!process.env.DN_TEST_ROOT,'Published artifact is checked in the artifact group');
 const html=fs.readFileSync(path.join(H.REPO,'how-to-play.html'),'utf8'),list=JSON.parse(fs.readFileSync(path.join(H.REPO,'puzzles-today.json'),'utf8'));
 for(const it of list.items){
  expect(html).toContain('href="/'+it.path+'?via=how-to-play"');
  expect(fs.existsSync(path.join(H.REPO,it.path)),it.path).toBe(true);
 }
});
// One guide page per puzzle type and the About page (tools/guide-pages.js, 10 Nov 2026; SITE.md › Type guide pages and About).
test('SEO/TYPE-PAGES: each puzzle type has its own readable guide page, linked both ways, and About opens them',async({phone},testInfo)=>{
 test.skip(!process.env.DN_TEST_ROOT,'Published artifact is checked in the artifact group');
 const {PAGES,rel}=require('../../guide-pages'),p=phone.p,types=Object.keys(PAGES);
 for(const width of [320,390]){
  await p.setViewportSize({width,height:844});
  for(const type of types){
   await goto(phone,rel(type));
   await expect(p.locator('h1')).toHaveCount(1);await expect(p.locator('h1')).toHaveText(PAGES[type].h1);
   await expect(p.locator('#'+type+' ol li')).toHaveCount(3);
   await expect(p.locator('.guide-facts div')).toHaveCount(PAGES[type].facts.length+3);
   await expect(p.locator('#guide-pills [aria-current="true"]')).toHaveCount(1);
   await expect(p.locator('#guide-pills [aria-current="true"]')).toHaveAttribute('href',rel(type));
   await expect(p.locator('link[rel="canonical"]')).toHaveAttribute('href','https://dailynoodle.co.uk/'+rel(type));
   await expect(p.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
   // the shared styles arrived (a broken relative path would leave the page unstyled)
   expect(await p.locator('.guide-play').evaluate(el=>getComputedStyle(el).borderRadius)).not.toBe('0px');
   expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
 await p.evaluate(()=>document.fonts.ready);
 await testInfo.attach('type-page-tally',{body:await p.screenshot({fullPage:true,scale:'css'}),contentType:'image/png'});
 // pills move between the nine pages; the full guide links to each page and back
 await p.locator('#guide-pills a',{hasText:'Mini'}).click();await p.waitForURL('**/'+rel('mini'));
 await p.getByRole('link',{name:'How to play every puzzle ›'}).click();await p.waitForURL('**/how-to-play.html');
 await p.locator('#mini .guide-links a').click();await p.waitForURL('**/'+rel('mini'));
 // inside the app (window.__DN_APP = 2) the guide hides the links that would leave for the browser
 await p.addInitScript(()=>{window.__DN_APP=2;});await goto(phone,'how-to-play.html#path');
 await expect(p.locator('#path')).toBeVisible();await expect(p.locator('#path .guide-links')).toBeHidden();
 await p.addInitScript(()=>{window.__DN_APP=0;});
 await goto(phone,'about.html');
 await expect(p.locator('h1')).toHaveCount(1);await expect(p.locator('.nine a')).toHaveCount(types.length);
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await testInfo.attach('about',{body:await p.screenshot({fullPage:true,scale:'css'}),contentType:'image/png'});
 await p.locator('.nine a').last().click();await p.waitForURL('**/'+rel(types[types.length-1]));
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
