'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {plan,execute,browserFiles,isBrowserSpec,MAX_JOBS}=require('../plan');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));

test('CI: build precedes the bounded pool; free slots immediately take the next check',{timeout:5000},async()=>{
 const calls=[],gates=new Map();let active=0,peak=0;
 const job=execute(async t=>{
  calls.push(t.name);active++;peak=Math.max(peak,active);
  if(plan().tasks.some(x=>x.name===t.name)){
   assert.ok(calls.indexOf('build')<calls.indexOf(t.name));
   const gate=deferred();gates.set(t.name,gate);await gate.promise;
  }
  active--;
 });
 await tick();assert.equal(gates.size,MAX_JOBS);assert.equal(peak,MAX_JOBS);
 assert.ok(!calls.includes('news'));
 gates.get('browser-games').resolve();await tick();assert.ok(calls.includes('news'));assert.ok(!calls.includes('timing-dates'));
 gates.get('browser-pages').resolve();await tick();assert.ok(calls.includes('timing-dates'));
 for(let round=0;round<plan().tasks.length+2;round++){for(const g of gates.values())g.resolve();await tick();if(calls.length===plan().serial.length&&active===0)break;}
 await job;assert.deepEqual(calls.slice().sort(),plan().serial.map(t=>t.name).sort());
 assert.equal(peak,MAX_JOBS);
 const serial=[];await execute(async t=>{serial.push(t.name);},{serial:true});assert.deepEqual(serial,plan().serial.map(t=>t.name));
});
test('CI: failure stops dispatch, waits for every active group and rejects publication',{timeout:5000},async()=>{
 const gate=deferred(),calls=[];let ended=false;
 const job=execute(async t=>{
  calls.push(t.name);
  if(t.name==='browser-pages')throw Error('browser regression');
  if(t.name.startsWith('puzzles-')||t.name==='browser-games')await gate.promise;
 }).finally(()=>{ended=true;});
 const rejected=assert.rejects(job,/browser regression/);
 await tick();assert.equal(ended,false);assert.ok(!calls.includes('artifact'));assert.ok(!calls.includes('worker'));
 gate.resolve();await rejected;
 const early=[];await assert.rejects(execute(async t=>{early.push(t.name);throw Error('unit regression');}),/unit regression/);
 assert.deepEqual(early,['unit']);
});
test('CI: smaller pools and serial mode retain every required check; invalid caps fail',async()=>{
 for(const jobs of [1,2,3,4,5]){
  const calls=[];let active=0,peak=0;
  await execute(async t=>{calls.push(t.name);active++;peak=Math.max(peak,active);await tick();active--;},{jobs});
  assert.ok(peak<=jobs);assert.deepEqual(calls.slice().sort(),plan().serial.map(t=>t.name).sort());
 }
 for(const jobs of [0,6,1.5,NaN])await assert.rejects(execute(async()=>{}, {jobs}),/DN_TEST_JOBS/);
});
test('CI: every gate and source browser spec appears once in the plan',()=>{
 const expected=['unit','backend','content','build','browser-games','browser-pages','artifact','puzzles-1','puzzles-2','puzzles-3','timing-dates','offline-next','worker','push-crypto','push-panel','news'].sort();
 const p=plan();assert.deepEqual(p.serial.map(t=>t.name).sort(),expected);
 assert.deepEqual([...p.preflight,...p.tasks].map(t=>t.name).sort(),expected);
 const files=browserFiles(),flat=Object.values(files).flat();assert.ok(files.games.length&&files.pages.length);
 assert.equal(new Set(flat).size,flat.length);
 const fs=require('node:fs'),path=require('node:path');
 const allSpecs=fs.readdirSync(path.join(__dirname,'../browser'),{recursive:true}).filter(isBrowserSpec).sort();
 assert.deepEqual(flat.slice().sort(),allSpecs);
 for(const [group,specs] of Object.entries(files)){
  const t=p.tasks.find(t=>t.name==='browser-'+group);
  assert.deepEqual(t.args.slice(2),specs.map(f=>'tools/tests/browser/'+f));assert.equal(t.env.DN_TEST_WORKERS,'1');
 }
});
test('CI: future nested JavaScript/TypeScript test files remain eligible for the Pages group',()=>{
 for(const file of ['future.test.js','nested/widget.spec.ts','widget.test.mjs','screen.spec.jsx','screen.test.tsx'])assert.equal(isBrowserSpec(file),true,file);
 for(const file of ['support.js','baselines/screen.png','fixture.json','game.spec.js.map'])assert.equal(isBrowserSpec(file),false,file);
});
test('CI: nightly and optional cross-browser gates remain required',()=>{
 assert.ok(plan({nightly:true}).preflight.find(t=>t.name==='content').args.includes('--all'));
 assert.ok(!plan().serial.some(t=>t.name==='cross-browser'));
 assert.ok(plan({nightly:true,crossBrowser:true}).serial.some(t=>t.name==='cross-browser'));
});
