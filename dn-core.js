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
 function read(key,storage){
  try{const s=JSON.parse((storage||root.localStorage).getItem(key)||'null');return object(s)&&s.v===1?s:null;}
  catch(e){return null;}
 }
 function getDone(key,id,storage){const s=read(key,storage);return s&&object(s.done)&&s.done[id]||null;}
 function putDone(key,id,rec,storage){
  try{
   storage=storage||root.localStorage;
   const s=read(key,storage)||{v:1};if(!object(s.done))s.done={};
   if(s.done[id])return s.done[id];
   const first=Object.assign({},rec,{d:londonDay()});s.done[id]=first;
   storage.setItem(key,JSON.stringify(s));return first;
  }catch(e){return null;}
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
 function saveProgress(key,current,activeId,storage){
  // Merge even if writing fails, so the current tab retains the results it read.
  try{
   storage=storage||root.localStorage;
   Object.assign(current,mergeProgress(current,read(key,storage),activeId));
   storage.setItem(key,JSON.stringify(current));
  }catch(e){}
  return current;
 }
 return {londonDay,dayBefore,getDone,putDone,mergeProgress,saveProgress};
});
