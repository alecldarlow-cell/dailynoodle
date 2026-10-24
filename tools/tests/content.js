'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),vm=require('node:vm');
const {read}=require('./read-puzzle');
const ROOT=path.resolve(__dirname,'../..');
/* Registry debt (tools/tests/fixtures/registry-debt.json). Each ERROR must match
   an entry by exact type, file and message, and its file by sha256 where given.
   An entry is either dated (reviewBy: fails once the London date passes it) or
   accepted history ("permanent": true with reason, decidedOn and owner, and no
   reviewBy). Every entry must still match a current error. */
const same=(a,b)=>['type','file','msg'].every(k=>a[k]===b[k]);
function checkDebtEntry(d){
  const at='Registry debt entry '+d.type+' '+d.file+': ';
  for(const k of ['type','file','msg'])assert.ok(typeof d[k]==='string'&&d[k],at+'needs '+k);
  if(d.permanent!==undefined)assert.equal(d.permanent,true,at+'"permanent" must be true or absent');
  if(d.permanent){
    assert.ok(typeof d.reason==='string'&&d.reason.trim(),at+'a permanent entry needs a reason');
    assert.ok(typeof d.owner==='string'&&d.owner.trim(),at+'a permanent entry needs an owner');
    assert.match(String(d.decidedOn),/^\d{4}-\d{2}-\d{2}$/,at+'a permanent entry needs decidedOn (YYYY-MM-DD)');
    assert.ok(!('reviewBy' in d),at+'a permanent entry has no reviewBy');
  }else assert.match(String(d.reviewBy),/^\d{4}-\d{2}-\d{2}$/,at+'needs reviewBy (YYYY-MM-DD) or "permanent": true');
}
function checkDebt(errors,debt,{today,hashOf}){
  for(const d of debt)checkDebtEntry(d);
  for(const e of errors){
    const known=debt.find(d=>same(d,e));
    assert.ok(known,'New registry error: '+JSON.stringify(e));
    if(!known.permanent)assert.ok(today<=known.reviewBy,'Registry debt review overdue: '+known.file);
    if(known.sha256)assert.equal(hashOf(e.file),known.sha256,'Changed legacy file must be re-reviewed: '+e.file);
  }
  for(const d of debt)assert.ok(errors.some(e=>same(e,d)),'Remove resolved registry exception: '+d.file);
}
module.exports={checkDebt,checkDebtEntry};
if(require.main===module){
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date());
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'noodle-content-'));
try {
  const report=path.join(temp,'registry.json');
  const result=spawnSync(process.execPath,['tools/build-registry.js','--check','--today',today,'--report',report],{cwd:ROOT,encoding:'utf8'});
  fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
  fs.writeFileSync(path.join(ROOT,'test-results/registry.log'),result.stdout+(result.stderr||''));
  if(!fs.existsSync(report)) throw new Error('Registry failed to produce its report: '+result.stderr);
  const data=JSON.parse(fs.readFileSync(report)),debt=require('./fixtures/registry-debt.json');
  const errors=data.problems.filter(p=>p.level==='ERROR');
  checkDebt(errors,debt,{today,hashOf:f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'reports',f))).digest('hex')});
  const perm=debt.filter(d=>d.permanent).length;
  console.log('Registry: no new errors; '+errors.length+' exact archive exceptions ('+perm+' accepted history, '+(debt.length-perm)+' dated; see test-results/registry.log).');
  const {G:link}=require('../build-link-batch'),{G:pg,grade}=require('../build-path-batch'),sweep=require('../build-sweep-batch');
  const {broadAlts}=require('../doku-broad-check'),reckon=require('../build-reckon-batch');
  const veto=require('../word-veto'),banned=new Set([...veto.BLOCKED,...veto.SENSITIVE,...veto.VETO]);
  const gates={};
  for(const type of ['mini','doku']) {
    const src=fs.readFileSync(path.join(ROOT,'engines',type+'.js'),'utf8');
    const marker='/* ---- Digi Puzzles: '+(type==='mini'?'Mini':'The Digi Doku')+' player';
    const at=src.indexOf(marker);assert.ok(at>0,'Missing '+type+' gate marker');
    const ctx={window:{},document:{write(){}}};
    vm.createContext(ctx);
    const code=src.slice(0,at)+(type==='doku'?src.slice(src.indexOf('/* ---- blocklist re-asserted'),src.indexOf('/* ---- state ---- */')):'');
    vm.runInContext(code+'\nthis.G={findSlots,validate'+(type==='doku'?',validateLexi':'')+'};',ctx);
    gates[type]=ctx.G;
  }
  const all=process.argv.includes('--all');
  let through=today;const n=new Date(today+'T12:00Z');n.setUTCDate(n.getUTCDate()+7);through=n.toISOString().slice(0,10);
  let checked=0;
  for(const file of fs.readdirSync(path.join(ROOT,'reports')).sort()){
    if(!/^\d{4}-\d{2}-\d{2}-(crossword-mini|logic-(doku|sweep|path)|word-(link|tangle)|geo-borders|quiz-reckon)/.test(file))continue;
    const day=file.slice(0,10);if(day<today||(!all&&day>through))continue;
    const p=read(path.join(ROOT,'reports',file));let gate;
    if(file.includes('crossword-mini')){
      const grid=p.grid.map(r=>r.map(c=>String(c).toLowerCase()));
      const slots=gates.mini.findSlots(grid);gate=slots&&gates.mini.validate(grid,slots,p.band);
      assert.ok(p.clues&&Object.keys(p.clues).length,'Missing clues '+file);
    }else if(file.includes('logic-doku')){gate=gates.doku.validateLexi(p);assert.equal(broadAlts(p),0,'Unintended second Doku answer: '+file);
      // 24 Oct 2026: no blocked or vetoed word in any run (tools/word-veto.js); earlier Dokus were never screened
      if(day>='2026-10-27'){const bad=gates.doku.findSlots(p.grid.map(r=>r.map(c=>String(c).toLowerCase()))).map(s=>s.cells.map(([r,c])=>String(p.grid[r][c]).toLowerCase()).join('')).filter(w=>banned.has(w));assert.ok(!bad.length,'Doku holds vetoed words ('+bad.join(', ')+'): '+file);}}
    else if(file.includes('logic-path')){gate=pg.validatePath(p);if(day>='2026-11-01')assert.deepEqual(grade(p).breaks,[],'Path quality '+file);}
    else if(file.includes('logic-sweep')){const r=sweep.evalPuzzle(p.mines,p.start);gate=r.v;if(day>='2026-11-01')assert.ok(r.fl.pass,'Sweep difficulty floor '+file);}
    else if(file.includes('word-link'))gate=link.validateLink(p);
    else if(file.includes('word-tangle')){assert.equal(p.tiles.length,16,file);assert.ok(p.main.includes(p.star),file);assert.equal(new Set(p.main).size,p.main.length,file);gate={pass:true};}
    else if(file.includes('quiz-reckon')){const errs=reckon.gateDay(p);assert.equal(p.date,day,file);gate={pass:!errs.length,checks:errs};}
    else {assert.equal(p.qs.length,10,file);for(const q of p.qs)assert.ok(q.o.includes(q.n),file+' has no correct answer');gate={pass:true};}
    assert.ok(gate&&gate.pass,file+' fails its ship gate: '+JSON.stringify(gate?.checks));checked++;
  }
  assert.ok(checked>=7,'No current puzzle fixtures checked');
  console.log('Content: '+checked+' current/forthcoming puzzles re-read from disk and validated'+(all?' (full future batch)':' (eight-day release window)')+'.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
}
