/* Publishing counts are public build metadata. Reader/admin data stays in Supabase. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.dnPublishingHealth=api;api.mount();}
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const TYPES=['mini','doku','sweep','path','link','tangle','borders','reckon'];   // Reckon from 20 Oct 2026
 const NAMES={mini:'Mini',doku:'Doku',sweep:'Sweep',path:'Path',link:'Link',tangle:'Tangle',borders:'Borders',reckon:'Reckon'};
 const SLUGS={mini:'crossword-mini',doku:'logic-doku',sweep:'logic-sweep',path:'logic-path',link:'word-link',tangle:'word-tangle',borders:'geo-borders',reckon:'quiz-reckon'};
 const IDS={mini:'MINI',doku:'LEXI',sweep:'SWEEP',path:'PATH',link:'LINK',tangle:'TANG',borders:'BORD',reckon:'RECK'};
 const REPO='https://github.com/alecldarlow-cell/dailynoodle';
 const API='https://api.github.com/repos/alecldarlow-cell/dailynoodle/actions/workflows/build-feed.yml/runs?per_page=20';
 const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const add=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
 const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function analyse(s,today){
  if(s?.version!==1||!validDay(s.today)||!s.days||Array.isArray(s.days)||typeof s.days!=='object'||!Number.isFinite(Date.parse(s.builtAt)))throw Error('Publishing snapshot is unavailable or invalid.');
  for(const [date,d] of Object.entries(s.days)){
   if(!validDay(date)||!d?.counts||typeof d.counts!=='object'||!Array.isArray(d.blocked)||d.blocked.some(t=>!TYPES.includes(t))||Object.entries(d.counts).some(([t,n])=>!TYPES.includes(t)||!Number.isInteger(n)||n<1))throw Error('Publishing snapshot contains invalid counts.');
  }
  const status=date=>{
   const d=s.days[date]||{counts:{},blocked:[]};
   return {date,missing:TYPES.filter(t=>!d.counts[t]),duplicate:TYPES.filter(t=>d.counts[t]>1),blocked:TYPES.filter(t=>d.blocked.includes(t)),count:TYPES.filter(t=>d.counts[t]===1&&!d.blocked.includes(t)).length};
  };
  let futureDays=0;while(futureDays<2000&&status(add(today,futureDays+1)).count===TYPES.length)futureDays++;
  const firstGap=status(add(today,futureDays+1));
  return {stale:s.today!==today,futureDays,through:futureDays?add(today,futureDays):null,firstGap,next:Array.from({length:8},(_,i)=>status(add(today,i+1)))};
 }
 function dailyList(j,today){
  if(j?.today!==today)throw Error('Daily list is out of date; expected '+today+'.');
  if(!Array.isArray(j.items)||j.items.length!==TYPES.length||new Set(j.items.map(i=>i.type)).size!==TYPES.length)throw Error('Daily list must contain exactly one of each of the '+TYPES.length+' puzzle types.');
  for(const i of j.items){
   if(!TYPES.includes(i.type)||typeof i.id!=='string'||!i.id.startsWith('DP·'+IDS[i.type]+'·')||typeof i.path!=='string'||!new RegExp('^reports/'+today+'-'+SLUGS[i.type]+'(?:-\\d+)?\\.html$').test(i.path))throw Error('Daily list contains an invalid puzzle entry.');
  }
  return TYPES.map(t=>j.items.find(i=>i.type===t));
 }
 const runLink=id=>/^\d+$/.test(String(id))?REPO+'/actions/runs/'+id:REPO+'/actions/workflows/build-feed.yml';
 const stamp=s=>Number.isFinite(Date.parse(s))?new Date(s).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}):'Unknown time';
 const fmt=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',year:'numeric'});
 async function request(url,options={},json=false){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const r=await fetch(url,{cache:'no-store',...options,signal:controller.signal});if(!r.ok)throw Error('Request returned '+r.status+'.');return json?await r.json():r;}finally{clearTimeout(timer);}
 }
 function mount(){
  const panel=document.getElementById('publishing');if(!panel)return;
  const $=id=>document.getElementById(id);let busy=false,started=false,checkedDay='';
  function card(id,tone,title,body){$(id).innerHTML='<p class="pub-state '+tone+'">'+esc(title)+'</p>'+body;}
  const text=s=>'<p class="sub">'+esc(s)+'</p>';
  const problems=d=>[d.missing.length?'Missing: '+d.missing.map(t=>NAMES[t]).join(', '):'',d.duplicate.length?'Duplicates: '+d.duplicate.map(t=>NAMES[t]).join(', '):'',d.blocked.length?'Metadata needs repair: '+d.blocked.map(t=>NAMES[t]).join(', '):''].filter(Boolean).join('. ');
  async function live(today){
   try{
    const j=await request('puzzles-today.json?publishing-check=1',{},true),items=dailyList(j,today);
    const results=await Promise.all(items.map(async i=>{
     try{await request(i.path+'?publishing-check=1',{method:'HEAD'});return {...i,ok:true};}catch(e){return {...i,ok:false};}
    }));
    if(day()!==today)throw Error('The London date changed during this check. Check again.');
    const n=results.filter(i=>i.ok).length;
    card('pubLive',n===TYPES.length?'good':'bad',n+'/'+TYPES.length+' puzzle files responding',text('Checked the daily list and each live URL for '+fmt(today)+'. This checks availability, not a full play-through.')+'<ul class="pub-items">'+results.map(i=>'<li><a href="'+esc(i.path)+'">'+NAMES[i.type]+'</a> · '+(i.ok?'Available':'Could not confirm')+'</li>').join('')+'</ul>');
   }catch(e){card('pubLive','bad','Today’s puzzles not confirmed',text(e.message));}
  }
  async function stock(today){
   try{
    const s=await request('publishing-health.json?publishing-check=1',{},true),a=analyse(s,today);
    card('pubStock',a.stale?'warn':a.futureDays>=7?'good':'warn',a.stale?'Build snapshot is out of date':a.futureDays+' complete future days on file',text((a.through?'One of each type from tomorrow through '+fmt(a.through)+'. ':'')+'First incomplete date: '+fmt(a.firstGap.date)+'. '+problems(a.firstGap))+text('Snapshot assembled '+stamp(s.builtAt)+' (London).')+'<a href="'+runLink(s.runId)+'">View this build’s release run</a>');
    $('pubDays').innerHTML='<table><caption>Next eight days of puzzle stock</caption><thead><tr><th>Date</th><th>Types</th><th>Needs attention</th></tr></thead><tbody>'+a.next.map(d=>'<tr><th scope="row">'+fmt(d.date)+'</th><td>'+d.count+'/'+TYPES.length+'</td><td>'+esc(problems(d)||'Every type on file')+'</td></tr>').join('')+'</tbody></table>';
   }catch(e){card('pubStock','warn','Future stock not confirmed',text(e.message));$('pubDays').textContent='No inventory snapshot available.';}
  }
  async function releases(){
   try{
    const data=await request(API,{},true);if(!Array.isArray(data.workflow_runs)||!data.workflow_runs.length)throw Error('No release runs returned.');
    const runs=data.workflow_runs,latest=runs[0],success=runs.find(r=>r.status==='completed'&&r.conclusion==='success');
    const label=latest.status==='completed'?({success:'Succeeded',failure:'Failed',cancelled:'Cancelled',timed_out:'Timed out'}[latest.conclusion]||latest.conclusion||'Unknown'):({in_progress:'In progress',queued:'Queued',pending:'Waiting',waiting:'Waiting',requested:'Requested'}[latest.status]||latest.status);
    card('pubRelease',latest.conclusion==='success'?'good':latest.status==='completed'&&latest.conclusion!=='cancelled'?'bad':'warn','Latest release: '+label,'<p><a href="'+runLink(latest.id)+'">View latest release run</a></p>'+text(success?'Last successful release finished '+stamp(success.updated_at)+' (London).':'No successful release in the latest 20 runs.')+(success?'<a href="'+runLink(success.id)+'">View last successful release</a>':'')+text('A successful run includes deployment and the live health check. A failed run may fail before or after publishing; use the live URL checks alongside this status.'));
   }catch(e){card('pubRelease','warn','GitHub status not confirmed',text('GitHub may be unavailable or its public API rate limit reached. The live URL checks are separate.')+'<a href="'+REPO+'/actions/workflows/build-feed.yml">Open releases on GitHub</a>');}
  }
  async function check(){
   if(busy)return;busy=true;const today=day();checkedDay=today;$('pubCheck').disabled=true;$('pubChecked').textContent='Checking publishing…';
   for(const id of ['pubLive','pubStock','pubRelease'])card(id,'','Checking…','');$('pubDays').textContent='Loading inventory…';
   try{await Promise.all([live(today),stock(today),releases()]);$('pubChecked').textContent='Checks finished '+stamp(new Date().toISOString())+' (London).';}
   finally{busy=false;$('pubCheck').disabled=false;}
  }
  $('pubCheck').onclick=check;
  setInterval(()=>{if(started&&!document.getElementById('app').hidden&&!document.hidden&&day()!==checkedDay)check();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&started&&!document.getElementById('app').hidden&&day()!==checkedDay)check();});
  api.start=()=>{if(!started){started=true;check();}};
 }
 const api={analyse,dailyList,mount,TYPES};return api;
});
