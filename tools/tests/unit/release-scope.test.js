'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {releaseScope,kindIn}=require('../../release-scope');
const news={status:'A',path:'reports/2026-11-05-briefing.html'};
const base={event:'push',today:'2026-11-05',feedToday:'2026-11-05',lastRelease:'abc',changes:[news],kindOf:()=>'report'};
const scope=o=>releaseScope({...base,...o}).scope;
test('RELEASE-SCOPE: a pushed news file alone takes the short path',()=>{
 assert.equal(scope({}),'news');
 assert.equal(scope({changes:[{status:'M',path:'reports/2026-10-30-a.html'},news]}),'news');
});
test('RELEASE-SCOPE: scheduled and manual runs are always full',()=>{
 assert.equal(scope({event:'schedule'}),'full');assert.equal(scope({event:'workflow_dispatch'}),'full');
});
test('RELEASE-SCOPE: a new London day is full, so puzzles only go live through every check',()=>{
 assert.equal(scope({feedToday:'2026-11-04'}),'full');
});
test('RELEASE-SCOPE: anything but news forces full, including untested code left by a failed run',()=>{
 for(const path of ['dn-core.js','tools/release.js','feed.json','engines/link.js'])assert.equal(scope({changes:[news,{status:'M',path}]}),'full');
 assert.equal(scope({kindOf:()=>'puzzle'}),'full');assert.equal(scope({kindOf:()=>'game'}),'full');assert.equal(scope({kindOf:()=>''}),'full');
 assert.equal(scope({changes:[{status:'D',path:news.path}]}),'full');
 assert.equal(scope({changes:[]}),'full');assert.equal(scope({lastRelease:''}),'full');
});
test('RELEASE-SCOPE: reads dn:kind from a page',()=>{
 assert.equal(kindIn('<meta name="dn:kind" content="report">'),'report');assert.equal(kindIn('<p>none</p>'),'');
});
