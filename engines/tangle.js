/* Digi Puzzles — tangle engine. One copy serves every tangle page in reports/.
   Extracted 2026-10-15 from 2027-10-04-word-tangle-0363.html by tools/engine-shells.js.
   The page supplies its puzzle as window.DN_PUZZLE before loading this file.
   Edit here to change every tangle; keep element ids and localStorage keys
   stable (dn-track.js and players' saved progress depend on them). */

'use strict';
const PUZZLE=window.DN_PUZZLE;
const N=4, MINLEN=3, ROUND=90;
const $=id=>document.getElementById(id);
const NB=(()=>{const a=[];for(let r=0;r<N;r++)for(let c=0;c<N;c++){const s=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
  const r2=r+dr,c2=c+dc;if((dr||dc)&&r2>=0&&r2<N&&c2>=0&&c2<N)s.push(r2*N+c2);}a.push(s);}return a;})();

/* ---------- ship gate: runs before anything is drawn ---------- */
/*@GATE*/
function GATE(P,metaDate){
  const f=[];
  if(!P||typeof P!=='object')return['no puzzle object'];
  if(!/^DP·TANG·\d{4}$/.test(P.id||''))f.push('id '+P.id);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(P.date||''))f.push('date '+P.date);
  if(metaDate!=null&&metaDate!==P.date)f.push('dn:date '+metaDate+' != '+P.date);
  if(!Array.isArray(P.grid)||P.grid.length!==N||P.grid.some(r=>!Array.isArray(r)||r.length!==N||r.some(c=>c!=='.')))f.push('grid literal must be a 4x4 of "."');
  const T=P.tiles;
  if(!Array.isArray(T)||T.length!==N*N||T.some(t=>!/^([A-PR-Z]|QU)$/.test(t)))return f.concat('tiles');
  if(T.filter(t=>t==='QU').length>1)f.push('more than one Qu');
  if(T.filter(t=>/^[JXZ]$/.test(t)).length>1)f.push('more than one of J/X/Z');
  const low=T.map(t=>t.toLowerCase());
  const trace=w=>{const go=(i,pos,used)=>{const t=low[i];if(!w.startsWith(t,pos))return null;const p2=pos+t.length;
      if(p2===w.length)return[i];for(const j of NB[i])if(!(used>>j&1)){const r=go(j,p2,used|1<<j);if(r)return[i].concat(r);}return null;};
    for(let i=0;i<N*N;i++){const r=go(i,0,1<<i);if(r)return r;}return null;};
  const M=P.main,B=P.bonus;
  if(!Array.isArray(M)||!Array.isArray(B))return f.concat('word lists');
  if(M.length<40||M.length>75)f.push('main count '+M.length);
  const seen=new Set();
  for(const w of M.concat(B)){
    if(typeof w!=='string'||!/^[a-z]{3,16}$/.test(w)){f.push('bad word '+w);continue;}
    if(seen.has(w))f.push('repeat '+w);seen.add(w);
    if(!trace(w))f.push('not traceable '+w);
  }
  const s=P.star;
  if(typeof s!=='string'||!M.includes(s)||s.length<8)f.push('star');
  else{
    if(M.concat(B).some(w=>w!==s&&w.length>=s.length))f.push('star is not the unique longest word on the board');
    const p=P.starPath;
    if(!Array.isArray(p)||new Set(p).size!==p.length||p.some((x,k)=>!Number.isInteger(x)||x<0||x>15||(k&&!NB[p[k-1]].includes(x)))||p.map(i=>low[i]).join('')!==s)f.push('star path');
  }
  return f;
}
/*@GATE_END*/

/* ---------- save (localStorage, every access guarded) ---------- */
const KEY='digi-tangle-v1';
const coarse=(()=>{try{return matchMedia('(pointer: coarse)').matches}catch(e){return false}})();
function defaults(){return {v:1,days:{},done:{},streak:{last:null,n:0,best:0},best:0,snd:true,rm:null,fs:coarse};}
let save=defaults();
function load(){try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);if(s&&s.v===1)save=Object.assign(defaults(),s);}}catch(e){}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(save));}catch(e){}}
load();

/* ---------- settings: motion, sound, full screen ---------- */
const sysRM=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})();
const reduced=()=>save.rm===null?sysRM:!!save.rm;
function applyRM(){document.body.classList.toggle('rm',reduced());}
applyRM();
const appFS=(()=>{try{return matchMedia('(display-mode: fullscreen)').matches}catch(e){return false}})();
const fsOK=!appFS&&(()=>{try{return !!(document.fullscreenEnabled||document.webkitFullscreenEnabled)}catch(e){return false}})();
const isFS=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function goFS(){if(!fsOK||!save.fs||isFS())return;try{const el=document.documentElement,rq=el.requestFullscreen||el.webkitRequestFullscreen;if(!rq)return;
 const lock=()=>{try{if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('portrait').catch(()=>{});}catch(e){}};
 fsAt=performance.now();const p=rq.call(el,{navigationUI:'hide'});if(p&&p.then)p.then(lock,()=>{});else lock();}catch(e){}}
function paintFS(){for(const id of ['fsHome','fsPlay']){const b=$(id);if(!b)continue;b.hidden=!fsOK;b.setAttribute('aria-pressed',String(isFS()));b.setAttribute('aria-label',isFS()?'Leave full screen':'Full screen');}}
function exitFS(){try{if(!isFS())return;const x=document.exitFullscreen||document.webkitExitFullscreen;const p=x&&x.call(document);if(p&&p.catch)p.catch(()=>{});}catch(e){}}
let actx=null;
function audio(){if(!save.snd)return null;try{if(!actx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;actx=new A();}
  if(actx.state==='suspended')actx.resume().catch(()=>{});return actx;}catch(e){return null}}
function tone(f,t,dur,type,g){const a=audio();if(!a)return;try{const o=a.createOscillator(),v=a.createGain(),t0=a.currentTime+t;
  o.type=type||'sine';o.frequency.setValueAtTime(f,t0);v.gain.setValueAtTime(0.0001,t0);v.gain.exponentialRampToValueAtTime(g||0.18,t0+0.012);
  v.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(v).connect(a.destination);o.start(t0);o.stop(t0+dur+0.05);}catch(e){}}
const sfx={
  step(k){tone(392*Math.pow(2,Math.min(k,12)/12),0,.08,'sine',.05);},
  word(n){tone(523*Math.pow(2,Math.min(n,8)/12),0,.3,'triangle',.14);tone(784*Math.pow(2,Math.min(n,8)/12),.08,.42,'triangle',.12);},
  meh(){tone(220,0,.14,'sine',.06);},
  tick(){tone(880,0,.05,'square',.03);},
  star(){[523,659,784,1047,1319].forEach((f,i)=>tone(f,i*.08,.5,'triangle',.11));},
  done(){[784,659,523,392].forEach((f,i)=>tone(f,i*.12,.5,'triangle',.12));}
};
function toggles(host){
  host.innerHTML='';
  const items=[['Sound',()=>save.snd,v=>{save.snd=v;if(v)audio();}],['Reduced motion',()=>reduced(),v=>{save.rm=v;applyRM();}]];
  if(fsOK)items.push(['Full screen',()=>!!save.fs,v=>{save.fs=v;if(v)goFS();else exitFS();setTimeout(paintFS,300);}]);
  for(const [label,get,set] of items){const b=document.createElement('button');b.className='tog';b.setAttribute('role','switch');
    b.textContent=label;b.setAttribute('aria-checked',String(get()));
    b.addEventListener('click',()=>{set(!get());b.setAttribute('aria-checked',String(get()));persist();});host.appendChild(b);}
}

/* ---------- helpers ---------- */
function today(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  catch(e){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}}
function dayBefore(s){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
function longDate(s){try{return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(s+'T12:00:00Z'));}catch(e){return s;}}
function mmss(s){s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=String(s%60).padStart(2,'0');return h?h+':'+String(m).padStart(2,'0')+':'+x:m+':'+x;}
const num=n=>['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen'][n]||String(n);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pts=w=>(w.length-2)*(w===P.star?2:1);
const plural=(n,a,b)=>n+' '+(n===1?a:b);

/* ---------- state ---------- */
/* D = today's one round, saved: {state:'ready'|'playing'|'done', found:[], left, score}; R = D while it is on the board */
let P=null, D=null, R=null, view='home', low=[], MAIN=null, BONUS=null, ALLW=null, tiles=[], paused=false, last=0, counting=false, cdT=0, fsAt=-1e9;
function day(){
  let d=save.days[P.id];
  if(!d||!Array.isArray(d.found)||!['ready','playing','done'].includes(d.state)){d={state:'ready',found:[],left:ROUND,score:0};save.days[P.id]=d;}
  return d;
}
function show(id){view=id;for(const s of document.querySelectorAll('.screen'))s.classList.toggle('vis',s.id===id);if(id==='play')requestAnimationFrame(measure);}
function shareLine(){const star=D.found.includes(P.star)?' ★':'';return '🧶 Tangle #'+P.n+' — '+plural(D.score,'point','points')+', '+plural(D.found.length,'word','words')+star;}
function shareText(){return shareLine();}   // score line only: no link

/* ---------- home ---------- */
function artSVG(){
  let s='<rect width="120" height="120" fill="none"/>';
  for(let i=0;i<16;i++){const x=12+(i%4)*26,y=12+Math.floor(i/4)*26;
    s+=`<rect x="${x}" y="${y}" width="21" height="21" rx="4" style="fill:var(--paper);stroke:var(--edge)" stroke-width="1.6"/>`;}
  const pts=[[22.5,74.5],[48.5,48.5],[74.5,22.5],[100.5,48.5],[74.5,74.5],[48.5,100.5],[74.5,100.5]].map(p=>p.join(',')).join(' ');
  s+=`<polyline points="${pts}" fill="none" style="stroke:var(--thread)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`;
  return s;
}
function liveStreak(){const s=save.streak||{n:0},t=today();return (s.last===t||s.last===dayBefore(t))?s.n:0;}
function renderHome(){
  show('home');
  $('numLabel').textContent='No. '+parseInt(P.id.slice(-4),10);
  $('dateLine').textContent=longDate(P.date);
  $('homeArt').innerHTML=artSVG();
  if(D.state==='done'){$('playHead').textContent=plural(D.score,'point','points');$('playStatus').textContent=`${plural(D.found.length,'word','words')} today. See the answers; a new board arrives at midnight.`;$('playGo').textContent='View';}
  else if(D.state==='playing'){$('playHead').textContent='Round paused';$('playStatus').textContent=`${mmss(D.left)} left, ${plural(D.score,'point','points')} so far.`;$('playGo').textContent='Resume';}
  else{$('playHead').textContent='Today\'s tangle';$('playStatus').textContent=`90 seconds. Longer words score more; the ${num(P.star.length)}-letter word scores double.`;$('playGo').textContent='Play';}
  $('yBtn').hidden=P.n<=1;
  $('hStreak').textContent=liveStreak();$('hBest').textContent=save.best||0;
  toggles($('homeToggles'));
}

/* ---------- board ---------- */
function buildBoard(){
  const b=$('board');b.querySelectorAll('.tile').forEach(t=>t.remove());tiles=[];
  P.tiles.forEach((t,i)=>{const d=document.createElement('div');d.className='tile'+(t==='QU'?' qu':'');d.textContent=t==='QU'?'Qu':t;
    d.setAttribute('role','button');d.setAttribute('aria-label',t==='QU'?'Q U':t);d.dataset.i=i;b.appendChild(d);tiles.push(d);});
}
let rects=[], boardRect=null;
function measure(){if(!tiles.length)return;boardRect=$('board').getBoundingClientRect();rects=tiles.map(t=>t.getBoundingClientRect());drawPath(null);}
function centre(i){const r=rects[i];return [r.left+r.width/2-boardRect.left,r.top+r.height/2-boardRect.top];}
/* hit test: inner 70% of a tile while dragging (so a diagonal can't clip a neighbour's corner); whole tile on press */
function hit(x,y,inner){
  for(let i=0;i<rects.length;i++){const r=rects[i],m=inner?0.15:0;
    if(x>=r.left+r.width*m&&x<=r.right-r.width*m&&y>=r.top+r.height*m&&y<=r.bottom-r.height*m)return i;}
  return -1;
}
let path=[], drag=null, kb='';    // drag = {id, start, moved, lx, ly}; kb = letters typed on a keyboard
const live=()=>view==='play'&&R&&R.state==='playing'&&!paused&&!counting;
function findPath(w){
  const go=(i,pos,used)=>{const t=low[i];if(!w.startsWith(t,pos))return null;const p2=pos+t.length;
    if(p2===w.length)return[i];for(const j of NB[i])if(!(used>>j&1)){const r=go(j,p2,used|1<<j);if(r)return[i].concat(r);}return null;};
  for(let i=0;i<N*N;i++){const r=go(i,0,1<<i);if(r)return r;}return null;
}
function typeKey(ch){
  let next=kb+ch;
  if(ch==='q'&&low.includes('qu'))next+='u';     // the Qu tile spells two letters
  const p=findPath(next);
  if(!p){toast('No path for '+next.toUpperCase());return;}
  kb=next;path=p;paint();sfx.step(path.length);
}
const wordOf=p=>p.map(i=>low[i]).join('');
function paint(){
  tiles.forEach((t,i)=>{t.classList.toggle('on',path.includes(i));t.classList.toggle('last',path.length>0&&path[path.length-1]===i);});
  const w=wordOf(path);
  const cw=$('curWord');
  if(w){cw.classList.remove('idle');cw.textContent=w;}
  else{cw.classList.add('idle');cw.textContent=live()?(coarse?'Drag across letters, or tap them':'Drag, tap, or type a word'):'';}
  drawPath(null);
}
function drawPath(pt){
  if(!boardRect||!path.length){$('pathLine').setAttribute('points','');return;}
  const pts=path.map(centre);if(pt)pts.push([pt[0]-boardRect.left,pt[1]-boardRect.top]);
  $('pathLine').setAttribute('points',pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' '));
}
function canAdd(i){return i>=0&&!path.includes(i)&&(path.length===0||NB[path[path.length-1]].includes(i));}
function add(i){if(!path.length){tiles.forEach(t=>t.classList.remove('good','bonus','meh'));$('toast').className='';}path.push(i);sfx.step(path.length);try{if(navigator.vibrate&&!reduced())navigator.vibrate(8);}catch(e){}}

function onDown(e){
  if(!live())return;
  if(e.button!=null&&e.button>0)return;
  if(drag)return;                                  // a second finger never hijacks a drag in progress
  measure();
  const i=hit(e.clientX,e.clientY,false);
  if(i<0)return;
  e.preventDefault();
  try{$('board').setPointerCapture(e.pointerId);}catch(x){}
  kb='';
  drag={id:e.pointerId,start:i,moved:false,lx:e.clientX,ly:e.clientY};
}
function step(x,y){
  const i=hit(x,y,true);
  if(!drag.moved){
    if(i<0||i===drag.start)return;
    // first move onto a different tile: this gesture is a drag (it continues a tapped word if it starts on its last letter)
    if(!(path.length&&path[path.length-1]===drag.start)){path=[];add(drag.start);}
    drag.moved=true;
  }
  if(i>=0){
    if(path.length>=2&&path[path.length-2]===i){path.pop();paint();}   // slide back to undo the last letter
    else if(canAdd(i)){add(i);paint();}
  }
}
function onMove(e){
  if(!drag||e.pointerId!==drag.id)return;
  // a quick swipe can jump a whole tile between two samples: walk the segment in small steps so nothing is skipped
  const pts=(e.getCoalescedEvents&&e.getCoalescedEvents().length)?e.getCoalescedEvents():[e];
  const unit=rects.length?rects[0].width/6:10;
  for(const q of pts){
    const dx=q.clientX-drag.lx,dy=q.clientY-drag.ly,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/unit));
    for(let k=1;k<=n;k++)step(drag.lx+dx*k/n,drag.ly+dy*k/n);
    drag.lx=q.clientX;drag.ly=q.clientY;
  }
  drawPath([e.clientX,e.clientY]);
}
function onUp(e){
  if(!drag||e.pointerId!==drag.id)return;
  const d=drag;drag=null;
  try{$('board').releasePointerCapture(e.pointerId);}catch(x){}
  if(!live()){path=[];paint();return;}
  if(d.moved){const p=path.slice();path=[];paint();if(p.length>1)submit(p);else drawPath(null);return;}
  tap(d.start);
}
function onCancel(e){if(drag&&e.pointerId===drag.id){drag=null;path=[];paint();}}
/* tap mode: tap letters in turn; tap the last letter again to enter; tap an earlier letter to step back to it;
   a tap on a letter that doesn't touch the last one starts a new word there */
function tap(i){
  kb='';
  if(path.length&&path[path.length-1]===i){const p=path.slice();path=[];paint();submit(p);return;}
  const k=path.indexOf(i);
  if(k>=0){path=path.slice(0,k+1);paint();return;}
  if(canAdd(i)){add(i);paint();return;}
  path=[];add(i);paint();
}

/* ---------- submitting ---------- */
let toastT=0;
function toast(msg,kind){const t=$('toast');t.textContent=msg;t.className='on'+(kind?' '+kind:'');clearTimeout(toastT);toastT=setTimeout(()=>{t.className='';},1100);}
function flashTiles(p,cls){p.forEach(i=>tiles[i].classList.add(cls));setTimeout(()=>p.forEach(i=>tiles[i].classList.remove(cls)),reduced()?250:420);}
function submit(p){
  if(!R||R.state!=='playing')return {r:'locked'};
  const w=wordOf(p);
  if(w.length<MINLEN){toast('Too short');sfx.meh();flashTiles(p,'meh');return {r:'short',w};}
  if(R.found.includes(w)){toast('Already found');flashTiles(p,'meh');
    const c=document.querySelector('.w[data-w="'+w+'"]');if(c){c.classList.remove('flash');void c.offsetWidth;c.classList.add('flash');try{c.scrollIntoView({block:'nearest'});}catch(x){}}
    return {r:'dup',w};}
  if(!ALLW.has(w)){toast("Not in today's list");sfx.meh();flashTiles(p,'meh');return {r:'none',w};}
  const g=pts(w);
  R.found.push(w);R.score+=g;
  persist();
  flashTiles(p,MAIN.has(w)?'good':'bonus');
  renderList(w);renderScore();
  if(w===P.star){toast('★ Longest word! +'+g,'gold');sfx.star();}
  else{toast('+'+g+' '+w.toUpperCase(),'good');sfx.word(w.length);}
  return {r:MAIN.has(w)?'main':'bonus',w,pts:g};
}

/* ---------- list + score ---------- */
function groups(words){const g={};for(const w of words)(g[w.length]||(g[w.length]=[])).push(w);return g;}
function renderList(fresh){
  const host=$('list');let h='';
  const gm=groups(P.main),gf=groups(R.found);
  const lens=[...new Set(Object.keys(gm).concat(Object.keys(gf)).map(Number))].sort((a,b)=>b-a);
  for(const L of lens){
    const found=(gf[L]||[]).slice().sort(),common=(gm[L]||[]).length,got=(gm[L]||[]).filter(w=>R.found.includes(w)).length;
    if(!found.length&&!common)continue;
    h+=`<div class="grp"><h3><span>${L} letters · ${plural((L-2),'pt','pts')} each</span><span>${common?got+' of '+common:''}</span></h3><div class="ws">`;
    for(const w of found)h+=`<span class="w${w===P.star?' star':''}${MAIN.has(w)?'':' bon'}${w===fresh?' new':''}" data-w="${w}">${esc(w)}</span>`;
    h+='</div></div>';
  }
  host.innerHTML=h;
  if(fresh){const c=host.querySelector('.w.new');if(c)try{c.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});}catch(x){}}
}
function renderClock(){
  const left=Math.max(0,R?R.left:ROUND),c=$('clock');
  c.textContent=mmss(Math.ceil(left-1e-9));
  c.classList.toggle('low',left<=10&&R&&R.state==='playing');
  $('timeFill').style.transform='scaleX('+(left/ROUND)+')';
}
function renderScore(){
  $('score').textContent=R.score;$('nWords').textContent=plural(R.found.length,'word','words');
  const got=R.found.includes(P.star);
  $('starPill').textContent=got?'★ '+P.star.toUpperCase()+' +'+pts(P.star):'★ Longest word: '+num(P.star.length)+' letters, double points';
  $('starPill').classList.toggle('got',got);
  renderClock();
}

/* ---------- the round ---------- */
function setPaused(on){
  paused=on;
  if(on)stopCount();
  $('veil').hidden=!on||!R||R.state!=='playing';
  $('board').classList.toggle('hide',on&&R&&R.state==='playing');
  if(on){if(drag)drag=null;path=[];kb='';paint();persist();}
  else{last=performance.now();if(R&&R.state==='playing')countIn();}
}
/* count-in: the clock holds at its time for 3-2-1 with the letters hidden. Chrome on Android shows a
   "to exit full screen" notice whenever full screen starts, and no page can suppress it, so when
   full screen has just been requested we wait for it to land and add a "Ready" beat, letting the
   notice show and fade before the round runs. */
function stopCount(){clearTimeout(cdT);if(!counting)return;counting=false;const c=$('count');c.hidden=true;c.textContent='';}
function countIn(){
  stopCount();counting=true;
  const c=$('count'),b=$('board');
  b.classList.add('hide');c.className='';c.textContent='';c.hidden=false;
  if(drag)drag=null;path=[];kb='';paint();
  const beats=['3','2','1'];
  const fresh=performance.now()-fsAt<1500;
  if(fresh)beats.unshift('Ready');
  const step=()=>{
    if(!counting)return;
    if(!beats.length){counting=false;c.hidden=true;c.textContent='';b.classList.remove('hide');last=performance.now();paint();return;}
    const s=beats.shift();c.textContent=s;c.className=s.length>1?'word':'';
    if(s.length===1)sfx.tick();
    cdT=setTimeout(step,1000);
  };
  // if full screen was just asked for, start the beats once it has arrived (or after 1s if it never does)
  if(fresh&&!isFS()){const t0=performance.now();const wait=()=>{if(!counting)return;if(isFS()||performance.now()-t0>1000)step();else cdT=setTimeout(wait,50);};wait();}
  else step();
}
function startPlay(){
  if(D.state==='done'){showResult(false);return;}
  R=D;
  if(D.state==='ready'){D.state='playing';D.left=ROUND;persist();}
  enterBoard();
}
function enterBoard(){
  path=[];kb='';show('play');$('play').classList.remove('locked');
  renderList();renderScore();setPaused(false);paint();last=performance.now();
}
function tick(){
  const now=performance.now(),dt=Math.min(1,Math.max(0,(now-last)/1000));last=now;
  if(view!=='play'||!R||R.state!=='playing'||paused||counting||document.hidden){last=now;return;}
  const before=Math.ceil(R.left);
  R.left=Math.max(0,R.left-dt);
  const after=Math.ceil(R.left);
  if(after!==before){renderClock();if(after<=5&&after>0)sfx.tick();if(after%5===0)persist();}
  if(R.left<=0)endRound();
}
function endRound(){
  if(!R||R.state!=='playing')return;
  R.state='done';R.left=0;
  if(drag)drag=null;path=[];kb='';paint();renderClock();
  $('play').classList.add('locked');
  sfx.done();
  // record the day's round; count the streak if it was played on its own day
  save.done[P.id]={o:'played',s:D.score,w:D.found.length,st:D.found.includes(P.star),d:today()};
  save.best=Math.max(save.best||0,D.score);
  const t=today();
  if(P.date===t){const s=save.streak||{last:null,n:0,best:0};
    if(s.last!==t){s.n=s.last===dayBefore(t)?s.n+1:1;s.last=t;}s.best=Math.max(s.best||0,s.n);save.streak=s;}
  persist();
  setTimeout(()=>showResult(true),reduced()?100:600);
}
function wordsHTML(found){
  const g=groups(P.main);let h='';
  for(const L of Object.keys(g).map(Number).sort((a,b)=>b-a)){
    h+=`<div class="grp"><h3><span>${L} letters</span><span>${g[L].filter(w=>found.includes(w)).length}/${g[L].length}</span></h3><div class="ws">`;
    for(const w of g[L].slice().sort())h+=`<span class="w${w===P.star?' star':''}${found.includes(w)?'':' miss'}">${esc(w)}</span>`;
    h+='</div></div>';
  }
  return h;
}
function showResult(fresh){
  const r=D;
  // fill every field first: the tracker reads #winTitle and #winTime the moment "on" lands
  $('rKick').textContent='Tangle '+parseInt(P.id.slice(-4),10)+', '+longDate(P.date);
  $('rBig').innerHTML=r.score+'<small>'+(r.score===1?'point':'points')+'</small>';
  $('winTitle').textContent='Time\'s up';
  $('winTime').textContent=mmss(ROUND-Math.max(0,r.left));
  $('rWords').textContent=r.found.length;
  $('rBest').textContent=save.best||0;
  $('rStreak').textContent=liveStreak();
  const sw=P.star.toUpperCase();
  $('rStar').textContent=r.found.includes(P.star)?`You found the longest word, ${sw}, for ${pts(P.star)} points.`:`The longest word was ${sw}, worth ${pts(P.star)} points.`;
  $('shareLine').textContent=shareLine();
  $('rList').innerHTML=wordsHTML(r.found);
  const bf=r.found.filter(w=>BONUS.has(w));
  $('bonSum').textContent=`Rarer words: you found ${bf.length} of ${P.bonus.length}`;
  $('bonList').textContent=P.bonus.map(w=>r.found.includes(w)?w+' ✓':w).join('  ');
  show('winModal');$('winModal').scrollTop=0;
  if(fresh)$('winModal').classList.add('on');      // once, when the day's round ends
}

/* ---------- yesterday ---------- */
function yesterdayFile(){return dayBefore(P.date)+'-word-tangle-'+String(P.n-1).padStart(4,'0')+'.html';}
async function showYesterday(){
  show('yest');const host=$('yList');host.innerHTML='<p class="small">Loading…</p>';
  $('yKick').textContent='Yesterday: Tangle '+String(P.n-1).padStart(4,'0')+', '+longDate(dayBefore(P.date));
  try{
    const r=await fetch(yesterdayFile(),{cache:'force-cache'});if(!r.ok)throw 0;
    const html=await r.text();const m=html.match(/\n(?:const PUZZLE|window\.DN_PUZZLE)=(\{.*\});\n/);if(!m)throw 0;
    const Y=JSON.parse(m[1].replace(/([{,])(id|date|n|band|grid|tiles|star|starPath|main|bonus):/g,'$1"$2":'));
    if(GATE(Y,null).length)throw 0;
    const yd=save.days[Y.id],mine=(yd&&yd.state==='done'&&yd.found)||[];
    const g=groups(Y.main);let h=`<p class="sub">${yd&&yd.state==='done'?`You scored ${plural(yd.score,'point','points')} with ${plural(mine.length,'word','words')}.`:`${Y.main.length} common words.`} Longest word: <b>${esc(Y.star.toUpperCase())}</b></p>`;
    for(const L of Object.keys(g).map(Number).sort((a,b)=>b-a)){
      h+=`<div class="grp"><h3><span>${L} letters</span><span>${g[L].length}</span></h3><div class="ws">`;
      for(const w of g[L].slice().sort())h+=`<span class="w${w===Y.star?' star':''}${mine.length&&!mine.includes(w)?' miss':''}">${esc(w)}</span>`;
      h+='</div></div>';
    }
    host.innerHTML=h;
  }catch(e){host.innerHTML='<p class="small">Yesterday\'s answers aren\'t available here. They\'re on the Digi Puzzles page, in yesterday\'s Tangle.</p>';}
}

let rsT=0;function remeasureSoon(){clearTimeout(rsT);rsT=setTimeout(measure,80);}
/* ---------- boot ---------- */
(function boot(){
  const md=(document.querySelector('meta[name="dn:date"]')||{}).content||null;
  const fails=GATE(typeof PUZZLE==='object'?PUZZLE:null,md);
  if(fails.length){show('err');$('errList').textContent='Failed: '+fails.join('; ');window.__tangleGate=fails;return;}
  P=PUZZLE;window.__tangleGate=[];
  low=P.tiles.map(t=>t.toLowerCase());MAIN=new Set(P.main);BONUS=new Set(P.bonus);ALLW=new Set(P.main.concat(P.bonus));D=day();
  buildBoard();
  const b=$('board');
  b.addEventListener('pointerdown',onDown);b.addEventListener('pointermove',onMove);
  b.addEventListener('pointerup',onUp);b.addEventListener('pointercancel',onCancel);b.addEventListener('lostpointercapture',e=>{if(drag&&e.pointerId===drag.id)onUp(e);});
  b.addEventListener('contextmenu',e=>e.preventDefault());
  $('playCard').addEventListener('click',()=>{goFS();audio();startPlay();});
  // full screen: a button on home and on the board; Play and Resume re-enter it if it was switched on
  for(const id of ['fsHome','fsPlay'])$(id).addEventListener('click',()=>{if(isFS()){save.fs=false;exitFS();}else{save.fs=true;goFS();}persist();setTimeout(paintFS,300);});
  const onFS=()=>{paintFS();remeasureSoon();};
  document.addEventListener('fullscreenchange',onFS);document.addEventListener('webkitfullscreenchange',onFS);
  paintFS();
  try{const bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();if(bg)$('themeColor').setAttribute('content',bg);}catch(e){}
  $('homeBtn').addEventListener('click',()=>{if(R&&R.state==='playing')setPaused(true);renderHome();});
  $('resumeBtn').addEventListener('click',()=>{goFS();audio();setPaused(false);paint();});
  const copied=()=>{$('shareBtn').textContent='Copied';setTimeout(()=>$('shareBtn').textContent='Share',1500);};
  const selectLine=()=>{try{const r=document.createRange();r.selectNodeContents($('shareLine'));const s=getSelection();s.removeAllRanges();s.addRange(r);$('shareBtn').textContent='Selected';setTimeout(()=>$('shareBtn').textContent='Share',1500);}catch(e){}};
  const copy=t=>{try{navigator.clipboard.writeText(t).then(copied,selectLine);}catch(e){selectLine();}};
  $('shareBtn').addEventListener('click',()=>{const t=shareText();
    if(coarse&&navigator.share){try{navigator.share({text:t}).catch(e=>{if(!e||e.name!=='AbortError')copy(t);});return;}catch(e){}}
    copy(t);});
  $('yBtn').addEventListener('click',showYesterday);
  $('yBack').addEventListener('click',renderHome);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(view==='play'&&path.length){kb='';path=[];paint();}return;}
    if(!live()||e.metaKey||e.ctrlKey||e.altKey||drag)return;
    if(e.key==='Enter'&&path.length){e.preventDefault();const p=path.slice();kb='';path=[];paint();submit(p);}
    else if(e.key==='Backspace'){e.preventDefault();if(!kb)kb=wordOf(path);kb=kb.endsWith('qu')&&low.includes('qu')?kb.slice(0,-2):kb.slice(0,-1);path=kb?(findPath(kb)||[]):[];if(!path.length)kb='';paint();}
    else if(/^[a-z]$/i.test(e.key)){e.preventDefault();if(!kb&&path.length)kb=wordOf(path);typeKey(e.key.toLowerCase());}
  });
  // leaving the page pauses the clock and hides the letters, so the board can't be studied off the clock
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(view==='play'&&R&&R.state==='playing')setPaused(true);persist();}else last=performance.now();});
  window.addEventListener('pagehide',persist);
  const remeasure=remeasureSoon;
  window.addEventListener('resize',remeasure);window.addEventListener('orientationchange',remeasure);
  if(window.visualViewport)visualViewport.addEventListener('resize',remeasure);
  last=performance.now();setInterval(tick,100);
  if(D.state==='done'&&save.done[P.id])showResult(false);else renderHome();
  if(window.__DGTEST===true)window.__tg={state:()=>({view,path,D,R,save,P,paused,counting}),submit:p=>submit(p),gate:GATE,rects:()=>rects};
})();
