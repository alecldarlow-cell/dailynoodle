/* ==========================================================================
   DIGI — shared front-page script for Digi News, Digi Puzzles and Digi Games.
   --------------------------------------------------------------------------
   Reads feed.json (built by .github/workflows/build-feed.yml on every push and
   nightly) and renders a reverse-chronological, topic-filterable card list of
   the section's own kind: report (News), puzzle (Puzzles) or game (Games).
   If feed.json can't be loaded (usually no connection) it says so and offers
   a retry, and tries again by itself when the phone comes back online.
   (19 Oct 2026: the old fallback that read the GitHub API was removed. The
   workflow always deploys feed.json, and the API listed held-back files the
   site doesn't serve, so its links led to 404s.)

   Back and forward (19 Oct 2026): the chosen topic and the card at the top of
   the screen are kept in history.state, so returning from a piece or puzzle
   lands where you left even when the browser has dropped the page from its
   back-forward cache. A page left open (or an installed app resumed) fetches
   the feed again once the London day changes or it is 30 minutes old.

   You should never need to edit this file to publish. Upload a piece to
   /reports, /puzzles or /games and it appears on the right page.

   LAB: anything carrying <meta name="dn:badge" content="In development"> is
   unfinished. It is left off News, Puzzles and Games and listed on lab.html
   instead, whatever its kind. Delete the tag and it moves to its own page.
   ========================================================================== */
(function(){
  'use strict';

  /* ---------- section ------------------------------------------------------
     Each page declares its desk on <html data-section="…">. The section picks
     which kind of item from feed.json it shows. One script, four pages.       */
  var SECTIONS = {
    news:    { kind:'report', noun:['piece','pieces'],
               empty:'No pieces published yet.' },
    puzzles: { kind:'puzzle', noun:['puzzle','puzzles'],
               empty:'No puzzles published yet.' },
    games:   { kind:'game',   noun:['game','games'],
               empty:'No games yet — the first ones are on their way.' },
    lab:     { kind:'*',      noun:['item','items'],
               empty:'Nothing in the lab right now — everything is finished.' }
  };
  var SEC = SECTIONS[document.documentElement.dataset.section] || SECTIONS.news;
  var LAB = SEC.kind === '*';
  var KIND_LABEL = { report:'News', puzzle:'Puzzles', game:'Games' };
  // An item is in the lab while its dn:badge reads "In development".
  function inLab(it){ return /^\s*in development\s*$/i.test(it.badge||''); }
  // Which items this page lists: the lab takes every unfinished item; each
  // desk takes its own kind, minus anything still in the lab.
  function mine(it){ return LAB ? inLab(it) : (it.kind===SEC.kind && !inLab(it)); }
  // The lab filters by desk; the desks filter by topic.
  function facet(it){ return LAB ? (KIND_LABEL[it.kind]||'') : (it.topic||''); }

  var state = { items:[], kind:SEC.kind, topic:'all', q:'', built:'', loadedAt:0, day:'' };

  var $feed   = document.getElementById('feed');
  var $chips  = document.getElementById('chips');
  var $count  = document.getElementById('count');
  var $status = document.getElementById('status');
  var $built  = document.getElementById('built');

  /* ---------- helpers ---------- */
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // Today's date in London, YYYY-MM-DD: the site's day, whatever the phone's time zone.
  function londonDay(){
    try { return new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  // Items carry a publication day, not a time. Labelling them in hours ("just
  // now" all morning, "24h ago") claimed a precision they don't have, so a
  // day-only date reads as a London calendar day: Today, Yesterday, 3d ago.
  function relTime(iso){
    if(!/^\d{4}-\d{2}-\d{2}/.test(iso||'')) return '';
    var d = new Date(iso.length>10 ? iso : iso+'T12:00:00Z');
    if(isNaN(d)) return '';
    var fmt = { day:'numeric', month:'short', year:'numeric' };
    if(iso.length === 10){
      var days = Math.round((Date.parse(londonDay()+'T12:00:00Z') - d.getTime())/864e5);
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

  /* ---------- load ---------- */
  function loadFeed(){
    return fetch('feed.json', {cache:'no-cache'})   // revalidates: a fresh copy only when it has changed
      .then(function(r){ if(!r.ok) throw new Error('feed.json '+r.status); return r.json(); })
      .then(function(j){
        if(!j || !Array.isArray(j.items)) throw new Error('feed.json has no items');
        state.items = j.items;
        state.built = j.built || '';
        state.loadedAt = Date.now();
        state.day = londonDay();
        return true;
      });
  }

  /* ---------- render ---------- */
  function topics(){
    var seen = {}, out = [];
    state.items.forEach(function(it){
      if(!mine(it)) return;
      var t = facet(it);
      if(t && !seen[t]){ seen[t]=1; out.push(t); }
    });
    return out.sort();
  }

  function renderChips(){
    var list = topics();
    if(state.topic!=='all' && list.indexOf(state.topic)===-1) state.topic='all';
    var html = [];
    // Puzzles only: the leaderboard link leads the row. A link, not a filter.
    if(SEC.kind==='puzzle') html.push('<a class="chip boardpill" href="board.html?from=pill">🏆 Board</a>');
    html.push('<button class="chip" data-topic="all" aria-pressed="'+(state.topic==='all')+'">'+(LAB?'Everything':'All topics')+'</button>');
    list.forEach(function(t){
      html.push('<button class="chip" data-topic="'+esc(t)+'" aria-pressed="'+(state.topic===t)+'">'+esc(t)+'</button>');
    });
    $chips.innerHTML = html.join('');
    $chips.hidden = list.length < 2 && SEC.kind!=='puzzle';   // a lone chip filters nothing (the Board pill keeps Puzzles' row)
  }

  function visible(){
    var q = state.q.trim().toLowerCase();
    return state.items.filter(function(it){
      if(!mine(it)) return false;
      if(state.topic!=='all' && facet(it)!==state.topic) return false;
      if(q && (it.headline+' '+it.standfirst+' '+it.topic).toLowerCase().indexOf(q)===-1) return false;
      return true;
    });
  }

  // The figure sizes the tile by its own length — the unit is set separately and
  // must not count, or "93%" would shrink to fit a character it doesn't own.
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

  function card(it){
    // A meaningful update (dn:updated) moves the card up and is labelled as such.
    var upd = /^\d{4}-\d{2}-\d{2}$/.test(it.updated||'') && it.updated > (it.date||'');
    var when = relTime(upd ? it.updated : it.date);
    if(upd && when) when = 'Updated ' + (/^(Today|Yesterday)$/.test(when) ? when.toLowerCase() : when);
    var thumb;
    if(it.thumb){
      thumb = '<img class="thumb" src="'+esc(it.thumb)+'" alt="" loading="lazy">';
    } else if(it.kind==='puzzle' && typeof it.mask==='string' && (it.mask.length===16 || it.mask.length===25 || it.mask.length===36)){
      thumb = puzzleTile(it.mask);
    } else if(it.stat){
      thumb = statTile(it);
    } else {
      thumb = '<div class="thumb glyph" aria-hidden="true">'+(it.kind==='report'?'Chart':'Play')+'</div>';
    }
    // Optional dn:badge (e.g. "In development") sits on the thumbnail.
    // In the lab every card is in development, so that badge would be noise.
    if(it.badge && !(LAB && inLab(it))) thumb = '<div class="thumbwrap">'+thumb+'<span class="badge">'+esc(it.badge)+'</span></div>';
    return '<li data-kind="'+esc(it.kind)+'"><a class="card" href="'+esc(it.path)+'">'
      + thumb
      + '<div>'
      +   '<h2 class="hl">'+esc(it.headline)+'</h2>'
      +   (it.standfirst ? '<p class="sf">'+esc(it.standfirst)+'</p>' : '')
      +   '<p class="meta"><span class="t">'+esc(it.topic)+'</span>'
      +     (when ? '<span class="dot">·</span><span>'+esc(when)+'</span>' : '')
      +     (it.read ? '<span class="dot">·</span><span>'+esc(it.read)+'</span>' : '')
      +   '</p>'
      + '</div></a></li>';
  }

  function render(){
    renderChips();
    var v = visible();
    $feed.innerHTML = v.length
      ? v.map(card).join('')
      : '<li class="empty">'+esc(state.items.some(mine)
          ? 'Nothing matches that filter yet.' : SEC.empty)+'</li>';
    $count.textContent = v.length
      ? v.length + ' ' + SEC.noun[v.length===1?0:1] + (state.q?' matching':'')
      : '';
    if (SEC.kind === 'puzzle') showRun();
    $built.textContent = state.built
      ? 'Index rebuilt ' + new Date(state.built).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})
      : '';
  }

  /* ---------- your overall run (Puzzles only) ----------
     Consecutive London days with at least one puzzle finished, from the
     players' own saves; the same count the finish sheet shows. */
  function showRun(){
    var KEYS = ['digi-mini-v1','digi-doku-v1','digi-sweep-v1','digi-path-v1','digi-link-v1','digi-tangle-v1','digi-borders-v1'],
        STREAKS = ['digi-mini-streak','digi-doku-streak','digi-link-streak','digi-sweep-streak','digi-path-streak'], days = {};
    function read(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    KEYS.forEach(function(k){ var s = read(k); if (s && s.done) for (var id in s.done) { var d = s.done[id] && (s.done[id].d || s.done[id].on); if (d) days[d] = 1; } });
    STREAKS.forEach(function(k){ var s = read(k); if (s && Array.isArray(s.dates)) s.dates.forEach(function(d){ days[d] = 1; }); });
    function back(d){ var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); }
    var t = londonDay();
    var d = days[t] ? t : back(t), n = 0;
    while (days[d] && n < 4000) { n++; d = back(d); }
    // 19 Oct 2026 (Alec): a chip on the count row, not a sentence under it.
    // "You've played every day for N days" read as a plain fact in body text
    // and didn't feel like a win. Filled once today is played; outlined, with a
    // nudge, while the run is still open (played up to yesterday, not today).
    var el = document.getElementById('run');
    if (!el) {
      var row = document.createElement('div'); row.className = 'countrow';
      $count.parentNode.insertBefore(row, $count); row.appendChild($count);
      el = document.createElement('p'); el.id = 'run'; el.className = 'run'; row.appendChild(el);
    }
    var safe = !!days[t];
    el.innerHTML = n < 2 ? ''
      : safe ? '<span aria-hidden="true">🔥</span><span><b>' + n + '-day</b> streak</span>'
             : '<span aria-hidden="true">🔥</span><span><b>' + n + '-day</b> streak · play today</span>';
    el.classList.toggle('risk', !safe);
    el.hidden = n < 2;
  }

  /* ---------- where you were: kept in this history entry ----------
     The card at the top of the screen (by its link) and its offset, not a
     pixel scroll position: cards below the screen are laid out lazily
     (content-visibility in front.css), so a raw scrollY would land a few
     cards out on a fresh load.                                             */
  try { if('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch(e){}
  function controlsBottom(){ var c = document.querySelector('.controls'); return c ? Math.max(0, c.getBoundingClientRect().bottom) : 0; }
  function anchor(){
    var top = controlsBottom(), cards = $feed.querySelectorAll('a.card');
    if(window.scrollY < 40 || !cards.length) return null;   // at the top: nothing to come back to
    for(var i=0;i<cards.length;i++){
      var r = cards[i].getBoundingClientRect();
      if(r.bottom > top + 1) return { href: cards[i].getAttribute('href'), off: Math.round(r.top) };
    }
    return null;
  }
  function toAnchor(a){
    if(!a || !a.href) return;
    var cards = $feed.querySelectorAll('a.card');
    for(var i=0;i<cards.length;i++) if(cards[i].getAttribute('href') === a.href){
      window.scrollTo(0, window.scrollY + cards[i].getBoundingClientRect().top - a.off);
      return;
    }
  }
  function remember(){
    try {
      var s = {}, h = history.state, k;
      if(h && typeof h === 'object') for(k in h) s[k] = h[k];
      s.dnFront = { topic: state.topic, at: anchor() };
      history.replaceState(s, '');
    } catch(e){}
  }
  var saved = null;
  try { saved = history.state && history.state.dnFront; } catch(e){}

  /* ---------- events ---------- */
  $chips.addEventListener('click', function(e){
    var b = e.target.closest('.chip'); if(!b || !b.dataset.topic) return;   // the Board pill is a plain link
    state.topic = b.dataset.topic;
    if(window.digi) window.digi.track('chip_click', { topic: state.topic });
    render();
    remember();
  });
  // Saved as you leave: tapping a card (before the browser navigates), and
  // whenever the page is hidden or unloaded.
  $feed.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('a.card')) remember(); }, true);
  window.addEventListener('pagehide', remember);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden') remember();
    else freshen();
  });

  // search toggle: the icon opens the field and focuses it; it closes on a
  // second tap or Escape, clearing any query so the list isn't left filtered
  // by text the reader can no longer see.
  var $q = document.getElementById('q'), $sbtn = document.getElementById('sbtn'),
      $srow = document.getElementById('searchrow');
  function setSearch(open){
    $srow.hidden = !open;
    $sbtn.setAttribute('aria-expanded', String(open));
    if(open){ $q.focus(); }
    else if($q.value){ $q.value=''; state.q=''; render(); }
  }
  $sbtn.addEventListener('click', function(){ setSearch($srow.hidden); });
  $q.addEventListener('keydown', function(e){
    if(e.key==='Escape'){ setSearch(false); $sbtn.focus(); }
  });

  var t;
  $q.addEventListener('input', function(e){
    clearTimeout(t); var val = e.target.value;
    t = setTimeout(function(){ state.q = val; render(); }, 120);
  });

  /* ---------- boot ---------- */
  var SKELETON = $feed.innerHTML, failed = false, loading = false;
  function showError(){
    failed = true;
    $feed.innerHTML = '';
    $count.textContent = '';
    $status.innerHTML = '<div class="note" role="alert"><b>Couldn’t load the list.</b> '
      + 'Check your connection and try again. '
      + '<button type="button" class="retry" id="retry">Try again</button></div>';
  }
  function boot(){
    if(loading) return; loading = true;
    failed = false;
    $status.innerHTML = '';
    if(!state.items.length) $feed.innerHTML = SKELETON;
    loadFeed().then(function(){
      loading = false;
      if(saved && typeof saved.topic === 'string') state.topic = saved.topic;   // renderChips falls back to all if it's gone
      render();
      if(saved) toAnchor(saved.at);
      saved = null;
    }, function(){ loading = false; showError(); });
  }
  $status.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('#retry')) boot(); });
  window.addEventListener('online', function(){ if(failed) boot(); });

  // A page left open, or an installed app brought back from the background,
  // would otherwise keep yesterday's list. Fetch again once the London day has
  // changed or the list is 30 minutes old, keeping the card you were looking at.
  function freshen(){
    if(failed){ boot(); return; }
    if(loading || !state.loadedAt) return;
    if(state.day === londonDay() && Date.now() - state.loadedAt < 30*60*1000){
      if(SEC.kind === 'puzzle') showRun();   // a puzzle may have been finished since
      return;
    }
    loading = true;
    loadFeed().then(function(){ loading = false; var a = anchor(); render(); toAnchor(a); },
                    function(){ loading = false; });
  }
  // Back to a page the browser kept whole (back-forward cache): nothing is
  // re-run, so bring the run and the list up to date here.
  window.addEventListener('pageshow', function(e){ if(e.persisted) freshen(); });

  boot();

})();
