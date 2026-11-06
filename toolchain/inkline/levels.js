const {plank,block,on}=require('./parts.js');
/* a smooth run: straight sections joined by round bends (radius r), laid as short overlapping planks */
function run(P,h=14,r=70){const pts=[P[0]];
 for(let i=1;i<P.length-1;i++){const a=P[i-1],b=P[i],c=P[i+1],u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],lu=Math.hypot(...u),lv=Math.hypot(...v);u[0]/=lu;u[1]/=lv?lu:1;u[1]=(a[1]-b[1])/lu;v[0]/=lv;v[1]/=lv;
  const th=Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]))),t=Math.min(r/Math.tan(th/2),lu*.45,lv*.45),p0=[b[0]+u[0]*t,b[1]+u[1]*t],p1=[b[0]+v[0]*t,b[1]+v[1]*t];
  const n=Math.max(2,Math.ceil((Math.PI-th)/(8*Math.PI/180)));for(let k=0;k<=n;k++){const s=k/n,m=[(1-s)*(1-s)*p0[0]+2*(1-s)*s*b[0]+s*s*p1[0],(1-s)*(1-s)*p0[1]+2*(1-s)*s*b[1]+s*s*p1[1]];pts.push(m)}}
 pts.push(P[P.length-1]);
 return pts.slice(1).map((q,i)=>{const p=pts[i],l=Math.hypot(q[0]-p[0],q[1]-p[1]),ux=(q[0]-p[0])/l,uy=(q[1]-p[1])/l,e=i?2:0,f=i<pts.length-2?2:0;return plank(p[0]-ux*e,p[1]-uy*e,q[0]+ux*f,q[1]+uy*f,h)})}
/* Inkline's hand-made levels. Each has its idea (what the player should realise) and the line a person would draw for it (sol).
   show: other lines worth drawing in the picture, such as the wrong peg pairs. Gems and hints are added by assemble.js. */
const LV=[];
LV.push({n:'Mind the Gap',h:'Draw one line across the gap. Lift to let go.',idea:'Span the gap: a line rests on both ledges.',
 m:on(0,60,150,215,30),s:[plank(0,60,150,215),block(80,300,60,14),block(270,300,30,14),block(286,314,14,326),block(352,120,8,460)],c:[329,560,1,1],
 sol:[[[110,292],[290,292]]]});
LV.push({n:'Slide',h:'Lines rest on ledges. Build a slide.',idea:'A sloping line between two posts turns the marble back.',
 m:on(0,90,150,150,30),s:[...run([[0,90],[150,150],[175,155]]),block(300,300,45,14),block(345,220,8,94),block(60,470,60,14),block(0,330,8,250),plank(110,500,66,528,10)],c:[38,560,-1],
 sol:[[[322,292],[105,463]]]});
LV.push({n:'Backboard',h:'Stand a line up in the slot.',idea:'Stand a line in the slot to make a wall.',
 m:on(0,80,140,360,30),s:[...run([[0,80],[140,360],[175,398],[198,402],[214,396]]),plank(300,452,267,458,10),block(300,415,7,40),block(316,415,7,40),block(296,455,31,8)],c:[245,470,1,1],
 sol:[[[311,250],[311,450]]]});
LV.push({n:'Over the Wall',h:'Lean a line on the wall to make a ramp.',idea:'Lean a line on the wall: a ramp over it.',
 m:on(0,60,50,280,30),s:[...run([[0,60],[50,280],[95,420],[130,470],[262,472]]),block(262,418,18,222),plank(280,528,303,543),block(352,150,8,440)],c:[326,560,1,1],
 sol:[[[190,464],[266,415],[276,411]]]});
LV.push({n:'Gap and Wall',h:'One line, two jobs.',idea:'One line bridges the gap and ramps over the wall.',
 m:on(0,60,90,300,30),s:[...run([[0,60],[90,300],[130,370],[175,392]]),block(262,350,14,290),block(328,200,8,370)],c:[302,530,1,1],
 sol:[[[160,382],[264,348],[272,344]]]});


/* ---------- Chapter 2: pegs ---------- */
/* 2.1 Lock: through two pegs a line is fixed in place, a ramp in mid-air. */
LV.push({n:'Lock',h:'Through two pegs, a line is fixed in place.',idea:'Through two pegs, a line is fixed: a ramp in mid-air.',
 m:on(360,70,200,130,30),s:[...run([[360,70],[200,130],[178,134]]),block(352,330,8,250)],p:[[120,300],[230,380]],c:[326,560,1,1],
 sol:[[[60,256],[300,430]]]});
/* 2.2 Pick Two: three pegs, but only one pair makes a ramp that reaches the cup. */
LV.push({n:'Pick Two',h:'Which two pegs?',idea:'Choose the pair of pegs that leads to the cup.',
 m:on(0,70,170,110,30),s:[...run([[0,70],[170,110],[190,112]]),block(352,150,8,430)],p:[[180,255],[95,395],[270,335]],c:[326,560,1,1],
 sol:[[[150,228],[300,362]]],show:[[[70,435],[205,215]],[[60,407],[300,325]]]});
/* 2.3 Hinge: a peg holds one end and a ledge the other, so the line stays put. */
LV.push({n:'Hinge',h:'A peg holds one end, a ledge the other.',idea:'A peg holds one end, the ledge the other.',
 m:on(0,70,140,120,30),s:[...run([[0,70],[140,120],[160,124]]),block(70,450,70,14),block(0,300,8,280),block(352,150,8,430)],p:[[250,250]],c:[34,560,-1,1],
 sol:[[[270,236],[100,444]]]});
/* 2.4 Swing: a line through one peg swings like a hammer and knocks the marble along its shelf. */
LV.push({n:'Swing',h:'Through one peg, a line swings.',idea:'A line through one peg swings: hit the marble.',
 m:[168,250],s:[block(164,261,34,12),...run([[195,267],[290,300],[318,312]],12,40),plank(270,480,302,520,10),block(352,0,8,580)],p:[[128,138]],c:[328,560,1,1],
 sol:[[[128,138],[0,138]]],show:[[[128,138],[40,58]]]});
/* 2.5 Ski Jump: the halfpipe has no far side; draw the jump through both pegs and the marble flies the wall. */
LV.push({n:'Ski Jump',h:'Finish the halfpipe.',idea:'Finish the halfpipe: a jump through both pegs.',
 m:on(0,60,50,250,30),s:[...run([[0,60],[50,250],[95,420],[140,480],[232,484]]),block(280,434,16,206),block(338,200,8,380)],p:[[230,465],[256,447]],c:[315,560,1,1],
 sol:[[[200,477],[268,438]]],show:[[[200,477],[240,462],[262,440],[270,425]]]});
/* chapters, in order: name and number of levels */
LV.CH=[{n:'Ledges',c:5},{n:'Pegs',c:5}];
module.exports=LV;
