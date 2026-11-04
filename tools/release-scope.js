'use strict';
/* Decides how much of the suite a release runs (Alec, 4 Nov 2026).
   News can take the short path only when it is the ONLY thing going out:
   - the run came from a push (scheduled and manual runs are always full);
   - feed.json is already on today's London day, so no new day's puzzles are released;
   - every change since the last tested release is an added or edited news file.
   The base is the last release commit, not the push's parent: code from a run that
   failed is still untested, so it stays in the comparison and forces the full suite. */
const RELEASE='chore: rebuild feed.json and prepare tested site';
function releaseScope({event,today,lastRelease,changes,feedToday,kindOf}){
 const full=reason=>({scope:'full',reason});
 if(event!=='push')return full('not a push');
 if(!lastRelease)return full('no earlier release commit');
 if(feedToday!==today)return full('a new London day is going live');
 if(!changes.length)return full('nothing changed');
 for(const {status,path} of changes){
  if(status!=='A'&&status!=='M')return full(path+' was not simply added or edited');
  if(!/^reports\/[^/]+\.html$/.test(path))return full(path+' is not a report file');
  if(kindOf(path)!=='report')return full(path+' is not a news piece');
 }
 return {scope:'news',reason:changes.length+' news file(s) only'};
}
const kindIn=html=>{const m=/<meta\s+name=["']dn:kind["']\s+content=["']([^"']+)["']/i.exec(html);return m?m[1]:'';};
function fromGit(git,event,today){
 const lastRelease=git(['log','-1','--format=%H','--fixed-strings','--grep='+RELEASE]).trim();
 const changes=lastRelease?git(['diff','--name-status','--no-renames',lastRelease,'HEAD']).split('\n').filter(Boolean).map(l=>{const [status,path]=l.split('\t');return {status,path};}):[];
 let feedToday='';try{feedToday=JSON.parse(git(['show','HEAD:feed.json'])).today;}catch(e){}
 return releaseScope({event,today,lastRelease,changes,feedToday,kindOf:p=>kindIn(git(['show','HEAD:'+p]))});
}
module.exports={releaseScope,fromGit,kindIn,RELEASE};
