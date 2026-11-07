'use strict';
// ARCHIVE: the archive by month (archive.html, SITE.md › Archive and personal stats, 6 Nov 2026).
const {test,expect,goto}=require('./support');
const H=require('../harness');
const feed=require('../../../feed.json');

const TODAY='2026-10-19';   // support.js pins the clock to 19 Oct 2026, 12:00 London
const items=(feed.items||[]).filter(it=>it.kind==='puzzle'&&!it.badge&&it.type&&it.date);
const day=d=>items.filter(it=>it.date===d);
const saveAll=list=>{const by={};for(const it of list){(by[it.type]=by[it.type]||{})[it.id]=it.type==='mini'?{s:61,d:it.date}:it.type==='link'?{o:'win',t:'01:10',m:1,r:[],g:[],d:it.date}:it.type==='borders'?{c:8,p:650,secs:9,ans:[],on:it.date}:{s:30,o:'played',p:500,t:'01:00',d:it.date};}return by;};
async function seed(phone,by){
 await phone.ctx.addInitScript(s=>{const o=JSON.parse(s);for(const t in o)try{localStorage.setItem('digi-'+t+'-v1',JSON.stringify({v:1,done:o[t]}));}catch(e){}},JSON.stringify(by));
}

test('ARCHIVE-01: GIVEN a day finished in full WHEN its month opens THEN the day is marked done and nothing from today on is offered',async({phone})=>{
 const full=day('2026-10-17'),some=day('2026-10-16');
 expect(full.length).toBeGreaterThan(5);
 await seed(phone,saveAll(full.concat(some.slice(0,2))));
 await goto(phone,'archive.html?m=2026-10');
 await expect(phone.p.locator('#ar-month')).toHaveText('October 2026');
 const c17=phone.p.locator('button.ar-c[data-d="2026-10-17"]');
 await expect(c17).toHaveClass(/full/);
 await expect(c17.locator('small')).toHaveText(full.length+'/'+full.length);
 await expect(phone.p.locator('button.ar-c[data-d="2026-10-16"]')).toHaveClass(/part/);
 // Today and later are never offered: today's set is on the Puzzles page, forward-dated files never.
 expect(await phone.p.locator('button.ar-c[data-d="'+TODAY+'"]').count()).toBe(0);
 expect(await phone.p.locator('button.ar-c[data-d="2026-10-25"]').count()).toBe(0);
 await expect(phone.p.locator('#ar-next')).toBeDisabled();
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});

test('ARCHIVE-02: GIVEN a type chosen in the picker WHEN chosen THEN the calendar and the day show only that type',async({phone})=>{
 const minis=day('2026-10-10').filter(it=>it.type==='mini');
 await seed(phone,saveAll(minis));
 await goto(phone,'archive.html?m=2026-10');
 // 7 Nov 2026: the type chips became one picker (a sheet of tiles), as the app's Archive.
 await H.tap(phone.p,phone.p.locator('#ar-pick'));await H.wait(phone.p,100);
 await H.tap(phone.p,phone.p.locator('#ar-sheet .ar-tile[data-t="mini"]'));await H.wait(phone.p,100);
 await expect(phone.p.locator('#ar-pick-name')).toHaveText('Mini');
 await expect(phone.p.locator('button.ar-c[data-d="2026-10-10"] small svg.ar-tk')).toHaveCount(1);
 await expect(phone.p.locator('button.ar-c[data-d="2026-10-11"] small')).toHaveText('');
 await H.tap(phone.p,phone.p.locator('button.ar-c[data-d="2026-10-10"]'));await H.wait(phone.p,100);
 const rows=phone.p.locator('#ar-day a.ar-row');
 await expect(rows).toHaveCount(1);
 await expect(rows.first()).toContainText('1:01');
 expect(new URL(phone.p.url()).search).toBe('?m=2026-10&t=mini&d=2026-10-10');
});

test('ARCHIVE-03: GIVEN a day WHEN a puzzle is chosen THEN it opens that released file and archive_play carries its type and id only',async({browser})=>{
 const events=[];
 const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();
 await p.clock.install({time:new Date('2026-10-19T12:00:00+01:00')});
 await p.goto('https://dailynoodle.co.uk/archive.html?m=2026-10&d=2026-10-12');await H.wait(p,1500);
 const list=day('2026-10-12');
 const rows=p.locator('#ar-day a.ar-row');
 await expect(rows).toHaveCount(list.length);
 for(const it of list)await expect(p.locator('#ar-day a.ar-row[href="'+it.path+'?via=archive"]')).toHaveCount(1);
 const first=list[0];
 await p.evaluate(()=>{document.addEventListener('click',e=>{if(e.target.closest('a.ar-row'))e.preventDefault();},true);});
 await H.tap(p,p.locator('#ar-day a.ar-row').first());
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,200);
 const play=events.find(e=>e.ev==='archive_play'),open=events.find(e=>e.ev==='archive_open');
 expect(open,'archive_open sent').toBeTruthy();
 expect(play,'archive_play sent').toBeTruthy();
 const {pv,...props}=play.x;
 expect(props).toEqual({type:first.type,id:first.id});
 await ctx.close();
});

test('ARCHIVE-04: GIVEN a small phone in dark mode WHEN the archive opens THEN nothing spills sideways and no errors show',async({browser})=>{
 const ctx=await H.newPhone(browser,{width:320,height:568,scheme:'dark'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.clock.install({time:new Date('2026-10-19T12:00:00+01:00')});
 await p.goto('https://dailynoodle.co.uk/archive.html?d=2026-10-18');await H.wait(p,1500);
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const bg=await p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
 expect(bg).toBe('rgb(17, 19, 26)');
 await expect(p.locator('#ar-day a.ar-row').first()).toBeVisible();
 expect(errs).toEqual([]);
 await ctx.close();
});

test('ARCHIVE-05: GIVEN every puzzle of the day finished WHEN a finished one reopens THEN "Try the archive" opens the archive',async({phone})=>{
 const list=day(TODAY);expect(list.length).toBeGreaterThan(5);
 await seed(phone,saveAll(list));
 const mini=list.find(it=>it.type==='mini');
 await goto(phone,mini.path);
 const row=phone.p.locator('.fin-next-done');
 await expect(row).toContainText('Try the archive');
 await expect(row).toHaveAttribute('href','../archive.html?from=finish');
});

test('ARCHIVE-06: GIVEN the archive opens WHEN nothing is chosen THEN it is a list, newest first by month, with one row of controls',async({phone})=>{
 await goto(phone,'archive.html');
 const p=phone.p;
 await expect(p.locator('#ar-listview')).toBeVisible();await expect(p.locator('#ar-cal')).toBeHidden();
 const past=items.filter(it=>it.date<TODAY);
 await expect(p.locator('#ar-listview a.ar-row')).toHaveCount(past.length);
 await expect(p.locator('#ar-listview .ar-sec').first()).toHaveText('October 2026');
 const first=await p.locator('#ar-listview a.ar-row').first().getAttribute('href');
 expect(first).toContain('2026-10-18');
 await expect(p.locator('#ar-listview a.ar-row').first()).toContainText('Yesterday');
 // the controls: picker, Hide done, calendar; every one at least 44 px tall
 for(const id of ['#ar-pick','#ar-hide','#ar-view']){const b=await p.locator(id).boundingBox();expect(b.height,id).toBeGreaterThanOrEqual(44);}
 await expect(p.locator('#ar-pick-name')).toHaveText('All');
 expect(await p.locator('#ar-pick-ico .ar-mark svg').count()).toBe(1);
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(phone.errors).toEqual([]);
});

test('ARCHIVE-07: GIVEN puzzles finished WHEN Hide done is on THEN they leave the list, the address keeps it, and the calendar hides the switch',async({phone})=>{
 const done=day('2026-10-18');
 await seed(phone,saveAll(done));
 await goto(phone,'archive.html?t=mini');
 const p=phone.p;
 const minis=items.filter(it=>it.type==='mini'&&it.date<TODAY);
 await expect(p.locator('#ar-listview a.ar-row')).toHaveCount(minis.length);
 await expect(p.locator('#ar-listview a.ar-row.ok')).toHaveCount(1);
 await H.tap(p,p.locator('#ar-hide'));await H.wait(p,100);
 await expect(p.locator('#ar-hide')).toHaveAttribute('aria-checked','true');
 await expect(p.locator('#ar-listview a.ar-row')).toHaveCount(minis.length-1);
 expect(new URL(p.url()).search).toBe('?t=mini&h=1');
 await H.tap(p,p.locator('#ar-view'));await H.wait(p,100);
 await expect(p.locator('#ar-cal')).toBeVisible();await expect(p.locator('#ar-hide')).toBeHidden();
 await expect(p.locator('#ar-view')).toHaveAttribute('aria-pressed','true');
 await H.tap(p,p.locator('#ar-view'));await H.wait(p,100);
 await expect(p.locator('#ar-listview')).toBeVisible();
 expect(phone.errors).toEqual([]);
});

test('ARCHIVE-08: GIVEN the picker sheet WHEN opened THEN it is titled "Choose a puzzle", focus is on the current tile, and Escape or the scrim closes it',async({phone})=>{
 await goto(phone,'archive.html');
 const p=phone.p;
 await H.tap(p,p.locator('#ar-pick'));await H.wait(p,100);
 await expect(p.locator('#ar-sheet')).toBeVisible();
 await expect(p.locator('#ar-sheet-title')).toHaveText('Choose a puzzle');
 await expect(p.locator('#ar-sheet .ar-tile')).toHaveCount(10);
 await expect(p.locator('#ar-sheet .ar-tile[data-t=""]')).toBeFocused();
 await expect(p.locator('#ar-pick')).toHaveAttribute('aria-expanded','true');
 await p.keyboard.press('Escape');
 await expect(p.locator('#ar-sheet')).toBeHidden();await expect(p.locator('#ar-pick')).toBeFocused();
 await H.tap(p,p.locator('#ar-pick'));await H.wait(p,100);
 await p.mouse.click(10,10);await H.wait(p,100);
 await expect(p.locator('#ar-sheet')).toBeHidden();
 expect(phone.errors).toEqual([]);
});
