'use strict';
// LAB-PANEL-WEB: "From the Lab" on Puzzles and the tidied Lab page (17 Nov 2026, Alec: the app's
// Today panel on the website; the Lab was swamped with every past day of the trials).
const {test,expect,goto}=require('./support');
const feed=require('../../../feed.json');
const DAY='2026-11-17';
const lab=type=>(feed.items||[]).filter(it=>it.type===type&&/in development/i.test(it.badge||'')&&it.date<=DAY).sort((a,b)=>a.date<b.date?1:-1);
const tilt=lab('tilt')[0],redact=lab('redact')[0],tumbler=lab('tumbler')[0];
async function on(phone,file,saves){
 await phone.p.clock.setSystemTime(new Date(DAY+'T12:00:00Z'));
 if(saves)await phone.ctx.addInitScript(s=>{for(const k in s)try{localStorage.setItem(k,JSON.stringify(s[k]));}catch(e){}},saves);
 await goto(phone,file);
}

test('LAB-PANEL-WEB-01: GIVEN no Lab plays WHEN Puzzles opens THEN From the Lab sits under the day\'s set with the three trials, each Try it',async({phone})=>{
 expect(tilt&&redact&&tumbler,'a Lab puzzle of each type by '+DAY).toBeTruthy();
 await on(phone,'puzzles.html');
 const panel=phone.p.locator('#labpanel');
 await expect(panel).toBeVisible();
 await expect(panel.locator('h2')).toHaveText('From the Lab');
 await expect(panel).toContainText('your votes help decide which become permanent dailies');
 await expect(panel).not.toContainText('RATED');
 const rows=panel.locator('a.lp-row');
 await expect(rows).toHaveCount(3);
 expect(await rows.evaluateAll(a=>a.map(x=>x.dataset.type))).toEqual(['tilt','redact','tumbler']);
 expect(await rows.evaluateAll(a=>a.map(x=>x.getAttribute('href')))).toEqual([tilt.path,redact.path,tumbler.path]);
 await expect(panel.locator('.lp-call')).toHaveText(['Try it','Try it','Try it']);
 // the panel follows the feed, and the feed's cards are still only the dailies
 expect(await phone.p.evaluate(()=>document.getElementById('feed').nextElementSibling.id)).toBe('labpanel');
 await expect(phone.p.locator('#feed a.card[href*="logic-tilt"]:visible')).toHaveCount(0);
 expect(phone.errors).toEqual([]);
});

test('LAB-PANEL-WEB-02: GIVEN Tilt finished and voted, Redact finished not voted, Tumbler started WHEN Puzzles opens THEN the rows read Done, Rate it and Continue; a search hides the panel',async({phone})=>{
 await on(phone,'puzzles.html',{
  'digi-tilt-v1':{done:{[tilt.id]:{t:'0:42',s:42,n:14,d:DAY}}},
  'digi-redact-v1':{done:{[redact.id]:{t:'1:10',s:70,m:0,d:DAY}}},
  'digi-tumbler-v1':{done:{},cur:{id:tumbler.id,o:[0,0,0,0],w:[],t:2,s:5}},
  'noodle-lab-votes-v1':{tilt:{v:'yes',at:'2026-11-10T09:00:00Z'},tumbler:{v:'no',at:'2026-11-10T09:00:00Z'}}
 });
 const panel=phone.p.locator('#labpanel');
 await expect(panel.locator('.lp-call')).toHaveText(['✓ Done','Rate it','Continue']);
 await expect(panel.locator('.lp-call.done')).toHaveCount(1);
 await expect(panel.locator('.lp-chev')).toHaveCount(2);
 await phone.p.evaluate(()=>{const q=document.getElementById('q');q.value='doku';q.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(panel).toBeHidden();
 expect(phone.errors).toEqual([]);
});

test('LAB-PANEL-WEB-03: GIVEN three weeks of trial puzzles WHEN the Lab page opens THEN today\'s three lead and the older trial days are hidden but still in the page',async({phone})=>{
 await on(phone,'lab.html');
 const shown=phone.p.locator('#feed > li:not([hidden]) a.card');
 expect((await shown.evaluateAll(a=>a.map(x=>x.getAttribute('href')))).slice(0,3)).toEqual([tilt.path,redact.path,tumbler.path]);
 const trialShown=await shown.evaluateAll(a=>a.filter(x=>/-(logic-tilt|word-redact|word-tumbler)-/.test(x.getAttribute('href'))).length);
 expect(trialShown).toBe(3);
 const older=lab('tilt')[1];
 await expect(phone.p.locator('#feed > li[hidden] a.card[href="'+older.path+'"]')).toHaveCount(1);
 await expect(phone.p.locator('#feed > li:not([hidden]) a.card[href*="games"], #feed > li:not([hidden])[data-kind="game"]').first()).toBeVisible();
 await expect(phone.p.locator('#labpanel')).toHaveCount(0);
 // the count is what shows, not every trial day in the page
 const n=await phone.p.locator('#feed > li:not([hidden])').count();
 await expect(phone.p.locator('#count')).toHaveText(n+' items');
 expect(phone.errors).toEqual([]);
});
