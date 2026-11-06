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
/* L6 Two Gaps: two gaps and a pillar between them. One long line rests on all three and spans both. */
LV.push({n:'Two Gaps',h:'One line can cross more than one gap.',idea:'A long line rests on both ledges and the pillar, bridging both gaps.',
 m:on(0,80,70,300,30),s:[...run([[0,80],[70,300],[100,330],[120,332]],14,70),block(100,332,20,14),block(190,318,16,322),block(270,307,30,14),block(286,321,14,319),block(352,150,8,490)],c:[328,560,1,1],
 sol:[[[105,324],[290,298]]],show:[[[105,324],[198,314]]]});
/* L8 Peak: the marble lands on the peak and rolls off the wrong side. Lay a line over the peak, sloping the other way. */
LV.push({n:'Peak',h:'Which way will it roll?',idea:'A line laid over the peak, sloping down to the right, turns the marble towards the cup.',
 m:[160,40],s:[block(130,20,8,90),block(182,20,8,90),plank(70,330,170,280,14),plank(170,280,290,330,14),block(0,520,100,14),block(290,560,70,14),block(352,200,8,360)],c:[322,539,1,1],
 sol:[[[90,250],[290,280]]],show:[[[50,280],[240,250]]]});


/* ---------- Chapter 2: pegs ---------- */
/* 2.1 Lock: through two pegs a line is fixed in place, a ramp in mid-air. */
LV.push({n:'Lock',h:'Through two pegs, a line is fixed in place.',idea:'Through two pegs, a line is fixed: a ramp in mid-air.',
 m:on(360,70,200,130,30),s:[...run([[360,70],[200,130],[178,134]]),block(352,330,8,250)],p:[[120,300],[230,380]],c:[326,560,1,1],
 sol:[[[60,256],[300,430]]]});
/* 2.2 Pick Two: three pegs, but only one pair makes a ramp that reaches the cup. */
LV.push({n:'Pick Two',h:'Which two pegs?',idea:'Choose the pair of pegs that leads to the cup.',
 m:on(0,70,170,110,30),s:[...run([[0,70],[170,110],[190,112]]),block(352,150,8,430)],p:[[180,255],[95,395],[270,335]],c:[326,560,1,1],
 sol:[[[150,228],[300,362]]],show:[[[70,435],[205,215]],[[60,407],[300,325]]]});
/* P6 Sky Slide: no ledges to rest on this time. Two pegs hold the slide up in the air. */
LV.push({n:'Sky Slide',h:'Nothing to rest on? Lock it.',idea:'With nothing to rest on, run the slide through both pegs so it locks in mid-air.',
 m:on(0,90,150,150,30),s:[...run([[0,90],[150,150],[175,155]]),block(345,150,8,200),block(0,330,8,250),plank(110,500,66,528,10)],p:[[290,320],[160,420]],c:[38,560,-1],
 sol:[[[330,290],[110,460]]],show:[[[330,290],[200,320]]]});
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
/* Chapter 3, Big Air: speed strips and red launch pads (7 Nov). */
/* B1 Launch Pad: the pad throws the marble high; it would fall down the shaft. Lay a line across the shaft for it to land on. */
LV.push({n:'Launch Pad',h:'Red pads fire the marble. Give it a landing.',idea:'The pad throws the marble over the shaft: bridge it so it lands and rolls to the cup.',
 m:on(0,80,90,400,30),s:[...run([[0,80],[90,400],[130,500],[170,512]]),block(230,340,14,300),block(310,340,12,300),block(322,622,38,18),block(352,200,8,422)],sp:[[195,512,50,-.15,14]],c:[337,600,1,1],
 sol:[[[234,333],[318,333]]],show:[[[200,300],[330,300]]]});
/* B2 Updraft: a strip pointing up lifts whatever rolls into it. Turn the marble back into the updraft and it rides up to the cup. */
LV.push({n:'Updraft',h:'Strips push. Ride this one up.',idea:'Catch the marble and slide it back into the upward strip, which carries it up to the high cup.',
 m:on(360,90,250,190,30),s:[...run([[360,90],[250,190],[215,200]],14,80),block(0,330,60,14),block(300,330,60,270),block(352,210,8,120),block(150,600,210,40)],bo:[[272,465,270,-Math.PI/2+.1,11]],c:[332,309,1,1],
 sol:[[[40,322],[255,588]]],show:[[[40,322],[150,590]]]});
/* B4 Against the Flow: a strip on the floor pushes back and stops the marble. Draw a hump over it. */
LV.push({n:'Against the Flow',h:'This strip pushes back. Go over it.',idea:'An arch over the strip keeps the marble out of its push.',
 m:on(0,80,70,450,30),s:[...run([[0,80],[40,400],[120,566],[305,566]],14,160),block(352,380,8,260),block(305,622,55,18)],bo:[[245,550,100,Math.PI,17]],c:[331,600,1,1],
 sol:[[[165,556],[200,537],[245,532],[290,537],[304,552]]],show:[[[170,552],[302,552]]]});
/* B3 Curtain: the pad throws the marble clean over the cup. Hang a line from the peg and it stops the marble dead. */
LV.push({n:'Curtain',h:'Too far! Hang a line from the peg.',idea:'A line through one peg hangs straight down: a curtain that stops the flying marble over the cup.',
 m:on(0,80,90,400,30),s:[...run([[0,80],[90,400],[130,500],[170,512]]),block(230,420,14,220),block(244,622,116,18),plank(244,520,272,575,10),plank(366,560,328,575,10)],sp:[[200,512,50,-.1,15]],p:[[318,150]],c:[300,600,1,1],
 sol:[[[318,150],[318,330]]],show:[[[318,150],[200,150]]]});
/* Chapter 4, Hands Off: red zones where you cannot draw (7 Nov). */
/* H1 Red Zone: the top gap is all red, so bridge the gap below it instead. */
LV.push({n:'Red Zone',h:'No drawing in the red zone.',idea:'The top gap is red: let the marble fall through and bridge the lower gap.',
 m:on(0,60,150,215,30),s:[plank(0,60,150,215),block(80,300,60,14),block(270,300,30,100),block(40,420,110,14),block(274,455,24,185),block(298,560,62,80),block(352,120,8,440)],z:[[60,230,260,90]],c:[325,540,1,1],
 sol:[[[90,412],[292,447]]],show:[[[90,412],[230,430]]]});
/* H2 Drop It: the gap is all red. Draw the bridge above the red and let it fall into place. */
LV.push({n:'Drop It',h:'Can\'t draw there? Drop it in.',idea:'Draw the bridge above the red zone; it falls across the gap.',
 m:on(0,60,150,215,30),s:[plank(0,60,150,215),block(80,330,60,14),block(270,330,30,14),block(286,344,14,296),block(352,120,8,460)],z:[[60,250,240,140]],c:[329,560,1,1],
 sol:[[[110,238],[290,238]]],show:[[[110,238],[200,238]]]});
/* H4 Drop the Ramp: red round the wall's foot. Draw the ramp above it, sloping up to the wall: it falls and leans on the wall. */
LV.push({n:'Drop the Ramp',h:'Drop a ramp against the wall.',idea:'Draw the ramp above the red; it drops and leans on the wall.',
 m:on(0,60,50,280,30),s:[...run([[0,60],[50,280],[95,420],[130,470],[262,472]]),block(262,418,18,222),plank(280,528,303,543),block(352,150,8,440)],z:[[140,380,150,100]],c:[326,560,1,1],
 sol:[[[180,372],[262,322],[290,306]]]});
/* H7 Red Peak: the peak is red. Drop a line on to it from above, with more of it to the right, so it tips that way. */
LV.push({n:'Red Peak',h:'Drop it so it tips the right way.',idea:'Draw the line above the red with most of it right of the peak: it lands tipped towards the cup.',
 m:[160,40],s:[block(130,20,8,90),block(182,20,8,90),plank(70,330,170,280,14),plank(170,280,290,330,14),block(0,520,100,14),block(290,560,70,14),block(352,200,8,360)],z:[[40,200,280,160]],c:[322,539,1,1],
 sol:[[[110,190],[300,190]]],show:[[[40,190],[230,190]]]});
/* H3 Drawbridge: the gap is red, but the peg at its edge isn't. Draw the line straight up from the peg: it falls across like a drawbridge. */
LV.push({n:'Drawbridge',h:'Draw it up. Let it fall.',idea:'A line up from the peg falls across the red gap like a drawbridge.',
 m:on(0,280,140,410,30),s:[...run([[0,280],[140,410],[160,420],[175,420]],14,60),block(150,420,30,14),block(288,445,24,14),block(312,540,48,100),block(352,300,8,240)],p:[[175,415]],z:[[198,0,92,500]],c:[334,519,1,1],
 sol:[[[175,415],[187,280]]],show:[[[175,415],[160,280]]]});
/* H5 Hang Down: you can't draw under the peg, but a line through it swings down by itself. Draw it sideways. */
LV.push({n:'Hang Down',h:'Lines through one peg swing.',idea:'Draw the line through the peg sideways, above the red: it swings down into a curtain that stops the marble.',
 m:on(0,80,90,400,30),s:[...run([[0,80],[90,400],[130,500],[170,512]]),block(230,420,14,220),block(244,622,116,18),plank(244,520,272,575,10),plank(366,520,328,575,10)],sp:[[200,512,50,-.1,15]],p:[[318,150]],z:[[200,160,160,300]],c:[300,600,1,1],
 sol:[[[318,150],[200,150]]],show:[[[318,150],[318,100]]]});
/* H6 Landing Drop: the pad throws the marble over the shaft, but the shaft is red. Draw the landing above it and drop it on. */
LV.push({n:'Landing Drop',h:'Drop the landing in.',idea:'Draw the landing above the red; it drops across the shaft before the marble arrives.',
 m:on(0,80,90,400,30),s:[...run([[0,80],[90,400],[130,500],[170,512]]),block(230,340,14,300),block(310,340,12,300),block(322,622,38,18),block(352,200,8,422)],sp:[[195,512,50,-.15,14]],z:[[214,250,120,140]],c:[337,600,1,1],
 sol:[[[232,238],[319,238]]],show:[[[236,238],[290,238]]]});
/* Chapter 5, Odd Inks: rubber bounces, glass breaks if hit hard (7 Nov). */
/* O1 Trampoline: rubber ink bounces. Lock a rubber line under the drop, tilted towards the cup, and the marble bounces over the wall. */
LV.push({n:'Trampoline',ink:'rubber',h:'Rubber ink bounces.',idea:'Lock rubber under the drop, tilted towards the cup: the marble bounces over the wall.',
 m:[110,60],s:[block(76,20,8,200),block(136,20,8,200),block(200,300,14,340),plank(214,430,262,500,10),plank(360,420,318,500,10),block(264,540,52,100),block(352,150,8,270)],p:[[70,480],[150,490],[150,450]],c:[290,519,1,1],
 sol:[[[50,477],[170,492]]],show:[[[50,485],[170,445]],[[150,420],[150,520]]]});
/* O2 Bank Shot: the marble flies off its ledge, over the cup. A rubber wall through the pegs bounces it back down into the cup. */
LV.push({n:'Bank Shot',ink:'rubber',h:'Bounce it back.',idea:'Lock a rubber wall in its path: the marble bounces back into the cup below.',
 m:on(0,70,120,260,30),s:[...run([[0,70],[120,260],[160,280],[175,280]],14,60),block(0,290,175,14),plank(0,520,72,592,10),plank(230,500,128,592,10),block(60,622,100,18),block(0,304,8,216)],p:[[300,290],[300,400]],c:[100,600,1,1],
 sol:[[[300,250],[300,440]]],show:[[[270,290],[330,290]]]});
/* O3 Handle With Care: glass breaks if it's hit hard. Lay the bridge flush with both ledges so the marble rolls on gently. */
LV.push({n:'Handle With Care',ink:'glass',h:'Glass breaks if hit hard.',idea:'Lay the glass bridge flush with the shelf: the marble rolls on gently instead of dropping on it.',
 m:on(0,84,140,108,40),s:[plank(0,84,140,108),block(230,120,60,14),block(352,60,8,560),block(270,622,90,18),plank(282,520,292,600,8)],c:[324,600,1,1],
 sol:[[[118,97],[256,112]]],show:[[[118,140],[256,140]]]});
/* O4 Glass Steps: two gaps, glass ink. Lay one glass line flush across both so the marble never drops on it. */
LV.push({n:'Glass Steps',ink:'glass',h:'Glass breaks if hit hard.',idea:'One glass line, flush with the shelf, crosses both gaps on the pillar.',
 m:on(0,84,140,108,40),s:[plank(0,84,140,108),block(185,112,16,528),block(250,116,50,14),block(352,60,8,560),block(270,622,90,18)],c:[324,600,1,1],
 sol:[[[118,97],[290,108]]],show:[[[118,130],[290,130]]]});
/* chapters, in order: name and number of levels */
LV.CH=[{n:'Ledges',c:7},{n:'Pegs',c:6},{n:'Big Air',c:4},{n:'Hands Off',c:7},{n:'Odd Inks',c:4}];
module.exports=LV;
