'use strict';
// Validate the actual emitted sitemap/HTML, rather than trusting generator output.
const fs=require('node:fs'),path=require('node:path');
const ORIGIN='https://dailynoodle.co.uk';
function attr(tag,name){return tag.match(new RegExp('\\b'+name+'\\s*=\\s*(["\\x27])([\\s\\S]*?)\\1','i'))?.[2]||'';}
function decode(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function check(site){
 const fail=message=>{throw Error('SEO: '+message);};
 const feed=JSON.parse(fs.readFileSync(path.join(site,'feed.json'),'utf8')),xml=fs.readFileSync(path.join(site,'sitemap.xml'),'utf8');
 const urls=Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g),m=>decode(m[1]));
 if(!urls.length)fail('empty sitemap');
 const expected=['', 'puzzles.html','games.html'];
 if(fs.existsSync(path.join(site,'how-to-play.html')))expected.push('how-to-play.html');
 for(const it of feed.items||[])if(!it.badge&&(!feed.today||it.date<=feed.today))expected.push(it.path);
 const wanted=new Set(expected.map(file=>ORIGIN+'/'+file)),seen=new Set(),titles=new Map();
 for(const loc of urls){
  if(seen.has(loc))fail('duplicate sitemap URL '+loc);seen.add(loc);
  if(!wanted.has(loc))fail('unexpected sitemap URL '+loc);
  const url=new URL(loc);
  if(url.origin!==ORIGIN||url.search||url.hash||url.pathname.includes('..'))fail('unclean sitemap URL '+loc);
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!fs.existsSync(path.join(site,file)))fail('broken sitemap link '+loc);
  const html=fs.readFileSync(path.join(site,file),'utf8'),head=html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i)?.[0];
  if(!head)fail('missing head '+file);
  const tags=head.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags)if(/^(robots|googlebot|bingbot)$/i.test(attr(tag,'name'))&&/\bnoindex\b|\bnone\b/i.test(attr(tag,'content')))fail('accidental noindex '+file);
  const titleMatches=Array.from(head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi));
  if(titleMatches.length!==1||!titleMatches[0][1].trim())fail('missing/duplicate title '+file);
  const title=decode(titleMatches[0][1]).replace(/\s+/g,' ').trim().toLowerCase();
  if(titles.has(title))fail('duplicate title '+file+' and '+titles.get(title));titles.set(title,file);
  const descriptions=tags.filter(tag=>/^description$/i.test(attr(tag,'name')));
  if(descriptions.length!==1||!decode(attr(descriptions[0],'content')).trim())fail('missing/duplicate description '+file);
  const canonicals=(head.match(/<link\b[^>]*>/gi)||[]).filter(tag=>attr(tag,'rel').split(/\s+/).some(s=>/^canonical$/i.test(s)));
  if(canonicals.length!==1||decode(attr(canonicals[0],'href'))!==loc)fail('wrong/duplicate canonical '+file);
 }
 for(const loc of wanted)if(!seen.has(loc))fail('missing sitemap URL '+loc);
 const robots=fs.readFileSync(path.join(site,'robots.txt'),'utf8');
 if(!robots.includes('Sitemap: '+ORIGIN+'/sitemap.xml')||/Disallow:\s*\/\s*$/mi.test(robots))fail('robots blocks discovery or omits sitemap');
 const hub=fs.readFileSync(path.join(site,'puzzles.html'),'utf8');
 for(const it of feed.items||[])if(it.kind==='puzzle'&&!it.badge&&(!feed.today||it.date<=feed.today)){
  if(!hub.includes('href="'+it.path+'"'))fail('puzzle is absent from initial HTML '+it.path);
 }
 if(fs.existsSync(path.join(site,'how-to-play.html'))){
  const guide=fs.readFileSync(path.join(site,'how-to-play.html'),'utf8');
  for(const type of ['mini','doku','sweep','path','link','tangle','borders','reckon']){
   const latest=(feed.items||[]).find(it=>it.kind==='puzzle'&&!it.badge&&it.type===type&&it.date===feed.today);
   if(latest&&!guide.includes('href="/'+latest.path+'?via=how-to-play"'))fail('guide has no direct daily link for '+type);
   if(!guide.includes('id="'+type+'"'))fail('missing guide section '+type);
  }
  if(!guide.includes('href="puzzles.html"'))fail('guide has no archive/hub link');
 }
 console.log('SEO: '+urls.length+' sitemap pages checked; titles, snippets, canonicals, indexing and static puzzle links OK');
 return urls.length;
}
module.exports={check};
if(require.main===module)check(path.resolve(process.argv[2]||'_site'));
