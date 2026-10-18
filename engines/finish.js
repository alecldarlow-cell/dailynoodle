/* ---------------------------------------------------------------------------
   The Daily Noodle: the shared finish sheet, used by every puzzle engine.
   (18 Oct 2026. Design approved by Alec from the mocks; see SITE.md.)

   One anatomy for all seven types: kicker, outcome, the result that gets
   shared, one line of comment, the share line with a Share button, three
   stats, the next puzzle you haven't played today, a countdown to the next
   board and your overall run, then the type's own recap.

   How an engine uses it. At the top of the engine:
       window.dnFinish=window.dnFinish||{q:[],show(c){this.q.push(c)},hide(){}};
       document.write('<link rel="stylesheet" href="../engines/finish.css"><script src="../engines/finish.js"><\/script>');
   then, once every result field is filled and before the tracker's "on":
       dnFinish.show({...});            // see show() below for the fields
   Calls made before this file has run are queued and replayed here.

   Contracts kept (dn-track.js, dn-board.js, share-v2, done-state):
   - the sheet is built INSIDE the tracker's result box (#winModal, #modal on
     Path) and adopts the engine's own id'd elements (#winTitle, #winTime,
     #rBig, #rWords, #rPts, #pips, ...), so every id the tracker reads stays
     in the box, filled by the engine exactly as before;
   - the sheet opens with the class "fin-open", never "on": "on" stays the
     tracker's once-only finish signal, added by the engine, so reopening a
     finished puzzle shows the sheet without logging a second finish.
--------------------------------------------------------------------------- */
(function () {
  'use strict';
  var queued = (window.dnFinish && window.dnFinish.q) || [];

  var ORDER = ['mini', 'doku', 'sweep', 'path', 'link', 'tangle', 'borders'];
  var SAVE = { mini: 'digi-mini-v1', doku: 'digi-doku-v1', sweep: 'digi-sweep-v1', path: 'digi-path-v1',
               link: 'digi-link-v1', tangle: 'digi-tangle-v1', borders: 'digi-borders-v1' };
  var NAME = { mini: 'Mini', doku: 'Doku', sweep: 'Sweep', path: 'Path', link: 'Link', tangle: 'Tangle', borders: 'Borders' };
  var SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
  var TICK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var CHEVRON = '<svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }

  /* ---------- London days ---------- */
  function londonDate(d) {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); }
    catch (e) { return (d || new Date()).toISOString().slice(0, 10); }
  }
  function dayBefore(s) { var d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
  function longDate(s) {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s + 'T12:00:00Z')).replace(',', ''); }
    catch (e) { return s; }
  }
  /* seconds until the next London midnight */
  function toMidnight() {
    try {
      var p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = +x.value; });
      return 86400 - (p.hour * 3600 + p.minute * 60 + p.second);
    } catch (e) { var n = new Date(); return 86400 - (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()); }
  }
  function hm(s) { var h = Math.floor(s / 3600), m = Math.ceil((s % 3600) / 60); if (m === 60) { h++; m = 0; } return h ? h + 'h ' + m + 'm' : Math.max(1, m) + 'm'; }

  /* ---------- what you've played ---------- */
  function done(type) { var s = read(SAVE[type]); return (s && s.done && typeof s.done === 'object') ? s.done : {}; }
  /* the overall run: consecutive London days with at least one puzzle finished, ending today or yesterday */
  function overallRun() {
    var days = {};
    ORDER.forEach(function (t) { var d = done(t); for (var id in d) { var day = d[id] && (d[id].d || d[id].on); if (day) days[day] = 1; } });   // Borders records its day as "on"
    ['digi-mini-streak', 'digi-link-streak', 'digi-sweep-streak', 'digi-path-streak'].forEach(function (k) {
      var s = read(k); if (s && Array.isArray(s.dates)) s.dates.forEach(function (d) { days[d] = 1; });
    });
    var t = londonDate(), d = days[t] ? t : dayBefore(t), n = 0;
    while (days[d] && n < 4000) { n++; d = dayBefore(d); }
    return n;
  }

  /* ---------- fonts the sheet uses ---------- */
  function fonts() {
    if (document.querySelector('link[data-fin-fonts]')) return;
    var have = [].slice.call(document.querySelectorAll('link[href*="fonts.googleapis.com/css2"]')).some(function (l) { return /Instrument\+Serif/.test(l.href) && /Archivo/.test(l.href); });
    if (have) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-fin-fonts', '');
    l.href = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Instrument+Serif:ital@0;1&display=swap';
    document.head.appendChild(l);
  }
  function css() {
    if (document.querySelector('link[data-fin-css], link[href$="engines/finish.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-fin-css', '');
    l.href = '../engines/finish.css'; document.head.appendChild(l);
  }

  /* ---------- share: the same behaviour on every type ---------- */
  var coarse = (function () { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
  function shareButton(btn, live, getText, label) {
    var lab = btn.querySelector('.fin-share-label');
    var reset;
    function say(icon, text, ms) {
      btn.querySelector('.fin-share-icon').innerHTML = icon; lab.textContent = text; live.textContent = text === label ? '' : text;
      clearTimeout(reset); reset = setTimeout(function () { btn.querySelector('.fin-share-icon').innerHTML = SHARE_ICON; lab.textContent = label; }, ms || 2000);
    }
    function select() {
      try { var r = document.createRange(); r.selectNodeContents(btn.parentNode.querySelector('.fin-share-text')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
      say(SHARE_ICON, 'Press and hold the line to copy', 3500);
    }
    function legacy(t) {
      try {
        var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta); ta.select(); var ok = document.execCommand && document.execCommand('copy'); document.body.removeChild(ta);
        if (ok) say(TICK_ICON, 'Copied'); else select();
      } catch (e) { select(); }
    }
    function copy(t) {
      try { navigator.clipboard.writeText(t).then(function () { say(TICK_ICON, 'Copied'); }, function () { legacy(t); }); }
      catch (e) { legacy(t); }
    }
    btn.addEventListener('click', function () {
      var t = getText();
      if (coarse && navigator.share) {
        try { navigator.share({ text: t }).catch(function (e) { if (!e || e.name !== 'AbortError') copy(t); }); return; } catch (e) {}
      }
      copy(t);
    });
  }

  /* ---------- the next puzzle ---------- */
  var todayList = null;
  function loadToday(cb) {
    if (todayList) return cb(todayList);
    try {
      fetch('../puzzles-today.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { todayList = j && Array.isArray(j.items) ? j : null; cb(todayList); }, function () { cb(null); });
    } catch (e) { cb(null); }
  }
  function fillNext(row, type) {
    loadToday(function (j) {
      var main = row.querySelector('.fin-next-main'), sub = row.querySelector('.fin-next-sub');
      if (!j) { main.textContent = 'Today’s puzzles'; sub.textContent = ''; row.href = '../puzzles.html'; return; }
      var items = j.items, playedN = 0, next = null, start = ORDER.indexOf(type);
      items.forEach(function (it) { if (done(it.type)[it.id]) playedN++; });
      for (var k = 1; k <= ORDER.length && !next; k++) {
        var t = ORDER[(start + k) % ORDER.length];
        items.forEach(function (it) { if (!next && it.type === t && !done(t)[it.id]) next = it; });
      }
      sub.textContent = playedN + ' of ' + items.length + ' played today';
      if (next) { main.textContent = 'Next: ' + next.name; row.href = '../' + next.path; }
      else { main.textContent = 'All today’s puzzles done'; row.href = '../puzzles.html'; }
    });
  }

  /* ---------- countdown and run ---------- */
  var clockTimer = 0;
  function fillClock(p, name) {
    function paint() {
      var s = toMidnight(), run = overallRun();
      var runTxt = run >= 2 ? ' You’ve played every day for <b>' + run + ' days</b>.' : '';
      if (s <= 60 || s >= 86340) {
        p.innerHTML = 'Today’s puzzles are out. <a href="" class="fin-reload">Reload</a>' + runTxt;
        var a = p.querySelector('.fin-reload'); if (a) a.addEventListener('click', function (e) { e.preventDefault(); location.reload(); });
      } else p.innerHTML = 'A new ' + esc(name) + ' in <b>' + hm(s) + '</b>.' + runTxt;
    }
    paint(); clearInterval(clockTimer); clockTimer = setInterval(paint, 30000);
  }

  /* ---------- build ---------- */
  /*  cfg = {
        type, id, n, date, box (id of the tracker's result box),
        title: id of the element holding the outcome (#winTitle),
        hero: id of the element holding the shared result (#rBig, #winTime) or a DOM node,
        note: html (one line of comment),
        share: { text(): string, label?: 'Share' },
        stats: [{ id?, value?, label }] three of them; an id is adopted, a value is written,
        keep: [ids] adopted but hidden (tracker reads them),
        recap: { title, sub?, node } the type's own section,
        after?: node placed at the very end (e.g. Play again)
      } */
  function show(cfg) {
    var box = $(cfg.box); if (!box) return;
    css(); fonts();
    document.documentElement.classList.add('fin-ready');
    box.classList.add('fin-box'); box.setAttribute('data-fin', cfg.type);
    var old = $('dnFin'); if (old) old.parentNode.removeChild(old);
    var keep = el('div', 'fin-keep'); keep.hidden = true;
    var f = el('div', 'fin'); f.id = 'dnFin';
    var adopt = function (id) { var e = $(id); if (e) { e.removeAttribute('style'); } return e; };

    f.appendChild(el('div', 'fin-top', '<a class="fin-back" href="../puzzles.html"><span aria-hidden="true">←</span> Puzzles</a>'));
    f.appendChild(el('p', 'fin-kick', esc(NAME[cfg.type] + ' ' + cfg.n + ', ' + longDate(cfg.date))));
    var t = adopt(cfg.title); if (t) { t.className = 'fin-title'; f.appendChild(t); }
    var hero = el('div', 'fin-hero');
    var h = typeof cfg.hero === 'string' ? adopt(cfg.hero) : cfg.hero;
    if (h) { if (h.id) h.classList.add('fin-hero-val'); hero.appendChild(h); }
    f.appendChild(hero);
    if (cfg.note) f.appendChild(el('p', 'fin-note', cfg.note));

    // share
    var label = (cfg.share && cfg.share.label) || 'Share';
    var card = el('section', 'fin-share');
    var text = cfg.share.text();
    var sq = esc(text).replace(/((?:🟩|🟦|🟨|⬛|⬜|🟥|🟪|❌)+(?: · [0-9:]+)?)/u, '<span class="fin-nw">$1</span>');
    card.innerHTML = '<div class="fin-share-card"><span class="fin-share-text">' + sq + '</span>' +
      '<button type="button" class="fin-pill fin-primary fin-share-btn"><span class="fin-share-icon">' + SHARE_ICON + '</span><span class="fin-share-label">' + esc(label) + '</span></button></div>' +
      '<span class="fin-live" role="status" aria-live="polite"></span>';
    f.appendChild(card);
    shareButton(card.querySelector('.fin-share-btn'), card.querySelector('.fin-live'), cfg.share.text, label);

    // stats
    var st = el('div', 'fin-stats');
    (cfg.stats || []).forEach(function (s) {
      var c = el('div'); var v = s.id ? adopt(s.id) : null;
      if (!v) { v = el('b'); v.textContent = s.value == null ? '' : s.value; } else { v.className = 'fin-stat-val'; }
      c.appendChild(v); c.appendChild(el('span', '', esc(s.label))); st.appendChild(c);
    });
    f.appendChild(st);

    // next, board link slot, countdown
    var next = el('a', 'fin-next', '<span><span class="fin-next-main">Today’s puzzles</span><small class="fin-next-sub"></small></span>' + CHEVRON);
    next.href = '../puzzles.html'; f.appendChild(next); fillNext(next, cfg.type);
    f.appendChild(el('div', 'fin-board-slot'));
    var clock = el('p', 'fin-clock'); f.appendChild(clock); fillClock(clock, NAME[cfg.type]);

    // the type's own recap
    if (cfg.recap) {
      var rc = el('section', 'fin-recap');
      rc.appendChild(el('h3', '', esc(cfg.recap.title)));
      if (cfg.recap.sub) rc.appendChild(el('p', 'fin-recap-sub', cfg.recap.sub));
      if (cfg.recap.node) rc.appendChild(cfg.recap.node);
      f.appendChild(rc);
    }
    if (cfg.after) f.appendChild(cfg.after);

    (cfg.keep || []).forEach(function (id) { var e = $(id); if (e) keep.appendChild(e); });
    f.appendChild(keep);
    box.appendChild(f);
    // dn-board.js may already have put its link in the old layout; move it into the sheet
    var bl = box.querySelector('.nn-board-wrap'); if (bl) f.querySelector('.fin-board-slot').appendChild(bl);
    open(box);
  }
  function open(box) {
    box.classList.add('fin-open'); document.documentElement.classList.add('fin-shown');
    try { box.scrollTop = 0; } catch (e) {}
  }
  function hide() {
    var b = document.querySelector('.fin-box.fin-open'); if (b) b.classList.remove('fin-open');
    document.documentElement.classList.remove('fin-shown');
  }

  window.dnFinish = { show: show, hide: hide, q: [], _test: { overallRun: overallRun, toMidnight: toMidnight, hm: hm } };
  queued.forEach(show);
})();
