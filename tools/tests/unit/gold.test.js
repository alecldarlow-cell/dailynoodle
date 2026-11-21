'use strict';
/* Gold stars (21 Nov 2026, Alec; project doc claude/rewards-review-2026-11-21.md): dnCore.gold's
   fixed rules, one per daily type, on every record shape the players save. The app's
   packages/core/src/gold.ts runs the same table (GOLD-CASES below is its parity list). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {gold}=require('../../../dn-core');

const CASES=[
 // [type, record, gold?]
 ['mini',{s:40},true],['mini',{s:41},false],['mini',{s:12,h:1},false],['mini',{s:30,d:'2026-11-01'},true],
 ['doku',{s:30},true],['doku',{s:31},false],
 ['sweep',{o:'win',s:30},true],['sweep',{o:'win',s:31},false],['sweep',{o:'loss',s:9,b:4},false],
 ['path',{t:'0:20'},true],['path',{t:'00:20'},true],['path',{t:'00:21'},false],
 ['tally',{t:'1:00',s:60},true],['tally',{t:'1:01',s:61},false],['tally',{t:'0:59'},true],
 ['link',{o:'win',m:0,t:'00:59'},true],['link',{o:'win',m:0,t:'01:01'},false],['link',{o:'win',m:1,t:'00:30'},false],['link',{o:'loss',m:4,t:'00:30'},false],['link',{o:'win',t:'00:30'},false],
 ['tangle',{s:40},true],['tangle',{s:39},false],
 ['borders',{p:1000,c:10},true],['borders',{p:950,c:10},false],['borders',{c:10},true],['borders',{p:1200,c:9},false],
 ['reckon',{p:750},true],['reckon',{p:740},false],
];

test('GOLD-01: each daily type earns gold exactly at its threshold, and never on a loss',()=>{
 for(const [type,rec,want] of CASES)assert.equal(!!gold(type,rec),want,type+' '+JSON.stringify(rec));
});
test('GOLD-02: a gold result says what earned it; anything else says nothing',()=>{
 assert.equal(gold('borders',{p:1000,c:10}),'A perfect ten');
 assert.equal(gold('path',{t:'0:15'}),'Under 0:20');
 assert.equal(gold('link',{o:'win',m:0,t:'00:40'}),'No mistakes, under 1:00');
 assert.equal(gold('mini',{s:20}),'Under 0:40 with no checks or reveals');
 assert.equal(gold('mini',{s:20,h:1}),'');
});
test('GOLD-03: Lab types, unknown types and broken records never get gold, and never throw',()=>{
 for(const t of ['tilt','redact','tumbler','cryptic','nope'])assert.equal(gold(t,{s:1,t:'0:01',p:9999}),'');
 for(const r of [null,undefined,'x',5,[],{},{s:'fast'},{t:'soon'}])for(const t of ['mini','path','link','borders','reckon','tangle'])assert.equal(gold(t,r),'',t+' '+JSON.stringify(r));
});
module.exports={CASES};
