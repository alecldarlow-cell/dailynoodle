'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),nightly=process.argv.includes('--nightly');
async function run(name,args,extra={}){
 const start=Date.now(),out=path.join(ROOT,'test-results',name+'.log');
 console.log('\n▶ '+name);
 const log=fs.createWriteStream(out);
 const code=await new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,args,{cwd:ROOT,env:{...process.env,...extra},stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{process.stdout.write(d);log.write(d);});p.stderr.on('data',d=>{process.stderr.write(d);log.write(d);});
  p.on('error',reject);p.on('close',c=>resolve(c??1));
 });log.end();const result={name,code,seconds:+((Date.now()-start)/1000).toFixed(1)};
 results.push(result);fs.writeFileSync(path.join(ROOT,'test-results/summary.json'),JSON.stringify(results,null,2)+'\n');
 if(code)throw Error(name+' failed; see '+out);
}
const results=[];
(async()=>{
 fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
 if(!process.env.PW_CHROMIUM&&process.platform==='linux')process.env.PW_CHROMIUM=await require('./chromium').executable();
 if(nightly)process.env.DN_NIGHTLY='1';
 await run('unit',['--test',...fs.readdirSync(path.join(__dirname,'unit')).filter(f=>f.endsWith('.test.js')).map(f=>'tools/tests/unit/'+f)]);
 await run('backend',['--test','tools/tests/backend.test.js']);
 await run('content',['tools/tests/content.js',...(nightly?['--all']:[])]);
 await run('build',['tools/tests/build.js']);
 await run('browser',['tools/tests/browser-run.js','--project=chromium']);
 await run('artifact',['tools/tests/browser-run.js','--project=chromium','artifact.spec.js'],{DN_TEST_ROOT:path.join(ROOT,'_site')});
 for(const [name,file] of [['puzzles','run.js'],['timing-dates','timing-dates.js'],['offline-next','offline-next.js'],['worker','sw.js'],['push-crypto','push-crypto.mjs'],['push-panel','push-panel.js']])await run(name,['tools/tests/'+file]);
 if(nightly&&process.env.DN_CROSS_BROWSER==='1'){
  await run('cross-browser',['tools/tests/browser-run.js','--project=firefox','--project=webkit','artifact.spec.js','platform.spec.js']);
 }
 console.log('\nAll required groups passed. Device checks remain manual: see toolchain/testing.md.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
