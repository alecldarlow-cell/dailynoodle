'use strict';
// Read-only post-deployment health check; never submits events or game scores.
const assert=require('node:assert/strict');
(async()=>{
 const base='https://dailynoodle.co.uk';
 for(const file of ['index.html','admin.html','admin-health.js','puzzles.html','games.html','front.js','engines/finish.js','sw.js','manifest.webmanifest']){
  const r=await fetch(base+'/'+file,{signal:AbortSignal.timeout(20000),cache:'no-cache'});assert.equal(r.status,200,file);assert.ok((await r.text()).length>20,file);console.log('LIVE '+file+' OK');
 }
 const list=await fetch(base+'/puzzles-today.json',{signal:AbortSignal.timeout(20000)}).then(r=>{assert.equal(r.status,200);return r.json();});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date());assert.equal(list.today,today,'Daily list is stale');assert.equal(list.items.length,require('../../admin-health').TYPES.length);
 require('../../admin-health').dailyList(list,today);
 const health=await fetch(base+'/publishing-health.json?publishing-check=1',{signal:AbortSignal.timeout(20000),cache:'no-store'}).then(r=>{assert.equal(r.status,200,'Publishing snapshot');return r.json();});
 assert.equal(health.today,today,'Publishing snapshot is stale');require('../../admin-health').analyse(health,today);
 console.log('LIVE publishing snapshot OK');
 for(const it of list.items){assert.match(it.path,/^reports\/[\w.-]+\.html$/);const r=await fetch(base+'/'+it.path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,it.path);const head=await fetch(base+'/'+it.path+'?publishing-check=1',{method:'HEAD',signal:AbortSignal.timeout(20000),cache:'no-store'});assert.equal(head.status,200,it.path+' HEAD availability');}
 console.log('LIVE current daily list and all '+list.items.length+' puzzle URLs OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
