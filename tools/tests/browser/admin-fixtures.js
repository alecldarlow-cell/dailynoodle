'use strict';
// Stubbed admin data for the admin browser specs (27 Nov 2026 rebuild). Figures are shaped like the live
// functions' answers (toolchain/sql/2026-11-27-admin-rebuild.sql, admin_lab, admin_archive_stats).
const {TYPES,LAB,addDay}=require('../../publishing-health');
const IDS={mini:'MINI',doku:'LEXI',sweep:'SWEEP',path:'PATH',link:'LINK',tangle:'TANG',borders:'BORD',reckon:'RECK',tally:'TALLY'};
const LAB_IDS={tilt:'TILT',tumbler:'TUMB',cryptic:'CRYP'};
const TODAY='2026-11-27',Y='2026-11-26';
const list=(today=TODAY)=>({today,items:Object.entries(TYPES).map(([type,slug])=>({type,id:'DP·'+IDS[type]+'·0001',path:'reports/'+today+'-'+slug+'-0001.html'}))});
const feed=(today=TODAY)=>({items:['tilt','tumbler','cryptic'].map(t=>({kind:'puzzle',type:t,date:today,path:'reports/'+today+'-'+LAB[t]+'-0001.html',headline:t+' 1',badge:'In development'}))
 .concat([{kind:'puzzle',type:'link',date:'2026-11-10',path:'reports/2026-11-10-word-link-0094.html',headline:'Link 94'},{kind:'puzzle',type:'link',date:Y,path:'reports/'+Y+'-word-link-0110.html',headline:'Link 110'}])});
/* Stock: every daily through `through`, except Link which stops at `link`; Lab through `lab`. */
function stock({today=TODAY,through='2028-02-01',link='2027-07-21',lab=addDay(TODAY,22)}={}){
 const days={};
 for(let d=today;d<=through;d=addDay(d,1)){
  const counts=Object.fromEntries(Object.keys(TYPES).filter(t=>t!=='link'||d<=link).map(t=>[t,1]));
  days[d]={counts,blocked:[]};
  if(d<=lab)days[d].lab={tilt:1,tumbler:1,cryptic:1};
 }
 return {version:1,today,builtAt:today+'T06:00:00Z',runId:'100',days};
}
const t=(slug,o)=>Object.assign({slug,players:40,attempts:400,finishes:380,pct_finished:95,pct_failed:0,pct_unfinished:5,pct_won:null,med_secs:60,p75_secs:90,p90_secs:120,
 med_score:null,mean_score:null,med_got:null,of_n:null,med_words:null,avg_mistakes:null,pct_help:0,gold:40,pct_gold:10.5,pct_returning:66,pct_of_players:45},o);
const types=()=>[
 t('crossword-mini',{players:59,attempts:515,pct_finished:93,med_secs:74,pct_help:18,pct_returning:63,pct_of_players:61,pct_gold:10.3}),
 t('logic-doku',{players:45,attempts:471,pct_finished:84,med_secs:91,pct_returning:71,pct_of_players:47,pct_gold:12.2}),
 t('logic-path',{players:46,attempts:466,pct_finished:95,med_secs:34,pct_returning:67,pct_of_players:48,pct_gold:15.5}),
 t('word-link',{players:45,attempts:494,pct_finished:53,pct_failed:37,pct_unfinished:10,pct_won:59,med_secs:87,avg_mistakes:2.29,pct_returning:71,pct_of_players:47,pct_gold:10.6}),
 t('logic-sweep',{players:41,attempts:422,pct_finished:57,pct_failed:39,pct_won:59,med_secs:54,pct_returning:66,pct_of_players:43,pct_gold:8.3}),
 t('word-tangle',{players:63,attempts:561,pct_finished:97,med_secs:null,med_score:25,mean_score:25,med_words:15,pct_returning:51,pct_of_players:66,pct_gold:11.2}),
 t('geo-borders',{players:52,attempts:444,pct_finished:97,med_secs:null,med_score:500,mean_score:559,med_got:5,of_n:10,pct_returning:63,pct_of_players:54,pct_gold:11.9}),
 t('quiz-reckon',{players:50,attempts:406,pct_finished:95,med_secs:null,med_score:620,mean_score:600,pct_returning:64,pct_of_players:52,pct_gold:12.5}),
 t('logic-tally',{players:44,attempts:351,pct_finished:76,pct_unfinished:24,med_secs:138,pct_returning:73,pct_of_players:46,pct_gold:6.0}),
 t('word-tumbler',{players:23,attempts:152,pct_finished:99,med_secs:63,pct_returning:65,pct_of_players:24,pct_gold:null}),
 t('logic-tilt',{players:19,attempts:87,pct_finished:85,med_secs:42,pct_returning:58,pct_of_players:20,pct_gold:null}),
 t('word-cryptic',{players:17,attempts:40,pct_finished:85,med_secs:40,pct_returning:47,pct_of_players:18,pct_gold:null})
];
function puzzles(){
 const out=[];
 for(let i=0;i<30;i++){
  const d=addDay('2026-10-28',i);
  out.push({slug:'word-link',path:'reports/'+d+'-word-link-'+String(81+i).padStart(4,'0')+'.html',date:d,players:12,pct_finished:60,pct_won:i<10?10+i:70,med_secs:100,med_score:null});
  out.push({slug:'logic-tally',path:'reports/'+d+'-logic-tally-'+String(4+i).padStart(4,'0')+'.html',date:d,players:12,pct_finished:i===29?58:80,pct_won:null,med_secs:130,med_score:null});
  out.push({slug:'crossword-mini',path:'reports/'+d+'-crossword-mini-'+String(110+i).padStart(4,'0')+'.html',date:d,players:15,pct_finished:i===6?73:95,pct_won:null,med_secs:70,med_score:null});
 }
 out.find(p=>p.date==='2026-11-10'&&p.slug==='word-link').pct_won=0;
 out.find(p=>p.date===Y&&p.slug==='word-link').pct_won=19;
 return out;
}
const scorecard=()=>({from:'2026-10-28',to:Y,players:96,types:types(),puzzles:puzzles(),
 bands:[{slug:'logic-doku',band:'easy',attempts:91,pct_finished:90,med_secs:37,p75_secs:69,p90_secs:109},{slug:'logic-doku',band:'medium',attempts:237,pct_finished:87,med_secs:90,p75_secs:163,p90_secs:260},{slug:'logic-doku',band:'hard',attempts:106,pct_finished:75,med_secs:271,p75_secs:442,p90_secs:645}],
 prev:{from:'2026-09-28',to:'2026-10-27',players:60,types:types().map(x=>Object.assign({},x,x.slug==='word-link'?{pct_won:62}:x.slug==='logic-tally'?{pct_finished:88}:x.slug==='word-tangle'?{pct_returning:62}:{}))},refreshed:Y+'T23:59:00Z'});
function players(){
 const daily=[];const vals=[12,14,11,13,12,10,12,15,18,20,22,19,21,24,39,24,30,26,30,26,24,22,24,21,25,25,21,22,24,22];
 for(let i=0;i<30;i++)daily.push({day:addDay('2026-10-28',i),players:vals[i],returning:Math.max(0,vals[i]-3),new:3});
 daily[29]={day:Y,players:22,returning:19,new:3};
 return {from:'2026-10-28',to:Y,players:96,new_players:79,avg_daily:21.1,avg_daily_first7:12,avg_daily_last7:23,weekly_players:42,daily,
  cohort:{d1_n:147,d1:32,w2_n:120,w2:32,m1_n:60,m1:8},
  app:{players_30:26,players_7:17,weeks:[{week:'2026-11-09',players:9},{week:'2026-11-16',players:14},{week:'2026-11-23',players:17}]},
  sources:[{src:'Direct or bookmark',visitors:3131,played:34,came_back:18,regular:15},{src:'Shared result',visitors:30,played:21,came_back:2,regular:2},{src:'The app',visitors:21,played:14,came_back:8,regular:8},{src:'Link: wordleverse',visitors:22,played:8,came_back:2,regular:1},{src:'Google',visitors:26,played:2,came_back:1,regular:0}],
  loops:{share_taps:235,share_players:31,share_arrivals:30,share_played:21,share_back:2,invites:0,joins:14,joins_due:12,joins_playing:9,app_prompt_views:80,app_prompt_taps:2,app_new:14,app_back:8,app_regular:8}};
}
const ops=({fatal=0}={})=>({app_errors:{day:fatal,week:fatal,fatal_week:fatal,top:fatal?[{kind:'fatal',message:'TypeError: x is undefined',version:'0.5.0',n:fatal,last:TODAY+'T08:00:00Z'}]:[],latest_version:'0.5.0'},
 lab_votes:[{type:'tilt',total:14,yes:11,new_7d:2,first:'2026-11-15'},{type:'tumbler',total:14,yes:14,new_7d:2,first:'2026-11-12'},{type:'cryptic',total:8,yes:7,new_7d:8,first:'2026-11-21'},{type:'redact',total:8,yes:7,new_7d:0,first:'2026-11-12'}],
 tasks:[],refreshed:Y+'T23:59:00Z'});
const labRow=(type,o)=>Object.assign({type,players:0,starters:0,finishers:0,starts:0,finishes:0,abandons:0,pct_abandoned:null,median_solve_secs:null,yes:0,no:0,pct_yes:null,app:{yes:0,no:0},web:{yes:0,no:0},pct_finished:null,trial_days:0,returners:0,regulars:0,pct_returned:null,avg_days:null},o);
const lab=()=>({types:[
 labRow('tumbler',{players:24,starters:23,finishers:23,starts:150,pct_abandoned:1,median_solve_secs:63,yes:14,no:0,pct_yes:100,app:{yes:10,no:0},web:{yes:4,no:0},pct_finished:99,trial_days:12,returners:15,regulars:10,pct_returned:65}),
 labRow('tilt',{players:20,starters:19,finishers:16,starts:87,abandons:13,pct_abandoned:15,median_solve_secs:42,yes:11,no:3,pct_yes:79,app:{yes:8,no:2},web:{yes:3,no:1},pct_finished:85,trial_days:12,returners:11,regulars:6,pct_returned:58}),
 labRow('cryptic',{players:18,starters:17,finishers:14,starts:40,abandons:6,pct_abandoned:15,median_solve_secs:40,yes:7,no:1,pct_yes:88,app:{yes:5,no:1},web:{yes:2,no:0},pct_finished:85,trial_days:6,returners:8,regulars:3,pct_returned:47}),
 labRow('redact',{})]});
const runs={workflow_runs:[{id:102,status:'completed',conclusion:'success',updated_at:TODAY+'T06:12:00Z'},{id:100,status:'completed',conclusion:'success',updated_at:Y+'T18:05:00Z'}]};
const tests={workflow_runs:[{id:900,status:'completed',conclusion:'success',created_at:TODAY+'T03:17:00Z'}]};
/** Sign in as an admin with these answers; `over` replaces any function's answer ({data} or {error}). */
async function auth(phone,over={},mode='admin'){
 const answers={admin_players:{data:players()},admin_scorecard:{data:scorecard()},admin_ops:{data:ops()},admin_lab:{data:lab()},
  admin_board:{data:{leagues:[]}},admin_archive_stats:{data:{weeks:[]}},admin_dashboard:{data:{range:{from:'2026-10-28',to:Y},generated_at:TODAY+'T12:00:00Z',kpis:{},items:[]}},
  admin_sources:{data:{first:[],visits:[],tags:[]}},admin_links:{data:[]},admin_refresh:{data:TODAY+'T17:00:00Z'},...over};
 await phone.ctx.addInitScript(([answers,mode])=>{
  window.__rpc=[];
  const session=mode==='signed-out'?null:{user:{email:'admin@example.test'}};
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session}}),onAuthStateChange(){},signOut:async()=>({})},rpc:async(name,args)=>{
   window.__rpc.push(name);
   if(mode==='not-admin')return {error:{message:'not_admin'}};
   return answers[name]||{data:false};
  }})};
 },[answers,mode]);
}
/** Publishing fixtures; state.phase switches between healthy, problem and hung. */
async function publishing(phone,{stockOver}={}){
 const state={phase:'healthy',calls:[]};
 await phone.ctx.route('**/publishing-health.json*',r=>{state.calls.push(r.request().method()+' stock');if(state.phase==='hung')return new Promise(()=>{});return r.fulfill({json:{...stock(stockOver),...(state.phase==='problem'?{today:Y}:{})}});});
 await phone.ctx.route('**/puzzles-today.json*',r=>{state.calls.push(r.request().method()+' list');return r.fulfill({json:list()});});
 await phone.ctx.route(/\/feed\.json\?publishing-check=1/,r=>{state.calls.push(r.request().method()+' feed');return r.fulfill({json:feed()});});
 await phone.ctx.route(/\/reports\/.*publishing-check=1/,r=>{state.calls.push(r.request().method()+' puzzle');return r.fulfill({status:state.phase==='problem'&&r.request().url().includes('word-link')?404:200,body:''});});
 await phone.ctx.route('https://api.github.com/**',r=>{
  const u=r.request().url();state.calls.push(r.request().method()+' github');
  if(state.phase==='problem'){
   if(u.includes('/jobs'))return r.fulfill({json:{jobs:[{name:'Release',conclusion:'failure',steps:[{name:'Checkout',conclusion:'success'},{name:'Required test suite',conclusion:'failure'}]}]}});
   if(u.includes('tests.yml'))return r.fulfill({json:{workflow_runs:[{id:901,status:'completed',conclusion:'failure',created_at:TODAY+'T03:17:00Z'}]}});
   return r.fulfill({json:{workflow_runs:[{id:103,status:'completed',conclusion:'failure',updated_at:TODAY+'T07:00:00Z'},...runs.workflow_runs]}});
  }
  return r.fulfill({json:u.includes('tests.yml')?tests:runs});
 });
 await phone.ctx.route('**/feed-lite.json*',r=>r.fulfill({json:{items:[{path:'reports/2026-11-23-logic-doku-0133.html',band:'hard'}]}}));
 return state;
}
module.exports={auth,publishing,TODAY,Y,stock,scorecard,players,ops,lab,labRow};
