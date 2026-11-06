/* Hand-made levels. Each has an idea (what the player should realise) and the line a person would draw for it. */
const T=14;
const rad=Math.PI/180;
/* a plank of scenery from (x1,y1) to (x2,y2): [cx,cy,w,h,angle] */
/* planks (runs, ramps, ledges) get fully rounded ends so the marble glides over joins; blocks keep crisp corners */
const plank=(x1,y1,x2,y2,h=T)=>[ (x1+x2)/2,(y1+y2)/2,Math.hypot(x2-x1,y2-y1),h,Math.atan2(y2-y1,x2-x1),1];
const block=(x,y,w,h)=>[x+w/2,y+h/2,w,h,0];
/* the marble resting on a plank's top surface, a distance d along it from (x1,y1) */
const on=(x1,y1,x2,y2,d,h=T)=>{const l=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/l,uy=(y2-y1)/l;let nx=uy,ny=-ux;if(ny>0){nx=-nx;ny=-ny}const o=11+h/2+1;return[x1+ux*d+nx*o,y1+uy*d+ny*o]};
const L=[];
module.exports={L,plank,block,on};
