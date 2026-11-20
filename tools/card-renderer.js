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
                      ['link','Link'],['tangle','Tangle'],['borders','Borders'],['reckon','Reckon'],['tally','Tally'],['tilt','Tilt'],['redact','Redact'],['tumbler','Tumbler'],['cryptic','Cryptic']];
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
    // Puzzle cards (7 Nov 2026, as the app): when on the left, one thing on the right (How to play,
    // or your result once there is one: front.js showPlayed). No reading time.
    var meta = guide
      ? (when ? '<span class="card-date">'+esc(when)+'</span>' : '')
      : '<span class="t">'+esc(it.topic)+'</span>'
        + (when ? '<span class="dot">·</span><span>'+esc(when)+'</span>' : '')
        + (it.read ? '<span class="dot">·</span><span>'+esc(it.read)+'</span>' : '');
    // Puzzles shows the day's set only (7 Nov 2026, as the app's Today): older cards stay in the page,
    // so every puzzle link is still crawlable, but hidden; the Archive is where players find them.
    var off = options && options.day && it.kind==='puzzle' && it.date!==options.day;
    return '<li data-kind="'+esc(it.kind)+'"'+(guide?' class="puzzle-card"':'')+(off?' hidden':'')+'><a class="card" href="'+esc(it.path)+'">'
      + thumb
      + '<div>'
      +   '<h2 class="hl">'+esc(it.headline)+'</h2>'
      +   (it.standfirst ? '<p class="sf">'+esc(it.standfirst)+'</p>' : '')
      +   '<p class="meta">'+meta+'</p>'
      + '</div></a>'
      + (guide ? '<a class="card-guide" href="how-to-play.html#'+guide+'" aria-label="How to play '+esc(TYPE_LABEL[guide])+'">How to play</a>' : '')
      + '</li>';
  }

  /* Puzzles' order (7 Nov 2026): the day's set first, in the daily order (Mini, Doku, Sweep, Path, Link,
     Tangle, Borders, Reckon, Tally), then every older card in feed order. The day is the newest released
     day up to today, so before today's build it is still yesterday's. Shared by the build and front.js. */
  function daySet(items, today){
    var day = '';
    items.forEach(function(it){ if(it.kind==='puzzle' && it.date && it.date<=today && it.date>day) day = it.date; });
    var rank = function(it){ var r = TYPE_RANK[puzzleType(it)]; return r==null ? 99 : r; };
    var first = items.filter(function(it){ return it.date===day; }).map(function(it, i){ return [it, i]; })
      .sort(function(a, b){ return rank(a[0]) - rank(b[0]) || a[1] - b[1]; }).map(function(x){ return x[0]; });
    return { day: day, items: first.concat(items.filter(function(it){ return it.date!==day; })) };
  }

  return {card:card,types:PUZZLE_TYPES,daySet:daySet};
});
