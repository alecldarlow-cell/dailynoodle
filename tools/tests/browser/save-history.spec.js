'use strict';
const {test,expect,H}=require('./support');
const play=require('../play');

for(const type of ['borders','tangle'])test('SAVE-TABS: '+type+' retains both results from tabs opened before either finishes',async({browser})=>{
 const files=type==='borders'
  ? ['2026-10-19-geo-borders-0015.html','2026-10-20-geo-borders-0016.html']
  : ['2026-10-19-word-tangle-0013.html','2026-10-20-word-tangle-0014.html'];
 const ctx=await H.newPhone(browser);
 try{
  const a=await H.open(browser,files[0],{ctx,time:'2026-10-19T12:00:00Z'});
  const b=await H.open(browser,files[1],{ctx,time:'2026-10-19T12:00:00Z'});
  const idA=await a.p.evaluate(()=>window.DN_PUZZLE.id),idB=await b.p.evaluate(()=>window.DN_PUZZLE.id);
  const finish=p=>type==='borders'?play.borders(p,{wrong:[],hint:[]}):play.tangle(p,{n:1});
  await finish(a.p);
  const first=await a.p.evaluate(key=>JSON.parse(localStorage.getItem(key)), 'digi-'+type+'-v1');
  expect(first.done[idA]).toBeTruthy();
  await finish(b.p);
  const both=await b.p.evaluate(key=>JSON.parse(localStorage.getItem(key)), 'digi-'+type+'-v1');
  expect(both.done[idA]).toEqual(first.done[idA]);
  expect(both.done[idB]).toBeTruthy();
  expect(both.streak).toMatchObject({last:'2026-10-19',n:1,best:1});
  if(type==='tangle')expect(both.days[idA].state).toBe('done');
  // A stale tab's later settings/pause write must also retain the second result.
  await a.p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  const again=await a.p.evaluate(key=>JSON.parse(localStorage.getItem(key)), 'digi-'+type+'-v1');
  expect(again.done).toEqual(both.done);
  await a.p.reload();await H.wait(a.p,1500);
  expect(await a.p.locator('.fin-open').count()).toBeGreaterThan(0);
  expect(a.p.errs).toEqual([]);expect(b.p.errs).toEqual([]);
 }finally{await ctx.close();}
});
