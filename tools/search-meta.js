'use strict';
// Search metadata belongs to the published artifact, not puzzle data or card copy.
// Run after feed generation so archives and tomorrow's puzzles use the same rules.
const fs=require('node:fs'),path=require('node:path');
const ORIGIN='https://dailynoodle.co.uk';
const TYPES={
 mini:{name:'Mini',title:'Daily Mini Crossword',rules:'Solve a small crossword with clues across and down.'},
 doku:{name:'Doku',title:'Daily Letter Logic Puzzle',rules:'Place the letters from the bank so every across and down run makes a real word.'},
 sweep:{name:'Sweep',title:'Daily Minesweeper Puzzle',rules:'Use the number clues to uncover safe squares and flag the hidden mines.'},
 path:{name:'Path',title:'Daily Number Path Puzzle',rules:'Connect the numbers in order with one continuous path through every square.'},
 link:{name:'Link',title:'Daily Word Groups Puzzle',rules:'Find four hidden groups of four among sixteen word tiles.'},
 tangle:{name:'Tangle',title:'Daily Word Finding Puzzle',rules:'Join touching letters to find as many words as you can in ninety seconds.'},
 borders:{name:'Borders',title:'Daily Country Outline Quiz',rules:'Identify ten countries from their outlines, with four answers to choose from.'},
 reckon:{name:'Reckon',title:'Daily Number Estimation Quiz',rules:'Estimate ten numbers from different topics. The closer you get, the more you score.'}
};
const HUBS={
 'index.html':{title:'Daily Noodle | News, Daily Puzzles & Browser Games',description:'Read sourced data journalism, play eight daily word, logic and geography puzzles, and explore quick browser games at The Daily Noodle.'},
 'puzzles.html':{title:'Daily Puzzles: Crosswords, Words & Logic | Daily Noodle',description:'Play Mini crosswords, Doku, Sweep, Path, Link, Tangle, Borders and Reckon. Eight daily word, logic, geography and number puzzles, with a how-to guide.'},
 'games.html':{title:'Browser Games: Arcade, Puzzles & Quizzes | Daily Noodle',description:'Play quick, replayable browser games at The Daily Noodle. Browse arcade games, puzzles and quizzes, and find a new favourite.'}
};
function puzzleMeta(item,dated=false){
 if(item.kind!=='puzzle')return null;
 const key=item.type||String(item.headline||'').split(/\s/)[0].toLowerCase(),type=TYPES[key];
 if(!type)return null;
 // Use feed numbering: older Sweep filenames contain a date, not a serial.
 const serial=String(item.headline||'').match(new RegExp('^'+type.name+'\\s+(\\d+)$','i'));
 const label=type.name+' '+(serial?String(Number(serial[1])):item.date);
 const date=String(item.date||'');
 return {title:label+(dated?' ('+date+')':'')+' — '+type.title+' | Daily Noodle',
  description:'Play '+label+(serial?' ('+date+')':'')+' at The Daily Noodle. '+type.rules};
}
function entries(feed){
 const items=(feed.items||[]).filter(it=>it.kind==='puzzle'&&/^reports\/[\w.-]+\.html$/.test(it.path)&&!it.badge&&(!feed.today||it.date<=feed.today)&&puzzleMeta(it));
 const counts=new Map();
 for(const it of items){const title=puzzleMeta(it).title;counts.set(title,(counts.get(title)||0)+1);}
 return [...Object.entries(HUBS),...items.map(it=>[it.path,puzzleMeta(it,counts.get(puzzleMeta(it).title)>1)])]
  .map(([file,meta])=>[file,{...meta,canonical:ORIGIN+'/'+(file==='index.html'?'':file)}]);
}
function escapeHtml(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function attribute(tag,name){
 const match=tag.match(new RegExp('\\b'+name+'\\s*=\\s*(["\\x27])([\\s\\S]*?)\\1','i'));
 return match?match[2]:null;
}
function updateHtml(html,meta){
 const head=html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i);
 if(!head)throw new Error('search-meta: page has no head');
 let content=head[0];
 if(meta.title!==undefined)content=content.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi,'');
 content=content
  .replace(/<meta\b[^>]*>/gi,tag=>meta.description!==undefined&&/^description$/i.test(attribute(tag,'name')||'')?'':tag)
  .replace(/<link\b[^>]*>/gi,tag=>(attribute(tag,'rel')||'').split(/\s+/).some(rel=>/^canonical$/i.test(rel))?'':tag);
 const tags=(meta.title===undefined?'':'<title>'+escapeHtml(meta.title)+'</title>\n')+(meta.description===undefined?'':'<meta name="description" content="'+escapeHtml(meta.description)+'">\n')+'<link rel="canonical" href="'+escapeHtml(meta.canonical)+'">';
 // Trim only the insertion gap so a second build produces identical bytes.
 content=content.replace(/\s*<\/head\s*>$/i,'\n'+tags+'\n</head>');
 return html.slice(0,head.index)+content+html.slice(head.index+head[0].length);
}
function write(out){
 const feed=JSON.parse(fs.readFileSync(path.join(out,'feed.json'),'utf8'));
 let count=0;
 for(const [file,meta] of entries(feed)){
  const target=path.join(out,file);
  if(!fs.existsSync(target))continue;
  fs.writeFileSync(target,updateHtml(fs.readFileSync(target,'utf8'),meta));count++;
 }
 // Preserve editorial titles/descriptions on news and games; fill absent snippets only.
 for(const it of feed.items||[]){
  if(it.kind==='puzzle'||it.badge||!/^reports\/[\w.-]+\.html$/.test(it.path||'')||(feed.today&&it.date>feed.today))continue;
  const file=path.join(out,it.path);if(!fs.existsSync(file))continue;
  const html=fs.readFileSync(file,'utf8'),head=html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i)?.[0]||'';
  const hasDescription=(head.match(/<meta\b[^>]*>/gi)||[]).some(tag=>/^description$/i.test(attribute(tag,'name')||'')&&String(attribute(tag,'content')||'').trim());
  const extra={canonical:ORIGIN+'/'+it.path};
  if(!hasDescription)extra.description=it.standfirst||'Read '+it.headline+' at The Daily Noodle.';
  fs.writeFileSync(file,updateHtml(html,extra));count++;
 }
 console.log('search-meta: '+count+' published pages with search titles, descriptions and canonical URLs');
 return count;
}
module.exports={TYPES,HUBS,puzzleMeta,entries,updateHtml,write};
