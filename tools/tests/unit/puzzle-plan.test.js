'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {selection,partition}=require('../puzzle-plan'),{TESTS}=require('../run');
const estimates=require('../fixtures/puzzle-durations.json').seconds;
test('PUZZLE-SHARDS: all production scenarios run once across balanced nonempty groups',()=>{
 const all=Object.keys(TESTS);
 for(const count of [1,2,3,5]){
  const groups=partition(all,count),flat=groups.flat();
  assert.equal(groups.length,count);assert.ok(groups.every(g=>g.length));
  assert.equal(new Set(flat).size,all.length);assert.equal(flat.length,all.length);assert.deepEqual(flat.slice().sort(),all.slice().sort());
  for(let i=0;i<count;i++)assert.deepEqual(selection(all,['--shard='+(i+1)+'/'+count]),groups[i]);
 }
 const seconds=partition(all,3).map(g=>g.reduce((n,name)=>n+(estimates[name]||10),0));
 assert.ok(Math.max(...seconds)-Math.min(...seconds)<10,'Measured shards must stay within ten seconds: '+seconds);
 assert.deepEqual(selection(all),all);
});
test('PUZZLE-SHARDS: estimates are fixed and unknown future scenarios cannot disappear',()=>{
 const all=Object.keys(TESTS);
 assert.ok(Object.values(estimates).every(s=>Number.isFinite(s)&&s>0));
 const a=partition(all,3),b=partition(all.slice().reverse(),3);
 assert.deepEqual(a.map(g=>g.slice().sort()),b.map(g=>g.slice().sort()));
 const extended=all.concat('new:future-scenario'),flat=partition(extended,3).flat();
 assert.equal(flat.filter(n=>n==='new:future-scenario').length,1);assert.equal(flat.length,extended.length);
});
test('PUZZLE-SHARDS: focused filters and old two-shard commands still work; invalid selections fail',()=>{
 const all=Object.keys(TESTS);assert.deepEqual(selection(all,['finish:link']),['finish:link','finish:link-loss']);
 const groups=partition(all,3),i=groups.findIndex(g=>g.includes('finish:link'));
 assert.deepEqual(selection(all,['finish:link','--shard='+(i+1)+'/3']),groups[i].filter(n=>n.includes('finish:link')));
 for(const args of [['--shard=0/2'],['--shard=3/2'],['--shard=1/0'],['--shard=1/9'],['--shard=1/2','--shard=2/2'],['typo']])assert.throws(()=>selection(all,args));
 const other=(i+1)%3;assert.throws(()=>selection(all,['finish:link-loss-does-not-exist','--shard='+(other+1)+'/3']));
});
