'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../../../dn-core'),{sync,bundled}=require('../../sync-core');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
function isolated(storage,extra={}){
 const ctx=vm.createContext({Date,Intl,localStorage:storage,...extra});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../../dn-core.js'),'utf8'),ctx);
 return ctx.dnCore;
}

test('SAVE-NOTICE: only actual progress failures notify, once per unresolved key',async()=>{
 const storage=memory(),set=storage.setItem;let deny=true;
 storage.setItem=(k,v)=>{if(deny)throw Error('full');set(k,v);};
 const core=isolated(storage);let changes=0;core.onSaveChange(()=>changes++);
 assert.equal(core.getDone('game','a'),null);assert.equal(changes,0);
 core.saveProgress('settings',{v:1,done:{}},'a',undefined,false);
 assert.equal(core.saveIssues(),0);
 for(let i=0;i<4;i++)core.saveProgress('game',{v:1,done:{a:{s:i}}},'a');
 assert.equal(core.saveIssues(),1);assert.equal(changes,1);
 assert.equal(await core.retrySaves(),false);assert.equal(changes,1);
 deny=false;core.saveProgress('unrelated',{v:1,done:{}},'a');
 assert.equal(core.saveIssues(),1); // a successful unrelated write is not recovery
 assert.equal(await core.retrySaves(),true);assert.equal(changes,2);
 assert.equal(JSON.parse(storage.getItem('game')).done.a.s,3);
});
test('SAVE-NOTICE: retry retains the first result, original day and other tabs’ history',async()=>{
 const storage=memory(),set=storage.setItem;let deny=true;
 storage.setItem=(k,v)=>{if(deny)throw Error('full');set(k,v);};
 let day='2026-10-19T12:00:00Z';
 class Clock extends Date{constructor(...args){super(...(args.length?args:[day]));}}
 const core=isolated(storage,{Date:Clock});
 core.putDone('game','a',{s:12});const first=core.getDone('game','a');
 assert.equal(first.d,'2026-10-19');day='2026-10-20T12:00:00Z';
 core.putDone('game','a',{s:99});assert.equal(core.getDone('game','a').s,12);
 core.putDone('game','b',{s:3});
 set('game',JSON.stringify({v:1,setting:true,done:{other:{s:7}}}));deny=false;
 assert.equal(await core.retrySaves(),true);
 const out=JSON.parse(storage.getItem('game'));
 assert.deepEqual(out.done,{other:{s:7},a:{s:12,d:'2026-10-19'},b:{s:3,d:'2026-10-20'}});
 assert.equal(out.setting,true);assert.equal(core.saveIssues(),0);
});
test('SAVE-NOTICE: housekeeping cannot warn about already-saved progress or failed settings',()=>{
 const storage=memory(),core=isolated(storage);
 const current={v:1,done:{a:{s:12}},streak:{last:'2026-10-19',n:1,best:1},best:12,snd:true};
 core.saveProgress('game',current,'a');
 storage.setItem=()=>{throw Error('full');};
 core.saveProgress('game',current,'a');assert.equal(core.saveIssues(),0);
 current.snd=false;core.saveProgress('game',current,'a',undefined,false);
 core.saveProgress('game',current,'a');assert.equal(core.saveIssues(),0);
 // A genuinely new answer still reports failure even when settings also changed.
 current.cur={id:'b',ans:['UK']};core.saveProgress('game',current,'b');assert.equal(core.saveIssues(),1);
});
test('SAVE-NOTICE: another tab’s committed results recover pending completion without another write',async()=>{
 const storage=memory(),set=storage.setItem,core=isolated(storage);
 storage.setItem=()=>{throw Error('full');};core.putDone('game','a',{s:12});
 set('game',JSON.stringify({v:1,done:{a:{s:7,d:'2026-10-19'}}}));
 assert.equal(await core.retrySaves(),true);assert.equal(core.getDone('game','a').s,7);
});
test('SAVE-NOTICE: streak fallback succeeds quietly; recovery must save every failed key',async()=>{
 const storage=memory(),set=storage.setItem;let deny=false;
 storage.setItem=(k,v)=>{if(deny)throw Error('full');set(k,v);};
 const core=isolated(storage),external={set(){throw Error('unavailable');}};
 const streak={last:'2026-10-19',streak:3};
 assert.equal(await core.saveStreak('streak',streak,external),true);assert.equal(core.saveIssues(),0);
 deny=true;core.putDone('game','a',{s:12});await core.saveStreak('streak',streak,external);
 assert.equal(core.saveIssues(),2);
 storage.setItem=(k,v)=>{if(k==='streak')throw Error('still full');set(k,v);};
 assert.equal(await core.retrySaves(),false);assert.equal(core.saveIssues(),1);
 assert.equal(core.getDone('game','a').s,12);
 storage.setItem=set;assert.equal(await core.retrySaves(),true);
 assert.deepEqual(JSON.parse(storage.getItem('streak')),streak);
});

test('DATE: London days cover both midnight and both DST boundaries',()=>{
 for(const [instant,day] of [
  ['2026-10-18T22:59:59Z','2026-10-18'],['2026-10-18T23:00:00Z','2026-10-19'],
  ['2026-10-25T00:59:59Z','2026-10-25'],['2026-10-25T01:00:00Z','2026-10-25'],
  ['2026-10-25T23:30:00Z','2026-10-25'],['2026-03-29T00:59:59Z','2026-03-29'],
  ['2026-03-29T01:00:00Z','2026-03-29'],['2026-03-29T23:00:00Z','2026-03-30']
 ])assert.equal(C.londonDay(instant),day,instant);
 for(const [day,previous] of [['2026-01-01','2025-12-31'],['2028-03-01','2028-02-29'],['2026-03-30','2026-03-29'],['2026-10-26','2026-10-25']])assert.equal(C.dayBefore(day),previous);
});
test('SAVE: first result and existing fields survive repeated completion writes',()=>{
 const s=memory();s.setItem('key',JSON.stringify({v:1,setting:true,done:{old:{s:7,d:'2026-03-01'}}}));
 C.putDone('key','new',{s:10},s);C.putDone('key','new',{s:99},s);
 assert.equal(C.getDone('key','new',s).s,10);assert.equal(C.getDone('key','old',s).d,'2026-03-01');
 assert.equal(JSON.parse(s.getItem('key')).setting,true);
 assert.match(C.getDone('key','new',s).d,/^\d{4}-\d{2}-\d{2}$/);
});
test('SAVE: unavailable, malformed and array storage never prevent play',()=>{
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('full');}};
 assert.equal(C.getDone('key','id',denied),null);assert.equal(C.putDone('key','id',{s:1},denied),null);
 const current={v:1,done:{id:{s:2}}};assert.equal(C.saveProgress('key',current,'id',denied),current);
 for(const raw of ['{bad','[]','null','{"v":1,"done":[]}']){
  const s=memory();s.setItem('key',raw);assert.equal(C.getDone('key','id',s),null);
  C.putDone('key','id',{s:3},s);assert.equal(C.getDone('key','id',s).s,3);
 }
});
test('SAVE-TABS: merge keeps both histories, first scores and the highest best',()=>{
 const s=memory(),a={v:1,done:{a:{s:12}},best:12},b={v:1,done:{b:{s:7}},best:7};
 C.saveProgress('key',a,'a',s);C.saveProgress('key',b,'b',s);
 a.done.b={s:999};C.saveProgress('key',a,'a',s);
 const out=JSON.parse(s.getItem('key'));assert.deepEqual(out.done,{a:{s:12},b:{s:7}});assert.equal(out.best,12);
});
test('SAVE-TABS: active Tangle round keeps its object; unrelated and completed days survive',()=>{
 const active={state:'playing',found:['cat'],left:40,score:1};
 const current={v:1,done:{},days:{a:active,b:{state:'ready'}}};
 const stored={v:1,done:{b:{s:4}},days:{a:{state:'ready'},b:{state:'done',found:['dog'],score:4}}};
 const out=C.mergeProgress(current,stored,'a');assert.equal(out.days.a,active);assert.equal(out.days.b.state,'done');
 const remoteDone={...stored,days:{a:{state:'done',found:['hat'],score:8}}};
 assert.equal(C.mergeProgress(current,remoteDone,'a').days.a.state,'done');
});
test('SAVE-TABS: a stale tab cannot roll back a streak or count the same day twice',()=>{
 const progress=streak=>({v:1,done:{},streak});
 const a=progress({last:'2026-10-19',n:4,best:7}),b=progress({last:'2026-10-20',n:1,best:1});
 const joined=C.mergeProgress(b,a).streak;assert.deepEqual(joined,{last:'2026-10-20',n:5,best:7});
 assert.deepEqual(C.mergeProgress(a,{...b,streak:joined}).streak,joined);
 assert.equal(C.mergeProgress(a,a).streak.n,4);
 assert.equal(C.mergeProgress(progress({last:'2026-10-23',n:1,best:1}),a).streak.n,1);
});
test('SAVE: read results still merge when a later write fails',()=>{
 const current={v:1,done:{a:{s:1}}};
 const storage={getItem:()=>JSON.stringify({v:1,done:{b:{s:2}}}),setItem(){throw Error('full');}};
 C.saveProgress('key',current,'a',storage);assert.deepEqual(Object.keys(current.done).sort(),['a','b']);
});
test('CORE: generated browser/worker copies match the authoritative source and are idempotent',()=>{
 assert.deepEqual(sync(true),[]);
 const core=fs.readFileSync(path.join(__dirname,'../../../dn-core.js'),'utf8');
 const once=bundled("'use strict';\nwindow.example=true;\n",core);assert.equal(bundled(once,core),once);
 const ctx=vm.createContext({Date,Intl});vm.runInContext(core,ctx);const api=ctx.dnCore;vm.runInContext(core,ctx);
 assert.equal(ctx.dnCore,api);assert.equal(ctx.dnCore.londonDay('2026-10-18T23:30:00Z'),'2026-10-19');
 assert.ok(bundled(once,core+'\n// changed').includes('// changed'));
});
test('SAVE: fresh done-state templates install shared rules and the share stage exactly once',()=>{
 const {TYPES,patch}=require('../../add-done-state');
 const source=TYPES.mini.edits(TYPES.mini.key).map(([find])=>find).join('\n');
 const result=patch(source,'mini');assert.equal(result.ok,true,result.why);
 assert.deepEqual(result.stages,['done','share']);
 assert.match(result.out,/window\.dnCore\.putDone\(DONE_KEY,id,rec\);doneShow\(\)/);
 assert.equal(patch(result.out,'mini').skipped,true);
});
