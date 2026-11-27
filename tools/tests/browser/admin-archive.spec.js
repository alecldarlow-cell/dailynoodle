'use strict';
// ADMIN-ARCHIVE-WEB: the admin Puzzles tab's Archive use panel (6 Nov 2026; folded under Puzzles from 27 Nov), on a stubbed admin_archive_stats.
const {test,expect,goto}=require('./support');
const F=require('./admin-fixtures');
test('ADMIN-ARCHIVE-WEB-01: GIVEN weekly counts WHEN the Puzzles tab opens THEN each week shows opens, plays by type and stats opens',async({phone})=>{
 await F.auth(phone,{admin_archive_stats:{data:{weeks:[{week:'2026-11-02',archive_opens:4,archive_plays:3,stats_opens:2,stats_visitors:1,by_type:{mini:2,link:1}}]}}});
 await F.publishing(phone);await goto(phone,'admin.html#puzzles');
 await phone.p.locator('#archStats summary').click();
 const t=phone.p.locator('#tArch');
 await expect(t).toContainText('2 Nov');
 await expect(t).toContainText('Mini 2 · Link 1');
 await expect(t).toContainText('1 visitor');
 expect(phone.errors).toEqual([]);
});
test('ADMIN-ARCHIVE-WEB-02: GIVEN the migration not applied WHEN the tab opens THEN the card says so',async({phone})=>{
 await F.auth(phone,{admin_archive_stats:{error:{code:'PGRST202',message:'Could not find the function public.admin_archive_stats'}}});
 await F.publishing(phone);await goto(phone,'admin.html#puzzles');
 await phone.p.locator('#archStats summary').click();
 await expect(phone.p.locator('#tArch')).toContainText('Not set up yet');
});
