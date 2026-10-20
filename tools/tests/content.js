'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),vm=require('node:vm');
const {read}=require('./read-puzzle');
const ROOT=path.resolve(__dirname,'../..');
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
  for(const e of errors){
    const known=debt.find(d=>['type','file','msg'].every(k=>d[k]===e[k]));
    assert.ok(known,'New registry error: '+JSON.stringify(e));
    assert.ok(today<=known.reviewBy,'Registry debt review overdue: '+known.file);
    if(known.sha256)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'reports',e.file))).digest('hex'),known.sha256,'Changed legacy file must be re-reviewed: '+e.file);
  }
  for(const d of debt)assert.ok(errors.some(e=>['type','file','msg'].every(k=>e[k]===d[k])),'Remove resolved registry exception: '+d.file);
  console.log('Registry: no new errors; '+errors.length+' exact, dated archive exceptions (see test-results/registry.log).');
  const {G:link}=require('../build-link-batch'),{G:pg,grade}=require('../build-path-batch'),sweep=require('../build-sweep-batch');
  const {broadAlts}=require('../doku-broad-check'),reckon=require('../build-reckon-batch');
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
    }else if(file.includes('logic-doku')){gate=gates.doku.validateLexi(p);assert.equal(broadAlts(p),0,'Unintended second Doku answer: '+file);}
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
