'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {selection,shardFor}=require('../puzzle-plan'),{TESTS}=require('../run');
test('PUZZLE-SHARDS: every production scenario runs exactly once across two nonempty shards',()=>{
 const all=Object.keys(TESTS),a=selection(all,['--shard=1/2']),b=selection(all,['--shard=2/2']);
 assert.ok(a.length&&b.length);assert.equal(new Set([...a,...b]).size,all.length);
 assert.equal(a.length+b.length,all.length);assert.deepEqual([...a,...b].sort(),all.slice().sort());
 for(const name of ['house:link','finish:mini','streak:doku-own'])assert.equal(shardFor(name),1);
 for(const name of ['house:sweep','finish:path','finish:tangle','finish:borders','flash:dark','streak:overall-run'])assert.equal(shardFor(name),2);
 assert.deepEqual(selection(all),all);
});
test('PUZZLE-SHARDS: focused filters still work and invalid/empty selections fail',()=>{
 const all=Object.keys(TESTS);assert.deepEqual(selection(all,['finish:link']),['finish:link','finish:link-loss']);
 assert.deepEqual(selection(all,['finish:link','--shard=1/2']),['finish:link','finish:link-loss']);
 for(const args of [['--shard=0/2'],['--shard=1/3'],['--shard=3/2'],['--shard=1/2','--shard=2/2'],['typo'],['finish:link','--shard=2/2']])assert.throws(()=>selection(all,args));
});
