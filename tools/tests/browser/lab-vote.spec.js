'use strict';
/* The Lab vote (engines/finish.js, 11 Nov 2026): after a Lab puzzle is solved, the finish sheet asks one question,
   "Should <Name> go daily?", with Yes and No. One tap keeps the answer (noodle-lab-votes-v1, the app's shape) and
   sends it to public.lab_vote with this browser's own voter code, never the tracker's; tapping the other changes it;
   a reopened sheet shows the answer; a daily puzzle's sheet has no question. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path'),vm=require('vm');
const FILE='reports/2026-11-06-word-redact-0010.html';
const P=vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,FILE),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')');
const cell=(p,i)=>p.locator('#grid .cell').nth(i);
test('LAB-VOTE-01: GIVEN a solved Lab puzzle WHEN Yes then No is tapped THEN each is kept and sent once, with its own voter code',async({phone})=>{
 const p=phone.p,sent=[];
 p.on('request',r=>{if(/\/rpc\/lab_vote$/.test(r.url()))sent.push(JSON.parse(r.postData()||'{}'));});
 await goto(phone,FILE);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 for(const i of P.black)await H.tap(p,cell(p,i));
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:5000});
 const vote=sheet.locator('.fin-vote');
 await expect(vote.locator('h3')).toHaveText('Should Redact go daily?');
 await expect(vote.locator('.fin-vote-note')).toHaveText('Your vote helps decide if it stays.');
 await expect(vote.locator('.fin-vote-btn[aria-pressed="true"]')).toHaveCount(0);
 await H.tap(p,vote.locator('[data-v="yes"]'));await H.wait(p,300);
 await expect(vote.locator('[data-v="yes"]')).toHaveAttribute('aria-pressed','true');
 await expect(vote.locator('.fin-vote-note')).toContainText('Thanks');
 let saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('noodle-lab-votes-v1')));
 expect(saved.redact.v).toBe('yes');
 const voter=await p.evaluate(()=>localStorage.getItem('noodle-lab-voter'));
 expect(voter).toMatch(/^[0-9a-f-]{36}$/);
 expect(voter).not.toBe(await p.evaluate(()=>localStorage.getItem('digi.aid')));
 // the same answer again sends nothing; the other answer changes it
 await H.tap(p,vote.locator('[data-v="yes"]'));
 await H.tap(p,vote.locator('[data-v="no"]'));await H.wait(p,300);
 await expect(vote.locator('[data-v="no"]')).toHaveAttribute('aria-pressed','true');
 await expect(vote.locator('[data-v="yes"]')).toHaveAttribute('aria-pressed','false');
 saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('noodle-lab-votes-v1')));
 expect(saved.redact.v).toBe('no');
 expect(sent.map(s=>[s.p_type,s.p_vote,s.p_source,s.p_anon===voter])).toEqual([['redact',true,'web',true],['redact',false,'web',true]]);
 // reopened: the answer shows
 await p.reload();await H.wait(p,1500);
 await expect(p.locator('.fin-box.fin-open .fin-vote [data-v="no"]')).toHaveAttribute('aria-pressed','true');
 expect(phone.errors).toEqual([]);
});
test('LAB-VOTE-02: GIVEN a daily puzzle WHEN its sheet opens THEN it asks no Lab question',async({phone})=>{
 const p=phone.p;
 const file=fs.readdirSync(path.join(H.REPO,'reports')).filter(f=>/-logic-tally-\d+\.html$/.test(f)).sort()[0];
 await goto(phone,'reports/'+file);
 await p.evaluate(id=>{const s={v:1,done:{}};s.done[id]={t:'1:00',s:60,d:'2026-11-01'};localStorage.setItem('digi-tally-v1',JSON.stringify(s));},
   vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,'reports',file),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')').id);
 await p.reload();await H.wait(p,1500);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:5000});
 await expect(p.locator('.fin-vote')).toHaveCount(0);
});
