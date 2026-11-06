/* How smoothly does a rolling marble get on to a line's end? Four everyday cases.
   Reports the speed kept and how high the marble rises above its rolling height on the line (a lip shows as a hop).
   node toolchain/inkline/endtest.js */
const {api,stroke}=require('./rig.js');const {plank,on}=require('./parts.js');
const floor=[plank(0,60,60,300),plank(56,302,110,420),plank(106,422,150,470),plank(146,470,360,470)];
const cases={
 'line lying on the floor (drawn 6px above, falls)':{s:floor,P:[[190,457],[330,457]]},
 'line laid on the floor (touching)':{s:floor,P:[[190,461],[330,461]]},
 'bridge from a ledge over a gap':{s:[...floor.slice(0,3),plank(146,470,230,470),plank(300,470,360,470)],P:[[205,461],[330,461]]},
 'ramp up from the floor (two pegs)':{s:floor,p:[[220,446],[280,412]],P:[[190,462],[300,400]],ramp:1}};
for(const [name,c] of Object.entries(cases)){const L={m:on(0,60,60,300,30),s:c.s,c:[900,900],g:[],p:c.p};const S=api.makeSim(L);stroke(c.P).forEach(p=>api.addPoint(S,p[0],p[1]));api.release(S);
 const x0=c.P[0][0],ys=[];let before=0,after=0;
 for(let n=0;n<1200;n++){api.step(S);const m=S.marble,v=Math.hypot(m.velocity.x,m.velocity.y);if(m.position.x<x0-14)before=v;if(m.position.x>x0+40&&!after)after=v;
  if(m.position.x>x0-30&&m.position.x<x0+60)ys.push([m.position.x,m.position.y]);if(m.position.x>x0+60)break}
 const rolled=ys.filter(p=>p[0]>x0+30).map(p=>p[1]),settled=rolled.reduce((a,b)=>a+b,0)/(rolled.length||1),top=Math.min(...ys.map(p=>p[1]));
 console.log(name.padEnd(50),'speed kept',(after/before*100).toFixed(0).padStart(3)+'%',c.ramp?'  (climbing, so no hop figure)':'  hop '+(settled-top).toFixed(2)+' px','  line',S.mode)}
