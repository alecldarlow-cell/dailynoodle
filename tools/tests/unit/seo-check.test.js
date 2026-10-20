'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {check}=require('../../seo-check');
function fixture(t){
 const site=fs.mkdtempSync(path.join(os.tmpdir(),'seo-gate-'));t.after(()=>fs.rmSync(site,{recursive:true,force:true}));
 fs.mkdirSync(path.join(site,'reports'));
 for(const file of ['index.html','puzzles.html','games.html','reports/path.html'])fs.writeFileSync(path.join(site,file),'<html><head><title>Original</title></head><body><p id="count"></p><ul id="feed"></ul></body></html>');
 fs.writeFileSync(path.join(site,'feed.json'),JSON.stringify({today:'2026-10-20',items:[{kind:'puzzle',type:'path',headline:'Path 94',date:'2026-10-20',read:'~3 min',path:'reports/path.html'}]}));
 require('../../puzzle-discovery').write(site);require('../../search-meta').write(site);require('../../sitemap').write(site);
 return site;
}
function edit(site,file,change){const p=path.join(site,file);fs.writeFileSync(p,change(fs.readFileSync(p,'utf8')));}
test('SEO gate accepts the assembled indexable pages and static archive links',t=>assert.equal(check(fixture(t)),4));
for(const [label,mutate,error] of [
 ['missing description',s=>edit(s,'puzzles.html',h=>h.replace(/<meta name="description"[^>]*>/,'')),/description/],
 ['accidental noindex',s=>edit(s,'puzzles.html',h=>h.replace('</head>','<meta name="robots" content="noindex,follow"></head>')),/noindex/],
 ['duplicate title',s=>{const title=fs.readFileSync(path.join(s,'index.html'),'utf8').match(/<title>[\s\S]*?<\/title>/)[0];edit(s,'games.html',h=>h.replace(/<title>[\s\S]*?<\/title>/,title));},/duplicate title/],
 ['broken sitemap target',s=>fs.rmSync(path.join(s,'reports/path.html')),/broken sitemap link/],
 ['omitted sitemap page',s=>edit(s,'sitemap.xml',h=>h.replace(/<url><loc>[^<]*reports\/path.html<\/loc>[\s\S]*?<\/url>/,'')),/missing sitemap URL/],
 ['tracking canonical',s=>edit(s,'puzzles.html',h=>h.replace('href="https://dailynoodle.co.uk/puzzles.html"','href="https://dailynoodle.co.uk/puzzles.html?via=reddit"')),/canonical/],
 ['missing static puzzle link',s=>edit(s,'puzzles.html',h=>h.replace('href="reports/path.html"','href="#"')),/initial HTML/],
 ['blocked robots',s=>edit(s,'robots.txt',h=>h+'\nDisallow: /\n'),/robots/]
])test('SEO gate rejects '+label,t=>{const s=fixture(t);mutate(s);assert.throws(()=>check(s),error);});
test('news keeps its editorial title and gets a missing description and clean canonical',t=>{
 const site=fixture(t),feed=JSON.parse(fs.readFileSync(path.join(site,'feed.json')));
 feed.items.push({kind:'report',path:'reports/news.html',headline:'A sourced story',standfirst:'The figures and what they mean.',date:feed.today});
 fs.writeFileSync(path.join(site,'feed.json'),JSON.stringify(feed));
 fs.writeFileSync(path.join(site,'reports/news.html'),'<head><title>A sourced story — Noodle News</title></head><body>Unchanged editorial text.</body>');
 require('../../search-meta').write(site);require('../../sitemap').write(site);
 const output=fs.readFileSync(path.join(site,'reports/news.html'),'utf8');
 assert.match(output,/<title>A sourced story — Noodle News<\/title>/);assert.match(output,/content="The figures and what they mean."/);
 assert.ok(output.endsWith('<body>Unchanged editorial text.</body>'));assert.equal(check(site),5);
});
