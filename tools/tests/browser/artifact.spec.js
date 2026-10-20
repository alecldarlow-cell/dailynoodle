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
 for(const it of items)await expect(phone.p.locator('#feed a.card[href="'+it.path+'"]')).toHaveCount(1);
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
