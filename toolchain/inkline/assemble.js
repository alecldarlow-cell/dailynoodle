/* Write the levels (with gems and hints) and the Daily into the game file.
   Daily: every level and its mirror image, scored by the shortest line; par is the shortest line the bot found that wins.
   node toolchain/inkline/assemble.js */
const fs=require('fs');const {run,wobble,rng,GAME}=require('./rig.js');const LV=require('./levels.js');const G=require('./gems.json');
const r2=a=>Math.round(a*100)/100,rs=a=>a.map(v=>typeof v=='number'?r2(v):v);
const levels=LV.map((L,i)=>{const o={n:L.n,m:L.m.map(r2),s:L.s.map(rs),c:L.c,g:(G[i]||{}).g||[]};for(const k of ['p','z','sp','bo','mv','ink'])if(L[k])o[k]=L[k];if(L.h)o.h=L.h;return o});
const mirror=L=>({...L,m:[360-L.m[0],L.m[1]],s:L.s.map(p=>[360-p[0],p[1],p[2],p[3],-(p[4]||0),p[5]]),c:[360-L.c[0],L.c[1],-(L.c[2]||1),L.c[3]||0],p:(L.p||[]).map(q=>[360-q[0],q[1]]),g:L.g.map(q=>[360-q[0],q[1]]),
 ...(L.bo?{bo:L.bo.map(q=>[360-q[0],q[1],q[2],Math.PI-(q[3]||0),...q.slice(4)])}:{}),...(L.sp?{sp:L.sp.map(q=>[360-q[0],q[1],q[2],-(q[3]||0),...q.slice(4)])}:{}),...(L.z?{z:L.z.map(q=>[360-q[0]-q[2],q[1],q[2],q[3]])}:{})});
const daily=[];levels.forEach((L,i)=>{for(const mir of [0,1]){const D=mir?mirror(L):{...L};delete D.h;D.n='Daily';const sol=LV[i].sol[0].map(p=>mir?[360-p[0],p[1]]:p);const r=rng(40+i*2+mir);let best=1e9;
 for(let k=0;k<120;k++){let P=wobble(sol,r,k<40?1:2);if(k>=40){const s=.75+r()*.3,o=r()<.5?0:P.length-1;P=P.map(p=>[P[o][0]+(p[0]-P[o][0])*s,P[o][1]+(p[1]-P[o][1])*s])}const q=run(D,P);if(q.state=='won')best=Math.min(best,q.len)}
 if(run(D,sol).state!='won'||best==1e9){console.log('left out of the Daily:',L.n,mir?'(mirror)':'');continue}D.par=Math.ceil(best);daily.push(D)}});
/* spread the Daily so neighbouring days differ: step through the list by a stride that shares no factor with its length */
const n=daily.length;let st=7;while(n%st==0||st%n==0)st++;const order=[...Array(n)].map((_,k)=>daily[(k*st)%n]);
let html=fs.readFileSync(GAME,'utf8');
const swap=(name,val)=>{const re=new RegExp('^const '+name+'=.*;$','m');if(!re.test(html))throw new Error('no '+name+' line in the game file');html=html.replace(re,()=>'const '+name+'='+JSON.stringify(val)+';')};
swap('CH',LV.CH);swap('LEVELS',levels);swap('DAILY',order);
const demo=LV[0].sol[0];html=html.replace(/const DLINE=\[[^;]*?\],DEMO=/,()=>'const DLINE='+JSON.stringify(demo)+',DEMO=');
fs.writeFileSync(GAME,html);console.log('wrote',levels.length,'levels and',n,'Daily puzzles into',GAME.split('/').slice(-2).join('/'));
