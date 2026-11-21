'use strict';
/* Shared calendar and completed-save rules. Node tools require this file;
   browsers receive identical bundled copies via tools/sync-core.js. Keep the
   existing storage keys, ids and record formats; never redate old results. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(root);
 else if(!root.dnCore)root.dnCore=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
 function londonDay(instant){
  const d=instant===undefined?new Date():new Date(instant);
  try{
   const p={};
   new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(d).forEach(x=>{p[x.type]=x.value;});
   return p.year+'-'+p.month+'-'+p.day;
  }catch(e){return d.toISOString().slice(0,10);}
 }
 function dayBefore(day){
  const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);
 }
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 // Track actual game-save failures only. No storage probes, timers or global
 // Storage patching. Pending data lives in this tab until a real write succeeds.
 const scopes=new WeakMap(),listeners=new Set();
 function scope(storage){
  const owner=storage||root;
  if(!scopes.has(owner))scopes.set(owner,{issues:new Map(),done:new Map()});
  return scopes.get(owner);
 }
 function changed(storage){if(!storage)listeners.forEach(fn=>{try{fn();}catch(e){}});}
 function failed(key,retry,storage){const issues=scope(storage).issues,was=issues.has(key);issues.set(key,retry);if(!was)changed(storage);}
 function saved(key,storage){if(scope(storage).issues.delete(key))changed(storage);}
 function saveIssues(){return scope().issues.size;}
 function onSaveChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
 async function retrySaves(){
  for(const retry of Array.from(scope().issues.values())){try{await retry();}catch(e){}}
  return saveIssues()===0;
 }
 function read(key,storage){
  try{const s=JSON.parse((storage||root.localStorage).getItem(key)||'null');return object(s)&&s.v===1?s:null;}
  catch(e){return null;}
 }
 function getDone(key,id,storage){const s=read(key,storage),pending=scope(storage).done.get(key);return s&&object(s.done)&&s.done[id]||pending&&pending[id]||null;}
 function putDone(key,id,rec,storage){
  const state=scope(storage),pending=state.done.get(key)||{};
  const s=read(key,storage)||{v:1};if(!object(s.done))s.done={};
  if(s.done[id]&&!Object.keys(pending).length)return s.done[id];
  const first=s.done[id]||pending[id]||Object.assign({},rec,{d:londonDay()});
  pending[id]=first;state.done.set(key,pending);
  if(Object.keys(pending).every(k=>s.done[k])){state.done.delete(key);saved(key,storage);return first;}
  s.done=Object.assign({},pending,s.done);
  try{
   (storage||root.localStorage).setItem(key,JSON.stringify(s));
   state.done.delete(key);saved(key,storage);return first;
  }catch(e){failed(key,()=>putDone(key,id,first,storage),storage);return null;}
 }
 function mergeStreak(a,b){
  a=object(a)?a:{};b=object(b)?b:{};
  const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s.last||'');
  const newer=valid(b)&&(!valid(a)||b.last>a.last)?b:a,older=newer===a?b:a;
  let n=Number(newer.n)||0;
  if(valid(newer)&&valid(older)){
   if(newer.last===older.last)n=Math.max(n,Number(older.n)||0);
   else if(dayBefore(newer.last)===older.last)n=Math.max(n,(Number(older.n)||0)+1);
  }
  return Object.assign({},older,newer,{n,best:Math.max(n,Number(a.best)||0,Number(b.best)||0)});
 }
 function mergeProgress(current,stored,activeId){
  if(!stored)return current;
  const merged=Object.assign({},stored,current);
  // The stored result was committed first. Replaying or an older tab cannot
  // replace it; new ids from either tab survive. Other save fields stay intact.
  merged.done=Object.assign({},object(current.done)?current.done:{},object(stored.done)?stored.done:{});
  if(object(current.days)||object(stored.days)){
   merged.days=Object.assign({},object(current.days)?current.days:{},object(stored.days)?stored.days:{});
   const local=object(current.days)&&current.days[activeId],remote=object(stored.days)&&stored.days[activeId];
   if(local&&(!remote||remote.state!=='done'))merged.days[activeId]=local;
  }
  if(current.streak||stored.streak)merged.streak=mergeStreak(current.streak,stored.streak);
  if('best' in current||'best' in stored)merged.best=Math.max(Number(current.best)||0,Number(stored.best)||0);
  return merged;
 }
 function same(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&same(a[k],b[k]));
 }
 function progressOnly(s){
  s=s||{};
  const days=Object.fromEntries(Object.entries(s.days||{}).filter(([,d])=>d&&d.state!=='ready'));
  return {done:s.done||{},days,cur:s.cur||null,streak:s.streak&&s.streak.last?s.streak:null,best:s.best||0};
 }
 function saveProgress(key,current,activeId,storage,report=true){
  // Merge even if writing fails, so the current tab retains the results it read.
  let pending=report;
  try{
   const stored=read(key,storage);
   Object.assign(current,mergeProgress(current,stored,activeId));
   if(stored&&same(current,stored)){saved(key,storage);return current;}
   // A later housekeeping/settings write must not warn about game data that
   // is already durable. Compare data, not property order or storage capacity.
   pending=report&&!same(progressOnly(current),progressOnly(stored));
   (storage||root.localStorage).setItem(key,JSON.stringify(current));saved(key,storage);
  }catch(e){if(pending||scope(storage).issues.has(key))failed(key,()=>saveProgress(key,current,activeId,storage,true),storage);}
  return current;
 }
 async function saveStreak(key,value,external){
  try{external=external===undefined?root.storage:external;if(external){await external.set(key,JSON.stringify(value));saved(key);return true;}}catch(e){}
  try{root.localStorage.setItem(key,JSON.stringify(value));saved(key);return true;}
  catch(e){failed(key,()=>saveStreak(key,value,external));return false;}
 }
 /* Gold stars (21 Nov 2026, Alec; project doc claude/rewards-review-2026-11-21.md): a really
    good result, about one finish in ten, by fixed rules that are the same every day. Worked out
    from the saved result alone, so old results earn gold too (back-dated). Returns the reason
    ("A perfect ten") or '' for no gold. Lab types never get gold. Past Minis saved before the
    help flag `h` (checks or reveals used) are judged on time alone. The app's
    packages/core/src/gold.ts must give the same answers (its parity test reads this file). */
 const GOLD={
  mini:r=>!r.h&&secsOf(r)!==null&&secsOf(r)<=40?'Under 0:40 with no checks or reveals':'',
  doku:r=>secsOf(r)!==null&&secsOf(r)<=30?'Under 0:30':'',
  sweep:r=>r.o==='win'&&secsOf(r)!==null&&secsOf(r)<=30?'Swept in under 0:30':'',
  path:r=>secsOf(r)!==null&&secsOf(r)<=20?'Under 0:20':'',
  tally:r=>secsOf(r)!==null&&secsOf(r)<=60?'Under 1:00':'',
  link:r=>r.o==='win'&&r.m===0&&secsOf(r)!==null&&secsOf(r)<=60?'No mistakes, under 1:00':'',
  tangle:r=>num(r.s)&&r.s>=40?'40 points or more':'',
  borders:r=>r.c===10&&(!num(r.p)||r.p>=1000)?'A perfect ten':'',
  reckon:r=>num(r.p)&&r.p>=750?'750 points or more':''
 };
 const num=x=>typeof x==='number'&&isFinite(x);
 // seconds from a record: `s` where it is a time (never Tangle's or Reckon's points), else the clock text `t` ("0:20", "00:20", "1:02:03")
 function secsOf(r){
  if(num(r.s))return r.s;
  const m=/^(\d+):(\d\d)(?::(\d\d))?$/.exec(String(r.t||''));
  return m?(m[3]?+m[1]*3600+ +m[2]*60+ +m[3]:+m[1]*60+ +m[2]):null;
 }
 function gold(type,r){
  try{return object(r)&&GOLD[type]?GOLD[type](r):'';}catch(e){return '';}
 }
 return {londonDay,dayBefore,getDone,putDone,mergeProgress,saveProgress,saveStreak,saveIssues,onSaveChange,retrySaves,gold};
});
