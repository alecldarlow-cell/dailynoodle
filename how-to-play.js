/* One static, indexable guide page. Hash links work with or without scripts. */
(function(){
  'use strict';
  var pills=document.getElementById('guide-pills');
  var links=Array.prototype.slice.call(pills.querySelectorAll('a.chip'));
  var panels=Array.prototype.slice.call(document.querySelectorAll('.guide-panel'));
  function type(){
    var value;
    try{value=decodeURIComponent(location.hash.slice(1));}catch(e){value='';}
    return panels.some(function(p){return p.id===value;})?value:'mini';
  }
  function select(focus){
    var active=type();
    panels.forEach(function(p){p.hidden=p.id!==active;});
    links.forEach(function(a){
      if(a.hash==='#'+active){
        a.setAttribute('aria-current','true');
        // Scroll the pill strip only, never the page.
        if(a.offsetLeft<pills.scrollLeft)pills.scrollLeft=a.offsetLeft;
        else if(a.offsetLeft+a.offsetWidth>pills.scrollLeft+pills.clientWidth)
          pills.scrollLeft=a.offsetLeft+a.offsetWidth-pills.clientWidth;
      }else a.removeAttribute('aria-current');
    });
    if(focus)document.getElementById(active+'-title').focus({preventScroll:true});
  }
  pills.addEventListener('click',function(e){
    var a=e.target.closest('a.chip');
    if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();
    if(location.hash!==a.hash)history.pushState(null,'',a.hash);
    select(true);
  });
  window.addEventListener('hashchange',function(){select(false);});
  window.addEventListener('popstate',function(){select(false);});
  // Static links point straight to today's files. Refresh on return to a cached page.
  function refreshPlayLinks(){
    panels.forEach(function(panel){
      panel.querySelector('.guide-play').setAttribute('href','/'+panel.id+'?via=how-to-play');
    });
    fetch('/puzzles-today.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(!j||!Array.isArray(j.items))return;
      j.items.forEach(function(it){
        var panel=panels.filter(function(p){return p.id===it.type;})[0];
        if(panel&&/^reports\/[\w.-]+\.html$/.test(it.path||''))
          panel.querySelector('.guide-play').setAttribute('href','/'+it.path+'?via=how-to-play');
      });
    }).catch(function(){/* Existing daily short links remain a safe fallback. */});
  }
  refreshPlayLinks();
  window.addEventListener('pageshow',function(e){if(e.persisted)refreshPlayLinks();});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')refreshPlayLinks();});
  document.body.classList.add('guide-enhanced');
  select(false);
})();
