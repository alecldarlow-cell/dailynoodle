'use strict';
/* Personal stats (6 Nov 2026, Alec's call: free for everyone, no sign-in needed).
   Worked out only from the players' own saves on this device (digi-<type>-v1,
   digi-<type>-streak); nothing is stored or sent. Read-only: never writes a key.
   Node tools and tests require this file; stats.html loads it as a script; the app
   vendors it (scripts/vendor-site.js) and proves its own port gives the same answers.
   Pure functions only: pass in today's London day, so tests can pin any date. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else if(!root.dnStats)root.dnStats=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
 const TYPES=['mini','doku','sweep','path','link','tangle','borders','reckon','tally'];
 const LABEL={mini:'Mini',doku:'Doku',sweep:'Sweep',path:'Path',link:'Link',tangle:'Tangle',borders:'Borders',reckon:'Reckon',tally:'Tally'};
 const SCORED={tangle:1,borders:1,reckon:1};
 const STREAK_TYPES=['mini','doku','sweep','path','link','tally'];
 const DAY=/^\d{4}-\d{2}-\d{2}$/;
 const MIN_SHOW=3, MIN_TREND=5, MIN_YEAR=10;

 const num=x=>typeof x==='number'&&isFinite(x);
 const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 function day(x){return typeof x==='string'&&DAY.test(x)?x:null;}
 // "02:31" / "1:02:31" (Path, Link and Tally save the clock's text) → seconds
 function clockSecs(t){
  const m=/^(\d+):(\d\d)(?::(\d\d))?$/.exec(String(t==null?'':t));
  if(!m)return null;
  return m[3]?(+m[1]*3600+ +m[2]*60+ +m[3]):(+m[1]*60+ +m[2]);
 }
 function back(d){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()-1);return x.toISOString().slice(0,10);}

 /* The saves as documents, from any Web-Storage-shaped store. A broken document is skipped. */
 function read(storage){
  const docs={},streaks={};
  const get=k=>{try{const v=JSON.parse(storage.getItem(k)||'null');return obj(v)?v:null;}catch(e){return null;}};
  TYPES.forEach(t=>{const d=get('digi-'+t+'-v1');if(d)docs[t]=d;});
  STREAK_TYPES.forEach(t=>{const s=get('digi-'+t+'-streak');if(s)streaks[t]=s;});
  return {docs:docs,streaks:streaks};
 }

 /* One row per finished puzzle. dates: {puzzleId: 'YYYY-MM-DD'} from the feed (optional).
    when: 'day' (played on the puzzle's own date), 'archive' (a catch-up) or null (unknown:
    no play date, or the puzzle's date isn't known). */
 function one(type,id,r,dates){
  if(!obj(r))return null;
  const played=day(r.d)||day(r.on);
  const date=dates&&day(dates[id])||null;
  const out={type:type,id:id,played:played,date:date,when:played&&date?(played===date?'day':'archive'):null,
   secs:null,won:null,score:null,mistakes:null,words:null,star:null,bulls:null,correct:null};
  switch(type){
   case 'mini':case 'doku':out.secs=num(r.s)?r.s:null;out.won=true;break;
   case 'tally':out.secs=num(r.s)?r.s:clockSecs(r.t);out.won=true;break;
   case 'path':out.secs=clockSecs(r.t);out.won=true;break;
   case 'sweep':out.won=r.o==='win';out.secs=out.won&&num(r.s)?r.s:null;break;
   case 'link':out.won=r.o==='win';out.secs=out.won?clockSecs(r.t):null;out.mistakes=num(r.m)?r.m:null;break;
   case 'tangle':out.score=num(r.s)?r.s:null;out.words=num(r.w)?r.w:null;out.star=typeof r.st==='boolean'?r.st:null;break;
   case 'borders':out.score=num(r.p)?r.p:null;out.correct=num(r.c)?r.c:null;break;
   case 'reckon':out.score=num(r.p)?r.p:null;out.bulls=num(r.b)?r.b:null;break;
  }
  if(out.secs!=null&&!(out.secs>=0))out.secs=null;
  return out;
 }
 function results(docs,dates){
  const out=[];
  TYPES.forEach(t=>{const d=docs&&docs[t];if(!d||!obj(d.done))return;
   Object.keys(d.done).sort().forEach(id=>{const r=one(t,id,d.done[id],dates);if(r)out.push(r);});});
  return out;
 }

 function median(a){if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;}
 function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
 /* A simple spread: up to 6 bins of a round width, the last open-ended when values run on. */
 function spread(vals,steps){
  if(vals.length<MIN_SHOW)return null;
  const lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals);
  let step=steps[steps.length-1];
  for(const s of steps){if((hi-lo)/s<=5){step=s;break;}}
  const start=Math.floor(lo/step)*step,bins=[];
  for(let i=0;i<6;i++)bins.push({from:start+i*step,to:start+(i+1)*step,n:0,open:i===5});
  vals.forEach(v=>{let i=Math.floor((v-start)/step);if(i>5)i=5;bins[i].n++;});
  while(bins.length>1&&bins[bins.length-1].n===0)bins.pop();
  bins[bins.length-1].open=bins.length===6&&hi>=bins[5].from+step;
  return bins;
 }
 const TIME_STEPS=[10,15,30,60,120,300,600,1800],SCORE_STEPS=[1,2,5,10,20,25,50,100,200,250,500];
 function months(today,k){const out=[];let y=+today.slice(0,4),m=+today.slice(5,7);
  for(let i=0;i<k;i++){out.unshift(y+'-'+String(m).padStart(2,'0'));m--;if(!m){m=12;y--;}}return out;}

 /* Consecutive London days with a finished puzzle, as the Puzzles page's chip (front.js showRun):
    every save's play date plus the grid types' streak dates. Archive catch-ups count on the day played. */
 function playedDays(rows,streaks){
  const days={};
  rows.forEach(r=>{if(r.played)days[r.played]=1;});
  Object.keys(streaks||{}).forEach(t=>{const s=streaks[t];if(s&&Array.isArray(s.dates))s.dates.forEach(d=>{if(day(d))days[d]=1;});});
  return days;
 }
 function runs(days,today){
  let d=days[today]?today:back(today),cur=0;
  while(days[d]&&cur<4000){cur++;d=back(d);}
  const all=Object.keys(days).sort();let best=0,n=0,prev=null;
  all.forEach(x=>{n=prev&&back(x)===prev?n+1:1;if(n>best)best=n;prev=x;});
  return {current:cur,longest:best};
 }

 function typeStats(type,rows,today){
  const n=rows.length,s={type:type,label:LABEL[type],n:n,scored:!!SCORED[type]};
  if(!n)return s;
  const show=n>=MIN_SHOW;
  if(s.scored){
   const sc=rows.map(r=>r.score).filter(num);
   s.best=sc.length?Math.max.apply(null,sc):null;
   s.average=show&&sc.length>=MIN_SHOW?Math.round(mean(sc)):null;
   s.spread=show?spread(sc,SCORE_STEPS):null;
   if(type==='tangle'){const w=rows.map(r=>r.words).filter(num);s.mostWords=w.length?Math.max.apply(null,w):null;
    s.stars=rows.filter(r=>r.star===true).length;}
   if(type==='reckon')s.bullseyes=rows.reduce((a,r)=>a+(num(r.bulls)?r.bulls:0),0);
   if(type==='borders'){const c=rows.map(r=>r.correct).filter(num);s.bestCorrect=c.length?Math.max.apply(null,c):null;
    s.averageCorrect=show&&c.length>=MIN_SHOW?Math.round(mean(c)*10)/10:null;}
  }else{
   const t=rows.map(r=>r.secs).filter(num);
   s.best=t.length?Math.min.apply(null,t):null;
   s.median=show&&t.length>=MIN_SHOW?Math.round(median(t)):null;
   s.spread=show?spread(t,TIME_STEPS):null;
   if(type==='sweep'||type==='link'){s.won=rows.filter(r=>r.won).length;s.solveRate=show?Math.round(100*s.won/n):null;}
   if(type==='link'){const m=rows.map(r=>r.mistakes).filter(num);s.mistakes=show&&m.length>=MIN_SHOW?Math.round(mean(m)*10)/10:null;}
  }
  // Monthly trend: median time or average score, by month played, last 6 months, ≥5 results that month.
  s.trend=null;
  if(show&&today){
   const ms=months(today,6),pts=ms.map(m=>{
    const v=rows.filter(r=>(r.played||r.date||'').slice(0,7)===m).map(r=>s.scored?r.score:r.secs).filter(num);
    return {month:m,value:v.length>=MIN_TREND?Math.round(s.scored?mean(v):median(v)):null,n:v.length};});
   if(pts.filter(p=>p.value!=null).length>=2)s.trend=pts;
  }
  return s;
 }

 /* Everything the Stats screen shows. mode: 'all' (default), 'day' or 'archive'.
    Runs always count every day played (a run is about days, not which puzzle). */
 function summary(saved,opts){
  opts=opts||{};
  const today=day(opts.today),mode=opts.mode==='day'||opts.mode==='archive'?opts.mode:'all';
  const all=results(saved&&saved.docs,opts.dates);
  const rows=mode==='all'?all:all.filter(r=>r.when===mode);
  const days={};rows.forEach(r=>{if(r.played)days[r.played]=1;});
  const per={};TYPES.forEach(t=>{per[t]=typeStats(t,rows.filter(r=>r.type===t),today);});
  let fav=null;TYPES.forEach(t=>{if(per[t].n&&(!fav||per[t].n>per[fav].n))fav=t;});
  const run=today?runs(playedDays(all,saved&&saved.streaks),today):{current:0,longest:0};
  return {mode:mode,overall:{finished:rows.length,days:Object.keys(days).length,run:run.current,longest:run.longest,
   favourite:fav?{type:fav,label:LABEL[fav],n:per[fav].n}:null},
   types:per,unknown:all.filter(r=>r.when===null).length};
 }

 /* "Your 2026 in Noodle": shown 1 Dec to 31 Jan (the year just gone in January), from 10 results. */
 function yearCard(saved,opts){
  opts=opts||{};const today=day(opts.today);if(!today)return null;
  const m=+today.slice(5,7);if(m!==12&&m!==1)return null;
  const year=m===12?+today.slice(0,4):+today.slice(0,4)-1,Y=String(year);
  const all=results(saved&&saved.docs,opts.dates);
  const rows=all.filter(r=>(r.played||r.date||'').slice(0,4)===Y);
  if(rows.length<MIN_YEAR)return null;
  const days={},byMonth={};rows.forEach(r=>{const d=r.played||r.date;days[d]=1;const k=d.slice(0,7);byMonth[k]=(byMonth[k]||0)+1;});
  const yd={};Object.keys(playedDays(all,saved&&saved.streaks)).forEach(d=>{if(d.slice(0,4)===Y)yd[d]=1;});
  const longest=runs(yd,Y+'-12-31').longest;
  const count={};rows.forEach(r=>{count[r.type]=(count[r.type]||0)+1;});
  let fav=null;TYPES.forEach(t=>{if(count[t]&&(!fav||count[t]>count[fav]))fav=t;});
  let busiest=null;Object.keys(byMonth).sort().forEach(k=>{if(!busiest||byMonth[k]>byMonth[busiest])busiest=k;});
  const bests=[];TYPES.forEach(t=>{const r=rows.filter(x=>x.type===t);if(!r.length)return;
   if(SCORED[t]){const v=r.map(x=>x.score).filter(num);if(v.length)bests.push({type:t,label:LABEL[t],score:Math.max.apply(null,v)});}
   else{const v=r.map(x=>x.secs).filter(num);if(v.length)bests.push({type:t,label:LABEL[t],secs:Math.min.apply(null,v)});}});
  return {year:year,finished:rows.length,days:Object.keys(days).length,longest:longest,
   favourite:fav?{type:fav,label:LABEL[fav],n:count[fav]}:null,busiest:busiest,bests:bests};
 }

 function clock(secs){secs=Math.round(Number(secs));if(!isFinite(secs)||secs<0)return '';
  const h=Math.floor(secs/3600),m=Math.floor(secs/60)%60,s=secs%60;
  return (h?h+':'+(m<10?'0':''):'')+m+':'+(s<10?'0':'')+s;}
 const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
 function monthName(k){return MONTHS[+k.slice(5,7)-1]||'';}
 /* The house share style: one line, "emoji Name — result". No link (see SITE.md › Personal stats). */
 function yearShare(y){
  if(!y)return '';
  return '🍜 My '+y.year+' in Noodle — '+y.finished+' puzzle'+(y.finished===1?'':'s')+' · '+y.days+' day'+(y.days===1?'':'s')+
   (y.longest>=2?' · 🔥'+y.longest+' best run':'')+(y.favourite?' · '+y.favourite.label+' most':'');
 }

 return {TYPES:TYPES,LABEL:LABEL,SCORED:SCORED,MIN_SHOW:MIN_SHOW,MIN_TREND:MIN_TREND,MIN_YEAR:MIN_YEAR,
  read:read,results:results,summary:summary,yearCard:yearCard,yearShare:yearShare,clock:clock,monthName:monthName,
  _test:{clockSecs:clockSecs,spread:spread,median:median,runs:runs,months:months}};
});
