'use strict';
/* GET-APP (dn-app.js, 15 Nov 2026; SITE.md › Getting the app): the website sends players to the Android
   app on Google Play. A returning player (saves on 2+ days) in an Android browser sees one card on Puzzles
   and one line on a solved finish sheet, until Get the app or Not now; a first visit sees neither, nor does
   an iPhone or the app's own web view. Account and About always link to Google Play where it can be used. */
const {test,expect,H,goto}=require('./support');
const PLAY=/^https:\/\/play\.google\.com\/store\/apps\/details\?id=uk\.co\.dailynoodle\.app&referrer=utm_source%3Ddailynoodle%26utm_medium%3Dwebsite%26utm_campaign%3D/;
const TWO_DAYS={v:1,done:{'DP·SWEEP·2026-10-18':{o:'win',s:90,b:7,d:'2026-10-18'},'DP·SWEEP·2026-10-19':{o:'win',s:80,b:7,d:'2026-10-19'}}};
const seed=(ctx,save)=>ctx.addInitScript(s=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('digi-sweep-v1',JSON.stringify(s));}},save);

test('GET-APP-01: GIVEN a first visit on an Android phone WHEN Puzzles opens THEN there is no app card',async({phone})=>{
 await goto(phone,'puzzles.html');
 await expect(phone.p.locator('#getapp')).toBeHidden();
 expect(phone.errors).toEqual([]);
});

test('GET-APP-02: GIVEN a returning Android player WHEN Puzzles opens THEN the card links to Google Play, and Not now hides it for good',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();
 await seed(ctx,TWO_DAYS);
 await p.goto('https://dailynoodle.co.uk/puzzles.html');await H.wait(p,1500);
 const card=p.locator('#getapp');
 await expect(card).toBeVisible();
 await expect(card.locator('b')).toHaveText('Daily Noodle is on Google Play');
 await expect(card.getByRole('link',{name:'Get it on Google Play'})).toBeVisible();
 expect(await card.locator('.go img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 expect(await card.locator('.go').getAttribute('href')).toMatch(new RegExp(PLAY.source+'today$'));
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await H.tap(p,card.locator('.no'));
 await expect(card).toBeHidden();
 expect((await p.evaluate(()=>JSON.parse(localStorage.getItem('noodle-getapp-v1')))).no).toBeGreaterThan(0);
 await p.reload();await H.wait(p,1500);
 await expect(card).toBeHidden();
 await H.wait(p,11000);   // the tracker sends every 10 s
 const got=events.filter(e=>/^app_promo_/.test(e.ev)).map(e=>e.ev+':'+e.x.place);
 expect(got).toEqual(expect.arrayContaining(['app_promo_view:today','app_promo_dismiss:today']));
 await ctx.close();
});

test('GET-APP-03: GIVEN a returning player in the app\'s web view WHEN Puzzles and Account open THEN neither offers the app',async({phone})=>{
 const {p,ctx}=phone;await seed(ctx,TWO_DAYS);
 await ctx.addInitScript(()=>{window.__DN_APP=2;});
 await goto(phone,'puzzles.html');
 await expect(p.locator('#getapp')).toBeHidden();
 await goto(phone,'account.html');
 await expect(p.locator('[data-getapp="account"]')).toBeHidden();
});

test('GET-APP-04: GIVEN an Android browser WHEN Account and About open THEN each links to Google Play with its place',async({phone})=>{
 const {p}=phone;
 await goto(phone,'account.html');
 const row=p.getByRole('link',{name:'Get the Android app'});
 await expect(row).toBeVisible();
 expect(await row.getAttribute('href')).toMatch(new RegExp(PLAY.source+'account$'));
 await goto(phone,'about.html');
 const a=p.getByRole('link',{name:'on Google Play',exact:true});
 await expect(a).toBeVisible();
 expect(await a.getAttribute('href')).toMatch(new RegExp(PLAY.source+'about$'));
 const badge=p.getByRole('link',{name:'Get it on Google Play',exact:true});
 await expect(badge).toBeVisible();
 expect(await badge.getAttribute('href')).toMatch(new RegExp(PLAY.source+'about-badge$'));
 expect(await badge.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 await expect(p.getByText('Google Play and the Google Play logo are trademarks of Google LLC.')).toBeVisible();
 expect(await p.content()).not.toMatch(/is in testing/);
 expect(phone.errors).toEqual([]);
});

test('GET-APP-05: GIVEN a returning Android player WHEN a solved finish sheet opens THEN it ends with Get the Daily Noodle app',async({phone})=>{
 const {p,ctx}=phone;await seed(ctx,TWO_DAYS);
 await goto(phone,'reports/2026-10-19-logic-sweep.html');
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:5000});
 const line=sheet.locator('.fin-getapp');
 await expect(line).toHaveText('Get the Daily Noodle app ›',{timeout:5000});
 expect(await line.getAttribute('href')).toMatch(new RegExp(PLAY.source+'finish$'));
 expect(phone.errors).toEqual([]);
});

test('GET-APP-06: GIVEN a returning player on an iPhone WHEN Puzzles and Account open THEN neither offers the app',async({browser})=>{
 const ctx=await H.newPhone(browser);const p=await ctx.newPage();
 await ctx.addInitScript(()=>{Object.defineProperty(Navigator.prototype,'userAgent',{get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',configurable:true});});
 await seed(ctx,TWO_DAYS);
 await p.goto('https://dailynoodle.co.uk/puzzles.html');await H.wait(p,1500);
 await expect(p.locator('#getapp')).toBeHidden();
 await p.goto('https://dailynoodle.co.uk/account.html');await H.wait(p,1500);
 await expect(p.locator('[data-getapp="account"]')).toBeHidden();
 await ctx.close();
});
