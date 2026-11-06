/* Picture of levels: scenery, the intended line (blue) and the marble's path with it (red; green for the second), and with no line (grey dashed).
   node toolchain/inkline/viz.js levels.js out.png [0,3] */
/* Draw each level with its intended line (blue), the marble's path with it (red), and with no line (grey). */
const {chromium}=require('playwright'),fs=require('fs');const {trace,api}=require('./rig.js');
(async()=>{const file=process.argv[2]||'levels.js',out=process.argv[3]||'viz.png',only=process.argv[4]?process.argv[4].split(',').map(Number):null;
 delete require.cache[require.resolve('./'+file)];const LV=require('./'+file);const GM=fs.existsSync(__dirname+'/gems.json')?require('./gems.json'):{};LV.forEach((L,i)=>{if(!L.g&&GM[i])L.g=GM[i].g});
 const items=LV.map((L,i)=>({L,i})).filter(o=>!only||only.includes(o.i)).map(({L,i})=>{const sols=(L.sol||[]).map(P=>trace(L,P));const none=trace(L,[[6,632],[40,632]]);
  const S=api.makeSim({g:[],...L});return{i,n:L.n,idea:L.idea||'',L,parts:S.parts.map(p=>({x:p.x,y:p.y,w:p.w,h:p.h,a:p.a,cup:p.cup,pow:p.pow})),sols,none,extra:(L.show||[]).map(P=>trace(L,P))}});
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:1500,height:1000}});
 const cols=Math.min(5,items.length),rows=Math.ceil(items.length/cols),sc=.75,cw=360*sc+8,ch=640*sc+40;
 await p.setViewportSize({width:cols*cw,height:rows*ch});
 await p.setContent('<canvas id=c></canvas><style>body{margin:0}</style>');
 await p.evaluate(({items,cols,sc,cw,ch})=>{const c=document.getElementById('c');c.width=cols*cw;c.height=Math.ceil(items.length/cols)*ch;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
  items.forEach((it,k)=>{g.save();g.translate((k%cols)*cw+4,Math.floor(k/cols)*ch+34);g.fillStyle='#000';g.font='13px sans-serif';g.fillText((it.i+1)+'. '+it.n+'  '+it.sols.map(s=>s.state+s.gems).join(' ')+' | none:'+it.none.state,0,-20);g.font='11px sans-serif';g.fillText(it.idea.slice(0,60),0,-6);
   g.scale(sc,sc);g.fillStyle='#eef3ee';g.fillRect(0,0,360,640);g.strokeStyle='#ccc';g.strokeRect(0,0,360,640);
   for(const z of it.L.z||[]){g.fillStyle='rgba(220,60,40,.15)';g.fillRect(z[0],z[1],z[2],z[3])}
   for(const q of it.parts){g.save();g.translate(q.x,q.y);g.rotate(q.a);g.fillStyle=q.cup?'#e7b75a':q.pow?'#e0584c':'#666';g.fillRect(-q.w/2,-q.h/2,q.w,q.h);g.restore()}
   for(const q of it.L.bo||[]){g.save();g.translate(q[0],q[1]);g.rotate(q[3]||0);g.fillStyle='rgba(224,161,6,.35)';g.fillRect(-q[2]/2,-14,q[2],28);g.restore()}
   for(const q of it.L.p||[]){g.fillStyle='#c98f2c';g.beginPath();g.arc(q[0],q[1],6,0,7);g.fill()}
   for(const q of it.L.g||[]){g.fillStyle='#f6c62c';g.strokeStyle='#000';g.beginPath();g.arc(q[0],q[1],7,0,7);g.fill();g.stroke()}
   const pl=(P,col,w,d)=>{if(!P||P.length<2)return;g.strokeStyle=col;g.lineWidth=w;g.setLineDash(d||[]);g.beginPath();P.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke();g.setLineDash([])};
   pl(it.none.path,'rgba(0,0,0,.3)',2,[4,4]);
   it.extra.forEach(s=>{pl(s.line0,'rgba(120,0,160,.35)',5);pl(s.line,'rgba(120,0,160,.9)',3);pl(s.path,'rgba(120,0,160,.6)',2)});
   it.sols.forEach((s,j)=>{pl(s.line0,'rgba(30,60,200,.35)',6);pl(s.line,'#1e3cc8',6);pl(s.path,j?'rgba(0,150,60,.8)':'rgba(220,40,30,.85)',2.5)});
   g.fillStyle='#d33';g.beginPath();g.arc(it.L.m[0],it.L.m[1],11,0,7);g.fill();g.restore()})},{items:items.map(o=>({...o,L:{...o.L,sol:undefined}})),cols,sc,cw,ch});
 await (await p.$('#c')).screenshot({path:out});await b.close();console.log('wrote',out)})();
