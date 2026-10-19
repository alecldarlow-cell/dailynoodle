'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),nightly=process.argv.includes('--nightly');
const {execute}=require('./plan');
const serial=process.argv.includes('--serial'),started=Date.now();
async function run(name,args,extra={}){
 const start=Date.now(),out=path.join(ROOT,'test-results',name+'.log');
 console.log('\n▶ '+name);
 const log=fs.createWriteStream(out);
 const code=await new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,args,{cwd:ROOT,env:{...process.env,DN_TEST_GROUP:name,...extra},stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{process.stdout.write(d);log.write(d);});p.stderr.on('data',d=>{process.stderr.write(d);log.write(d);});
  p.on('error',reject);p.on('close',c=>resolve(c??1));
 });await new Promise(resolve=>log.end(resolve));const result={name,code,seconds:+((Date.now()-start)/1000).toFixed(1),startedAfterSeconds:+((start-started)/1000).toFixed(1)};
 results.push(result);fs.writeFileSync(path.join(ROOT,'test-results/summary.json'),JSON.stringify(results,null,2)+'\n');
 console.log('\n■ '+name+': '+(code?'FAIL':'PASS')+' ('+result.seconds+'s)');
 if(code)throw Error(name+' failed; see '+out);
}
const results=[];
(async()=>{
 fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
 if(!process.env.PW_CHROMIUM&&process.platform==='linux')process.env.PW_CHROMIUM=await require('./chromium').executable();
 if(nightly)process.env.DN_NIGHTLY='1';
 fs.writeFileSync(path.join(ROOT,'test-results/summary.json'),'[]\n');
 await execute(t=>run(t.name,t.args,t.env),{nightly,crossBrowser:process.env.DN_CROSS_BROWSER==='1',serial});
 console.log('\nAll required groups passed. Device checks remain manual: see toolchain/testing.md.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{
 const wallSeconds=+((Date.now()-started)/1000).toFixed(1),groupSeconds=+results.reduce((n,r)=>n+r.seconds,0).toFixed(1);
 fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
 fs.writeFileSync(path.join(ROOT,'test-results/timing.json'),JSON.stringify({mode:serial?'serial':'parallel',wallSeconds,groupSeconds,passed:!process.exitCode,groups:results.length},null,2)+'\n');
 console.log('\nSuite: '+wallSeconds+'s elapsed; '+groupSeconds+'s summed group time ('+(serial?'serial':'parallel')+').');
});
