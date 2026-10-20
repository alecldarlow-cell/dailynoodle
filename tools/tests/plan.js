'use strict';
// Every post-build group is independent. Dispatch short follow-up checks as
// slots free up rather than appending them to the busiest browser lane.
const MAX_JOBS=5;
const isBrowserSpec=file=>/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file);
function browserFiles(){
 const fs=require('node:fs'),path=require('node:path');
 const all=fs.readdirSync(path.join(__dirname,'browser'),{recursive:true}).filter(isBrowserSpec).sort();
 return {games:all.filter(f=>f==='games.spec.js'),pages:all.filter(f=>f!=='games.spec.js')};
}
function plan({nightly=false,crossBrowser=false}={}){
 const fs=require('node:fs'),path=require('node:path');
 const task=(name,args,env={})=>({name,args,env});
 const preflight=[
  task('unit',['--test',...fs.readdirSync(path.join(__dirname,'unit')).filter(f=>f.endsWith('.test.js')).sort().map(f=>'tools/tests/unit/'+f)]),
  task('backend',['--test','tools/tests/backend.test.js']),
  task('content',['tools/tests/content.js',...(nightly?['--all']:[])]),
  task('build',['tools/tests/build.js'])
 ];
 const files=browserFiles();
 const browser=Object.entries(files).map(([group,specs])=>task('browser-'+group,
  ['tools/tests/browser-run.js','--project=chromium',...specs.map(f=>'tools/tests/browser/'+f)],{DN_TEST_WORKERS:'1'}));
 const puzzles=[1,2,3].map(n=>task('puzzles-'+n,['tools/tests/run.js','--shard='+n+'/3']));
 const focused=[['timing-dates','timing-dates.js'],['offline-next','offline-next.js'],['worker','sw.js'],['push-crypto','push-crypto.mjs'],['push-panel','push-panel.js']]
  .map(([name,file])=>task(name,['tools/tests/'+file]));
 const cross=nightly&&crossBrowser?[task('cross-browser',['tools/tests/browser-run.js','--project=firefox','--project=webkit','artifact.spec.js','platform.spec.js'],{DN_TEST_WORKERS:'1'})]:[];
 // News pieces rendered in a real browser (dn-render): the last 7 days at release, every piece nightly.
 const news=task('news',['tools/tests/news.js',...(nightly?['--all','--jobs','2']:['--jobs','2'])]);
 const artifact=task('artifact',['tools/tests/browser-run.js','--project=chromium','artifact.spec.js'],{DN_TEST_ROOT:path.resolve(__dirname,'../../_site'),DN_TEST_WORKERS:'1'});
 // Long groups start first. All groups after preflight read immutable source
 // or _site; report paths are isolated by DN_TEST_GROUP in suite.js.
 const tasks=[...puzzles,...browser,news,focused[0],focused[2],artifact,focused[4],focused[1],focused[3],...cross];
 return {preflight,tasks,serial:[...preflight,...tasks]};
}
async function execute(run,options={}){
 const p=plan(options);let failed=false;
 const jobs=options.serial?1:Number(options.jobs??MAX_JOBS);
 if(!Number.isInteger(jobs)||jobs<1||jobs>MAX_JOBS)throw Error('DN_TEST_JOBS must be an integer from 1 to '+MAX_JOBS);
 const one=async t=>{if(failed)return;try{await run(t);}catch(e){failed=true;throw e;}};
 const lane=async tasks=>{for(const t of tasks)await one(t);};
 if(options.serial)return lane(p.serial);
 await lane(p.preflight);
 let next=0;const errors=[];
 const worker=async()=>{while(!failed&&next<p.tasks.length){
  const task=p.tasks[next++];
  try{await one(task);}catch(e){errors.push(e);}
 }};
 // Wait for in-flight work after a failure; launch no new groups. Returning
 // early would risk unobserved failures or orphan test runners at publication.
 await Promise.all(Array.from({length:Math.min(jobs,p.tasks.length)},worker));
 if(errors.length)throw new AggregateError(errors,errors.map(e=>e.message).join('\n'));
}
module.exports={plan,execute,browserFiles,isBrowserSpec,MAX_JOBS};
