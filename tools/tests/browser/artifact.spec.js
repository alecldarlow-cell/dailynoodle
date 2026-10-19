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
