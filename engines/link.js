/* Digi Puzzles — link engine. One copy serves every link page in reports/.
   Extracted 2026-10-15 from 2027-06-01-word-link-0297.html by tools/engine-shells.js.
   The page supplies its puzzle as window.DN_PUZZLE before loading this file.
   Edit here to change every link; keep element ids and localStorage keys
   stable (dn-track.js and players' saved progress depend on them). */

/* ================= THE PUZZLE =================
   Authored object. Groups are ranked 1 (easiest) → 4 (hardest); the rank drives
   the band colour. The board is dealt shuffled, so member order here is source
   order only. */
/* the shared finish sheet (engines/finish.js): calls made before it loads are queued */
window.dnFinish=window.dnFinish||{q:[],show(c){this.q.push(c)},hide(){}};
document.write('<link rel="stylesheet" href="../engines/finish.css"><link rel="stylesheet" href="../engines/house.css"><script src="../engines/finish.js"><\/script><script src="../engines/house.js"><\/script>');
const SAMPLE = window.DN_PUZZLE;

/* ================= THE SHIP GATE =================
   Same rule as every Digi type: the puzzle is checked in code, at build and
   again here at load. A tampered or malformed Link must not render. */
const BLOCKED=["anal","anus","arse","bastard","bitch","boob","bugger","bollock","clit","cock","crap","cunt","dick","dyke","fag","fuck","hooker","incest","jizz","kike","nazi","nigg","paki","penis","piss","poop","porn","prick","pube","pussy","queer","rape","retard","screw","shit","slag","slut","spunk","turd","twat","vagina","wank","whore"];
const SENSITIVE=["ass","bra","coke","crack","damn","hell","kill","nude","sex","shag","tit","wee","willy"];
function byGroupOf(gs,tile){return gs.find(g=>(g.members||[]).some(m=>String(m).toUpperCase()===tile));}
function validateLink(P){
  const c={};
  const gs=Array.isArray(P.groups)?P.groups:[];
  c.four_groups        = gs.length===4;
  c.four_per_group     = gs.every(g=>Array.isArray(g.members)&&g.members.length===4);
  const tiles=gs.flatMap(g=>g.members||[]).map(t=>String(t).trim().toUpperCase());
  c.sixteen_tiles      = tiles.length===16;
  c.no_duplicate_tiles = new Set(tiles).size===16;
  c.tiles_render       = tiles.every(t=>t.length>=1&&t.length<=10&&/^[A-Z][A-Z '\-]*$/.test(t));
  c.ranks_are_1_to_4   = JSON.stringify(gs.map(g=>g.rank).sort())==="[1,2,3,4]";
  c.names_distinct     = new Set(gs.map(g=>String(g.name||"").toLowerCase())).size===4;
  /* a tile printed inside its own category name would hand the group over */
  c.no_giveaway        = gs.every(g=>(g.members||[]).every(m=>!String(g.name||"").toLowerCase().includes(String(m).toLowerCase())));
  const clean=s=>{const x=String(s).toLowerCase();
    if(BLOCKED.includes(x)||SENSITIVE.includes(x))return false;
    return !BLOCKED.some(b=>x.includes(b));};
  c.family_friendly    = tiles.every(clean)&&gs.every(g=>clean(g.name));
  /* every declared trap must be a real tile, must not sit in the group it is
     declared to be tempting you away from, and must name a group that exists */
  const traps=Array.isArray(P.traps)?P.traps:[];
  c.traps_resolve      = traps.every(t=>{
    const tile=String(t.tile).toUpperCase(), home=byGroupOf(gs,tile);
    return tiles.includes(tile) && home && home.name!==t.not && gs.some(g=>g.name===t.not);
  });
  const pass=Object.values(c).every(Boolean);
  return {pass,checks:c};
}
const gate=validateLink(SAMPLE);
if(!gate.pass){
  document.body.innerHTML='<div class="gate-fail"><b>Ship-gate check failed — this Link will not render.</b><br><br>'+
    Object.entries(gate.checks).map(([k,v])=>k+": "+(v?"pass":"FAIL")).join("<br>")+'</div>';
  throw new Error("Link failed ship gate");
}

/* ================= PLAYER ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const P=SAMPLE;
const MAX_MISTAKES=4;
/* ---- app mode (shared) ---- */
const APPMODE=!!(window.matchMedia&&window.matchMedia("(pointer:coarse) and (hover:none)").matches);
if(APPMODE)document.documentElement.classList.add("app-mode");
const byName=new Map(); P.groups.forEach(g=>g.members.forEach(m=>byName.set(m.toUpperCase(),g)));

let live=[], sel=new Set(), solved=[], mistakes=0, over=false, won=false, ranked=true, t0=0, tick=0, guesses=[], tried=new Set(), busy=false, newBand=null, bandArriving=false, bandLanded=null, justLost=false;

const comboKey=ws=>[...ws].map(w=>w.toUpperCase()).sort().join("|");
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function render(){
  const b=$("#board"); b.innerHTML="";
  for(const g of solved){
    const band=document.createElement("div");
    band.className="band r"+g.rank+(g===newBand?(bandArriving?" arriving":" new"):"")+(g===bandLanded?" landed":"");
    band.innerHTML='<div class="bname">'+g.name+'</div><div class="bmem"><span>'+g.members.join(" · ")+'</span></div>';
    b.appendChild(band);
  }
  for(let r=0;r<live.length/4;r++){
    const row=document.createElement("div"); row.className="row";
    for(const w of live.slice(r*4,r*4+4)){
      const t=document.createElement("button");
      t.className="tile"+(sel.has(w)?" sel":""); t.type="button";
      t.dataset.w=w;
      const sp=document.createElement("span"); sp.className="tt"; sp.textContent=w;
      t.appendChild(sp);
      t.setAttribute("aria-pressed",String(sel.has(w)));
      t.onclick=()=>toggle(w);
      row.appendChild(t);
    }
    b.appendChild(row);
  }
  $("#pips").innerHTML=Array.from({length:MAX_MISTAKES},(_,i)=>{
    const spent=i<mistakes, just=justLost&&i===mistakes-1;
    return '<span class="pip'+(spent?" gone":"")+(just?" lost":"")+'"></span>';
  }).join("");
  justLost=false;
  $("#submit").disabled=over||busy||sel.size!==4;
  $("#clear").disabled=over||busy||sel.size===0;
  $("#shuffle").disabled=over||busy;
  if(typeof doneSync==="function")doneSync();
  fitBoard(); fitFont();
}
/* One size for the whole board, MEASURED rather than estimated. The old
   version guessed from character count and a per-character coefficient, which
   overflowed the moment a fallback face loaded wider than Space Grotesk. This
   shrinks until the widest word actually fits, then stops. Memoised on tile
   width + longest word, so tapping doesn't retrigger the search. */
/* One unit height governs both a chip row and a band, so solving a group never
   changes the board's height. On a phone the board is allocated the leftover
   space and the unit is sized to fill it; on a wide screen the unit is simply
   the chip's own height and the bands follow it. */
let _unitW=0,_unitH=0;
function fitBoard(){
  const b=$("#board"); if(!b)return;
  const rows=Math.ceil(live.length/4);
  const bands=b.querySelectorAll(".band").length;
  const t=b.querySelector(".tile");
  if(t&&t.clientWidth)_unitW=t.clientWidth;
  if(APPMODE){
    const avail=b.clientHeight, units=rows+bands;
    if(avail&&units){
      /* a chip that goes portrait stops reading as a chip, so the unit is
         capped against the chip's own width; the leftover becomes one steady
         gap rather than a board that shrinks under you */
      const cap=(_unitW||80)*1.22;
      _unitH=Math.max(50,Math.min(cap,Math.floor((avail-7*(units-1))/units)));
    }
  }else if(t&&t.offsetHeight){
    _unitH=t.offsetHeight;
  }
  if(_unitH){b.style.setProperty("--th",_unitH+"px");b.style.setProperty("--bh",_unitH+"px");}
  fitBands(b);
}
/* A band's members are one line or they are nothing — a four-name list that
   wraps reads as an accident next to three that don't. Measured per band, so a
   long group shrinks only itself. */
function fitBands(b){
  b.querySelectorAll(".band").forEach(band=>{
    const box=band.querySelector(".bmem"), sp=box&&box.firstElementChild;
    if(!sp)return;
    const room=band.clientWidth-26; if(room<=0)return;
    let lo=11,hi=19,best=lo;
    for(let i=0;i<6;i++){
      const mid=(lo+hi)/2; box.style.fontSize=mid+"px";
      if(sp.offsetWidth<=room){best=mid;lo=mid;}else hi=mid;
    }
    box.style.fontSize=best.toFixed(2)+"px";
  });
}
let _fitKey="";
function fitFont(force){
  const b=$("#board"), tiles=$$(".tile");
  if(!tiles.length){_fitKey="";return;}
  const avail=tiles[0].clientWidth;
  if(!avail)return;                                    // no layout yet
  const maxLen=Math.max(...live.map(w=>w.length));
  const key=avail+"|"+maxLen;
  if(key===_fitKey&&!force)return;
  const room=avail-12;
  let lo=9, hi=18, best=lo;
  for(let i=0;i<7;i++){                                // binary search to 0.07px
    const mid=(lo+hi)/2;
    b.style.setProperty("--tf",mid+"px");
    const fits=tiles.every(t=>{const sp=t.querySelector(".tt");return !sp||sp.offsetWidth<=room;});
    if(fits){best=mid;lo=mid;}else{hi=mid;}
  }
  b.style.setProperty("--tf",best.toFixed(2)+"px");
  _fitKey=key;
}
addEventListener("resize",()=>{fitBoard();fitFont(true);});
function toggle(w){
  if(over||busy)return;
  startTimer();   // also works if the start card could not load
  if(sel.has(w))sel.delete(w);
  else{ if(sel.size>=4){setMsg("Four at a time");return;} sel.add(w); }
  setMsg(""); render();
}
function setMsg(t,tone){const m=$("#msg"); m.className="msg"+(tone?" "+tone:""); m.textContent=t||"";}
/* haptics, where the device offers them — silent no-op everywhere else */
function buzz(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern);}catch(e){}}

function submit(){
  if(over||busy||sel.size!==4)return;
  /* Board order, not tap order — the share grid should read the way the board
     read when you pressed Submit. */
  const els=$$(".tile.sel");
  const picked=els.map(e=>e.dataset.w);
  /* A guess you have already made tells you nothing new, so it costs nothing.
     Mistakes are for wrong ideas, not for mis-taps. */
  const key=comboKey(picked);
  if(tried.has(key)){
    setMsg("Already tried that one");
    els.forEach(e=>{e.classList.remove("miss");void e.offsetWidth;e.classList.add("miss");});
    buzz(12);
    const seen=new Set(picked);
    setTimeout(()=>{$$(".tile").forEach(e=>{if(seen.has(e.dataset.w))e.classList.remove("miss");});},760);
    return;
  }
  tried.add(key);
  guesses.push(picked.map(w=>byName.get(w).rank));
  const counts=new Map();
  for(const w of picked){const g=byName.get(w); counts.set(g,(counts.get(g)||0)+1);}
  const best=Math.max(...counts.values());

  if(best===4){
    const g=[...counts.keys()][0];
    const commit=arriving=>{
      solved.push(g);                       // in the order found, not by rank
      live=live.filter(w=>!sel.has(w)); sel.clear();
      newBand=g; bandArriving=!!arriving;
      if(!arriving)buzz([10,40,18]);        // no flight, so the tick lands here
      setMsg("");
      render(); newBand=null; bandArriving=false;
    };
    const checkWin=()=>{ if(solved.length===4){won=true;over=true;stopTimer();finish(true);} };
    if(reduceMotion){busy=false;commit(false);render();checkWin();return;}
    busy=true;
    /* THE SETTLE, beat one: the four turn their group's colour left to right,
       and hold, so the group is legible as a group before it moves. */
    els.forEach((e,i)=>{
      e.style.transitionDelay=(i*80)+"ms";
      e.classList.remove("sel"); e.classList.add("hit","g"+g.rank);
    });
    $("#shuffle").disabled=true; $("#clear").disabled=true; $("#submit").disabled=true;
    setTimeout(()=>{
      const first=els.map(e=>e.getBoundingClientRect());
      commit(true);                          // band takes its place, still invisible
      flyIntoBand(first,g,checkWin);
    },80*3+300);
    return;
  }
  if(best===3)setMsg("One away",  "bad");
  else        setMsg("Not a group","bad");
  mistakes++; justLost=true;
  render();                       // rebuilds the tiles — so paint the miss AFTER it
  /* three channels at once: colour, motion, touch. Redundant on purpose — any
     one can be missed on a phone, all three together cannot. */
  const held=new Set(picked);
  $$(".tile").forEach(e=>{if(held.has(e.dataset.w))e.classList.add("miss");});
  buzz(best===3?[16,80,16]:[26,60,26,60,26]);
  setTimeout(()=>{$$(".tile").forEach(e=>e.classList.remove("miss"));},780);
  if(mistakes>=MAX_MISTAKES){
    over=true;stopTimer();
    setTimeout(revealRest,420);
  }
}
function revealRest(){
  sel.clear();
  const rest=P.groups.filter(g=>!solved.includes(g)).sort((a,b)=>a.rank-b.rank);
  let i=0;
  const step=()=>{
    if(i>=rest.length){setMsg("Out of mistakes — here's the rest");finish(false);return;}
    const g=rest[i++]; solved.push(g); newBand=g;
    live=live.filter(w=>!g.members.includes(w)); render(); newBand=null;
    setTimeout(step,reduceMotion?0:420);
  };
  step();
}

/* THE SETTLE, beat two: the four chips leave the grid and converge on the
   band's footprint, each taking a quarter of it, then fuse as the band comes
   up underneath. A real FLIP — first rects are measured before the commit, the
   band's rect after it, so the flight lands exactly where the band is rather
   than somewhere that merely looks close. Falls back to a plain reveal wherever
   the Web Animations API or layout metrics are unavailable. */
function flyIntoBand(first,g,done){
  const band=$("#board .band.arriving");
  /* the tick belongs to the landing, not the launch */
  const finishUp=landed=>{ busy=false; bandLanded=landed?g:null; buzz([10,40,18]);
    render(); bandLanded=null; done(); };
  if(!band||first.length!==4||!first[0].width||typeof band.animate!=="function"){
    if(band)band.classList.remove("arriving");
    return finishUp(false);
  }
  const b=band.getBoundingClientRect();
  if(!b.width) { band.classList.remove("arriving"); return finishUp(false); }
  const slot=b.width/4;
  const flights=first.map((r,i)=>{
    const el=document.createElement("div");
    el.className="ghost r"+g.rank;
    el.style.left=r.left+"px"; el.style.top=r.top+"px";
    el.style.width=r.width+"px"; el.style.height=r.height+"px";
    document.body.appendChild(el);
    const dx=(b.left+i*slot+slot/2)-(r.left+r.width/2);
    const dy=(b.top+b.height/2)-(r.top+r.height/2);
    const land="translate("+dx+"px,"+dy+"px) scale("+(slot/r.width)+","+(b.height/r.height)+")";
    return el.animate([
      {transform:"translate(0,0) scale(1)",opacity:1,borderRadius:"11px"},
      {transform:land,opacity:1,borderRadius:"3px",offset:.8},
      {transform:land,opacity:0,borderRadius:"3px"}
    ],{duration:540,easing:"cubic-bezier(.55,0,.2,1)",fill:"forwards"});
  });
  band.animate([{opacity:0},{opacity:0,offset:.66},{opacity:1}],
    {duration:540,easing:"ease-out",fill:"forwards"});
  Promise.all(flights.map(a=>a.finished.catch(()=>{}))).then(()=>{
    $$(".ghost").forEach(e=>e.remove());
    band.classList.remove("arriving"); band.style.opacity="";
    finishUp(true);
  });
}

/* ---- timer ---- */
function stamp(){const s=t0?Math.floor((Date.now()-t0)/1000):0;return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
function startTimer(){if(over||tick)return;t0=Date.now();tick=setInterval(()=>{$("#timer").textContent=stamp();},250);}
function stopTimer(){clearInterval(tick);tick=0;$("#timer").textContent=stamp();}
window.addEventListener('dn:play',startTimer);

/* ---- streak (shared: advances once per calendar day on any solve) ---- */
const KEY="digi-link-streak";
async function store(){
  try{if(window.storage){const r=await window.storage.get(KEY);return r?JSON.parse(r.value):null;}}catch(e){}
  try{return JSON.parse(localStorage.getItem(KEY))}catch(e){return null}
}
async function saveStreak(o){
  try{if(window.storage){await window.storage.set(KEY,JSON.stringify(o));return;}}catch(e){}
  try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}
}
/* ---- dn-london-day-v1: streak days are London calendar days. They were UTC
   dates, so a play between midnight and 1 am BST filed under the day before.
   A save written before this change (no tz mark) may hold that UTC date, so
   it is allowed one extra day of gap, once; the next write marks it. ---- */
function today(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(e){return new Date().toISOString().slice(0,10);}}
function dayBefore(s){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
function followsOn(s,t){const y=dayBefore(t);return s.last===y||(!s.tz&&s.last===dayBefore(y));}
async function recordResult(win){
  let s=await store()||{last:null,streak:0,best:0,dates:[]};
  const t=today();
  if((s.dates||[]).includes(t)){refreshStreakUI(s);return;}
  if(win){s.streak=followsOn(s,t)?s.streak+1:1; s.best=Math.max(s.best||0,s.streak);}
  else s.streak=0;
  s.last=t; s.tz="L"; s.dates=[...new Set([...(s.dates||[]),t])].slice(-90);
  await saveStreak(s); refreshStreakUI(s); ranked=false;
}
/* ---- dn-replay-label-v1: "replay" marks a second go at today's puzzle, never
   the first result (recordResult sets ranked=false before the card is filled)
   or a finished puzzle reopened from its save. ---- */
let endRanked=true, replayStarted=false;
function rankLabel(){const show=!ranked&&(replayStarted||!doneGet(P.id));$("#rank").textContent=show?"· replay":"";return show;}
async function initRanked(){
  const s=await store();
  ranked=!(s&&s.dates&&s.dates.includes(today()));
  if(rankLabel())setMsg("Today's result is already in — this is a replay, and nothing is recorded.");
  refreshStreakUI(s);
  restoreDone();
  doneShow();
}
async function refreshStreakUI(s){
  s=s||await store()||{streak:0,best:0};
  $("#streak").textContent=s.streak||0; $("#best").textContent=s.best||0;
}

/* ---- celebration (shared) ---- */
const reduceMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
async function finish(win){
  donePut(P.id,{o:win?"win":"loss",t:$("#timer").textContent,m:mistakes,r:solved.map(g=>g.rank),g:guesses});
  endRanked=ranked;
  if(ranked)await recordResult(win);
  if(win)buzz([12,50,12,50,28]);
  if(win&&!reduceMotion){
    setTimeout(()=>confettiBurst(200),200);
    setTimeout(()=>{confettiBurst(80);showEnd(true);},1200);
  }else setTimeout(()=>showEnd(win),reduceMotion?0:500);
}
function showEnd(win){
  $("#endIcon").className="check"+(win?"":" miss");
  $("#endIcon").textContent=win?"✓":"✕";
  $("#winTitle").textContent=win?"Linked":"So close.";      // "So close." is the tracker's loss title: keep it exact
  $("#winSub").textContent=dnLabel(P.id)+(endRanked?"":" · replay");
  $("#winTime").textContent=dnTime($("#timer").textContent);
  $("#winStreak").textContent=$("#streak").textContent;
  $("#winBest").textContent=$("#best").textContent;
  $("#winNew").textContent=win?"Done":"Play again";
  finishSheet(shareText(),win);
  $("#winModal").classList.add("on");
}
/* ---- the shared finish sheet (engines/finish.js) ---- */
const TICK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function finishSheet(share,win){
  const gs=guesses.filter(x=>Array.isArray(x)&&x.length===4), right=x=>x.every(v=>v===x[0]);
  const hero=document.createElement("div");hero.className="fin-guess";
  hero.setAttribute("role","img");
  hero.setAttribute("aria-label",gs.map(x=>right(x)?P.groups.find(g=>g.rank===x[0]).name:"a miss").join(", "));
  hero.innerHTML=gs.map(x=>right(x)?`<i class="fin-g${x[0]}">${TICK}</i>`:`<i class="fin-gx">${CROSS}</i>`).join("");
  const wrong=gs.filter(x=>!right(x)), found=gs.filter(right).length, count={};
  wrong.forEach(x=>x.forEach(r=>count[r]=(count[r]||0)+1));
  const worst=Object.keys(count).sort((a,b)=>count[b]-count[a])[0];
  const caught=worst?` ${P.groups.find(g=>g.rank===+worst).name} caught you out.`:"";
  const nm=wrong.length, m=nm===1?"one mistake":nm+" mistakes";
  const note=win?(nm?`All four groups with ${m}.${caught}`:"All four groups, no mistakes."):`You found ${found===1?"one group":["no","one","two","three"][found]+" groups"} of four.${caught}`;
  const bands=document.createElement("div");bands.className="fin-bands";
  bands.innerHTML=P.groups.slice().sort((a,b)=>a.rank-b.rank).map(g=>`<div class="fin-band fin-b${g.rank}"><b>${g.name}</b><span>${g.members.join(", ")}</span></div>`).join("");
  let after=null;
  if(!win){after=document.createElement("button");after.type="button";after.className="fin-link";after.textContent="Play again (not recorded)";
    after.addEventListener("click",()=>{window.dnFinish.hide();$("#winModal").classList.remove("on");replayStarted=true;start();rankLabel();doneSync();});}
  window.dnFinish.show({type:"link",id:P.id,n:parseInt(String(P.id).split("·").pop(),10),date:(document.querySelector('meta[name="dn:date"]')||{}).content||"",
    box:"winModal",title:"winTitle",hero,note,share:{text:()=>share},
    stats:[{id:"winTime",label:"time"},{id:"winStreak",label:"day streak"},{id:"winBest",label:"best streak"}],
    recap:{title:"The groups",sub:"Easiest to hardest",node:bands},after});
}
let _cf={cv:null,ctx:null,parts:[],raf:0,W:0,H:0,dpr:1};
function confettiBurst(n){
  if(reduceMotion)return;
  const cv=$("#confetti"); if(!cv||!cv.getContext)return;
  const ctx=cv.getContext("2d"); if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if(!_cf.raf){
    cv.classList.add("on");
    _cf.dpr=dpr; _cf.W=cv.width=innerWidth*dpr; _cf.H=cv.height=innerHeight*dpr;
    cv.style.width=innerWidth+"px"; cv.style.height=innerHeight+"px";
    _cf.cv=cv; _cf.ctx=ctx; _cf.parts.length=0;
  }
  const d=_cf.dpr, cols=["#2E5BFF","#FFD54A","#1F9E6B","#1B3B9E","#ffffff"];
  const rect=$("#board").getBoundingClientRect();
  const ox=(rect.left+rect.width/2)*d, oy=(rect.top+rect.height*0.42)*d;
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2, sp=(4+Math.random()*9)*d;
    _cf.parts.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-8*d,g:.16*d,
      w:(5+Math.random()*6)*d,rot:Math.random()*6.28,vr:(-.35+Math.random()*.7),
      col:cols[i%cols.length],life:0,max:110+Math.random()*70});}
  if(!_cf.raf)confettiLoop();
}
function confettiLoop(){
  const {ctx,W,H}=_cf; ctx.clearRect(0,0,W,H); let alive=false;
  for(const p of _cf.parts){ if(p.life>p.max)continue; alive=true;
    p.life++; p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr;
    ctx.save(); ctx.globalAlpha=Math.max(0,1-p.life/p.max);
    ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.col;
    ctx.fillRect(-p.w/2,-p.w/2,p.w,p.w*0.6); ctx.restore(); }
  if(alive){_cf.raf=requestAnimationFrame(confettiLoop);}
  else{_cf.raf=0; _cf.parts.length=0; ctx.clearRect(0,0,W,H); _cf.cv.classList.remove("on");}
}
const GLYPH={1:"🟩",2:"🟦",3:"🟨",4:"⬛"};
function shareText(){
  return dnLink(guesses,won,$("#timer").textContent,$("#streak").textContent,P.id);
}
$("#winShare").onclick=async()=>{
  const b=$("#winShare"), txt=shareText();
  if(typeof doneCopy==="function"){doneCopy(txt,b);return;}
  try{await navigator.clipboard.writeText(txt);b.textContent="Copied ✓";}
  catch(_){
    /* clipboard blocked (insecure context, iOS webview) — fall back to a
       selectable prompt rather than telling the person it can't be done */
    try{
      const ta=document.createElement("textarea");
      ta.value=txt; ta.style.cssText="position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta); ta.select();
      const ok=document.execCommand&&document.execCommand("copy");
      document.body.removeChild(ta);
      b.textContent=ok?"Copied ✓":"Copy unavailable";
    }catch(e){b.textContent="Copy unavailable";}
  }
  setTimeout(()=>b.textContent="Share result",1600);
};
$("#winNew").onclick=()=>{$("#winModal").classList.remove("on"); if(!won){replayStarted=true;start();rankLabel();}};
$("#winModal").addEventListener("click",e=>{if(e.target===$("#winModal"))$("#winModal").classList.remove("on");});

/* ---- controls ---- */
$("#shuffle").onclick=()=>{shuffle(live);render();};
$("#clear").onclick=()=>{sel.clear();setMsg("");render();};
$("#submit").onclick=submit;
addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!$("#submit").disabled){e.preventDefault();submit();}
  if(e.key==="Escape"){sel.clear();render();}
});

/* ---- start ---- */
function start(){
  live=shuffle(P.groups.flatMap(g=>g.members.map(m=>m.toUpperCase())));
  _fitKey="";_unitW=0;_unitH=0;
  sel.clear(); solved=[]; mistakes=0; over=false; won=false; guesses=[]; tried=new Set(); busy=false; newBand=null;
  $("#pid").textContent=dnLabel(P.id); $("#pband").textContent=P.band;
  setMsg(""); render(); stopTimer(); t0=0; $("#timer").textContent="00:00";
  if(replayStarted)startTimer();   // replays open straight on the board, without a start card
}
/* ---- digi-done-v1: a finished puzzle reopens finished (digi-link-v1 → done[id]) ---- */
const DONE_KEY="digi-link-v1";
function doneGet(id){try{const s=JSON.parse(localStorage.getItem(DONE_KEY)||"null");return (s&&s.v===1&&s.done&&s.done[id])||null;}catch(e){return null;}}
function donePut(id,rec){try{let s=JSON.parse(localStorage.getItem(DONE_KEY)||"null");if(!s||s.v!==1||!s.done||typeof s.done!=="object")s={v:1,done:{}};if(s.done[id])return;rec.d=today();s.done[id]=rec;localStorage.setItem(DONE_KEY,JSON.stringify(s));}catch(e){}doneShow();}
let doneTried=false;
/* ---- digi-done-share-v1: the day's saved result stays shareable after a revisit ---- */
function doneId(){return P.id;}
function doneMMSS(s){s=Math.max(0,Math.min(359999,Math.floor(+s)||0));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
function doneUI(id){const e=document.getElementById(id);return (e&&e.textContent)||"0";}
/* ---- digi-share-v2: one-line emoji share text ---- */
function dnLabel(id){var s=String(id),m=s.match(/·(\d+)$/),n=m?parseInt(m[1],10):NaN;if(isNaN(n)){var h=document.querySelector('meta[name="dn:headline"]'),k=h&&String(h.content).match(/(\d+)\s*$/);n=k?parseInt(k[1],10):NaN;}var t={MINI:"Mini",LEXI:"Doku",SWEEP:"Sweep",PATH:"Path",LINK:"Link",BORD:"Borders",TANG:"Tangle"}[s.split("·")[1]]||"";return isNaN(n)?s:(t?t+" "+n:String(n));}
function dnNum(id){const n=parseInt(String(id).split("·").pop(),10);return isNaN(n)?"":"#"+n;}
function dnTime(t){return String(t||"").trim().replace(/^0+(\d)/,"$1");}
function dnStreak(n){n=parseInt(String(n||"").replace(/\D/g,""),10)||0;return n>=2?" · 🔥"+n:"";}
function dnLinkRow(g){return (Array.isArray(g)?g:[]).filter(x=>Array.isArray(x)&&x.length===4).map(x=>x.every(v=>v===x[0])&&GLYPH[x[0]]?GLYPH[x[0]]:"❌").join("");}
function dnLink(g,won,t,streak,id){return "🔗 Link "+dnNum(id)+" — "+dnLinkRow(g)+(won?" · "+dnTime(t):"")+(won?dnStreak(streak):"");}
function doneText(rec){const t=(/^\d{1,4}:\d{2}$/.test(String(rec.t))?String(rec.t):null)||"00:00";return dnLink(rec.g,rec.o==="win",t,doneUI("streak"),doneId());}
function doneCopy(txt,b){
  const said=t=>{b.textContent=t;setTimeout(()=>{b.textContent="Share result";},1600);};
  const fallback=()=>{try{const ta=document.createElement("textarea");ta.value=txt;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;top:0;left:0;opacity:0";document.body.appendChild(ta);ta.select();const ok=document.execCommand&&document.execCommand("copy");document.body.removeChild(ta);said(ok?"Copied ✓":"Copy unavailable");}catch(e){said("Copy unavailable");}};
  const coarse=!!(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches);
  if(coarse&&navigator.share){try{navigator.share({text:txt}).catch(e=>{if(!e||e.name!=="AbortError")fallback();});return;}catch(e){}}
  try{navigator.clipboard.writeText(txt).then(()=>said("Copied ✓"),fallback);}catch(e){fallback();}
}
function doneShow(){
  const id=doneId(); if(!doneGet(id))return;
  try{document.documentElement.setAttribute("data-dn-done","");}catch(e){}
  if(!document.getElementById("shareAgain")){
    const host=document.querySelector(".controls"); if(!host)return;
    const b=document.createElement("button"); b.type="button"; b.id="shareAgain"; b.className="primary"; b.textContent="Share result";
    b.addEventListener("click",()=>{const r=doneGet(id); if(r)doneCopy(doneText(r),b);});
    host.insertBefore(b,host.firstChild);
  }
  doneSync();
}
/* Link's controls row is one fixed line: while the board is over, Share takes
   the place of Shuffle / Deselect / Submit; a replay brings them back. */
function doneSync(){const sh=document.getElementById("shareAgain");if(!sh)return;const on=!!over;sh.style.display=on?"":"none";for(const k of ["shuffle","clear","submit"]){const e=document.getElementById(k);if(e)e.style.display=on?"none":"";}}
function restoreDone(){
  if(doneTried)return; doneTried=true;
  const rec=doneGet(P.id); if(!rec||!/^(win|loss)$/.test(rec.o)||!Array.isArray(rec.r))return;
  const order=rec.r.map(k=>P.groups.find(g=>g.rank===k));
  if(order.length!==P.groups.length||order.some(g=>!g)||new Set(order).size!==order.length)return;
  const t=(/^\d{1,4}:\d{2}$/.test(String(rec.t))?String(rec.t):null)||"00:00";
  solved=order; live=[]; sel.clear(); busy=false; newBand=null;
  mistakes=Math.max(0,Math.min(MAX_MISTAKES,Math.floor(+rec.m)||0));
  guesses=Array.isArray(rec.g)?rec.g.filter(x=>Array.isArray(x)&&x.every(v=>GLYPH[v])):[];
  over=true; won=rec.o==="win";
  clearInterval(tick); $("#timer").textContent=t;
  render();
  if(won)setMsg("Linked in "+t+(mistakes?" · "+mistakes+" mistake"+(mistakes>1?"s":""):" · perfect"));
  else setMsg("Out of mistakes — here's the rest");
  // reopen on the finish sheet (no "on": the tracker logged this finish the first time)
  $("#winTitle").textContent=won?"Linked":"So close.";
  $("#winTime").textContent=dnTime(t);$("#winStreak").textContent=$("#streak").textContent;$("#winBest").textContent=$("#best").textContent;
  finishSheet(doneText(rec),won);
}
start();
initRanked();
