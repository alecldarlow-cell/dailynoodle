'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..');
function build(out=path.join(ROOT,'_site')){
 fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
 const detailLog=path.join(ROOT,'test-results/build-transform.log');fs.writeFileSync(detailLog,'');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'noodle-build-')),stage=path.join(tmp,'source');
 try{
  fs.cpSync(ROOT,stage,{recursive:true,filter:src=>{
   const rel=path.relative(ROOT,src);return !rel.split(path.sep).some(p=>['.git','node_modules','_site','test-results','playwright-report'].includes(p));
  }});
  const held=path.join(tmp,'held.txt');
  const env={...process.env,DN_HELD_OUT:held};
  for(const [file,args] of [['prepare-site.js',[]],['build-site.js',[held,path.join(tmp,'site')]]]){
   const r=spawnSync(process.execPath,[path.join(stage,'tools',file),...args],{cwd:stage,encoding:'utf8',env,maxBuffer:16*1024*1024});
   fs.appendFileSync(detailLog,r.stdout+r.stderr);
   assert.equal(r.status,0,file+' failed; see test-results/build-transform.log\n'+r.stderr);
  }
  const site=path.join(tmp,'site'),feed=JSON.parse(fs.readFileSync(path.join(site,'feed.json'))),day=JSON.parse(fs.readFileSync(path.join(site,'puzzles-today.json'))).today;
  const health=JSON.parse(fs.readFileSync(path.join(site,'publishing-health.json')));
  assert.equal(health.version,1);assert.equal(health.today,day);assert.ok(health.days[day],'Publishing snapshot needs today’s stock');
  assert.doesNotMatch(JSON.stringify(health),/DP·|reports\/|\.html/,'Health metadata must not expose future content');
  for(const it of feed.items){assert.ok(fs.existsSync(path.join(site,it.path)),it.path);assert.ok(it.date<=day,'Future card '+it.path);}
  for(const f of fs.readdirSync(path.join(site,'reports')))if(/^\d{4}-\d{2}-\d{2}-/.test(f))assert.ok(f.slice(0,10)<=day,'Future file leaked '+f);
  // App data (tools/puzzle-json.js): one JSON per released puzzle page with a data object, none for held files.
  const lite=JSON.parse(fs.readFileSync(path.join(site,'feed-lite.json'))),puzzles=feed.items.filter(it=>it.kind==='puzzle'&&it.type);
  assert.deepEqual(lite.items.map(it=>it.path),puzzles.map(it=>it.path),'feed-lite.json lists every released puzzle card');
  assert.ok(lite.items.filter(it=>it.json).length>=puzzles.length-60,'Most puzzle cards have app data');
  for(const it of lite.items)if(it.json){const j=JSON.parse(fs.readFileSync(path.join(site,it.json)));assert.equal(j.path,it.path,it.json);assert.equal(j.type,it.type,it.json);assert.ok(j.data&&j.data.id===j.id,it.json);}
  for(const f of fs.readdirSync(path.join(site,'reports')))if(f.endsWith('.json'))assert.ok(fs.existsSync(path.join(site,'reports',f.replace(/\.json$/,'.html'))),'Orphan app data '+f);
  // App links (SITE.md › App links): the Android verification file and the join page are published.
  const links=JSON.parse(fs.readFileSync(path.join(site,'.well-known','assetlinks.json')));
  const app=links.find(l=>l.target&&l.target.package_name==='uk.co.dailynoodle.app');
  assert.ok(app,'assetlinks.json names the app');
  assert.deepEqual(app.relation,['delegate_permission/common.handle_all_urls']);
  assert.ok(app.target.sha256_cert_fingerprints.length>0,'assetlinks.json has a signing fingerprint');
  // Both keys the app is signed with: EAS's (preview/internal builds) and Google Play's app-signing key (Play installs).
  for(const fp of ['0A:E9:05:AD:A8:46:42:4B','4B:3D:36:4E:09:54:62:90'])assert.ok(app.target.sha256_cert_fingerprints.some(f=>f.startsWith(fp)),'assetlinks.json has the '+fp+'… key');
  for(const f of app.target.sha256_cert_fingerprints)assert.match(f,/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/,'Fingerprint format '+f);
  assert.ok(fs.existsSync(path.join(site,'join.html')),'join.html published');
  for(const file of ['tools','toolchain','package.json','package-lock.json','playwright.config.js','registry.json','published.json'])assert.ok(!fs.existsSync(path.join(site,file)),'Private tooling deployed: '+file);
  // Inspect every emitted search tag and prove metadata never changes playable content.
  const searchPages=require('../search-meta').entries(feed),titles=new Set();
  for(const [file,meta] of searchPages){
   const published=fs.readFileSync(path.join(site,file),'utf8'),source=fs.readFileSync(path.join(stage,file),'utf8');
   const head=published.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i)[0];
   assert.equal((head.match(/<title\b/gi)||[]).length,1,file+' duplicate title');
   assert.equal((head.match(/<meta\s+name="description"/gi)||[]).length,1,file+' description');
   assert.equal((head.match(/<link\s+rel="canonical"/gi)||[]).length,1,file+' canonical');
   assert.ok(head.includes('href="'+meta.canonical+'"'),file+' canonical URL');
   assert.ok(!titles.has(meta.title),'Reused search title: '+meta.title);titles.add(meta.title);
   if(file!=='puzzles.html')assert.equal(published.slice(published.indexOf('</head>')),source.slice(source.indexOf('</head>')),file+' body changed');
   assert.deepEqual(published.match(/<meta\b[^>]*\b(?:name="dn:|property="og:)[^>]*>/g),source.match(/<meta\b[^>]*\b(?:name="dn:|property="og:)[^>]*>/g),file+' card/social metadata changed');
  }
  for(const it of feed.items.filter(it=>it.kind==='puzzle'&&!it.badge)){
   assert.ok(searchPages.some(([file])=>file===it.path),'Puzzle missing search metadata: '+it.path);
   const doc=fs.readFileSync(path.join(site,it.path),'utf8');
   assert.match(doc,/<title>[^<]+ — Daily [^<]+ \| Daily Noodle<\/title>/,it.path);
  }
  const sample=feed.items.find(it=>it.kind==='puzzle'&&it.type==='path');
  assert.match(fs.readFileSync(path.join(site,sample.path),'utf8'),/<title>Path \d+ — Daily Number Path Puzzle \| Daily Noodle<\/title>/);
  for(const it of feed.items.filter(it=>it.kind!=='puzzle')){
   const output=fs.readFileSync(path.join(site,it.path),'utf8'),original=fs.readFileSync(path.join(stage,it.path),'utf8');
   assert.equal(output.slice(output.indexOf('</head>')),original.slice(original.indexOf('</head>')),it.path+' editorial body changed');
   assert.equal(output.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)[0],original.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)[0],it.path+' editorial title changed');
  }
  fs.rmSync(out,{recursive:true,force:true});fs.cpSync(site,out,{recursive:true});
  console.log('Tested build assembled: '+feed.items.length+' released cards; no future files or developer tooling.');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
module.exports={build};
if(require.main===module)build();
