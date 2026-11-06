/* Place two gems on a level from the paths of winning lines that are the same idea drawn differently
   (wobbled, steeper or shallower, longer or shorter): gem 1 where most of them pass, gem 2 where only some do,
   and a line that takes both must survive a wobbly hand. If every variation takes the same route, both gems go on it.
   node toolchain/inkline/gems.js 3   (updates gems.json for level 4) */
const fs=require('fs');const {run,wobble,rng,trace,api}=require('./rig.js');const LV=require('./levels.js');const G=require('./gems.json');
const ids=process.argv[2].split(',').map(Number);
function clear(L,x,y){if(x<18||x>342||y<18||y>622)return false;const S=api.makeSim({g:[],...L});if(S.parts.some(p=>{const c=Math.cos(-p.a),s=Math.sin(-p.a),dx=x-p.x,dy=y-p.y;return Math.abs(dx*c-dy*s)<p.w/2+16&&Math.abs(dx*s+dy*c)<p.h/2+16}))return false;
 return Math.hypot(x-L.m[0],y-L.m[1])>55&&Math.hypot(x-L.c[0],y-L.c[1])>55}
for(const i of ids){const L=LV[i],r=rng(500+i),S0=L.sol[0],wins=[];
 for(let k=0;k<160;k++){let P=wobble(S0,r,k<60?1:k<110?2.2:3.5);if(k>=60){const e=r()<.5?0:P.length-1,o=e?0:P.length-1,d=(r()-.5)*70,dx=P[e][0]-P[o][0],dy=P[e][1]-P[o][1],l=Math.hypot(dx,dy)||1;P=P.map((p,j)=>{const t=Math.abs(j-o)/(P.length-1);return[p[0]+(-dy/l)*d*t,p[1]+(dx/l)*d*t]});if(r()<.5){const s2=.8+r()*.45;P=P.map(p=>[P[o][0]+(p[0]-P[o][0])*s2,P[o][1]+(p[1]-P[o][1])*s2])}}
  const t=trace({...L,g:[]},P);if(t.state=='won')wins.push({P,path:t.path})}
 const near=(path,g)=>path.some(p=>Math.hypot(p[0]-g[0],p[1]-g[1])<19),seen=new Set(),cov=[];
 wins.forEach(w=>w.path.forEach((p,k)=>{if(k%3||!clear(L,p[0],p[1]))return;const g=p.map(Math.round),key=Math.round(g[0]/8)+','+Math.round(g[1]/8);if(seen.has(key))return;seen.add(key);const set=wins.map(w=>near(w.path,g));cov.push({g,set,c:set.filter(Boolean).length/wins.length})}));
 let best=null;for(const a of cov.filter(o=>o.c>=.55&&o.c<=.95))for(const b of cov.filter(o=>o.c>=.08&&o.c<=.5)){if(Math.hypot(a.g[0]-b.g[0],a.g[1]-b.g[1])<50)continue;const both=wins.filter((w,k)=>a.set[k]&&b.set[k]);if(both.length<3)continue;const sc=-Math.abs(both.length/wins.length-.2);if(!best||sc>best.sc)best={sc,g:[a.g,b.g],both}}
 if(!best){const P=trace({...L,g:[]},S0).path,pick=f=>{for(let d=0;d<40;d++)for(const s of [1,-1]){const k=Math.round(P.length*f)+s*d;if(P[k]&&clear(L,P[k][0],P[k][1]))return P[k].map(Math.round)}};best={g:[pick(.45),pick(.75)],both:[{P:S0}]};console.log(L.n,': one route only, both gems on it')}
 const GL={...L,g:best.g};let top=null;for(const w of best.both.slice(0,12)){const rr=rng(77);let ok=0;for(let k=0;k<30;k++){const q=run(GL,wobble(w.P,rr));if(q.state=='won'&&q.gems==2)ok++}if(!top||ok>top.ok)top={P:w.P,ok}}
 G[i]={g:best.g,star:top.P.map(p=>p.map(v=>Math.round(v*10)/10))};console.log(String(i+1).padStart(2),L.n,'gems',JSON.stringify(best.g),'| best three-star line keeps all gems',Math.round(top.ok/30*100)+'% of the time')}
fs.writeFileSync(__dirname+'/gems.json',JSON.stringify(G));
