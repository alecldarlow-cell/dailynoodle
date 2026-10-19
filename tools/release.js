#!/usr/bin/env node
'use strict';
// Only Actions publishes/commits. Local npm test builds in a disposable copy.
const {spawnSync}=require('node:child_process'),fs=require('node:fs');
const {prepare,run}=require('./prepare-site');
function git(args,allowFailure=false){const r=spawnSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});if(r.status&&!allowFailure)throw Error(r.stderr||r.stdout);return r;}
function day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date());}
if(process.env.GITHUB_ACTIONS!=='true')throw Error('release.js runs only in GitHub Actions; use npm test locally');
fs.rmSync('test-results/release.json',{force:true});
for(let attempt=1;attempt<=3;attempt++){
 git(['fetch','origin','main']);git(['merge','--ff-only','origin/main']);
 const builtDay=day();process.env.DN_HELD_OUT='held.txt';prepare();
 run('tests/suite.js');
 // The release artifact is the one the suite built from this exact transformed
 // source tree. Never reassemble or patch it after this point.
 if(day()!==builtDay){console.log('London day changed during checks; rebuild/recheck.');continue;}
 git(['add','feed.json','puzzles-today.json','reports']);
 if(git(['diff','--cached','--quiet'],true).status!==0)git(['commit','-m','chore: rebuild feed.json and prepare tested site [skip ci]']);
 const push=git(['push','origin','HEAD:main'],true);
 if(push.status===0){
  fs.writeFileSync('test-results/release.json',JSON.stringify({commit:git(['rev-parse','HEAD']).stdout.trim(),day:builtDay,attempt},null,2)+'\n');
  console.log('Published source and retained tested _site for Pages.');break;
 }
 if(attempt===3)throw Error('Could not push tested build after three attempts: '+push.stderr);
 git(['fetch','origin','main']);git(['rebase','origin/main']);
 console.log('Concurrent main update: rebuild and rerun all gates on rebased source.');
}
if(!fs.existsSync('test-results/release.json'))throw Error('No stable tested release revision was produced');
