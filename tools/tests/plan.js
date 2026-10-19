'use strict';
// Two browser lanes at most. The source/artifact Playwright runs stay in the
// same lane, and neither can start until the transformed build has passed.
function plan({nightly=false,crossBrowser=false}={}){
 const fs=require('node:fs'),path=require('node:path');
 const task=(name,args,env={})=>({name,args,env});
 const preflight=[
  task('unit',['--test',...fs.readdirSync(path.join(__dirname,'unit')).filter(f=>f.endsWith('.test.js')).sort().map(f=>'tools/tests/unit/'+f)]),
  task('backend',['--test','tools/tests/backend.test.js']),
  task('content',['tools/tests/content.js',...(nightly?['--all']:[])]),
  task('build',['tools/tests/build.js'])
 ];
 const browser=[
  task('browser',['tools/tests/browser-run.js','--project=chromium']),
  task('artifact',['tools/tests/browser-run.js','--project=chromium','artifact.spec.js'],{DN_TEST_ROOT:path.resolve(__dirname,'../../_site')})
 ];
 const puzzles=task('puzzles',['tools/tests/run.js']);
 const focused=[['timing-dates','timing-dates.js'],['offline-next','offline-next.js'],['worker','sw.js'],['push-crypto','push-crypto.mjs'],['push-panel','push-panel.js']]
  .map(([name,file])=>task(name,['tools/tests/'+file]));
 const cross=nightly&&crossBrowser?[task('cross-browser',['tools/tests/browser-run.js','--project=firefox','--project=webkit','artifact.spec.js','platform.spec.js'])]:[];
 return {preflight,lanes:[[puzzles],[...browser,...focused,...cross]],serial:[...preflight,...browser,puzzles,...focused,...cross]};
}
async function execute(run,options={}){
 const p=plan(options);let failed=false;
 const one=async t=>{if(failed)return;try{await run(t);}catch(e){failed=true;throw e;}};
 const lane=async tasks=>{for(const t of tasks)await one(t);};
 if(options.serial)return lane(p.serial);
 await lane(p.preflight);
 // Wait for active work even after a failure. Do not leave child test runners
 // behind or return success while another lane is still running.
 const outcomes=await Promise.allSettled(p.lanes.map(lane));
 const errors=outcomes.filter(r=>r.status==='rejected').map(r=>r.reason);
 if(errors.length)throw new AggregateError(errors,errors.map(e=>e.message).join('\n'));
}
module.exports={plan,execute};
