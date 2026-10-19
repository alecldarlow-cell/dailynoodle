'use strict';
// Read-only post-deployment health check; never submits events or game scores.
const assert=require('node:assert/strict');
(async()=>{
 const base='https://dailynoodle.co.uk';
 for(const file of ['index.html','puzzles.html','games.html','front.js','engines/finish.js','sw.js','manifest.webmanifest']){
  const r=await fetch(base+'/'+file,{signal:AbortSignal.timeout(20000),cache:'no-cache'});assert.equal(r.status,200,file);assert.ok((await r.text()).length>20,file);console.log('LIVE '+file+' OK');
 }
 const list=await fetch(base+'/puzzles-today.json',{signal:AbortSignal.timeout(20000)}).then(r=>{assert.equal(r.status,200);return r.json();});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date());assert.equal(list.today,today,'Daily list is stale');assert.equal(list.items.length,7);
 for(const it of list.items){assert.match(it.path,/^reports\/[\w.-]+\.html$/);const r=await fetch(base+'/'+it.path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,it.path);}
 console.log('LIVE current daily list and seven puzzle URLs OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
