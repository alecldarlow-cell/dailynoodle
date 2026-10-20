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

// Reckon (20 Oct 2026) saves through the same dn-core saveProgress/mergeProgress
// path. Fails against an engine whose persist() writes its in-memory save
// without the merge: the second tab drops the first tab's result.
test('SAVE-TABS: reckon retains both results from tabs opened before either finishes',async({browser})=>{
 const files=['2026-10-20-quiz-reckon-0001.html','2026-10-21-quiz-reckon-0002.html'];
 const KEY='digi-reckon-v1',time='2026-10-20T14:30:00Z';   // Reckon 1's own London day (15:30 BST)
 const ctx=await H.newPhone(browser);
 const read=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 try{
  const a=await H.open(browser,files[0],{ctx,time});
  const b=await H.open(browser,files[1],{ctx,time});
  const idA=await a.p.evaluate(()=>window.DN_PUZZLE.id),idB=await b.p.evaluate(()=>window.DN_PUZZLE.id);
  expect([idA,idB]).toEqual(['DP·RECK·0001','DP·RECK·0002']);
  await play.reckon(a.p,{wrong:[2,5]});                    // 800 points, on its day
  const first=await read(a.p);
  expect(first.done[idA]).toMatchObject({p:800,b:8,d:'2026-10-20'});
  expect(first.streak).toMatchObject({last:'2026-10-20',n:1,best:1});
  await play.reckon(b.p,{wrong:[]});                       // 1000 points; tab B still holds the save it read at load
  const both=await read(b.p);
  expect(both.done[idA]).toEqual(first.done[idA]);
  expect(both.done[idB]).toMatchObject({p:1000,b:10,d:'2026-10-20'});
  expect(both.streak).toMatchObject({last:'2026-10-20',n:1,best:1});
  expect(both.best).toBe(1000);
  expect(both.cur).toBeNull();
  // A stale tab's later settings/pause write must also retain the second result.
  await a.p.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'));});
  await H.wait(a.p,300);
  const again=await read(a.p);
  expect(again.done).toEqual(both.done);
  expect(again.best).toBe(1000);
  // Reopening the first tab shows its finished result, not a fresh round.
  await a.p.reload();await H.wait(a.p,1500);
  expect(await a.p.locator('.fin-open').count()).toBeGreaterThan(0);
  expect(a.p.errs).toEqual([]);expect(b.p.errs).toEqual([]);
 }finally{await ctx.close();}
});
