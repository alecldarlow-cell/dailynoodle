#!/usr/bin/env node
'use strict';
// The same ordered transformations serve local artifact tests and publication.
const {spawnSync}=require('node:child_process'),path=require('node:path');
function run(file,args=[]){
 const r=spawnSync(process.execPath,[path.join(process.cwd(),'tools',file),...args],{stdio:'inherit',env:process.env});
 if(r.status!==0)throw new Error(file+' exited '+r.status);
}
function prepare(){
 for(const file of ['inject-tracker.js','share-v2.js'])run(file);
 for(const type of ['mini','doku','sweep','link','path','tangle','borders'])run('engine-shells.js',[type]);
 for(const file of ['og-tags.js','news-share.js','news-nav.js','news-dark.js','build-feed.js'])run(file);
 run('add-done-state.js',['--check']);
}
module.exports={prepare,run};
if(require.main===module)prepare();
