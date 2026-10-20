'use strict';
const fs=require('node:fs'),path=require('node:path');
const {londonDay}=require('../dn-core');
const TYPES={mini:'crossword-mini',doku:'logic-doku',sweep:'logic-sweep',path:'logic-path',link:'word-link',tangle:'word-tangle',borders:'geo-borders'};
const IDS={mini:'MINI',doku:'LEXI',sweep:'SWEEP',path:'PATH',link:'LINK',tangle:'TANG',borders:'BORD'};
const addDay=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
function snapshot(root,{now=new Date(),env=process.env}={}){
 const today=londonDay(now),days={};
 for(const file of fs.readdirSync(path.join(root,'reports')).sort()){
  const m=/^(\d{4}-\d{2}-\d{2})-(.+)\.html$/.exec(file);if(!m||m[1]<today)continue;
  const type=Object.keys(TYPES).find(t=>new RegExp('^'+TYPES[t]+'(?:-\\d+)?$').test(m[2]));if(!type)continue;
  const date=m[1],src=fs.readFileSync(path.join(root,'reports',file),'utf8');
  const meta=name=>{const tag=src.match(new RegExp('<meta\\b[^>]*name=["\\\']'+name+'["\\\'][^>]*>','i'));return tag&&(tag[0].match(/content=(["'])(.*?)\1/i)||[])[2];};
  const entry=(days[date]||={counts:{},blocked:[]});entry.counts[type]=(entry.counts[type]||0)+1;
  const id=(src.match(/\bid["']?\s*:\s*["'](DP·[^"']+)["']/)||[])[1];
  const expected='DP·'+IDS[type]+'·'+(m[2].slice(TYPES[type].length).replace(/^-/, '')||date);
  if(meta('dn:date')!==date||meta('dn:kind')!=='puzzle'||id!==expected)entry.blocked.push(type);
 }
 const run=/^\d+$/.test(env.GITHUB_RUN_ID||'')?env.GITHUB_RUN_ID:null;
 return {version:1,builtAt:new Date(now).toISOString(),today,runId:run,checkedThrough:addDay(today,7),days};
}
module.exports={snapshot,TYPES,addDay};
