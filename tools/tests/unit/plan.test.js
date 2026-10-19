'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {plan,execute}=require('../plan');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('CI: build precedes three lanes; at most three groups overlap; serial keeps every gate',async()=>{
 const calls=[],puzzle=deferred(),entered=deferred();let active=0,peak=0,shards=0;
 const job=execute(async t=>{
  calls.push(t.name);active++;peak=Math.max(peak,active);
  if(t.name.startsWith('puzzles-')){if(++shards===2)entered.resolve();await puzzle.promise;}
  if(t.name==='browser'){await entered.promise;assert.ok(calls.indexOf('build')<calls.indexOf('browser'));}
  active--;
 });
 await entered.promise;await new Promise(r=>setImmediate(r));
 assert.ok(calls.includes('artifact'));assert.equal(peak,3);puzzle.resolve();await job;
 assert.deepEqual(calls.slice().sort(),plan().serial.map(t=>t.name).sort());
 const serial=[];await execute(async t=>{serial.push(t.name);},{serial:true});assert.deepEqual(serial,plan().serial.map(t=>t.name));
});
test('CI: failures stop new groups, await active work, and reject the release',async()=>{
 const puzzle=deferred(),entered=deferred(),calls=[];let ended=false,shards=0;
 const job=execute(async t=>{
  calls.push(t.name);
  if(t.name.startsWith('puzzles-')){if(++shards===2)entered.resolve();await puzzle.promise;}
  if(t.name==='browser')throw Error('browser regression');
 }).finally(()=>{ended=true;});
 const rejected=assert.rejects(job,/browser regression/);
 await entered.promise;await new Promise(r=>setImmediate(r));assert.equal(ended,false);
 assert.ok(!calls.includes('artifact'));assert.ok(!calls.includes('worker'));puzzle.resolve();await rejected;
 const early=[];await assert.rejects(execute(async t=>{early.push(t.name);throw Error('unit regression');}),/unit regression/);
 assert.deepEqual(early,['unit']);
});
test('CI: every required group remains in both serial and parallel plans',()=>{
 const expected=['unit','backend','content','build','browser','artifact','puzzles-1','puzzles-2','timing-dates','offline-next','worker','push-crypto','push-panel'].sort();
 const p=plan();assert.deepEqual(p.serial.map(t=>t.name).sort(),expected);
 assert.deepEqual([...p.preflight,...p.lanes.flat()].map(t=>t.name).sort(),expected);
});
test('CI: nightly and optional cross-browser checks remain in the plan',()=>{
 assert.ok(plan({nightly:true}).preflight.find(t=>t.name==='content').args.includes('--all'));
 assert.ok(!plan().serial.some(t=>t.name==='cross-browser'));
 assert.ok(plan({nightly:true,crossBrowser:true}).serial.some(t=>t.name==='cross-browser'));
});
