'use strict';
// ADMIN-ARCHIVE-WEB: the admin Puzzles tab's Archive and stats card (6 Nov 2026), on a stubbed admin_archive_stats.
const {test,expect,goto}=require('./support');
async function auth(phone,archive){
 await phone.ctx.addInitScript(archive=>{
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{email:'admin@example.test'}}}}),onAuthStateChange(){},signOut:async()=>({})},rpc:async name=>{
   if(name==='admin_archive_stats')return archive;
   return {data:name==='admin_dashboard'?{range:{from:'2026-10-01',to:'2026-10-19'},generated_at:'2026-10-19T12:00:00Z',kpis:{},items:[]}:name==='admin_board'?{leagues:[]}:false};
  }})};
 },archive);
}
test('ADMIN-ARCHIVE-WEB-01: GIVEN weekly counts WHEN the Puzzles tab opens THEN each week shows opens, plays by type and stats opens',async({phone})=>{
 await auth(phone,{data:{weeks:[{week:'2026-11-02',archive_opens:4,archive_plays:3,stats_opens:2,stats_visitors:1,by_type:{mini:2,link:1}}]}});
 await goto(phone,'admin.html#puzzles');
 const t=phone.p.locator('#tArch');
 await expect(t).toContainText('2 Nov');
 await expect(t).toContainText('Mini 2 · Link 1');
 await expect(t).toContainText('1 visitor');
 expect(phone.errors).toEqual([]);
});
test('ADMIN-ARCHIVE-WEB-02: GIVEN the migration not applied WHEN the tab opens THEN the card says so',async({phone})=>{
 await auth(phone,{error:{code:'PGRST202',message:'Could not find the function public.admin_archive_stats'}});
 await goto(phone,'admin.html#puzzles');
 await expect(phone.p.locator('#tArch')).toContainText('Not set up yet');
});
