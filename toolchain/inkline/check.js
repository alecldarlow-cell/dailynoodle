/* Check every level (or the listed ones):
   - no line: the level must not finish by itself (tiny harmless lines in out-of-the-way spots, marble nudged by fractions of a pixel)
   - the intended line must win, and keep winning when drawn 60 times by a wobbly hand (aim for 85% or more)
   - with gems: how often that wobbly intended line also takes both gems
   - show lines (e.g. the wrong peg pairs) are reported as won or lost
   node toolchain/inkline/check.js [0,3,7] */
const {run,wobble,rng}=require('./rig.js');const LV=require('./levels.js');const G=require('./gems.json');const only=process.argv[2]?process.argv[2].split(',').map(Number):null;
LV.forEach((L0,i)=>{if(only&&!only.includes(i))return;const L={...L0,g:(G[i]||{}).g||[]},r=rng(17+i);let self=0;
 for(let k=0;k<12;k++){const x=6+k*2.5,y=628-(k%3);if(run({...L,m:[L.m[0]+((k%5)-2)*.3,L.m[1]+((k%3)-1)*.3]},[[x,y],[x+22,y]]).state=='won')self++}
 const sols=(L.sol||[]).map(P=>{const b=run(L,P);let w=0,g3=0,N=60;for(let k=0;k<N;k++){const q=run(L,wobble(P,r));if(q.state=='won'){w++;if(q.gems==L.g.length)g3++}}return `${b.state} | wobbly hand wins ${Math.round(w/N*100)}%${L.g.length?', all gems '+Math.round(g3/N*100)+'%':''}`});
 const ex=(L.show||[]).map(P=>run(L,P).state);
 console.log(String(i+1).padStart(2),L.n.padEnd(14),'finishes alone:',self?'YES '+self+'/12':'no','|',sols.join(' ; '),ex.length?'| other lines: '+ex.join(','):'')});
