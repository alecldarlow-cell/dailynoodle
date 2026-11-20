'use strict';
// ADMIN-LAB-WEB: the admin Puzzles tab's Lab trial read-out (17 Nov 2026), on a stubbed admin_lab.
const {test,expect,goto}=require('./support');
async function auth(phone,lab){
 await phone.ctx.addInitScript(lab=>{
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{email:'admin@example.test'}}}}),onAuthStateChange(){},signOut:async()=>({})},rpc:async name=>{
   if(name==='admin_lab')return lab;
   return {data:name==='admin_dashboard'?{range:{from:'2026-11-01',to:'2026-11-17'},generated_at:'2026-11-17T12:00:00Z',kpis:{},items:[]}:name==='admin_board'?{leagues:[]}:name==='admin_archive_stats'?{weeks:[]}:false};
  }})};
 },lab);
}
const row=(type,o)=>Object.assign({type,players:0,starters:0,finishers:0,starts:0,finishes:0,abandons:0,pct_abandoned:null,median_solve_secs:null,yes:0,no:0,pct_yes:null,app:{yes:0,no:0},web:{yes:0,no:0},pct_finished:null,trial_days:0,returners:0,regulars:0,pct_returned:null,avg_days:null},o);
test('ADMIN-LAB-WEB-01: GIVEN liked-and-returned, split-but-returned and too-early types WHEN the Puzzles tab opens THEN each gets a plain read-out and the table shows coming back',async({phone})=>{
 await auth(phone,{data:{types:[
  row('redact',{players:30,starters:25,finishers:15,starts:40,abandons:20,pct_abandoned:50,pct_finished:60,trial_days:6,returners:12,regulars:6,pct_returned:48,yes:12,no:10,pct_yes:55,app:{yes:10,no:8},web:{yes:2,no:2}}),
  row('tilt',{players:40,starters:35,finishers:33,starts:60,abandons:3,pct_abandoned:5,pct_finished:94,median_solve_secs:75,trial_days:6,returners:18,regulars:9,pct_returned:51,yes:22,no:4,pct_yes:85,app:{yes:20,no:4},web:{yes:2,no:0}}),
  row('tumbler',{players:6,starters:6,finishers:5,starts:6,abandons:1,pct_abandoned:17,pct_finished:83,trial_days:2,returners:0,pct_returned:0,yes:3,no:0,pct_yes:100,app:{yes:3,no:0}})
 ]}});
 await goto(phone,'admin.html#puzzles');
 const rd=phone.p.locator('#labRead');
 await expect(rd.locator('[data-type="tilt"]')).toContainText('Looks like a daily: liked and returned to');
 await expect(rd.locator('[data-type="tilt"]')).toContainText('85% Yes from 26 voters, clearing the 70% bar.');
 await expect(rd.locator('[data-type="redact"]')).toContainText('Split vote, but players keep coming back');
 await expect(rd.locator('[data-type="redact"]')).toContainText('may be too hard or unclear');
 await expect(rd.locator('[data-type="tumbler"]')).toContainText('Too early to call, and few come back so far');
 await expect(phone.p.locator('#tLab')).toContainText('48% · 6 on 3+ days');
 await expect(rd).not.toContainText('apply migration lab_readout');
 expect(phone.errors).toEqual([]);
});
test('ADMIN-LAB-WEB-02: GIVEN admin_lab from before the read-out migration WHEN the tab opens THEN the votes still read and it says coming back needs the migration',async({phone})=>{
 const old=row('tilt',{players:4,starters:4,finishers:4,starts:4,pct_abandoned:0,yes:1,no:0,pct_yes:100,app:{yes:1,no:0}});
 ['pct_finished','trial_days','returners','regulars','pct_returned','avg_days'].forEach(k=>delete old[k]);
 await auth(phone,{data:{types:[old]}});
 await goto(phone,'admin.html#puzzles');
 await expect(phone.p.locator('#labRead')).toContainText('Too early to call');
 await expect(phone.p.locator('#labRead')).toContainText('apply migration lab_readout');
 expect(phone.errors).toEqual([]);
});
