'use strict';
const {test,expect,H,goto}=require('./support');
const {TYPES,addDay}=require('../../publishing-health');
const ids={mini:'MINI',doku:'LEXI',sweep:'SWEEP',path:'PATH',link:'LINK',tangle:'TANG',borders:'BORD',reckon:'RECK'};
const today='2026-10-19';
const list={today,items:Object.entries(TYPES).map(([type,slug])=>({type,id:'DP·'+ids[type]+'·0001',path:'reports/'+today+'-'+slug+'-0001.html'}))};
const stock={version:1,today,builtAt:today+'T10:00:00Z',runId:'100',days:Object.fromEntries([1,2,3].map(n=>[addDay(today,n),{counts:Object.fromEntries(Object.keys(TYPES).map(t=>[t,1])),blocked:[]}]))};
async function auth(phone,mode='admin'){
 await phone.ctx.addInitScript(mode=>{
  const session=mode==='signed-out'?null:{user:{email:'admin@example.test'}};
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session}}),onAuthStateChange(){},signOut:async()=>({})},rpc:async name=>{
   if(mode==='not-admin')return {error:{message:'not_admin'}};
   return {data:name==='admin_dashboard'?{range:{from:'2026-10-01',to:'2026-10-19'},generated_at:'2026-10-19T12:00:00Z',kpis:{},items:[]}:name==='admin_board'?{leagues:[]}:false};
  }})};
 },mode);
}
async function fixtures(phone){
 const state={phase:'healthy',calls:[]};
 await phone.ctx.route('**/publishing-health.json*',r=>{state.calls.push(r.request().method()+' stock');if(state.phase==='hung')return new Promise(()=>{});return r.fulfill({json:{...stock,...(state.phase==='problem'?{today:'2026-10-18'}:{})}});});
 await phone.ctx.route('**/puzzles-today.json*',r=>{state.calls.push(r.request().method()+' list');return r.fulfill({json:list});});
 await phone.ctx.route(/\/reports\/.*publishing-check=1/,r=>{state.calls.push(r.request().method()+' puzzle');return r.fulfill({status:state.phase==='problem'&&r.request().url().includes('word-link')?404:200,body:''});});
 await phone.ctx.route('https://api.github.com/**',r=>{state.calls.push(r.request().method()+' github');return state.phase==='problem'?r.fulfill({status:403,json:{message:'rate limit'}}):r.fulfill({json:{workflow_runs:[{id:102,status:'in_progress',conclusion:null},{id:100,status:'completed',conclusion:'success',updated_at:'2026-10-19T10:05:00Z'}]}});});
 return state;
}
test('ADMIN-PUBLISH: live files, future stock and release states remain independent; refresh reports failures',async({phone})=>{
 await auth(phone);const state=await fixtures(phone);await phone.p.setViewportSize({width:360,height:780});await goto(phone,'admin.html');
 const p=phone.p;await expect(p.locator('#pubLive')).toContainText('8/8 puzzle files responding');
 await expect(p.locator('#pubStock')).toContainText('3 complete future days');await expect(p.locator('#pubStock')).toContainText('23 Oct 2026');
 await expect(p.locator('#pubRelease')).toContainText('In progress');await expect(p.locator('#pubRelease')).toContainText('19 Oct 2026');
 await p.locator('[data-filter="puzzles"]').click();await expect(p.locator('#publishing')).toBeVisible();
 await p.getByRole('button',{name:'7 days',exact:true}).click();expect(state.calls.filter(x=>x==='GET github')).toHaveLength(1);
 await p.locator('#publishing summary').click();await expect(p.locator('#pubDays')).toContainText('Every type on file');
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await p.locator('#publishing').screenshot({path:'test-results/admin-publishing-phone.png'});
 await p.setViewportSize({width:1120,height:850});await p.locator('#publishing').screenshot({path:'test-results/admin-publishing-desktop.png'});
 state.phase='problem';await p.locator('#pubCheck').click();
 await expect(p.locator('#pubLive')).toContainText('7/8 puzzle files responding');await expect(p.locator('#pubStock')).toContainText('out of date');await expect(p.locator('#pubRelease')).toContainText('GitHub status not confirmed');
 expect(state.calls.every(c=>/^(GET|HEAD) /.test(c))).toBe(true);expect(phone.errors).toEqual([]);
});
for(const mode of ['signed-out','not-admin'])test('ADMIN-PUBLISH: '+mode+' does not start publishing requests',async({phone})=>{
 await auth(phone,mode);const state=await fixtures(phone);await goto(phone,'admin.html');
 await expect(phone.p.locator('#signin')).toBeVisible();await expect(phone.p.locator('#app')).toBeHidden();expect(state.calls).toEqual([]);expect(phone.errors).toEqual([]);
});

test('ADMIN-PUBLISH: a stalled snapshot times out and can be checked again',async({phone})=>{
 await auth(phone);const state=await fixtures(phone);state.phase='hung';await goto(phone,'admin.html');
 await H.wait(phone.p,13000);await expect(phone.p.locator('#pubStock')).toContainText('Future stock not confirmed');
 await expect(phone.p.locator('#pubCheck')).toBeEnabled();state.phase='healthy';await phone.p.locator('#pubCheck').click();
 await expect(phone.p.locator('#pubStock')).toContainText('3 complete future days');expect(phone.errors).toEqual([]);
});
