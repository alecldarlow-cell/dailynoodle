'use strict';
// Publish the existing cards as HTML; the browser enhances the same markup.
const fs=require('node:fs'),path=require('node:path'),{card}=require('./card-renderer');
function write(out){
 const feed=JSON.parse(fs.readFileSync(path.join(out,'feed.json'),'utf8'));
 const items=(feed.items||[]).filter(it=>it.kind==='puzzle'&&!/^\s*in development\s*$/i.test(it.badge||'')&&(!feed.today||it.date<=feed.today));
 const hub=path.join(out,'puzzles.html');
 if(fs.existsSync(hub)){
  let html=fs.readFileSync(hub,'utf8');
  html=html.replace(/(<ul\b[^>]*\bid="feed"[^>]*>)[\s\S]*?(<\/ul>)/i,(_,open,close)=>open+'\n'+items.map(it=>card(it,{today:feed.today})).join('\n')+'\n  '+close);
  html=html.replace(/(<p\b[^>]*\bid="count"[^>]*>)[\s\S]*?(<\/p>)/i,(_,open,close)=>open+(items.length?items.length+' '+(items.length===1?'puzzle':'puzzles'):'')+close);
  fs.writeFileSync(hub,html);
 }
 const guide=path.join(out,'how-to-play.html');
 if(fs.existsSync(guide)){
  let html=fs.readFileSync(guide,'utf8');
  for(const it of items){
   // Feed order is newest first. Each existing "Play today" link is changed once.
   if(it.date!==feed.today||!/^[a-z]+$/.test(it.type||'')||!/^reports\/[\w.-]+\.html$/.test(it.path))continue;
   html=html.replace(new RegExp('href="/'+it.type+'\\?via=how-to-play"','g'),'href="/'+it.path+'?via=how-to-play"');
  }
  fs.writeFileSync(guide,html);
 }
 console.log('puzzle-discovery: '+items.length+' crawlable puzzle cards');
 return items.length;
}
module.exports={write};
