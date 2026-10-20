'use strict';
// sitemap.xml + robots.txt written into the built site; tools/sitemap.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { write } = require('../../sitemap');

test('sitemap: lists front pages and published feed items only, never held or Lab files', () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-'));
  fs.mkdirSync(path.join(site, 'reports'));
  for (const f of ['a.html', 'lab.html', 'held.html']) fs.writeFileSync(path.join(site, 'reports', f), 'x');
  fs.writeFileSync(path.join(site, 'feed.json'), JSON.stringify({ today: '2026-10-20', items: [
    { path: 'reports/a.html', date: '2026-10-19', updated: '2026-10-20' },
    { path: 'reports/held.html', date: '2026-10-21' },                    // not in the site: held back
    { path: 'reports/lab.html', date: '2026-10-19', badge: 'In development' },
  ] }));
  assert.strictEqual(write(site), 4);
  const xml = fs.readFileSync(path.join(site, 'sitemap.xml'), 'utf8');
  assert.match(xml, /<loc>https:\/\/dailynoodle.co.uk\/reports\/a.html<\/loc><lastmod>2026-10-20<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/dailynoodle.co.uk\/<\/loc>/);
  assert.doesNotMatch(xml, /held\.html|lab\.html/);
  assert.match(fs.readFileSync(path.join(site, 'robots.txt'), 'utf8'), /^Sitemap: https:\/\/dailynoodle.co.uk\/sitemap.xml$/m);
});

test('sitemap: the shared how-to page is included when it is published',()=>{
 const site=fs.mkdtempSync(path.join(os.tmpdir(),'sm-guide-'));
 try{
  fs.writeFileSync(path.join(site,'feed.json'),JSON.stringify({today:'2026-10-20',items:[]}));
  fs.writeFileSync(path.join(site,'how-to-play.html'),'<!doctype html><title>How to play</title>');
  assert.strictEqual(write(site),4);
  const xml=fs.readFileSync(path.join(site,'sitemap.xml'),'utf8');
  assert.match(xml,/<loc>https:\/\/dailynoodle.co.uk\/how-to-play.html<\/loc>/);
  assert.doesNotMatch(xml,/#mini|#path/);
 }finally{fs.rmSync(site,{recursive:true,force:true});}
});
