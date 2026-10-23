'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {checkDebt}=require('../content');
const ROOT=path.resolve(__dirname,'../../..');

const err={level:'ERROR',type:'doku',file:'2026-08-14-logic-doku-0032.html',msg:'duplicate puzzle (D4/canonical key) with 2026-08-13-logic-doku-0031.html'};
const gap={level:'ERROR',type:'mini',file:'-',msg:'3 missing day(s); first is 2026-07-13'};
const perm=(e,extra={})=>({...e,sha256:null,permanent:true,reason:'Published history.',decidedOn:'2026-10-23',owner:'Daily Noodle maintainers',...extra});
const dated=(e,extra={})=>({...e,sha256:null,reason:'Pending repair.',owner:'Daily Noodle maintainers',reviewBy:'2026-11-19',...extra});
const hashes={[err.file]:'aaa'},hashOf=f=>hashes[f];
const run=(errors,debt,today='2026-10-23')=>checkDebt(errors,debt,{today,hashOf});

test('DEBT-01: a permanent entry matching type, file, message and sha256 passes, after any date',()=>{
  run([err,gap],[perm(err,{sha256:'aaa'}),perm(gap)],'2030-01-01');
});
test('DEBT-02: a permanent entry still fails when its file changes',()=>{
  assert.throws(()=>run([err],[perm(err,{sha256:'bbb'})]),/Changed legacy file must be re-reviewed/);
});
test('DEBT-03: a permanent entry matches only its exact type, file and message',()=>{
  assert.throws(()=>run([err],[perm({...err,msg:err.msg+' '})]),/New registry error/);
  assert.throws(()=>run([err],[perm({...err,type:'mini'})]),/New registry error/);
  assert.throws(()=>run([err],[perm({...err,file:'2026-08-15-logic-doku-0033.html'})]),/New registry error/);
});
test('DEBT-04: a new finding still fails alongside permanent entries',()=>{
  const fresh={level:'ERROR',type:'path',file:'2026-07-21-logic-path-0003.html',msg:'no readable puzzle id'};
  assert.throws(()=>run([err,fresh],[perm(err,{sha256:'aaa'})]),/New registry error/);
});
test('DEBT-05: a dated entry still expires after its review date (London day)',()=>{
  run([gap],[dated(gap)],'2026-11-19');
  assert.throws(()=>run([gap],[dated(gap)],'2026-11-20'),/review overdue/);
});
test('DEBT-06: a permanent entry needs a reason, an owner and decidedOn, and no reviewBy',()=>{
  const {reason,...noReason}=perm(gap);
  assert.throws(()=>run([gap],[noReason]),/needs a reason/);
  assert.throws(()=>run([gap],[perm(gap,{reason:'  '})]),/needs a reason/);
  const {owner,...noOwner}=perm(gap);
  assert.throws(()=>run([gap],[noOwner]),/needs an owner/);
  const {decidedOn,...noDecided}=perm(gap);
  assert.throws(()=>run([gap],[noDecided]),/decidedOn/);
  assert.throws(()=>run([gap],[perm(gap,{reviewBy:'2026-11-19'})]),/has no reviewBy/);
  assert.throws(()=>run([gap],[perm(gap,{permanent:'yes'})]),/must be true/);
});
test('DEBT-07: an entry with neither reviewBy nor permanent fails',()=>{
  const {reviewBy,...bare}=dated(gap);
  assert.throws(()=>run([gap],[bare]),/reviewBy/);
});
test('DEBT-08: a permanent entry whose finding is gone must be removed',()=>{
  assert.throws(()=>run([],[perm(gap)]),/Remove resolved registry exception/);
});
test('DEBT-09: every checked-in debt entry is permanent or dated',()=>{
  const debt=require('../fixtures/registry-debt.json');
  assert.ok(debt.every(d=>d.permanent||d.reviewBy),'every entry is permanent or dated');
});

test('REG-01: legacy file map and \\u00b7-escaped ids are read by build-registry.js',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'noodle-reg-'));
  try{
    fs.mkdirSync(path.join(dir,'reports'));
    for(const f of ['DP-SWEEP-2026-07-17.html','digi-path-0002.html','2026-07-14-logic-doku-0002.html','digi-doku-0004.html'])
      fs.copyFileSync(path.join(ROOT,'reports',f),path.join(dir,'reports',f));
    const rep=path.join(dir,'r.json');
    spawnSync(process.execPath,[path.join(ROOT,'tools/build-registry.js'),'--check','--today','2026-07-20','--report',rep],{cwd:dir,encoding:'utf8'});
    const {summary,problems}=JSON.parse(fs.readFileSync(rep));
    const on=f=>problems.filter(p=>p.file===f&&p.level==='ERROR').map(p=>p.msg);
    assert.deepEqual(on('DP-SWEEP-2026-07-17.html'),[]);
    assert.deepEqual(on('digi-path-0002.html'),[]);
    assert.deepEqual(on('2026-07-14-logic-doku-0002.html'),[]);
    assert.equal(summary.sweep.dateFirst,'2026-07-17');
    assert.equal(summary.path.serialFirst,2);
    // not in the map: still reported, as accepted history
    assert.match(on('digi-doku-0004.html').join(),/does not match/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
