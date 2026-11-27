'use strict';
// ADMIN-TABS: the admin Players & growth and Puzzles tabs (27 Nov 2026 rebuild), judged against admin-targets.json.
const {test,expect,goto}=require('./support');
const F=require('./admin-fixtures');
async function at(phone){await phone.p.clock.setSystemTime(new Date('2026-11-27T17:40:00Z'));}

test('ADMIN-TABS-01: GIVEN growing play but few new players back WHEN Players & growth opens THEN the headline says so and the goal, loops and sources show',async({phone})=>{
 await F.auth(phone);await F.publishing(phone);await at(phone);await goto(phone,'admin.html#players');
 const p=phone.p;
 await expect(p.locator('#plHead')).toContainText('Growing, but new players don’t stick');
 await expect(p.locator('#plHead')).toContainText('23 a day, up from 12');
 await expect(p.locator('#appN')).toHaveText('26');
 await expect(p.locator('#plKpis')).toContainText('22%');
 await expect(p.locator('#loops')).toContainText('235');
 await expect(p.locator('#loops')).toContainText('taps (3%)');
 await expect(p.locator('#plSources')).toContainText('Shared result');
 await expect(p.locator('#plSources .srow')).toHaveCount(6);
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await p.screenshot({path:'test-results/admin-players-phone.png',fullPage:true});
 expect(phone.errors).toEqual([]);
});

test('ADMIN-TABS-02: GIVEN the 30-day scorecard WHEN Puzzles opens THEN each daily gets a verdict, Doku splits by band and the worst Links group together',async({phone})=>{
 await F.auth(phone);await F.publishing(phone);await at(phone);await goto(phone,'admin.html#puzzles');
 const p=phone.p,v=k=>p.locator('.vrow[data-type="'+k+'"] .vp');
 await expect(v('link')).toHaveText('Improve');
 await expect(v('sweep')).toHaveText('Improve');   // missed in the period before too
 await expect(v('doku')).toHaveText('Watch');
 await expect(v('tally')).toHaveText('Watch');
 await expect(v('tangle')).toHaveText('Watch');
 await expect(v('mini')).toHaveText('Keep');
 await expect(v('reckon')).toHaveText('Keep');
 await expect(p.locator('.vrow[data-type="link"]')).toContainText('Next:');
 await expect(p.locator('.vrow[data-type="path"]')).toContainText('above band');
 await expect(p.locator('#scSub')).toContainText('Retire: none');
 await expect(p.locator('#bands')).toContainText('4:31');
 await expect(p.locator('#worst .fgroup')).toContainText(/Link: \d+ flagged/);
 await expect(p.locator('#worst')).toContainText('Link 94');
 // Mini types never show as slugs (the old double TYPE_NAMES bug)
 await expect(p.locator('#scRows')).not.toContainText('crossword-mini');
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await p.screenshot({path:'test-results/admin-puzzles-phone.png',fullPage:true});
 expect(phone.errors).toEqual([]);
});

test('ADMIN-TABS-03: GIVEN the new functions not applied yet WHEN Players and Puzzles open THEN each says which migration is needed',async({phone})=>{
 const gone=fn=>({error:{code:'PGRST202',message:'Could not find the function public.'+fn}});
 await F.auth(phone,{admin_players:gone('admin_players'),admin_scorecard:gone('admin_scorecard'),admin_ops:gone('admin_ops')});
 await F.publishing(phone);await at(phone);await goto(phone,'admin.html#players');
 await expect(phone.p.locator('#plHead')).toContainText('apply migration admin_rebuild');
 await phone.p.getByRole('tab',{name:'Puzzles'}).click();
 await expect(phone.p.locator('#scSub')).toContainText('apply migration admin_rebuild');
 expect(phone.errors).toEqual([]);
});
