'use strict';
// One guide page per puzzle type, written into the built site; tools/guide-pages.js (SITE.md › Type guide pages and About).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {PAGES,rel,page,linkGuide,write}=require('../../guide-pages');
const {TYPES}=require('../../search-meta');
const ROOT=path.resolve(__dirname,'../../..'),GUIDE=fs.readFileSync(path.join(ROOT,'how-to-play.html'),'utf8');
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
test('GUIDE-PAGES-01 the pages cover exactly the daily types, with distinct titles and headings',()=>{
 assert.deepEqual(Object.keys(PAGES),Object.keys(TYPES));
 for(const key of ['title','h1','lede','aka'])assert.equal(new Set(Object.values(PAGES).map(p=>p[key])).size,Object.keys(PAGES).length,key+' repeats');
 for(const [type,p] of Object.entries(PAGES)){assert.ok(p.h1.startsWith(TYPES[type].name+': '),type);assert.ok(p.title.length<=60,type+' title fits a search result');}
});
test('GUIDE-PAGES-02 a page carries the guide\'s own rules, example and tip, word for word, under one h1',()=>{
 for(const type of Object.keys(PAGES)){
  const html=page(GUIDE,type),source=GUIDE.match(new RegExp('<section class="guide-panel" id="'+type+'"[\\s\\S]*?</section>'))[0];
  for(const part of ['guide-rules','guide-example','guide-tip']){
   const chunk=source.match(new RegExp('<(ol|figure|p) class="'+part+'"[\\s\\S]*?</\\1>'));
   if(!chunk){assert.equal(part,'guide-example',type+' has no '+part);assert.ok(!html.includes('worked example'),type+' promises no example');continue;}   // Borders and Reckon have no worked example
   assert.ok(html.includes(chunk[0]),type+' '+part+' differs from the guide');
  }
  assert.equal((html.match(/<h1\b/g)||[]).length,1,type);assert.ok(html.includes('<h1 id="'+type+'-title">'+PAGES[type].h1+'</h1>'));
  assert.ok(html.includes('<link rel="canonical" href="https://dailynoodle.co.uk/'+rel(type)+'">'),type+' canonical');
  assert.equal((html.match(/<title>/g)||[]).length,1);assert.ok(html.includes('<title>'+PAGES[type].title.replace(/&/g,'&amp;')+' | Daily Noodle</title>'));
  assert.ok(html.includes('<base href="/">'),'links resolve from the site root');
  assert.doesNotMatch(html,/noindex/);assert.doesNotMatch(html,/href="#/,'no hash links: they would resolve to the home page');
  assert.equal((html.match(/aria-current="true"/g)||[]).length,1);assert.ok(html.includes('<a class="chip" href="'+rel(type)+'" aria-current="true">'));
  assert.doesNotMatch(html,/how-to-play\.js/,'the page needs no script to be read');
 }
});
test('GUIDE-PAGES-03 the full guide gains one link per section and is otherwise unchanged; a second run changes nothing',()=>{
 const once=linkGuide(GUIDE),twice=linkGuide(once);
 assert.equal(once,twice);
 for(const type of Object.keys(PAGES))assert.equal(once.split('href="'+rel(type)+'"').length-1,1,type);
 assert.equal(text(once.replace(/<p class="guide-links">[\s\S]*?<\/p>/g,'')),text(GUIDE));
 for(const type of Object.keys(PAGES))assert.equal((once.match(new RegExp('id="'+type+'"','g'))||[]).length,1);
});
test('GUIDE-PAGES-04 write() makes nine pages beside the guide, and nothing without one',t=>{
 const site=fs.mkdtempSync(path.join(os.tmpdir(),'gp-'));t.after(()=>fs.rmSync(site,{recursive:true,force:true}));
 assert.equal(write(site),0);
 fs.writeFileSync(path.join(site,'how-to-play.html'),GUIDE);
 assert.equal(write(site),9);assert.equal(write(site),9);
 assert.deepEqual(fs.readdirSync(path.join(site,'how-to-play')).sort(),Object.keys(PAGES).map(t=>t+'.html').sort());
 assert.equal(fs.readFileSync(path.join(site,'how-to-play.html'),'utf8'),linkGuide(GUIDE));
 assert.doesNotMatch(fs.readFileSync(path.join(site,rel('mini')),'utf8'),/More about Mini/,'pages are built from the guide before its links are added');
});
test('GUIDE-PAGES-05 the About page names every type page and makes no claim the site cannot keep',()=>{
 const about=fs.readFileSync(path.join(ROOT,'about.html'),'utf8');
 for(const type of Object.keys(PAGES))assert.ok(about.includes('href="'+rel(type)+'"'),type);
 assert.equal((about.match(/<h1\b/g)||[]).length,1);assert.ok(about.includes('<link rel="canonical" href="https://dailynoodle.co.uk/about.html">'));
 assert.doesNotMatch(about,/noindex|TODO|\[YOUR/);
});
