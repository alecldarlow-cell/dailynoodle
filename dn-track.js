/* ==========================================================================
   DIGI — reader activity (dn-track.js)  v3
   --------------------------------------------------------------------------
   v3 (15 Oct 2026, MI audit):
     - puzzle_start only counts a tap inside the play area (grid, board,
       letter bank, keyboard, clue list, the Play card). v2 counted any tap,
       including the masthead or the start of a scroll, which inflated starts.
       Events carry tv:3 so the dashboard can tell old starts from new.
     - puzzle_end carries the result where a type has one: score, got/of
       (Borders "7 of 10"), words (Tangle), mistakes (Link). Tangle and
       Borders end as outcome "scored": a timed round can't be solved or
       failed, and v2 logged every round as "solved".
     - page_view carries via (?via=… on shared links) and app (in-app
       browser, e.g. Facebook or Instagram), since apps send no referrer.
   Anonymous, first-party usage events for Digi News, Puzzles and Games,
   sent to the `digi` Supabase project (London, eu-west-2) through one
   write-only function, log_events. The page can add events; it can never
   read anything back.

   Identity: one random ID per browser (a "reader"), one per visit (30 min
   idle), and one per page load ("pv") so a page's events can be tied
   together. None is linked to a name, email or IP address.

   Automatic events
     all pages   page_view   {pv, topic, kind, new, ref, screen, [via], [app]}
                 page_exit   {pv, secs, depth, [started, ended]}   each time the page is hidden (running totals)
     front pages card_click  {to, pos, topic, searched}
     articles    read_depth  {pv, pct: 25|50|75|100}
                 exhibit_view{pv, n}      a chart scrolled half into view
                 source_click{pv, domain} an outbound link
     puzzles     puzzle_start{pv, type, tv}  first tap in the play area or key press (not on a reopened, already-finished puzzle)
                 puzzle_end  {pv, type, tv, outcome: solved|failed|revealed|scored, secs, checks, reveals, hints,
                              [score], [got, of], [words], [mistakes]}
   Games call digi.track('game_start' | 'game_end', {...}) themselves.

   Automated browsers (19 Oct 2026): nothing is sent from a browser that says
   it is automated (navigator.webdriver) or whose user agent names a crawler,
   headless browser or page tester. Crawlers that hide it still get through;
   the admin page hides "one-page readers" for those. The browser tests in
   tools/tests clear the webdriver flag so they still see the events.

   Never sent: names, emails, IP addresses, answers, keystrokes.
   Opt-out: the "Don't record my visits" button in any footer, or a browser
   Global Privacy Control / Do Not Track signal.
   The page never depends on this script: every failure is silent.
   ========================================================================== */

/* ==========================================================================
   Domain move (Oct 2026): alecldarlow-cell.github.io/digi-news -> dailynoodle.co.uk
   --------------------------------------------------------------------------
   Saved progress (streaks, finished puzzles, game saves) lives in each
   browser's localStorage, which belongs to one address. A plain redirect
   would leave it behind, so:

   OLD address  The forwarding repo alecldarlow-cell/digi-news (its index.html
                and 404.html) packs this browser's saved data into the link's
                #fragment (never sent to any server) and jumps to the same
                page on the new address.
   NEW address  This file: a page opened with that fragment merges the data in, never
                overwriting newer progress made on the new address, removes
                the fragment from the address bar and reloads once so the
                puzzle or game starts with the merged save.

   Lives here because every page already loads this file. Independent of the
   tracker below: opting out of tracking does not block the move.
   ========================================================================== */
(function () {
  'use strict';
  var TAG = '#dnmove=';

  function b64d(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x); }
  function parse(s){ try { return JSON.parse(s); } catch (e) { return undefined; } }

  // Union of finished puzzles / days / atlas entries; for a streak keep the
  // more recent run and the higher best. Anything else: keep what's here.
  var UNION = { done:1, days:1, found:1 };
  function mergeObj(here, old){
    var out = {}, k;
    for (k in here) out[k] = here[k];
    if (isStreak(here) && isStreak(old)) {
      var src = (old.last || '') > (here.last || '') ? old : here;
      for (k in src) out[k] = src[k];
      if ('best' in old || 'best' in here) out.best = Math.max(+old.best || 0, +here.best || 0);
      if (Array.isArray(old.dates) && Array.isArray(here.dates)) {
        var seen = {}, all = here.dates.concat(old.dates).filter(function(d){ return seen[d] ? 0 : (seen[d] = 1); });
        out.dates = all.sort();
        // With the full list of days played, the current run can be recounted
        // across both addresses (played yesterday on the old one, today on the new).
        if ('streak' in out && out.dates.length) {
          var run = 1, day = out.dates[out.dates.length - 1];
          while (true) {
            var prev = new Date(Date.parse(day + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
            if (out.dates.indexOf(prev) < 0) break;
            run++; day = prev;
          }
          out.last = out.dates[out.dates.length - 1];
          out.streak = run;
          out.best = Math.max(out.best || 0, run);
        }
      }
    }
    for (k in old) {
      if (!(k in out)) out[k] = old[k];
      else if (UNION[k] && isObj(out[k]) && isObj(old[k])) {
        var u = {}, j;
        for (j in old[k]) u[j] = old[k][j];
        for (j in out[k]) u[j] = out[k][j];
        out[k] = u;
      } else if (k === 'streak' && isObj(out[k]) && isObj(old[k])) {
        out[k] = mergeObj(out[k], old[k]);
      }
    }
    return out;
  }
  function isStreak(o){ return isObj(o) && 'last' in o && ('streak' in o || 'n' in o); }

  try {
    if (location.hash.indexOf(TAG) !== 0) return;
    var p = parse(b64d(location.hash.slice(TAG.length)));
    if (isObj(p) && p.v === 1 && isObj(p.d)) {
      // The new address may already have its own tracker id. Keep the old one
      // too (digi.aid.prev), so the leaderboard's history copy can also read
      // this browser's earlier finishes. Same browser only, never sent on its own.
      try {
        var oldAid = p.d['digi.aid'], nowAid = localStorage.getItem('digi.aid');
        if (/^[0-9a-f-]{36}$/i.test(oldAid || '') && nowAid && nowAid !== oldAid && localStorage.getItem('digi.optout') !== '1') {
          var prev = parse(localStorage.getItem('digi.aid.prev') || '[]');
          if (!Array.isArray(prev)) prev = [];
          if (prev.indexOf(oldAid) < 0) prev.push(oldAid);
          localStorage.setItem('digi.aid.prev', JSON.stringify(prev.slice(-5)));
        }
      } catch (e) {}
      for (var k in p.d) {
        if (k === 'digi.aid.prev') continue;
        var oldV = p.d[k], here = null;
        try { here = localStorage.getItem(k); } catch (e) {}
        var val = oldV;
        if (here != null) {
          var a = parse(here), b = parse(oldV);
          val = (isObj(a) && isObj(b)) ? JSON.stringify(mergeObj(a, b)) : here;
        }
        try { localStorage.setItem(k, val); } catch (e) {}
      }
    }
    window.DN_MOVING = true;
    history.replaceState(null, '', location.pathname + location.search + ((p && typeof p.h === 'string') ? p.h : ''));
    location.reload();
  } catch (e) {}
})();

(function () {
  'use strict';

  var SELF = (document.currentScript && document.currentScript.src) || '';   // for loading dn-board.js
  var URL_ ='https://gnehttjheoyutrfsvslq.supabase.co/rest/v1/rpc/log_events';
  var KEY  = 'sb_publishable_dEMntRNiElpGHn3Hd5Ef1Q_HvLa2wTB';   // public by design
  var IDLE = 30 * 60 * 1000;
  var MAX_BATCH = 25;

  /* ---------- storage (every access guarded) ---------- */
  function get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k){ try { localStorage.removeItem(k); } catch (e) {} }

  function uuid(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16), i;
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (i = 0; i < 16; i++) b[i] = Math.random() * 256 | 0;
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = ''; for (i = 0; i < 16; i++) h += (b[i] + 256).toString(16).slice(1);
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }

  function signalOptOut(){
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  }
  function optedOut(){ return get('digi.optout') === '1' || signalOptOut(); }

  // Automated browsers record nothing. Cubot is a phone brand, not a crawler.
  var BOT = (function(){
    try {
      if (navigator.webdriver === true) return true;
      var u = navigator.userAgent || '';
      return /cubot/i.test(u) ? false
           : /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|inspectiontool|pagerenderer|facebookexternalhit|ptst|gtmetrix|pingdom|phantomjs|puppeteer|playwright|selenium/i.test(u);
    } catch (e) { return false; }
  })();

  /* ---------- identity ---------- */
  var isNew = false;
  function ids(){
    var a = get('digi.aid');
    if (!a) { a = uuid(); set('digi.aid', a); isNew = true; }
    var s = get('digi.sid'), last = +get('digi.last') || 0, now = Date.now();
    if (!s || now - last > IDLE) { s = uuid(); set('digi.sid', s); }
    set('digi.last', String(now));
    return { a: a, s: s };
  }
  var PV = uuid().slice(0, 8);   // this page load

  /* ---------- where are we ---------- */
  function meta(n){ var m = document.querySelector('meta[name="'+n+'"]'); return m ? m.content : ''; }
  var KIND = meta('dn:kind');
  var KIND_TO_SECTION = { report: 'news', puzzle: 'puzzles', game: 'games' };
  var PAGE_SECTION = document.documentElement.dataset.section || KIND_TO_SECTION[KIND] || 'site';
  // public.log_events only accepts these sections and silently drops anything
  // else, so any other page (Lab, or one added later) is recorded as 'site'.
  var ACCEPTED = { news: 1, puzzles: 1, games: 1, site: 1 };
  var SECTION = ACCEPTED[PAGE_SECTION] ? PAGE_SECTION : 'site';
  function pathOf(href){
    try {
      var p = new URL(href, location.href).pathname.split('/').filter(Boolean);
      if (!p.length || !/\./.test(p[p.length-1])) p.push('index.html');
      return p.slice(-2)[0] === 'reports' ? p.slice(-2).join('/') : p[p.length-1];
    } catch (e) { return ''; }
  }
  var PATH = pathOf(location.href);
  var PTYPE = (PATH.match(/(crossword-mini|logic-doku|logic-path|logic-sweep|word-link|geo-borders|word-tangle|digi-doku|digi-path)/) || [])[1] || '';
  if (PTYPE === 'digi-doku') PTYPE = 'logic-doku';
  if (PTYPE === 'digi-path') PTYPE = 'logic-path';

  /* ---------- queue + send ---------- */
  var queue = [];
  function track(ev, props, path){
    if (BOT || optedOut()) return;
    var id = ids(), x = {};
    if (props && typeof props === 'object') for (var k in props) if (props.hasOwnProperty(k)) x[k] = props[k];
    if (!('pv' in x)) x.pv = PV;
    queue.push({ a: id.a, s: id.s, sec: SECTION, ev: String(ev), p: path || PATH, x: x });
    if (queue.length >= MAX_BATCH) flush();
  }
  function flush(){
    if (!queue.length) return;
    var batch = queue.splice(0, MAX_BATCH);
    try {
      fetch(URL_, {
        method: 'POST', keepalive: true, mode: 'cors',
        headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: batch })
      }).catch(function(){});
    } catch (e) {}
    if (queue.length) flush();
  }
  setInterval(flush, 10000);

  /* ---------- page view ---------- */
  function band(w){ return w < 480 ? 'phone' : w < 1024 ? 'tablet' : 'desktop'; }
  function refDomain(){
    try { var r = new URL(document.referrer); return r.host === location.host ? '' : r.host; }
    catch (e) { return ''; }
  }
  // Shared links can carry ?via=share (or any short tag); keep it tidy.
  function viaTag(){
    try { var v = new URLSearchParams(location.search).get('via') || '';
          return v.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24); }
    catch (e) { return ''; }
  }
  // In-app browsers send no referrer, so name the app when it says who it is.
  // (WhatsApp mostly opens links in the phone's own browser and can't be seen.)
  function inApp(){
    var u = navigator.userAgent || '';
    return /FBAN|FBAV|FB_IAB/.test(u) ? 'facebook' : /Instagram/.test(u) ? 'instagram'
         : /WhatsApp/i.test(u) ? 'whatsapp' : /Snapchat/.test(u) ? 'snapchat' : /\bLine\//.test(u) ? 'line' : '';
  }
  // Opened from a home-screen icon (the app manifest asks for fullscreen; iOS
  // reports standalone). Added 18 Oct 2026: page views before then have no inst.
  function installed(){
    try {
      var mm = window.matchMedia;
      return !!((mm && (mm('(display-mode: fullscreen)').matches || mm('(display-mode: standalone)').matches
                     || mm('(display-mode: minimal-ui)').matches)) || navigator.standalone === true);
    } catch (e) { return false; }
  }
  if (!BOT && !optedOut()) ids();   // sets isNew before the first event
  var pvProps = { topic: meta('dn:topic'), kind: KIND, new: isNew,
                  ref: refDomain(), screen: band(window.innerWidth), inst: installed() ? 1 : 0, tv: 3 };
  var VIA = viaTag(), APP = inApp();
  if (VIA) pvProps.via = VIA;
  if (APP) pvProps.app = APP;
  track('page_view', pvProps);
  flush();

  /* ---------- time on page + depth, sent once when the page is first hidden ---------- */
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : 0, activeMs = 0, maxDepth = 0, exited = 0;
  function depthNow(){
    var h = document.documentElement.scrollHeight - window.innerHeight;
    return Math.min(100, Math.round(h > 0 ? (window.scrollY / h) * 100 : 100));
  }
  window.addEventListener('scroll', function(){ var d = depthNow(); if (d > maxDepth) maxDepth = d; }, { passive: true });
  function exit(){
    if (visibleSince) { activeMs += Date.now() - visibleSince; visibleSince = 0; }
    // Sent every time the page is hidden, with running totals: a reader who
    // switches apps and comes back is counted once, using the largest values.
    if (activeMs - exited >= 1000 || !exited) {
      exited = activeMs || 1;
      var p = { secs: Math.round(activeMs / 1000), depth: Math.max(maxDepth, depthNow()) };
      if (PTYPE) { p.type = PTYPE; p.started = puz.started; p.ended = puz.ended; }
      track('page_exit', p);
    }
    flush();
  }
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') exit();
    else if (!visibleSince) visibleSince = Date.now();
  });
  window.addEventListener('pagehide', exit);

  /* ---------- front pages: which card ---------- */
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a.card');
    if (!a) return;
    var li = a.closest('li'), pos = li ? Array.prototype.indexOf.call(li.parentNode.children, li) + 1 : 0;
    var topic = document.querySelector('.chip[aria-pressed="true"]');
    var q = document.getElementById('q');
    track('card_click', {
      to: pathOf(a.href), pos: pos,
      topic: topic && topic.dataset.topic !== 'all' ? topic.dataset.topic : '',
      searched: !!(q && q.value)
    });
    flush();
  });

  /* ---------- articles: depth, charts seen, sources opened ---------- */
  if (SECTION === 'news' && KIND === 'report') {
    var marks = [25, 50, 75, 100], hit = {};
    var onScroll = function(){
      var pct = depthNow();
      marks.forEach(function(m){ if (pct >= m - 1 && !hit[m]) { hit[m] = 1; track('read_depth', { pct: m }); } });
      if (hit[100]) window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    var watchExhibits = function(){
      var ex = document.querySelectorAll('figure.exhibit');
      if (!ex.length || !('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if (en.isIntersecting) {
            track('exhibit_view', { n: Array.prototype.indexOf.call(ex, en.target) + 1 });
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.5 });
      Array.prototype.forEach.call(ex, function(el){ io.observe(el); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchExhibits); else watchExhibits();

    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href^="http"]');
      if (!a) return;
      try { var h = new URL(a.href).host; if (h && h !== location.host) track('source_click', { domain: h }); } catch (x) {}
    });
  }

  /* ---------- puzzles: start, finish, help used ----------
     Every puzzle type shows its result box (#winModal, or #modal for Path)
     by adding the class "on", and titles it with the outcome. So one
     observer covers all of them without touching the puzzle files.       */
  var puz = { started: false, ended: false, t0: 0, checks: 0, reveals: 0, hints: 0, revealedAll: false };
  var LOSS_TITLES = /^(boom\.?|so close\.?)$/i;
  function mmss(t){
    var m = String(t || '').match(/(\d+):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return m[3] ? (+m[1])*3600 + (+m[2])*60 + (+m[3]) : (+m[1])*60 + (+m[2]);
  }
  /* Where play happens, across all seven types: Mini (#grid, #kb, clues),
     Doku (#grid, #bank), Path (#grid, #lines), Sweep (#grid), Link (#board),
     Tangle (#playCard / #resumeBtn start the clock, #board) and Borders
     (#playCard starts the round, #opts, #qmap). A tap anywhere else (the
     masthead, the instructions, the first touch of a scroll) is not a start. */
  var PLAY_AREA = '#grid,#board,#bank,#kb,#cluesWrap,#cluebar,#lines,#playCard,#resumeBtn,#opts,#qmap';
  var SCORED = { 'word-tangle': 1, 'geo-borders': 1 };
  function num(id){
    var el = document.getElementById(id);
    var m = el && String(el.textContent).replace(/,/g, '').match(/-?\d+/);
    return m ? +m[0] : null;
  }
  if (PTYPE) {
    // Leaderboards: dn-board.js submits results for players in a league and
    // adds "See today's board" to the result box. Independent of opt-out.
    try {
      var bs = document.createElement('script');
      bs.src = SELF ? SELF.replace(/dn-track\.js(\?.*)?$/, 'dn-board.js') : '../dn-board.js';
      bs.defer = true; document.head.appendChild(bs);
    } catch (e) {}
    var startPuzzle = function(e){
      if (puz.started) return;
      /* A finished puzzle reopened from the player's own save is marked
         data-dn-done by the page; tapping it (or its Share button) is not a
         new attempt, so it must not count as one. */
      if (document.documentElement.hasAttribute('data-dn-done')) return;
      var t = e.target;
      if (t && t.closest && t.closest('a, .modal, footer, .foot')) return;
      if (e.type === 'keydown') {
        // Typing counts; Tab, Escape, modifiers and function keys don't.
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (!(e.key && (e.key.length === 1 || /^(Arrow|Backspace|Delete|Enter)/.test(e.key)))) return;
      } else if (document.querySelector(PLAY_AREA)) {
        if (!(t && t.closest && t.closest(PLAY_AREA))) return;
      }
      puz.started = true; puz.t0 = Date.now();
      track('puzzle_start', { type: PTYPE, tv: 3 });
    };
    document.addEventListener('pointerdown', startPuzzle, true);
    document.addEventListener('keydown', startPuzzle, true);

    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('button, [role="button"]');
      if (!b || !b.id) return;
      if (/^check/i.test(b.id)) puz.checks++;
      else if (b.id === 'revealAll') puz.revealedAll = true;
      else if (/^reveal/i.test(b.id)) puz.reveals++;
      else if (/^hint/i.test(b.id)) puz.hints++;
    }, true);

    var watchResult = function(){
      var box = document.getElementById('winModal') || document.getElementById('modal');
      if (!box || !('MutationObserver' in window)) return;
      new MutationObserver(function(){
        if (puz.ended || !box.classList.contains('on')) return;
        puz.ended = true;
        // A finish with no recorded start means the play-area list missed
        // how this puzzle is played. Count the start anyway, flagged, so the
        // funnel stays whole and the gap shows up in the data.
        if (!puz.started) {
          puz.started = true;
          track('puzzle_start', { type: PTYPE, tv: 3, late: true });
        }
        var title = (document.getElementById('winTitle') || {}).textContent || '';
        var shown = mmss((document.getElementById('winTime') || document.getElementById('statTime') || {}).textContent);
        var outcome = puz.revealedAll ? 'revealed'
                    : SCORED[PTYPE] ? 'scored'
                    : LOSS_TITLES.test(title.trim()) ? 'failed' : 'solved';
        var end = {
          type: PTYPE, tv: 3, outcome: outcome,
          secs: shown != null ? shown : (puz.t0 ? Math.round((Date.now() - puz.t0) / 1000) : null),
          checks: puz.checks, reveals: puz.reveals, hints: puz.hints
        };
        // The result itself, read from the result box the page has just filled.
        if (PTYPE === 'word-tangle') {
          end.score = num('rBig'); end.words = num('rWords');
        } else if (PTYPE === 'geo-borders') {
          var big = String((document.getElementById('rBig') || {}).textContent || '').match(/(\d+)\s*of\s*(\d+)/);
          if (big) { end.got = +big[1]; end.of = +big[2]; }
          end.score = num('rPts');
        } else if (PTYPE === 'word-link') {
          end.mistakes = document.querySelectorAll('#pips .pip.gone').length;
        }
        // For the leaderboard (dn-board.js), whether or not visits are recorded.
        try { document.dispatchEvent(new CustomEvent('dn:puzzle_end', { detail: end })); } catch (x) {}
        track('puzzle_end', end);
        flush();
      }).observe(box, { attributes: true, attributeFilter: ['class'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchResult); else watchResult();
  }

  /* ---------- opt-out button(s) ---------- */
  function paint(){
    document.querySelectorAll('[data-digi-optout]').forEach(function(b){
      var off = optedOut();
      b.textContent = off ? 'Not recording your visits · turn back on' : 'Don’t record my visits';
      b.setAttribute('aria-pressed', String(off));
      b.disabled = signalOptOut();
      if (signalOptOut()) b.textContent = 'Not recording (your browser asked us not to)';
    });
  }
  function setOptOut(on){
    if (on) { set('digi.optout', '1'); queue.length = 0; del('digi.aid'); del('digi.aid.prev'); del('digi.sid'); del('digi.last'); }
    else    { del('digi.optout'); }
    paint();
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-digi-optout]');
    if (b) setOptOut(!optedOut());
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();

  window.digi = { track: track, flush: flush, optOut: setOptOut, isOptedOut: optedOut };
})();

/* ==========================================================================
   Service worker (19 Oct 2026): offline copies of pages already opened, plus
   today's puzzles. See sw.js. Registered here because every page loads this
   file; independent of tracking opt-out (it records nothing). Waits for the
   page to finish loading so it never slows the first paint. Any failure
   (old browser, private mode, no sw.js beside this file) is silent.
   ========================================================================== */
(function () {
  try {
    // __DGTEST: the games checker (4-dg-check.js) serves a game without sw.js
    // beside it, and Chrome logs a missing worker as a console error.
    if (!('serviceWorker' in navigator) || window.DN_MOVING || window.__DGTEST) return;
    var me = document.currentScript && document.currentScript.src;
    if (!me || !/\/dn-track\.js(\?.*)?$/.test(me)) return;
    var sw = me.replace(/dn-track\.js(\?.*)?$/, 'sw.js');
    var warm = function (r) { if (r.active) r.active.postMessage('warm'); };
    var go = function () {
      try {
        navigator.serviceWorker.register(sw).then(function () { return navigator.serviceWorker.ready; })
          .then(warm).catch(function () {});
      } catch (e) {}
    };
    if (document.readyState === 'complete') setTimeout(go, 1500);
    else window.addEventListener('load', function () { setTimeout(go, 1500); });
    window.addEventListener('online', function () { navigator.serviceWorker.ready.then(warm).catch(function () {}); });
  } catch (e) {}
})();
