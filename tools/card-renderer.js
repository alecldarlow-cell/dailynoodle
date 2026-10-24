'use strict';
/* Shared markup for published HTML and interactive front pages. No DOM or saves. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.dnCards=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  var PUZZLE_TYPES = [['mini','Mini'],['doku','Doku'],['sweep','Sweep'],['path','Path'],
                      ['link','Link'],['tangle','Tangle'],['borders','Borders'],['reckon','Reckon']];
  var TYPE_LABEL = {}, TYPE_RANK = {};
  PUZZLE_TYPES.forEach(function(t, i){ TYPE_LABEL[t[0]] = t[1]; TYPE_RANK[t[1]] = i; });
  function puzzleType(it){
    if(it.type) return TYPE_LABEL[it.type] || (it.type.charAt(0).toUpperCase() + it.type.slice(1));
    var w = String(it.headline||'').split(/\s+/)[0];
    return TYPE_RANK.hasOwnProperty(w) ? w : '';
  }
  function relTime(iso,today){
    if(!/^\d{4}-\d{2}-\d{2}/.test(iso||'')) return '';
    var d = new Date(iso.length>10 ? iso : iso+'T12:00:00Z');
    if(isNaN(d)) return '';
    var fmt = { day:'numeric', month:'short', year:'numeric' };
    if(iso.length === 10){
      var days = Math.round((Date.parse(today+'T12:00:00Z') - d.getTime())/864e5);
      if(days <= 0) return 'Today';
      if(days === 1) return 'Yesterday';
      if(days < 7)  return days+'d ago';
      fmt.timeZone = 'UTC';   // the date as written, not shifted by the phone's zone
      return d.toLocaleDateString('en-GB', fmt);
    }
    var mins = Math.round((Date.now()-d.getTime())/60000);
    if(mins < 1)    return 'just now';
    if(mins < 60)   return mins+'m ago';
    if(mins < 1440) return Math.round(mins/60)+'h ago';
    if(mins < 10080)return Math.round(mins/1440)+'d ago';
    return d.toLocaleDateString('en-GB', fmt);
  }

  function inLab(it){return /^\s*in development\s*$/i.test(it.badge||'');}
  function statTile(it){
    var n = Math.min(String(it.stat).length, 6);
    var lab = it.statLabel || '';
    return '<div class="thumb stat'+(lab?' haslabel':'')+'" data-len="'+n+'" aria-hidden="true">'
         +   '<span class="fig">'+esc(it.stat)
         +     (it.statUnit ? '<span class="unit">'+esc(it.statUnit)+'</span>' : '')
         +   '</span>'
         +   (lab ? '<span class="lab">'+esc(lab)+'</span>' : '')
         + '</div>';
  }

  // mask is 25 chars (5x5 Mini/Doku) or 36 chars (6x6 Sweep/Path) from feed.json:
  // # block, L pre-locked, o the free opening (Sweep), . to fill. The marigold
  // marks where play starts — the free opening if the type has one, otherwise
  // the first fillable cell — so the tile is a still of the game rather than a
  // picture of one. Sweep tiles were all identical until 'o' was carried through.
  function puzzleTile(mask){
    // 16 = Link's 4x4 of chips; 25 = 5x5 Mini/Doku; 36 = 6x6 Sweep/Path.
    var n = mask.length===36 ? 36 : mask.length===16 ? 16 : 25;
    var shape = n===36 ? ' six' : n===16 ? ' four' : '';
    var op = mask.indexOf('o');
    // Link has no start square — every chip is equally live — so no marigold cell.
    var act = n===16 ? -1 : (op >= 0 ? op : mask.indexOf('.')), cells = '';
    for(var i=0;i<n;i++){
      var cls = mask[i]==='#' ? 'b' : mask[i]==='L' ? 'l' : (i===act ? 'a' : '');
      cells += cls ? '<i class="'+cls+'"></i>' : '<i></i>';
    }
    return '<div class="thumb puzzle" aria-hidden="true"><div class="pgrid'+shape+'">'+cells+'</div></div>';
  }

  function card(it,options){
    options=options||{};
    var LAB=!!options.lab;
    // A meaningful update (dn:updated) moves the card up and is labelled as such.
    var upd = /^\d{4}-\d{2}-\d{2}$/.test(it.updated||'') && it.updated > (it.date||'');
    var when = relTime(upd ? it.updated : it.date,options.today);
    if(upd && when) when = 'Updated ' + (/^(Today|Yesterday)$/.test(when) ? when.toLowerCase() : when);
    var thumb;
    if(it.thumb){
      thumb = '<img class="thumb" src="'+esc(it.thumb)+'" alt="" loading="lazy">';
    } else if(it.kind==='puzzle' && typeof it.mask==='string' && (it.mask.length===16 || it.mask.length===25 || it.mask.length===36)){
      thumb = puzzleTile(it.mask);
    } else if(it.stat){
      thumb = statTile(it);
    } else {
      thumb = '<div class="thumb glyph" aria-hidden="true">'+(it.format==='briefing'?'Brief':it.kind==='report'?'Chart':'Play')+'</div>';
    }
    // Optional dn:badge (e.g. "In development") sits on the thumbnail.
    // In the lab every card is in development, so that badge would be noise.
    if(it.badge && !(LAB && inLab(it))) thumb = '<div class="thumbwrap">'+thumb+'<span class="badge">'+esc(it.badge)+'</span></div>';
    // Sibling links: the card opens the puzzle; the guide never sits inside it.
    var guide = '';
    if(it.kind==='puzzle'){
      var label = puzzleType(it);
      PUZZLE_TYPES.forEach(function(t){ if(t[1]===label) guide=t[0]; });
    }
    var meta = guide
      ? (when ? '<span class="card-date">'+esc(when)+'</span>' : '')
        + (it.read ? (when ? '<span class="dot">·</span>' : '')+'<span class="card-time">'+esc(it.read)+'</span>' : '')
      : '<span class="t">'+esc(it.topic)+'</span>'
        + (when ? '<span class="dot">·</span><span>'+esc(when)+'</span>' : '')
        + (it.read ? '<span class="dot">·</span><span>'+esc(it.read)+'</span>' : '');
    return '<li data-kind="'+esc(it.kind)+'"'+(guide?' class="puzzle-card"':'')+'><a class="card" href="'+esc(it.path)+'">'
      + thumb
      + '<div>'
      +   '<h2 class="hl">'+esc(it.headline)+'</h2>'
      +   (it.standfirst ? '<p class="sf">'+esc(it.standfirst)+'</p>' : '')
      +   '<p class="meta">'+meta+'</p>'
      + '</div></a>'
      + (guide ? '<a class="card-guide" href="how-to-play.html#'+guide+'" aria-label="How to play '+esc(TYPE_LABEL[guide])+'">How to play</a>' : '')
      + '</li>';
  }

  return {card:card,types:PUZZLE_TYPES};
});
