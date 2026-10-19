/* Digi Puzzles — sweep engine. One copy serves every sweep page in reports/.
   Extracted 2026-10-15 from 2027-08-16-logic-sweep.html by tools/engine-shells.js.
   The page supplies its puzzle as window.DN_PUZZLE before loading this file.
   Edit here to change every sweep; keep element ids and localStorage keys
   stable (dn-track.js and players' saved progress depend on them). */
/* the shared finish sheet (engines/finish.js): calls made before it loads are queued */
window.dnFinish=window.dnFinish||{q:[],show(c){this.q.push(c)},hide(){}};
document.write('<link rel="stylesheet" href="../engines/finish.css"><link rel="stylesheet" href="../engines/house.css"><script src="../engines/finish.js"><\/script><script src="../engines/house.js"><\/script>');

/* ================= The Digi Sweep engine (gate only) ===============
   The GENERATOR does not ship. This file cannot mint a puzzle — it can only
   prove the one it carries. produceSweep() lives in tools/build-sweep-batch.js
   and runs at build time; what travels to the player is the pair of proofs:
   a brute-force uniqueness enumerator and a deduction-only prover, plus
   deduceStep(), which Hint reuses. A player who cannot reroll has a streak
   that means something. */
const N=6, CELLS=36;
const ix=(r,c)=>r*N+c, rc=i=>[Math.floor(i/N),i%N];
const NB=Array.from({length:CELLS},(_,i)=>{const [r,c]=rc(i),o=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const y=r+dr,x=c+dc;
    if(y>=0&&y<N&&x>=0&&x<N)o.push(ix(y,x));}return o;});

/* One band. Medium is the only band, so there is no band table and no knob:
   seven mines in thirty-six squares, every day. Difficulty now comes from
   SELECTION — the build scans thousands of seeds, scores each passing grid
   by how much deduction it demands, and spends the best ones on the days.
   A dial you can turn is a weaker instrument than a pool you can choose from.

   Board size is 6x6 as of shell v7. 5x5 was measured as too short: ~16
   decisions and a ~1.5 min run. 6x6 lands ~21 decisions at ~2-3 min, keeps
   cells at ~52px (above the 48px house target) and — critically — keeps
   countSolutions() below 60ms at load. 7x7 was rejected on that last count
   (2.5s in Node, seconds more on a phone) and 8x8 on yield: one passing
   grid in 60,000 seeds. See typespec v3. */
const BAND={mines:7};
function counts(ms){const n=Array(CELLS).fill(0);
  for(let i=0;i<CELLS;i++){if(ms.has(i)){n[i]=-1;continue;}n[i]=NB[i].filter(j=>ms.has(j)).length;}return n;}
function cascade(start,n){const seen=new Set([start]),q=[start];
  while(q.length){const i=q.pop(); if(n[i]!==0)continue;
    for(const j of NB[i])if(!seen.has(j)){seen.add(j);if(n[j]===0)q.push(j);}}
  return seen;}

/* One step of deduction from a given view. Powers both the prover and Hint. */
function deduceStep(revealed,flagged,n,total,useSubset){
  const cons=[];
  for(const i of revealed){
    const hid=NB[i].filter(j=>!revealed.has(j)&&!flagged.has(j));
    const fl=NB[i].filter(j=>flagged.has(j)).length;
    if(hid.length)cons.push({cells:new Set(hid),n:n[i]-fl});
  }
  const allHid=[];for(let i=0;i<CELLS;i++)if(!revealed.has(i)&&!flagged.has(i))allHid.push(i);
  if(allHid.length)cons.push({cells:new Set(allHid),n:total-flagged.size});
  const safe=new Set(),mine=new Set();
  const trivial=cs=>{for(const c of cs){
    if(c.n===0)c.cells.forEach(x=>safe.add(x));
    else if(c.n===c.cells.size)c.cells.forEach(x=>mine.add(x));}};
  trivial(cons);
  let usedSubset=false;
  if(useSubset&&!safe.size&&!mine.size){
    const derived=[];
    for(const A of cons)for(const B of cons){
      if(A===B||A.cells.size>=B.cells.size)continue;
      let sub=true;for(const x of A.cells)if(!B.cells.has(x)){sub=false;break;}
      if(!sub)continue;
      const diff=new Set([...B.cells].filter(x=>!A.cells.has(x)));
      if(diff.size)derived.push({cells:diff,n:B.n-A.n});
    }
    trivial(derived);
    if(safe.size||mine.size)usedSubset=true;
  }
  return {safe:[...safe],mine:[...mine],usedSubset};
}
/* GATE 1 — deduction-only prover. No guessing, ever. */
function solveNoGuess(ms,opening,n,useSubset){
  const revealed=new Set(opening),flagged=new Set(),total=ms.size,safeCount=CELLS-total;
  let usedSubset=false,progress=true;
  while(progress){
    progress=false;
    const d=deduceStep(revealed,flagged,n,total,useSubset);
    if(d.usedSubset)usedSubset=true;
    for(const x of d.mine)if(!flagged.has(x)){flagged.add(x);progress=true;}
    for(const x of d.safe){
      if(revealed.has(x)||flagged.has(x))continue;
      if(ms.has(x))return {ok:false};
      for(const y of cascade(x,n))revealed.add(y);
      progress=true;
    }
    if(revealed.size===safeCount)return {ok:true,usedSubset};
  }
  return {ok:false,usedSubset};
}
/* GATE 2 — independent uniqueness proof: brute-force every mine placement
   consistent with the opening view. Exactly one must survive. */
function countSolutions(opening,n,total,cap=2){
  const hidden=[];for(let i=0;i<CELLS;i++)if(!opening.has(i))hidden.push(i);
  const rev=[...opening],pick=[];let found=0;
  (function rec(start,left){
    if(found>=cap)return;
    if(left===0){const ms=new Set(pick);
      for(const i of rev)if(NB[i].filter(j=>ms.has(j)).length!==n[i])return;
      found++;return;}
    for(let k=start;k<=hidden.length-left;k++){pick.push(hidden[k]);rec(k+1,left-1);pick.pop();if(found>=cap)return;}
  })(0,total);
  return found;
}
function validateSweep(mines,start){
  const ms=new Set(mines.map(([r,c])=>ix(r,c))),st=ix(start[0],start[1]);
  const n=counts(ms),c={};
  c.mine_count=ms.size===BAND.mines;
  c.no_mine_on_opening=!ms.has(st);
  c.opening_is_zero=n[st]===0;
  const opening=c.opening_is_zero?cascade(st,n):new Set([st]);
  /* proportional, not absolute: >=40% of the safe squares still hidden.
     Identical to v6 at 5x5 (ceil(20*0.4)=8), and scales with the board. */
  c.opening_leaves_work=(CELLS-ms.size)-opening.size>=Math.ceil((CELLS-ms.size)*0.4);
  c.unique_solution=countSolutions(opening,n,ms.size)===1;
  c.solvable_without_guessing=solveNoGuess(ms,opening,n,true).ok;
  const pass=Object.values(c).every(Boolean);
  return {pass,checks:c,opening,n,meta:{opening:opening.size,hidden:CELLS-opening.size}};
}
/* ================= The shipped puzzle ==============================
   PLACEHOLDER — build-sweep-batch.js overwrites this block per day.
   Top of the 6x6 pool: score 184 (rounds 14, subsetUses 1, opening 17,
   hidden 19). Pool: 154 D4-distinct passing grids from 54,156 seeds.
   `grid` exists for the Digi News feed tile: "." = an ordinary square,
   "o" = the free opening. It is the SHAPE only — no mine ever appears in it,
   so a card cannot spoil its own puzzle. (One new mask char: "o".)
   Coordinates below are 1-indexed [row,col], as the grid reads. */
const SAMPLE=window.DN_PUZZLE;

const FLAG_SVG=`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M7.6 3.4v17.2" stroke="#141726" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M9 5.1 19.4 8.9 9 12.7Z" fill="#1B3B9E"/>
  <path d="M9 3.8 19.4 7.6 9 11.4Z" fill="#2E5BFF" stroke="rgba(255,255,255,.35)" stroke-width=".7" stroke-linejoin="round"/>
</svg>`;
const MINE_SVG=`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <g stroke="#fff" stroke-width="2.1" stroke-linecap="round">
    <path d="M12 2.8v18.4M2.8 12h18.4M5.5 5.5l13 13M18.5 5.5l-13 13"/></g>
  <circle cx="12" cy="12" r="5.1" fill="#fff"/><circle cx="10.2" cy="10.2" r="1.5" fill="#141726"/>
</svg>`;

/* ================= The Digi Sweep player =========================== */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let usedHints=0;   // for the finish sheet's one line
let P=null,revealed=null,flagged=null,boomed=null,NUM=null,MS=null;
let started=false,tHandle=null,seconds=0,over=false,won=false,flagMode=false,flagCheck=true;
/* ranked = today's result is not yet on the books. A loss sticks; everything
   after it today is a replay that records nothing. */
let ranked=true;
/* startDug = the one required first move hasn't happened yet. Nothing else
   on the board responds until it does — the proof only guarantees deduction
   from THIS cell forward, not from wherever a player happens to tap. */
let startDug=false, STARTIX=-1;
/* clean-tap tests won't catch this: real touch hardware jitters a few px
   between pointerdown/up even on a "still" tap. Tolerate it so digs and
   long-press flags don't get silently cancelled. */
const MOVE_TOL=10;

let curSrc=SAMPLE;
function load(pz){
  curSrc=pz;
  const mines=pz.mines.map(([r,c])=>[r-1,c-1]), start=[pz.start[0]-1,pz.start[1]-1];
  /* ---- the gate, at load: a puzzle that failed cannot render ---- */
  const v=validateSweep(mines,start);
  if(!v.pass){
    document.querySelector("main").innerHTML=
      '<div class="rules" style="color:var(--bad)"><b>Refused to render.</b> This puzzle did not pass the ship gate: '+
      Object.keys(v.checks).filter(k=>!v.checks[k]).join(", ")+'.</div>';
    return;
  }
  P={...pz,mines,start,opening:v.opening};
  MS=new Set(mines.map(([r,c])=>ix(r,c)));
  NUM=v.n;
  STARTIX=ix(P.start[0],P.start[1]);
  startDug=false;
  /* Nothing is pre-revealed. The opening is earned by digging the start
     cell — that's the player's one required first move. */
  revealed=new Set(); flagged=new Set(); boomed=new Set();
  over=false; won=false; started=false; seconds=0; stopTimer(); renderTime();
  document.body.classList.remove("win");
  $("#winModal").classList.remove("on"); $("#grid").classList.remove("celebrate");
  $("#pid").textContent=dnLabel(P.id); $("#pband").textContent=P.band;
  buildGrid(); paint(); refreshStreakUI(); initRanked();
  $("#msg").textContent="Tap the highlighted cell to begin — it's proven safe.";
  scheduleFit();
}
function buildGrid(){
  const g=$("#grid"); g.innerHTML="";
  for(let i=0;i<CELLS;i++){
    const [r,c]=rc(i);
    const cell=document.createElement("div");
    cell.className="cell"; cell.dataset.i=i; cell.setAttribute("role","gridcell");
    if(i===ix(P.start[0],P.start[1]))cell.classList.add("start");
    cell.insertAdjacentHTML("beforeend",'<span class="val"></span><span class="gl"></span>');
    /* tap = dig (or flag in flag mode); long-press / right-click = flag.
       MOVE_TOL tolerates incidental jitter between down/up on real touch
       hardware — only a move past the tolerance cancels the gesture. */
    let lp=null,moved=false,sx=0,sy=0;
    cell.addEventListener("contextmenu",e=>{e.preventDefault();toggleFlag(i);});
    cell.addEventListener("pointerdown",e=>{
      moved=false; sx=e.clientX; sy=e.clientY;
      lp=setTimeout(()=>{lp=null;moved=true;toggleFlag(i);},350);
    });
    cell.addEventListener("pointermove",e=>{
      if(!lp)return;
      if(Math.hypot(e.clientX-sx,e.clientY-sy)>MOVE_TOL){clearTimeout(lp);lp=null;moved=true;}
    });
    cell.addEventListener("pointercancel",()=>{if(lp){clearTimeout(lp);lp=null;}});
    cell.addEventListener("pointerup",()=>{
      if(lp){clearTimeout(lp);lp=null; if(!moved){flagMode?toggleFlag(i):dig(i);} }
    });
    g.appendChild(cell);
  }
}
function paint(){
  const known=i=>flagged.has(i)||boomed.has(i);          // squares the player calls "mine"
  $$("#grid .cell").forEach(cell=>{
    const i=+cell.dataset.i, v=cell.querySelector(".val"), g=cell.querySelector(".gl");
    cell.classList.remove("hid","open","flag","boom","locked");
    v.textContent=""; v.className="val"; v.removeAttribute("data-n"); g.innerHTML="";
    if(boomed.has(i)){cell.classList.add("boom");g.innerHTML=MINE_SVG;}
    else if(revealed.has(i)){
      cell.classList.add("open");
      if(NUM[i]>0){
        v.textContent=NUM[i]; v.setAttribute("data-n",NUM[i]);
        // it cannot touch more mines than it says. If it does, that is not a
        // hint — it is the board reading itself back to you.
        if(flagCheck && NB[i].filter(known).length>NUM[i])v.classList.add("over");
      }
    }
    else if(flagged.has(i)){cell.classList.add("flag");g.innerHTML=FLAG_SVG;}
    else{
      cell.classList.add("hid");
      cell.classList.toggle("locked",!startDug&&i!==STARTIX);
    }
  });
  /* Never clamp this. A counter that cannot go negative cannot tell you that
     you have laid more flags than there are mines — which is exactly the
     moment you most need telling. */
  const left=MS.size-flagged.size-boomed.size;
  const mb=$("#mleft"); mb.textContent=left; mb.classList.toggle("neg",left<0);
  $("#modeDig").classList.toggle("on",!flagMode);
  $("#modeDig").setAttribute("aria-pressed",String(!flagMode));
  $("#modeFlag").classList.toggle("on",flagMode);
  $("#modeFlag").setAttribute("aria-pressed",String(flagMode));
}
function toggleFlag(i){
  if(!startDug)return;   // nothing else responds until the safe start is dug
  if(over||revealed.has(i)||boomed.has(i))return;
  startTimer();
  flagged.has(i)?flagged.delete(i):flagged.add(i);
  paint(); nudge();
}
/* The one dead end this type has: every square called, but a flag parked on a
   safe square — so it never gets dug and the win never fires. Name it. */
function nudge(){
  if(over)return;
  const called=revealed.size+flagged.size+boomed.size;
  if(called===CELLS && revealed.size!==CELLS-MS.size){
    $("#msg").innerHTML=`All ${CELLS} squares called, but the sweep isn't done — a flag is sitting on a safe square. The counter reads <b>${MS.size-flagged.size-boomed.size}</b>.`;
  }
}
/* Digging a mine ends it. The grid is proved guess-free, so a mine was never
   bad luck — it was always a step you hadn't found. That is exactly why the
   loss is allowed to count. */
async function dig(i){
  if(over||revealed.has(i)||flagged.has(i)||boomed.has(i))return;
  if(!startDug){
    if(i!==STARTIX)return;   // every other cell is locked until this one is dug
    startDug=true;
    startTimer();
    for(const y of P.opening)revealed.add(y);
    $("#msg").textContent="";
    paint(); checkWin(); nudge();
    return;
  }
  startTimer();
  if(MS.has(i))return lose(i);
  for(const y of cascade(i,NUM))revealed.add(y);
  paint(); checkWin(); nudge();
}
async function lose(i){
  over=true; won=false; boomed.add(i); stopTimer(); donePut(P.id,{o:"loss",s:seconds,b:i});
  for(const m of MS)if(m!==i)flagged.add(m);      // show where the others were
  for(let k=0;k<CELLS;k++)if(!MS.has(k))revealed.add(k);
  flagCheck=false; paint();
  endRanked=ranked;
  if(ranked){await recordResult(false);
    $("#msg").innerHTML=`That was a mine. The grid never needed a guess — the step was there.`;}
  else $("#msg").innerHTML=`That was a mine. Replay — nothing recorded.`;
  showEnd(false);
}
$("#modeDig").onclick=()=>{flagMode=false;paint();};
$("#modeFlag").onclick=()=>{flagMode=true;paint();};
/* Hint reuses the prover: it doesn't peek at the mines, it finds the next
   step you could have found — from what's on your board right now. */
$("#hint").onclick=()=>{
  if(!over)usedHints++;
  if(over)return;
  const d=deduceStep(revealed,flagged,NUM,MS.size,true);
  const safe=d.safe.filter(x=>!revealed.has(x)&&!flagged.has(x));
  const mine=d.mine.filter(x=>!flagged.has(x)&&!boomed.has(x));
  const pick=safe.length?safe[0]:(mine.length?mine[0]:null);
  if(pick===null){$("#msg").textContent="Nothing new is deducible from the board as it stands — check your flags.";return;}
  const cell=$(`#grid .cell[data-i="${pick}"]`);
  cell.classList.remove("hint"); void cell.offsetWidth; cell.classList.add("hint");
  $("#msg").innerHTML=safe.length?"This one is provably <b>safe</b>.":"This one is provably a <b>mine</b>.";
  setTimeout(()=>cell.classList.remove("hint"),2400);
};
$("#revealAll").onclick=async()=>{
  if(ranked){await recordResult(false);$("#rank").textContent="· replay";}  // giving up is a result
  startTimer(); over=true; stopTimer(); donePut(P.id,{o:"gave",s:seconds});
  for(let i=0;i<CELLS;i++){if(MS.has(i))flagged.add(i);else revealed.add(i);}
  flagCheck=false; paint();
  $("#msg").innerHTML="Revealed. The five were always findable.";
};
$("#reset").onclick=()=>load(curSrc);
document.addEventListener("keydown",e=>{if(e.key==="f"||e.key==="F"){flagMode=!flagMode;paint();}});

/* ---- timer (shared) ---- */
function startTimer(){if(started||over)return;started=true;tHandle=setInterval(()=>{seconds++;renderTime();},1000);}
function stopTimer(){if(tHandle)clearInterval(tHandle);tHandle=null;}
function renderTime(){const m=String(Math.floor(seconds/60)).padStart(2,"0"),s=String(seconds%60).padStart(2,"0");$("#timer").textContent=`${m}:${s}`;}

/* ---- win + streak (shared) ---- */
async function checkWin(){
  if(over)return;
  if(revealed.size!==CELLS-MS.size)return;
  over=true; won=true; stopTimer(); donePut(P.id,{o:"win",s:seconds});
  for(const i of MS)flagged.add(i);
  paint();
  $("#msg").innerHTML=`Swept in <b>${$("#timer").textContent}</b>.${ranked?" Nice.":" Replay — nothing recorded."}`;
  document.body.classList.add("win");
  endRanked=ranked;
  if(ranked)await recordResult(true);
  celebrate();
}
async function store(get){
  const KEY="digi-sweep-streak";
  try{if(window.storage&&get){const r=await window.storage.get(KEY);return r?JSON.parse(r.value):null;}}catch(e){}
  if(get){try{return JSON.parse(localStorage.getItem(KEY))}catch(e){return null}}
  return null;
}
async function saveStreak(o){
  const KEY="digi-sweep-streak";
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
  let s=await store(true)||{last:null,streak:0,best:0,dates:[]};
  const t=today();
  if(s.dates.includes(t)){refreshStreakUI(s);return;}   // today is already on the books
  if(win){s.streak=followsOn(s,t)?s.streak+1:1; s.best=Math.max(s.best,s.streak);}
  else s.streak=0;                                       // a loss ends the run
  s.last=t; s.tz="L"; s.dates=[...new Set([...(s.dates||[]),t])].slice(-90);
  await saveStreak(s); refreshStreakUI(s); ranked=false;
}
/* One ranked go per day. If today already has a result, say so plainly
   rather than pretending the replay counts. */
/* ---- dn-replay-label-v1: "replay" marks a second go at today's puzzle, never
   the first result (recordResult sets ranked=false before the card is filled)
   or a finished puzzle reopened from its save. ---- */
let endRanked=true, replayStarted=false;
function rankLabel(){const show=!ranked&&(replayStarted||!doneGet(P.id));$("#rank").textContent=show?"· replay":"";return show;}
async function initRanked(){
  const s=await store(true);
  ranked=!(s&&s.dates&&s.dates.includes(today()));
  if(rankLabel())$("#msg").textContent="Today's result is already in — this is a replay, and nothing is recorded.";
  restoreDone();
  doneShow();
}
async function refreshStreakUI(s){
  s=s||await store(true)||{streak:0,best:0};
  $("#streak").textContent=s.streak||0; $("#best").textContent=s.best||0;
}

/* ---- flag check toggle (the Doku's hints toggle, same seam) ---- */
$("#flagCheck").onclick=()=>{
  flagCheck=!flagCheck;
  $("#flagCheck").textContent="Flag check: "+(flagCheck?"on":"off");
  $("#flagCheck").setAttribute("aria-pressed",String(flagCheck));
  paint();
};

/* ---- celebration (shared) ---- */
const reduceMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
function showEnd(win){
  $("#endIcon").className="check"+(win?"":" miss");
  $("#endIcon").textContent=win?"✓":"✕";
  $("#winTitle").textContent=win?"Swept":"Boom.";      // "Boom." is the tracker's loss title: keep it exact
  $("#winSub").textContent=`${dnLabel(P.id)}${endRanked?"":" · replay"}`;
  $("#winTime").textContent=dnTime($("#timer").textContent);
  $("#winStreak").textContent=$("#streak").textContent;
  $("#winBest").textContent=$("#best").textContent;
  $("#winNew").textContent=win?"Done":"Play again";
  finishSheet(win?"win":"loss",true);
  $("#winModal").classList.add("on");
}
/* ---- the shared finish sheet (engines/finish.js) ---- */
function finishSheet(o,fresh){
  const W=["no","one","two","three","four","five","six","seven","eight","nine","ten"],m=W[MS.size]||MS.size;
  let note=o==="win"?(fresh?`All ${m} mines found, ${usedHints?(usedHints===1?"with one hint":`with ${W[usedHints]||usedHints} hints`):"no hints"}.`:`All ${m} mines found.`)
    :"That was a mine. The grid never needed a guess; the step was there to find.";
  let played=0;try{const s=JSON.parse(localStorage.getItem(DONE_KEY)||"null");played=s&&s.done?Object.keys(s.done).length:0;}catch(e){}
  const FLAG='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 14V2M4 2.5l8 2.8-8 2.9" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const g=document.createElement("div");g.className="fin-grid g6 sw";
  let h="";for(let k=0;k<CELLS;k++){
    if(MS.has(k))h+=boomed.has(k)?'<i class="boom" aria-label="the mine you hit">✕</i>':`<i class="flag" aria-label="mine">${FLAG}</i>`;
    else{const v=NUM[k];h+=`<i class="n${v}">${v||""}</i>`;}
  }
  g.innerHTML=h;
  let after=null;
  if(o!=="win"){after=document.createElement("button");after.type="button";after.className="fin-link";after.textContent="Play again (not recorded)";
    after.addEventListener("click",()=>{window.dnFinish.hide();$("#winModal").classList.remove("on");replayStarted=true;load(curSrc);});}
  window.dnFinish.show({type:"sweep",id:P.id,n:parseInt(((document.querySelector('meta[name="dn:headline"]')||{}).content||"").replace(/\D+/g,""),10)||"",
    date:(document.querySelector('meta[name="dn:date"]')||{}).content||"",
    box:"winModal",title:"winTitle",hero:"winTime",note,
    share:{text:()=>dnSweep(o,$("#timer").textContent,$("#streak").textContent,P.id)},
    stats:[{id:"winStreak",label:"day streak"},{id:"winBest",label:"best streak"},{value:played,label:"Sweeps played"}],
    recap:{title:"The board",node:g},after});
}
function celebrate(){
  if(reduceMotion){showEnd(true);return;}
  const g=$("#grid"); g.classList.add("celebrate");
  $$("#grid .cell").forEach(cell=>{const [r,c]=rc(+cell.dataset.i);cell.style.animationDelay=((r+c)*90)+"ms";});
  setTimeout(()=>{g.classList.remove("celebrate");$$("#grid .cell").forEach(c=>c.style.animationDelay="");},1900);
  setTimeout(()=>confettiBurst(200),350);
  setTimeout(()=>{confettiBurst(80);showEnd(true);},1450);
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
  const rect=$("#grid").getBoundingClientRect();
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
$("#winShare").onclick=async()=>{
  const txt=dnSweep(won?"win":"loss",$("#timer").textContent,$("#streak").textContent,P.id);
  doneCopy(txt,$("#winShare"));
};
$("#winNew").onclick=()=>{$("#winModal").classList.remove("on"); if(!won){replayStarted=true;load(curSrc);}};
$("#winModal").addEventListener("click",e=>{if(e.target===$("#winModal"))$("#winModal").classList.remove("on");});

/* ---- app mode (shared) ---- */
function fitGrid(){
  if(!document.documentElement.classList.contains("app-mode"))return;
  const wrap=document.querySelector(".gridwrap"),g=$("#grid");
  if(!wrap||!g)return;
  const side=Math.max(0,Math.floor(Math.min(wrap.clientWidth,wrap.clientHeight)));
  if(side>0){g.style.setProperty("--side",side+"px");g.style.setProperty("--cell",(side/5)+"px");}
}
let _fitRAF=0;
function scheduleFit(){
  if(!("requestAnimationFrame" in window)){fitGrid();return;}
  cancelAnimationFrame(_fitRAF);
  _fitRAF=requestAnimationFrame(()=>requestAnimationFrame(fitGrid));
}
(function(){
  const btn=$("#fs"),root=document.documentElement;
  if(!btn)return;
  const req=root.requestFullscreen||root.webkitRequestFullscreen;
  if(!req){btn.style.display="none";return;}
  btn.onclick=()=>{
    const on=document.fullscreenElement||document.webkitFullscreenElement;
    if(on)(document.exitFullscreen||document.webkitExitFullscreen).call(document);
    else req.call(root);
  };
  document.addEventListener("fullscreenchange",scheduleFit);
  document.addEventListener("webkitfullscreenchange",scheduleFit);
})();
const APPMODE=!!(window.matchMedia&&window.matchMedia("(pointer:coarse) and (hover:none)").matches);
function initAppMode(){
  if(!APPMODE)return;
  document.documentElement.classList.add("app-mode");
  addEventListener("resize",scheduleFit);
  addEventListener("orientationchange",scheduleFit);
  if(window.visualViewport)visualViewport.addEventListener("resize",scheduleFit);
  scheduleFit();
}
initAppMode();
/* ---- digi-done-v1: a finished puzzle reopens finished (digi-sweep-v1 → done[id]) ---- */
const DONE_KEY="digi-sweep-v1";
function doneGet(id){try{const s=JSON.parse(localStorage.getItem(DONE_KEY)||"null");return (s&&s.v===1&&s.done&&s.done[id])||null;}catch(e){return null;}}
function donePut(id,rec){try{let s=JSON.parse(localStorage.getItem(DONE_KEY)||"null");if(!s||s.v!==1||!s.done||typeof s.done!=="object")s={v:1,done:{}};if(s.done[id])return;rec.d=today();s.done[id]=rec;localStorage.setItem(DONE_KEY,JSON.stringify(s));}catch(e){}doneShow();}
let doneTried=false;
/* ---- digi-done-share-v1: the day's saved result stays shareable after a revisit ---- */
function doneId(){return SAMPLE.id;}
function doneMMSS(s){s=Math.max(0,Math.min(359999,Math.floor(+s)||0));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
function doneUI(id){const e=document.getElementById(id);return (e&&e.textContent)||"0";}
/* ---- digi-share-v2: one-line emoji share text ---- */
function dnLabel(id){var s=String(id),m=s.match(/·(\d+)$/),n=m?parseInt(m[1],10):NaN;if(isNaN(n)){var h=document.querySelector('meta[name="dn:headline"]'),k=h&&String(h.content).match(/(\d+)\s*$/);n=k?parseInt(k[1],10):NaN;}var t={MINI:"Mini",LEXI:"Doku",SWEEP:"Sweep",PATH:"Path",LINK:"Link",BORD:"Borders",TANG:"Tangle"}[s.split("·")[1]]||"";return isNaN(n)?s:(t?t+" "+n:String(n));}
function dnNum(id){const n=parseInt(String(id).split("·").pop(),10);return isNaN(n)?"":"#"+n;}
function dnTime(t){return String(t||"").trim().replace(/^0+(\d)/,"$1");}
function dnStreak(n){n=parseInt(String(n||"").replace(/\D/g,""),10)||0;return n>=2?" · 🔥"+n:"";}
function dnSweepDay(id){const m=String(id).match(/(\d{4})-(\d{2})-(\d{2})/);return m?(+m[3])+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m[2]-1]:dnNum(id);}
function dnSweep(o,t,streak,id){const d=dnSweepDay(id);return o==="win"?"💣 Sweep "+d+" — swept in "+dnTime(t)+dnStreak(streak):o==="loss"?"💥 Sweep "+d+" — boom":"💣 Sweep "+d+" — revealed";}
function doneText(rec){return dnSweep(rec.o==="win"?"win":rec.o==="loss"?"loss":"gave",doneMMSS(rec.s),doneUI("streak"),doneId());}
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
  
}
function restoreDone(){
  if(doneTried)return; doneTried=true;
  if(!P||P.id!==SAMPLE.id)return;
  const rec=doneGet(P.id); if(!rec||!/^(win|loss|gave)$/.test(rec.o))return;
  if(rec.o==="loss"&&!MS.has(rec.b))return;
  startDug=true; over=true; won=rec.o==="win"; stopTimer(); seconds=Math.max(0,Math.min(359999,Math.floor(+rec.s)||0)); renderTime();
  revealed=new Set(); flagged=new Set(); boomed=new Set();
  for(let k=0;k<CELLS;k++){
    if(!MS.has(k))revealed.add(k);
    else if(rec.o==="loss"&&k===rec.b)boomed.add(k);
    else flagged.add(k);
  }
  if(!won)flagCheck=false;
  paint();
  if(won){$("#msg").innerHTML=`Swept in <b>${$("#timer").textContent}</b>.`;document.body.classList.add("win");}
  else if(rec.o==="loss")$("#msg").innerHTML="That was a mine. The grid never needed a guess — the step was there.";
  else $("#msg").innerHTML="Revealed.";
  if(rec.o==="gave")return;
  // reopen on the finish sheet (no "on": the tracker logged this finish the first time)
  $("#winTitle").textContent=won?"Swept":"Boom.";$("#winTime").textContent=dnTime($("#timer").textContent);
  (async()=>{const st=await store(true)||{streak:0,best:0};await refreshStreakUI(st);
    $("#winStreak").textContent=$("#streak").textContent;$("#winBest").textContent=$("#best").textContent;
    finishSheet(won?"win":"loss",false);})();
}
load(SAMPLE);
