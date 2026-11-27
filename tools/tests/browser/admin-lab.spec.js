'use strict';
// ADMIN-LAB-WEB: the admin Lab tab (27 Nov 2026 rebuild; read-out from 17 Nov), on stubbed admin_lab and admin_ops.
const {test,expect,goto}=require('./support');
const F=require('./admin-fixtures');
async function at(phone){await phone.p.clock.setSystemTime(new Date('2026-11-27T17:40:00Z'));}

test('ADMIN-LAB-WEB-01: GIVEN three trials WHEN the Lab tab opens THEN each gets a verdict against the bar, vote pace and the call for the review',async({phone})=>{
 await F.auth(phone);await F.publishing(phone);await at(phone);await goto(phone,'admin.html#lab');
 const p=phone.p;
 await expect(p.locator('#labHead')).toContainText('Review on Sun 29 Nov');
 await expect(p.locator('#labHead')).toContainText('Votes have stalled');
 await expect(p.locator('.trial[data-type="tumbler"] .vp')).toHaveText('Liked, fewer return');   // 65% come back against the dailies' 66%
 await expect(p.locator('.trial[data-type="tilt"] .vp')).toHaveText('Liked, fewer return');
 await expect(p.locator('.trial[data-type="cryptic"] .vp')).toHaveText('Too early');
 await expect(p.locator('.trial[data-type="tumbler"]')).toContainText('6 short of 20 · 2 in 7 days');
 await expect(p.locator('#labCall')).toContainText('65% against 66%');
 await expect(p.locator('#labRetired')).toContainText('Redact');
 // the 17 Nov read-out is kept under Trial detail
 await p.locator('#labStats summary').click();
 await expect(p.locator('#labRead [data-type="tilt"]')).toContainText('79% Yes from 14 voters');
 await expect(p.locator('#tLab')).toContainText('58% · 6 on 3+ days');
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await p.screenshot({path:'test-results/admin-lab-phone.png',fullPage:true});
 expect(phone.errors).toEqual([]);
});

test('ADMIN-LAB-WEB-02: GIVEN admin_lab from before the read-out migration WHEN the tab opens THEN the votes still read and it says coming back needs the migration',async({phone})=>{
 const old=F.labRow('tilt',{players:4,starters:4,finishers:4,starts:4,pct_abandoned:0,yes:1,no:0,pct_yes:100,app:{yes:1,no:0}});
 ['pct_finished','trial_days','returners','regulars','pct_returned','avg_days'].forEach(k=>delete old[k]);
 await F.auth(phone,{admin_lab:{data:{types:[old]}}});await F.publishing(phone);await at(phone);await goto(phone,'admin.html#lab');
 await phone.p.locator('#labStats summary').click();
 await expect(phone.p.locator('#labRead')).toContainText('Too early to call');
 await expect(phone.p.locator('#labRead')).toContainText('apply migration lab_readout');
 expect(phone.errors).toEqual([]);
});
