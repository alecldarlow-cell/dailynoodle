/* Inkline design rig: runs the game's own physics (read from the game file, so there is one source of truth) with lines a person might draw. */
const fs=require('fs'),path=require('path');
const GAME=path.join(__dirname,'../../reports/2026-11-05-arcade-inkline.html');
const html=fs.readFileSync(GAME,'utf8');
const matterSrc=html.slice(html.indexOf('<script>/* matter-js')+8,html.indexOf('</script>',html.indexOf('<script>/* matter-js')));
const simSrc=html.slice(html.indexOf('/* ---------- Inkline physics'),html.indexOf('const CH='));
/* the same Matter build the game inlines, then the game's physics on top of it */
const mod={exports:{}};new Function('module','exports',matterSrc)(mod,mod.exports);const Matter=mod.exports;
const api=new Function('Matter',simSrc+';return {testRun,makeSim,lineLength,step,addPoint,release,obstacle,W,H,R}')(Matter);
function rng(s){return()=>(s=(s*1664525+1013904223)%4294967296)/4294967296}
/* a stroke through the given corners, sampled every 6px like a finger */
function stroke(P){const r=[];for(let i=0;i<P.length-1;i++){const[a,b]=[P[i],P[i+1]],n=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6));for(let k=0;k<n;k++)r.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n])}r.push(P[P.length-1]);return r}
/* a wobbly hand: shift up to 6px, turn up to 3 degrees, stretch up to 4%, and jitter (amt scales all of it) */
function wobble(P,r,amt=1){const cx=P.reduce((t,p)=>t+p[0],0)/P.length,cy=P.reduce((t,p)=>t+p[1],0)/P.length,dx=(r()-.5)*12*amt,dy=(r()-.5)*12*amt,a=(r()-.5)*.1*amt,s=1+(r()-.5)*.08*amt,c=Math.cos(a),sn=Math.sin(a);
 return P.map(p=>{const x=(p[0]-cx)*s,y=(p[1]-cy)*s;return[cx+x*c-y*sn+dx+(r()-.5)*2*amt,cy+x*sn+y*c+dy+(r()-.5)*2*amt]})}
const run=(L,P,track)=>api.testRun({g:[],...L},stroke(P),track);
function placed(S){const l=S.line,c=Math.cos(l.angle),s=Math.sin(l.angle);return S.local.map(q=>[l.position.x+q[0]*c-q[1]*s,l.position.y+q[0]*s+q[1]*c])}
/* one attempt, recording the marble's path and where the line ends up */
function trace(L,P,maxT=15000){const S=api.makeSim({g:[],...L});stroke(P).forEach(p=>api.addPoint(S,p[0],p[1]));
 if(!api.release(S))return{state:'rejected',path:[],line:[]};const path=[],line0=placed(S);let n=0;
 while(S.state=='run'&&S.t<maxT){api.step(S);S.fx.length=0;if(!(n++%4))path.push([S.marble.position.x,S.marble.position.y])}
 path.push([S.marble.position.x,S.marble.position.y]);return{state:S.state,gems:S.got.size,path,line0,line:S.line?placed(S):[],t:S.t,mode:S.mode,x:S.marble.position.x,y:S.marble.position.y,parts:S.parts.map(p=>({x:p.b.position.x,y:p.b.position.y,w:p.w,h:p.h,a:p.b.angle,cup:p.cup}))}}
module.exports={api,rng,stroke,wobble,run,trace,GAME};
