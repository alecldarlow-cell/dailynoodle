'use strict';
// Linux uses the npm-pinned browser and fallback fonts, without downloading
// a second browser or restoring archive ownership (unsupported in some hosts).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {pipeline}=require('node:stream/promises'),{spawnSync}=require('node:child_process');
async function executable(){
 if(process.env.PW_CHROMIUM)return process.env.PW_CHROMIUM;
 if(process.platform!=='linux'||process.arch!=='x64')return undefined;
 const root=path.resolve(path.dirname(require.resolve('@sparticuz/chromium')),'..');
 const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
 const dir=path.join(os.tmpdir(),'daily-noodle-chromium-'+version);fs.mkdirSync(dir,{recursive:true});
 const binary=path.join(dir,'chromium');
 if(!fs.existsSync(path.join(dir,'ready'))){
  const tmp=binary+'.'+process.pid;
  await pipeline(fs.createReadStream(path.join(root,'bin/chromium.br')),zlib.createBrotliDecompress(),fs.createWriteStream(tmp,{mode:0o755}));fs.renameSync(tmp,binary);
  for(const [archive,out] of [['fonts.tar.br',path.join(dir,'fonts')],['swiftshader.tar.br',dir]]){
   fs.mkdirSync(out,{recursive:true});const r=spawnSync('tar',['--extract','--no-same-owner','--file','-','--directory',out],{input:zlib.brotliDecompressSync(fs.readFileSync(path.join(root,'bin',archive)))});
   if(r.status!==0)throw Error('Browser assets failed to unpack: '+r.stderr);
  }
  fs.writeFileSync(path.join(dir,'fonts/fonts.conf'),`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${path.join(dir,'fonts/fonts')}</dir><cachedir>${path.join(dir,'font-cache')}</cachedir><config></config></fontconfig>`);
  fs.writeFileSync(path.join(dir,'ready'),version);
 }
 process.env.FONTCONFIG_PATH=path.join(dir,'fonts');
 process.env.LD_LIBRARY_PATH=[dir,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
 return binary;
}
module.exports={executable};
