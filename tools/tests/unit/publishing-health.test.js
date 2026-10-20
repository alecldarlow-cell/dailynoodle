'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {snapshot,TYPES,addDay}=require('../../publishing-health'),{analyse,dailyList}=require('../../../admin-health');
const ids={mini:'MINI',doku:'LEXI',sweep:'SWEEP',path:'PATH',link:'LINK',tangle:'TANG',borders:'BORD',reckon:'RECK'};
const list=day=>({today:day,items:Object.entries(TYPES).map(([type,slug])=>({type,id:'DP·'+ids[type]+'·0001',path:'reports/'+day+'-'+slug+'-0001.html'}))});
const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'publishing-'));fs.mkdirSync(path.join(root,'reports'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};
function put(root,date,type,serial=1,metaDate=date){
 const file=path.join(root,'reports',date+'-'+TYPES[type]+'-'+String(serial).padStart(4,'0')+'.html');
 fs.writeFileSync(file,`<meta name="dn:date" content="${metaDate}"><meta name="dn:kind" content="puzzle"><script>window.DN_PUZZLE={id:"DP·${ids[type]}·0001",answers:["SECRET_ANSWER"]}</script>`);return file;
}
test('PUBLISH: stock counts consecutive complete future days, stops at gaps and duplicates',t=>{
 const root=fixture(t),today='2026-10-20';
 for(let n=0;n<4;n++)for(const type of Object.keys(TYPES))put(root,addDay(today,n),type);
 let s=snapshot(root,{now:new Date('2026-10-20T12:00Z'),env:{GITHUB_RUN_ID:'123'}}),a=analyse(s,today);
 assert.equal(a.futureDays,3);assert.equal(a.through,'2026-10-23');assert.equal(a.firstGap.date,'2026-10-24');assert.equal(s.runId,'123');
 put(root,'2026-10-22','link',2);s=snapshot(root,{now:new Date('2026-10-20T12:00Z')});a=analyse(s,today);
 assert.equal(a.futureDays,1);assert.deepEqual(a.firstGap.duplicate,['link']);
 fs.unlinkSync(path.join(root,'reports/2026-10-21-'+TYPES.mini+'-0001.html'));
 a=analyse(snapshot(root,{now:new Date('2026-10-20T12:00Z')}),today);assert.equal(a.futureDays,0);assert.deepEqual(a.firstGap.missing,['mini']);
 assert.equal(analyse(s,'2026-10-21').stale,true);
});
test('PUBLISH: invalid metadata is blocked; snapshot exposes no future content or paths',t=>{
 const root=fixture(t);for(const type of Object.keys(TYPES))put(root,'2026-10-21',type,1,type==='doku'?'2026-10-22':'2026-10-21');
 const s=snapshot(root,{now:new Date('2026-10-20T23:30Z'),env:{GITHUB_RUN_ID:'invalid'}});
 assert.equal(s.today,'2026-10-21','London day, not UTC');assert.equal(s.runId,null);
 assert.deepEqual(s.days['2026-10-21'].blocked,['doku']);
 const a=analyse(s,'2026-10-20');assert.deepEqual(a.firstGap.blocked,['doku']);assert.equal(a.futureDays,0);
 assert.doesNotMatch(JSON.stringify(s),/SECRET_ANSWER|DP·|\.html|reports\//);
});
test('PUBLISH: malformed stock and stale, duplicated or unsafe daily lists never pass',()=>{
 const d='2026-10-20',j=list(d);assert.equal(dailyList(j,d).length,Object.keys(TYPES).length);
 for(const mutate of [x=>x.today='2026-10-19',x=>x.items.pop(),x=>x.items[0].type='doku',x=>x.items[0].path='../private.html',x=>x.items[0].path='https://other.site/mini.html',x=>x.items[0].id='DP·LINK·0001']){
  const x=structuredClone(j);mutate(x);assert.throws(()=>dailyList(x,d));
 }
 for(const s of [{},{version:1,today:d,builtAt:new Date().toISOString(),days:{[d]:{counts:{mini:-1},blocked:[]}}}])assert.throws(()=>analyse(s,d));
});
