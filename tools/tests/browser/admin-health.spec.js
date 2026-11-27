'use strict';
// ADMIN-TODAY: the admin Today tab (27 Nov 2026 rebuild): one headline of what needs Alec, five status lamps,
// runway per type against the goal, yesterday's players and flags. Publishing checks stay independent of
// the date range, start only after admin access is confirmed, and report each failure on its own.
const {test,expect,H,goto}=require('./support');
const F=require('./admin-fixtures');
async function at(phone){await phone.p.clock.setSystemTime(new Date('2026-11-27T17:40:00Z'));}

test('ADMIN-TODAY-01: GIVEN live puzzles, a passed release, a Lab review in 2 days and Link with under 3 months left WHEN Today opens THEN it names both as things to do and the lamps say why',async({phone})=>{
 await F.auth(phone);const state=await F.publishing(phone,{stockOver:{link:'2027-01-26'}});await at(phone);await phone.p.setViewportSize({width:360,height:780});await goto(phone,'admin.html');
 const p=phone.p;
 await expect(p.locator('#todayHead')).toContainText('2 things need you');
 await expect(p.locator('#todayHead')).toContainText('Decide on Tumbler, Tilt by Sun 29 Nov');
 await expect(p.locator('#todayHead')).toContainText('Make more Link puzzles');
 await expect(p.locator('#todayHead')).toContainText('Link ends 26 Jan 2027 (60 days)');
 // Lab files run past the review (19 Dec against 29 Nov), so Lab stock is not a problem
 await expect(p.locator('#lamps')).toContainText('12 of 12 responding: 9 dailies and 3 Lab');
 await expect(p.locator('#lamps')).toContainText('No app errors in 7 days');
 await expect(p.locator('#lamps')).toContainText('Passed');
 await expect(p.locator('#lamps')).toContainText('Nightly tests passed');
 await expect(p.locator('#lamps .lmp').last()).toHaveClass(/warn/);
 await expect(p.locator('#rwList')).toContainText('Lab: Tilt');await expect(p.locator('#rwList')).toContainText('Review 29 Nov');
 await expect(p.locator('#rwList .rw.bad')).toHaveCount(0);await expect(p.locator('#rwList .rw.warn')).toHaveCount(1);
 await expect(p.locator('#ydTiles')).toContainText('22');await expect(p.locator('#ydTiles')).toContainText('came back');
 await expect(p.locator('#ydFlags')).toContainText('Link 110');
 await expect(p.locator('#ydApp')).toContainText('26');
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await p.screenshot({path:'test-results/admin-today-phone.png',fullPage:true});
 // Publishing detail keeps the per-check cards; the range sheet does not repeat the checks.
 await p.locator('#pubPanel summary').click();await expect(p.locator('#pubLive')).toContainText('12/12 puzzle files responding');
 await expect(p.locator('#pubStock')).toContainText('complete future days');await expect(p.locator('#pubRelease')).toContainText('Succeeded');
 const gh=state.calls.filter(x=>x==='GET github').length;
 await p.getByRole('button',{name:'Settings'}).click();await p.getByRole('button',{name:'7 days',exact:true}).click();await p.keyboard.press('Escape');
 expect(state.calls.filter(x=>x==='GET github')).toHaveLength(gh);
 // Opening the page asks only for Today's figures.
 const rpc=await p.evaluate(()=>window.__rpc);expect(rpc).not.toContain('admin_dashboard');expect(rpc).not.toContain('admin_lab');
 await p.setViewportSize({width:1120,height:850});await p.screenshot({path:'test-results/admin-today-desktop.png',fullPage:true});
 // Re-check with problems: one file down, a failed release (named step) and failed nightly tests.
 state.phase='problem';await p.locator('#pubCheck').click();
 await expect(p.locator('#lamps')).toContainText('11 of 12 responding');
 await expect(p.locator('#lamps')).toContainText('Failed at: Release › Required test suite');
 await expect(p.locator('#lamps')).toContainText('Nightly tests failed');
 await expect(p.locator('#todayHead')).toHaveClass(/bad/);await expect(p.locator('#todayHead')).toContainText('The last release failed');
 await expect(p.locator('#pubStock')).toContainText('out of date');
 expect(state.calls.every(c=>/^(GET|HEAD) /.test(c))).toBe(true);expect(phone.errors).toEqual([]);
});

test('ADMIN-TODAY-02: GIVEN an app crash this week WHEN Today opens THEN the App lamp is red and it is first among things to do',async({phone})=>{
 await F.auth(phone,{admin_ops:{data:F.ops({fatal:3})}});await F.publishing(phone,{stockOver:{link:'2028-08-01',lab:'2027-03-01'}});await at(phone);await goto(phone,'admin.html');
 await expect(phone.p.locator('#lamps .lmp').nth(1)).toHaveClass(/bad/);
 await expect(phone.p.locator('#lamps')).toContainText('3 crashes this week');
 await expect(phone.p.locator('#todayHead .act').first()).toContainText('3 app crashes this week');
 expect(phone.errors).toEqual([]);
});

test('ADMIN-TODAY-03: GIVEN everything live, released, stocked and no Lab review due WHEN Today opens THEN it says All clear',async({phone})=>{
 await F.auth(phone);await F.publishing(phone,{stockOver:{lab:'2027-03-01'}});await at(phone);
 const targets=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../../../admin-targets.json'),'utf8'));
 for(const t of Object.values(targets.lab.trials))if(t.review)t.review='2027-02-01';
 await phone.ctx.route('**/admin-targets.json',r=>r.fulfill({json:targets}));
 await goto(phone,'admin.html');
 await expect(phone.p.locator('#todayHead')).toHaveClass(/good/);await expect(phone.p.locator('#todayHead')).toContainText('All clear');
 expect(phone.errors).toEqual([]);
});

test('ADMIN-TODAY-04: GIVEN Lab files that end before the review WHEN Today opens THEN that is red',async({phone})=>{
 await F.auth(phone);await F.publishing(phone,{stockOver:{lab:'2026-11-28'}});await at(phone);await goto(phone,'admin.html');
 await expect(phone.p.locator('#todayHead')).toContainText('Lab puzzles run out before the review');
 await expect(phone.p.locator('#rwList .rw.bad')).toHaveCount(3);
 expect(phone.errors).toEqual([]);
});

for(const mode of ['signed-out','not-admin'])test('ADMIN-TODAY: '+mode+' does not start publishing requests',async({phone})=>{
 await F.auth(phone,{},mode);const state=await F.publishing(phone);await goto(phone,'admin.html');
 await expect(phone.p.locator('#signin')).toBeVisible();await expect(phone.p.locator('#app')).toBeHidden();expect(state.calls).toEqual([]);expect(phone.errors).toEqual([]);
});

test('ADMIN-TODAY: a stalled snapshot times out and can be checked again',async({phone})=>{
 await F.auth(phone);const state=await F.publishing(phone);state.phase='hung';await at(phone);await goto(phone,'admin.html');
 await H.wait(phone.p,13000);await expect(phone.p.locator('#pubStock')).toContainText('Future stock not confirmed');
 await expect(phone.p.locator('#pubCheck')).toBeEnabled();state.phase='healthy';await phone.p.locator('#pubCheck').click();
 await expect(phone.p.locator('#pubStock')).toContainText('complete future days');expect(phone.errors).toEqual([]);
});

test('ADMIN-TODAY: old addresses open the new tabs',async({phone})=>{
 await F.auth(phone);await F.publishing(phone);await at(phone);
 await goto(phone,'admin.html#publishing');await expect(phone.p.getByRole('tab',{name:'Today'})).toHaveAttribute('aria-selected','true');
 await goto(phone,'admin.html?again=1#news');await expect(phone.p.getByRole('tab',{name:'Other'})).toHaveAttribute('aria-selected','true');
 expect(phone.errors).toEqual([]);
});
