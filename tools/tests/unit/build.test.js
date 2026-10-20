'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../../..');
const run=(tool,dir,args=[],env={})=>{const r=spawnSync(process.execPath,[path.join(ROOT,'tools',tool),...args],{cwd:dir,encoding:'utf8',env:{...process.env,...env}});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
const fixture=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'noodle-tools-'));fs.mkdirSync(path.join(dir,'reports'));for(const file of ['puzzles.html','games.html'])fs.writeFileSync(path.join(dir,file),'<html><head></head><body><ul id="feed"></ul><p id="count"></p></body></html>');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
const html=(day,headline)=>`<html><head><title>${headline}</title><meta name="dn:date" content="${day}"><meta name="dn:kind" content="report"><meta name="dn:headline" content="${headline}"><meta name="dn:topic" content="Science"><meta name="dn:standfirst" content="A complete example."><meta name="dn:read" content="~3 min"></head><body><h1>${headline}</h1></body></html>`;
test('BUILD-01/02: London cutoff, intact apostrophes and no future deployed HTML',t=>{
 const dir=fixture(t),future='reports/2026-10-20-science-future.html';
 fs.writeFileSync(path.join(dir,'reports/2026-10-19-science-crispr.html'),html('2026-10-19',"CRISPR's next step"));fs.writeFileSync(path.join(dir,future),html('2026-10-20','Held back'));
 fs.writeFileSync(path.join(dir,'index.html'),'<html><head><title>News</title></head><body><h1>News</h1></body></html>');fs.writeFileSync(path.join(dir,'package.json'),'{}');fs.writeFileSync(path.join(dir,'registry.json'),'future answers');
 const env={DN_TEST_TIME:'2026-10-18T23:30:00Z',NODE_OPTIONS:'--require '+path.join(ROOT,'tools/tests/fixtures/clock.cjs'),TZ:'America/Los_Angeles',DN_HELD_OUT:path.join(dir,'held.txt')};
 run('build-feed.js',dir,[],env);const feed=JSON.parse(fs.readFileSync(path.join(dir,'feed.json')));assert.equal(feed.items.length,1);assert.equal(feed.items[0].title||feed.items[0].headline,"CRISPR's next step");
 run('build-site.js',dir,['held.txt','_site']);assert.ok(!fs.existsSync(path.join(dir,'_site',future)));assert.ok(fs.existsSync(path.join(dir,'_site/reports/2026-10-19-science-crispr.html')));
 for(const file of ['package.json','registry.json','held.txt'])assert.ok(!fs.existsSync(path.join(dir,'_site',file)),file+' must not deploy');
 run('build-feed.js',dir,[],{...env,DN_TEST_TIME:'2026-10-19T23:30:00Z'});assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'feed.json'))).items.length,2);
});
test('BUILD-02: transformations are idempotent; News navigation removes byte for byte',t=>{
 const dir=fixture(t),file=path.join(dir,'reports/2026-10-19-science-example.html');
 const original=html('2026-10-19','Example').replace('<h1>','<header class="mast"><div class="mono">DN</div><div class="word">Noodle<b>News</b></div></header><h1>');fs.writeFileSync(file,original);
 run('news-nav.js',dir);const once=fs.readFileSync(file,'utf8');assert.notEqual(once,original,'Fixture must actually transform');run('news-nav.js',dir);assert.equal(fs.readFileSync(file,'utf8'),once);run('news-nav.js',dir,['--remove']);assert.equal(fs.readFileSync(file,'utf8'),original);
 run('og-tags.js',dir);const og=fs.readFileSync(file,'utf8');run('og-tags.js',dir);assert.equal(fs.readFileSync(file,'utf8'),og);assert.match(og,/og:image/);
});
test('BUILD-01: assembler rejects a broken feed target',t=>{
 const dir=fixture(t);fs.writeFileSync(path.join(dir,'index.html'),'<html><head><title>News</title></head><body>News</body></html>');fs.writeFileSync(path.join(dir,'feed.json'),JSON.stringify({items:[{path:'reports/missing.html'}]}));fs.writeFileSync(path.join(dir,'held.txt'),'');
 const r=spawnSync(process.execPath,[path.join(ROOT,'tools/build-site.js'),'held.txt','_site'],{cwd:dir,encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/not in the site/);
});
