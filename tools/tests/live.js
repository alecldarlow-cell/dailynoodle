'use strict';
// Read-only post-deployment health check; never submits events or game scores.
const assert=require('node:assert/strict');
const {HUBS,puzzleMeta}=require('../search-meta');
const escapeHtml=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function searchTags(html,meta,canonical){
 const head=html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i)?.[0]||'';
 assert.ok(head.includes('<title>'+escapeHtml(meta.title)+'</title>'),'Search title: '+canonical);
 assert.ok(head.includes('<meta name="description" content="'+escapeHtml(meta.description)+'">'),'Search description: '+canonical);
 assert.ok(head.includes('<link rel="canonical" href="'+canonical+'">'),'Canonical URL: '+canonical);
}
(async()=>{
 const base='https://dailynoodle.co.uk';
 for(const file of ['index.html','admin.html','admin-health.js','puzzles.html','games.html','how-to-play.html','front.js','engines/finish.js','sw.js','manifest.webmanifest']){
  const r=await fetch(base+'/'+file,{signal:AbortSignal.timeout(20000),cache:'no-cache'});assert.equal(r.status,200,file);const html=await r.text();assert.ok(html.length>20,file);
  if(HUBS[file])searchTags(html,HUBS[file],base+'/'+(file==='index.html'?'':file));console.log('LIVE '+file+' OK');
 }
 const list=await fetch(base+'/puzzles-today.json',{signal:AbortSignal.timeout(20000)}).then(r=>{assert.equal(r.status,200);return r.json();});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date());assert.equal(list.today,today,'Daily list is stale');assert.equal(list.items.length,require('../../admin-health').TYPES.length);
 require('../../admin-health').dailyList(list,today);
 const health=await fetch(base+'/publishing-health.json?publishing-check=1',{signal:AbortSignal.timeout(20000),cache:'no-store'}).then(r=>{assert.equal(r.status,200,'Publishing snapshot');return r.json();});
 assert.equal(health.today,today,'Publishing snapshot is stale');require('../../admin-health').analyse(health,today);
 console.log('LIVE publishing snapshot OK');
 for(const it of list.items){assert.match(it.path,/^reports\/[\w.-]+\.html$/);const r=await fetch(base+'/'+it.path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,it.path);searchTags(await r.text(),puzzleMeta({kind:'puzzle',type:it.type,headline:it.name,date:list.today}),base+'/'+it.path);const head=await fetch(base+'/'+it.path+'?publishing-check=1',{method:'HEAD',signal:AbortSignal.timeout(20000),cache:'no-store'});assert.equal(head.status,200,it.path+' HEAD availability');}
 console.log('LIVE current daily list and all '+list.items.length+' puzzle URLs OK');
 // App data (tools/puzzle-json.js): today's eight puzzles as JSON, and the archive list.
 const lite=await fetch(base+'/feed-lite.json',{signal:AbortSignal.timeout(20000),cache:'no-cache'}).then(r=>{assert.equal(r.status,200,'feed-lite.json');return r.json();});
 for(const it of list.items){assert.ok(lite.items.some(x=>x.path===it.path),'feed-lite lists '+it.path);const j=await fetch(base+'/'+it.path.replace(/\.html$/,'.json'),{signal:AbortSignal.timeout(20000),cache:'no-cache'}).then(r=>{assert.equal(r.status,200,it.path+' app data');return r.json();});assert.equal(j.id,it.id,it.path+' app data id');assert.equal(j.data.id,it.id,it.path+' app data object');}
 console.log('LIVE app data for today and feed-lite.json OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
