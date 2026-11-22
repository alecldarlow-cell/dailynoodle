'use strict';
/* One unfinished round per puzzle (22 Nov 2026, Alec: "Only one Tally can be part-played at a time"
   came up too often in the app, and the website silently replaced the other round). Each of Tally,
   Link, Borders and Reckon keeps every puzzle's round in digi-<type>-v1.rounds[id]; cur still holds
   the latest. GIVEN two puzzles of a type part-played, WHEN the older one is opened again, THEN it
   resumes from its own round. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path');
const {parseDnPuzzle}=require('../../puzzle-json');
const puzzle=file=>parseDnPuzzle(fs.readFileSync(path.join(H.REPO,file),'utf8'));
const ls=(p,k)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),k);
async function seed(phone,key,doc){
 await phone.ctx.addInitScript(([k,v])=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.setItem(k,v);},[key,JSON.stringify(doc)]);
}

test('ROUNDS-E2E-01: GIVEN Tally 1 part-played WHEN Tally 2 is played and Tally 1 reopened THEN Tally 1 carries on from its own board, and both rounds are saved',async({phone})=>{
 const p=phone.p,A='reports/2026-10-25-logic-tally-0001.html',B='reports/2026-10-26-logic-tally-0002.html';
 const PA=puzzle(A),PB=puzzle(B);
 const enter=async(P,i)=>{await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);await H.tap(p,p.locator('.cell').nth(i));await H.tap(p,p.locator('#keys button').nth(+P.sol[i]-1));await H.wait(p,400);};
 await goto(phone,A);await enter(PA,0);
 await goto(phone,B);await enter(PB,1);
 const s=await ls(p,'digi-tally-v1');
 expect(Object.keys(s.rounds).sort()).toEqual([PA.id,PB.id].sort());
 expect(s.cur.id).toBe(PB.id);
 expect(s.rounds[PA.id].g[0]).toBe(+PA.sol[0]);expect(s.rounds[PB.id].g[1]).toBe(+PB.sol[1]);
 await goto(phone,A);
 await expect(p.locator('#dnPlay')).toBeVisible();
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('.cell').nth(0).locator('.val')).toHaveText(String(PA.sol[0]));
 await expect(p.locator('#msg')).toContainText('Carrying on');
 // finishing Tally 1 takes only its own round away
 for(let i=1;i<PA.sol.length;i++){await H.tap(p,p.locator('.cell').nth(i));await H.tap(p,p.locator('#keys button').nth(+PA.sol[i]-1));}
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:5000});
 const after=await ls(p,'digi-tally-v1');
 expect(after.done[PA.id]).toBeTruthy();
 expect(Object.keys(after.rounds)).toEqual([PB.id]);
 expect(phone.errors).toEqual([]);
});

test('ROUNDS-E2E-02: GIVEN a Borders round kept in rounds while cur holds another puzzle\'s WHEN it is opened THEN it offers Resume at its own question',async({phone})=>{
 const p=phone.p,A='reports/2026-10-05-geo-borders-0001.html',B='reports/2026-10-06-geo-borders-0002.html';
 const a=puzzle(A).id,b=puzzle(B).id;
 const ra={id:a,i:2,ans:[{ok:true},{ok:true}],pts:200,run:2,secs:20,at:1},rb={id:b,i:5,ans:[{ok:true},{ok:true},{ok:true},{ok:true},{ok:true}],pts:500,run:5,secs:40,at:2};
 await seed(phone,'digi-borders-v1',{v:1,done:{},cur:rb,rounds:{[a]:ra,[b]:rb}});
 await goto(phone,A);
 await expect(p.locator('#playStatus')).toHaveText('Question 3 of 10, 200 points so far.');
 await expect(p.locator('#playGo')).toHaveText('Resume');
 await goto(phone,B);
 await expect(p.locator('#playStatus')).toHaveText('Question 6 of 10, 500 points so far.');
 expect(phone.errors).toEqual([]);
});

test('ROUNDS-E2E-03: GIVEN a Reckon round kept in rounds while cur holds another puzzle\'s WHEN it is opened THEN it offers Resume at its own question',async({phone})=>{
 const p=phone.p,A='reports/2026-10-20-quiz-reckon-0001.html',B='reports/2026-10-21-quiz-reckon-0002.html';
 const a=puzzle(A).id,b=puzzle(B).id;
 const ra={id:a,i:2,ph:'g',g:[1,2],z:[0,0],cur:null,secs:20,at:1},rb={id:b,i:0,ph:'g',g:[],z:[],cur:null,secs:3,at:2};
 await seed(phone,'digi-reckon-v1',{v:1,done:{},cur:rb,rounds:{[a]:ra,[b]:rb}});
 await goto(phone,A);
 await expect(p.locator('#playStatus')).toContainText('Question 3 of 10');
 await expect(p.locator('#playCard')).toHaveText('Resume');
 expect(phone.errors).toEqual([]);
});

test('ROUNDS-E2E-04: GIVEN a Link round kept in rounds while cur holds another puzzle\'s WHEN it is opened THEN it offers Resume with its own group found',async({phone})=>{
 const p=phone.p,A='reports/2026-08-10-word-link-0002.html',B='reports/2026-08-12-word-link-0004.html';
 const PA=puzzle(A),b=puzzle(B).id;
 const ra={id:PA.id,f:[PA.groups[0].rank],m:1,g:[],tr:[],l:null,s:30,at:1},rb={id:b,f:[],m:0,g:[],tr:[],l:null,s:5,at:2};
 await seed(phone,'digi-link-v1',{v:1,done:{},cur:rb,rounds:{[PA.id]:ra,[b]:rb}});
 await goto(phone,A);
 await expect(p.locator('#dnPlay')).toHaveText('Resume');
 await expect(p.locator('.dn-start-card h2+p')).toContainText('One group found so far');
 expect(phone.errors).toEqual([]);
});
