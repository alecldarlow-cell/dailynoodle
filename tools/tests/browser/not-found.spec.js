'use strict';
// NOTFOUND: the 404 page's three cases (SITE.md, Sections, "404 page").
// GitHub Pages answers a missing path with 404.html and status 404, keeping
// the address, so the page reads the date from the link itself. This spec
// serves it that way from its own routes (registered after newPhone()'s, so
// they run first and fall back to the harness for files that exist), and
// controls puzzles-today.json to say whether today's build has run.
//   - a dated reports/ file whose London day hasn't come: "Not out yet" + its date
//   - one for today: "Nearly ready" until puzzles-today.json shows today's build, then not-found
//   - anything else: the normal not-found page
// Filenames below are not in reports/, as on the site before the build serves them.
const fs=require('fs'),path=require('path');
const {test,expect,H}=require('./support');
const PAGE404=fs.readFileSync(path.join(H.REPO,'404.html'));
const NOT_FOUND={h:'That page isn\'t here',title:'Page not found — The Daily Noodle'};

async function lost(browser,{time,url,built,todayList='ok'}){
 const ctx=await H.newPhone(browser);
 const seen=[];
 await ctx.route('https://dailynoodle.co.uk/**',route=>{
  const u=new URL(route.request().url());let p=decodeURIComponent(u.pathname);
  if(p==='/puzzles-today.json'){
   seen.push('today');
   if(todayList==='fail')return route.abort();
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({today:built,items:[]})});
  }
  if(p.endsWith('/'))p+='index.html';
  const f=path.join(H.REPO,p);
  if(f.startsWith(H.REPO)&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fallback();
  return route.fulfill({status:404,contentType:'text/html',body:PAGE404});
 });
 const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
 await p.clock.install({time:new Date(time)});
 const res=await p.goto('https://dailynoodle.co.uk'+url);
 await H.wait(p,600);
 const out={status:res.status(),url:p.url(),title:await p.title(),
  h:await p.locator('#lostH').textContent(),p:await p.locator('#lostP').textContent(),seen,errs:p.errs};
 await ctx.close();
 return out;
}

test.describe('NOTFOUND',()=>{
 test('NOTFOUND-01: a missing path is served as 404.html with status 404 and its own address',async({browser})=>{
  const r=await lost(browser,{time:'2026-10-20T12:00:00+01:00',url:'/no-such-page',built:'2026-10-20'});
  expect([r.status,r.url]).toEqual([404,'https://dailynoodle.co.uk/no-such-page']);
  expect([r.h,r.title]).toEqual([NOT_FOUND.h,NOT_FOUND.title]);
  expect(r.seen,'an undated address does not ask for the daily list').toEqual([]);
  expect(r.errs).toEqual([]);
 });

 test('NOTFOUND-02: a dated file whose London day has not come says "Not out yet" with its date',async({browser})=>{
  const r=await lost(browser,{time:'2026-10-20T12:00:00+01:00',url:'/reports/2026-10-24-logic-sweep-9999.html',built:'2026-10-20'});
  expect([r.status,r.url]).toEqual([404,'https://dailynoodle.co.uk/reports/2026-10-24-logic-sweep-9999.html']);
  expect([r.title,r.h,r.p]).toEqual(['Not out yet — The Daily Noodle','Not out yet','This one comes out on Saturday 24 October.']);
  expect(r.errs).toEqual([]);
 });

 test('NOTFOUND-03: today\'s file says "Nearly ready" until today\'s build has run, then not-found',async({browser})=>{
  const url='/reports/2026-10-20-quiz-reckon-9999.html',time='2026-10-20T01:15:00+01:00';
  const before=await lost(browser,{time,url,built:'2026-10-19'});
  expect(before.status).toBe(404);
  expect([before.title,before.h]).toEqual(['Not out yet — The Daily Noodle','Nearly ready']);
  expect(before.p).toMatch(/^Today’s set is still being published\./);
  expect(before.seen).toEqual(['today']);
  const offline=await lost(browser,{time,url,built:'2026-10-20',todayList:'fail'});
  expect(offline.h,'no daily list: still "Nearly ready"').toBe('Nearly ready');
  const after=await lost(browser,{time,url,built:'2026-10-20'});
  expect([after.status,after.title,after.h]).toEqual([404,NOT_FOUND.title,NOT_FOUND.h]);
  expect(after.p).toMatch(/^The link may be mistyped/);
  expect([...before.errs,...offline.errs,...after.errs]).toEqual([]);
 });

 test('NOTFOUND-04: an earlier day\'s missing file is the normal not-found page',async({browser})=>{
  const r=await lost(browser,{time:'2026-10-20T12:00:00+01:00',url:'/reports/2026-10-19-word-link-9999.html',built:'2026-10-19'});
  expect([r.status,r.title,r.h]).toEqual([404,NOT_FOUND.title,NOT_FOUND.h]);
  expect(r.seen).toEqual([]);
 });

 // London midnight, not UTC midnight: at 00:00 BST it is still 23:00 UTC the day before.
 for(const [zone,last,first,from,to,long] of [
  ['BST','2026-10-20T22:59:59Z','2026-10-20T23:00:00Z','2026-10-20','2026-10-21','Wednesday 21 October'],
  ['GMT','2026-11-01T23:59:59Z','2026-11-02T00:00:00Z','2026-11-01','2026-11-02','Monday 2 November'],
 ])test('NOTFOUND-05: the London-midnight boundary ('+zone+')',async({browser})=>{
  const url='/reports/'+to+'-crossword-mini-9999.html';
  const eve=await lost(browser,{time:last,url,built:from});
  expect([eve.h,eve.p],'one second before London midnight').toEqual(['Not out yet','This one comes out on '+long+'.']);
  const mid=await lost(browser,{time:first,url,built:from});
  expect(mid.h,'at London midnight, before the build').toBe('Nearly ready');
  const built=await lost(browser,{time:first,url,built:to});
  expect(built.h,'at London midnight, after the build').toBe(NOT_FOUND.h);
  // and yesterday's file just after midnight is simply missing
  const old=await lost(browser,{time:first,url:'/reports/'+from+'-crossword-mini-9999.html',built:from});
  expect(old.h).toBe(NOT_FOUND.h);
 });
});
