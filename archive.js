/* The archive by month (6 Nov 2026, Alec's call: free for everyone).
   A calendar of released puzzles from feed.json (it never lists a forward-dated file),
   each day marked with what you've finished, from the players' own saves (read-only,
   the same rule as the Puzzles page's played marks). Tap a day for its puzzles, then
   play or reopen one. Today's set stays on the Puzzles page, so days run to yesterday
   (as the app's Archive tab, AF-030). Records archive_open and archive_play {type, id}. */
(function () {
  'use strict';
  var TYPES = ['mini', 'doku', 'sweep', 'path', 'link', 'tangle', 'borders', 'reckon', 'tally'];
  var LABEL = { mini: 'Mini', doku: 'Doku', sweep: 'Sweep', path: 'Path', link: 'Link', tangle: 'Tangle', borders: 'Borders', reckon: 'Reckon', tally: 'Tally' };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var TICK = '<svg class="ar-tk" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  var $ = function (id) { return document.getElementById(id); };
  var grid = $('ar-grid'), title = $('ar-month'), dayBox = $('ar-day'), status = $('ar-status');
  var listBox = $('ar-listview'), calBox = $('ar-cal'), sheet = $('ar-sheet'), scrim = $('ar-scrim'), pick = $('ar-pick');
  // view: 'list' (the default, as the app) or 'cal'; hide: "Hide done" (list only). Both live in the address, not storage.
  var state = { items: [], byDay: {}, first: null, last: null, month: null, type: null, day: null, saves: {}, view: 'list', hide: false, today: '' };

  function londonDay() {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return p.year + '-' + p.month + '-' + p.day;
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function track(ev, props) { try { if (window.digi && window.digi.track) window.digi.track(ev, props || {}); } catch (e) {} }
  function readSaves() {
    var out = {};
    TYPES.forEach(function (t) {
      try { var d = JSON.parse(localStorage.getItem('digi-' + t + '-v1') || 'null'); if (d && d.done && typeof d.done === 'object') out[t] = d.done; } catch (e) {}
    });
    return out;
  }
  function done(it) { var d = state.saves[it.type]; return !!(d && it.id && d[it.id]); }
  function clock(secs) {
    secs = Math.round(Number(secs)); if (!isFinite(secs) || secs < 0) return '';
    var h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, s = secs % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function shown(t) { var m = /^(\d+):(\d\d)(?::(\d\d))?$/.exec(String(t || '')); return m ? clock(m[3] ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : (+m[1] * 60 + +m[2])) : ''; }
  function num(x) { return typeof x === 'number' && isFinite(x); }
  // The same words as the Puzzles page's played marks, kept short.
  function result(it) {
    var r = state.saves[it.type] && state.saves[it.type][it.id]; if (!r) return '';
    switch (it.type) {
      case 'sweep': return r.o === 'win' ? clock(r.s) : r.o === 'gave' ? 'Gave up' : 'Hit a mine';
      case 'link': return r.o === 'win' ? (num(r.m) ? r.m + ' mistake' + (r.m === 1 ? '' : 's') : 'Solved') : 'Out of mistakes';
      case 'path': return shown(r.t) || 'Done';
      case 'tally': return num(r.s) ? clock(r.s) : shown(r.t) || 'Done';
      case 'tangle': case 'reckon': return num(r.s) || num(r.p) ? (num(r.p) ? r.p : r.s) + ' pts' : 'Done';
      case 'borders': return num(r.p) ? r.p + ' pts · ' + r.c + '/10' : num(r.c) ? r.c + '/10' : 'Done';
      default: return num(r.s) ? clock(r.s) : 'Done';
    }
  }
  function monthOf(d) { return d.slice(0, 7); }
  function addMonth(m, k) { var y = +m.slice(0, 4), n = +m.slice(5, 7) - 1 + k; y += Math.floor(n / 12); n = ((n % 12) + 12) % 12; return y + '-' + String(n + 1).padStart(2, '0'); }
  function longDay(d) {
    var x = new Date(d + 'T12:00:00Z');
    return x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
  }
  function visible(list) { return state.type ? list.filter(function (it) { return it.type === state.type; }) : list; }

  function saveUrl() {
    var q = new URLSearchParams();
    if (state.view === 'cal' && state.month) q.set('m', state.month);
    if (state.type) q.set('t', state.type);
    if (state.view === 'cal' && state.day) q.set('d', state.day);
    if (state.view === 'list' && state.hide) q.set('h', '1');
    try { history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '')); } catch (e) {}
  }

  /* One row of controls (7 Nov 2026, as the app's option F): the type picker, "Hide done" (list only), the calendar. */
  function icon(t) {
    return t ? '<img src="assets/' + t + '-thumb.svg" alt="" width="26" height="26">' : '<span class="ar-mark">' + $('ar-mark').innerHTML + '</span>';
  }
  function renderBar() {
    $('ar-pick-ico').innerHTML = icon(state.type);
    $('ar-pick-name').textContent = state.type ? LABEL[state.type] : 'All';
    pick.setAttribute('aria-label', 'Puzzles: ' + (state.type ? LABEL[state.type] : 'All') + '. Choose which puzzle to show');
    var hide = $('ar-hide'), view = $('ar-view'), cal = state.view === 'cal';
    hide.hidden = cal; hide.setAttribute('aria-checked', state.hide ? 'true' : 'false');
    view.setAttribute('aria-pressed', cal ? 'true' : 'false');
    view.setAttribute('aria-label', cal ? 'Show as a list' : 'Show as a calendar');
    listBox.hidden = cal; calBox.hidden = !cal;
  }
  function relDay(d) {
    var n = Math.round((Date.parse(state.today + 'T12:00:00Z') - Date.parse(d + 'T12:00:00Z')) / 864e5);
    if (n === 1) return 'Yesterday';
    if (n > 1 && n < 7) return n + 'd ago';
    return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }
  function row(it, when) {
    var ok = done(it), res = result(it);
    return '<li><a class="ar-row' + (ok ? ' ok' : '') + '" href="' + esc(it.path) + '?via=archive" data-type="' + esc(it.type) + '" data-id="' + esc(it.id || '') + '">' +
      '<img src="' + esc(it.thumb || 'assets/' + it.type + '-thumb.svg') + '" alt="" width="36" height="36" loading="lazy">' +
      '<span class="ar-name">' + esc(it.headline) + (when ? '<small class="ar-when">' + esc(when) + '</small>' : '') + '</span>' +
      (ok ? '<span class="ar-res"><span class="ar-tick">' + TICK + '</span>' + esc(res) + '</span>' : '<span class="ar-play">Play</span>') +
      '</a></li>';
  }
  // Every released puzzle before today, newest first, in month sections (the app's list view).
  function renderList() {
    if (state.view !== 'list') return;
    var list = visible(state.items).filter(function (it) { return !state.hide || !done(it); }).sort(function (a, b) {
      return a.date === b.date ? TYPES.indexOf(a.type) - TYPES.indexOf(b.type) : a.date < b.date ? 1 : -1;
    });
    if (!list.length) { listBox.innerHTML = state.items.length ? '<p class="ar-empty">' + (state.hide ? 'All done here' : 'No puzzles match') + '</p>' : ''; return; }
    var html = [], open = '';
    list.forEach(function (it) {
      var m = monthOf(it.date);
      if (m !== open) {
        if (open) html.push('</ul>');
        html.push('<h3 class="ar-sec">' + MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4) + '</h3><ul class="ar-list ar-all">');
        open = m;
      }
      html.push(row(it, relDay(it.date)));
    });
    html.push('</ul>');
    listBox.innerHTML = html.join('');
  }

  function renderMonth() {
    var m = state.month, y = +m.slice(0, 4), mo = +m.slice(5, 7);
    title.textContent = MONTHS[mo - 1] + ' ' + y;
    $('ar-prev').disabled = !state.first || m <= monthOf(state.first);
    $('ar-next').disabled = !state.last || m >= monthOf(state.last);
    var first = new Date(Date.UTC(y, mo - 1, 1)), lead = (first.getUTCDay() + 6) % 7;
    var days = new Date(Date.UTC(y, mo, 0)).getUTCDate(), cells = [];
    for (var i = 0; i < lead; i++) cells.push('<span class="ar-c ar-blank" aria-hidden="true"></span>');
    for (var d = 1; d <= days; d++) {
      var key = m + '-' + String(d).padStart(2, '0'), list = visible(state.byDay[key] || []);
      if (!list.length) { cells.push('<span class="ar-c ar-none" aria-hidden="true"><b>' + d + '</b></span>'); continue; }
      var n = list.filter(done).length, cls = n === list.length ? ' full' : n ? ' part' : '';
      var sub = state.type ? (n ? TICK : '') : n + '/' + list.length;
      var label = longDay(key) + ': ' + (state.type ? (n ? LABEL[state.type] + ' done' : LABEL[state.type] + ' not done') : n + ' of ' + list.length + ' done');
      cells.push('<button type="button" class="ar-c' + cls + (key === state.day ? ' sel' : '') + '" data-d="' + key + '" aria-label="' + esc(label) + '" aria-pressed="' + (key === state.day) + '"><b>' + d + '</b><small>' + sub + '</small></button>');
    }
    grid.innerHTML = cells.join('');
  }

  function renderDay() {
    if (state.view !== 'cal') { dayBox.hidden = true; return; }
    var list = state.day ? visible(state.byDay[state.day] || []) : [];
    if (!list.length) { dayBox.hidden = true; dayBox.innerHTML = ''; return; }
    var n = list.filter(done).length;
    dayBox.innerHTML = '<div class="ar-dayhead"><h2>' + esc(longDay(state.day)) + '</h2><span>' + n + ' of ' + list.length + ' done</span></div><ul class="ar-list">' +
      list.map(function (it) { return row(it, ''); }).join('') + '</ul>';
    dayBox.hidden = false;
  }

  function render() { renderBar(); renderList(); renderMonth(); renderDay(); saveUrl(); }

  /* The type sheet: a bottom sheet on phones, a centred card on wide screens. Escape, the scrim
     or a choice closes it; focus goes to the chosen tile, stays inside, and returns to the picker. */
  function tiles() {
    $('ar-tiles').innerHTML = [''].concat(TYPES).map(function (t) {
      var on = (state.type || '') === t;
      return '<button type="button" class="ar-tile" role="radio" data-t="' + t + '" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '">' +
        '<span class="ar-ico">' + icon(t) + '</span><span>' + (t ? LABEL[t] : 'All') + '</span></button>';
    }).join('');
  }
  function openSheet() {
    tiles(); scrim.hidden = false; sheet.hidden = false; pick.setAttribute('aria-expanded', 'true');
    document.body.classList.add('ar-locked');
    requestAnimationFrame(function () { sheet.classList.add('open'); scrim.classList.add('open'); });
    var on = sheet.querySelector('.ar-tile[aria-checked="true"]'); if (on) on.focus();
  }
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.classList.remove('open'); scrim.classList.remove('open');
    sheet.hidden = true; scrim.hidden = true; pick.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('ar-locked'); pick.focus();
  }
  pick.addEventListener('click', openSheet);
  scrim.addEventListener('click', closeSheet);
  $('ar-tiles').addEventListener('click', function (e) {
    var b = e.target.closest('.ar-tile'); if (!b) return;
    state.type = b.getAttribute('data-t') || null; closeSheet(); render();
  });
  sheet.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
    var all = [].slice.call(sheet.querySelectorAll('.ar-tile')), i = all.indexOf(document.activeElement);
    if (e.key === 'Tab') { e.preventDefault(); return; }   // one control group: focus stays on the tiles
    var k = { ArrowRight: 1, ArrowDown: 3, ArrowLeft: -1, ArrowUp: -3 }[e.key];
    if (k && i >= 0) { e.preventDefault(); all[Math.max(0, Math.min(all.length - 1, i + k))].focus(); }
  });
  $('ar-hide').addEventListener('click', function () { state.hide = !state.hide; render(); });
  $('ar-view').addEventListener('click', function () { state.view = state.view === 'cal' ? 'list' : 'cal'; state.day = null; render(); });
  listBox.addEventListener('click', function (e) {
    var a = e.target.closest('a.ar-row'); if (!a) return;
    track('archive_play', { type: a.getAttribute('data-type'), id: a.getAttribute('data-id') });
  });
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-d]'); if (!b) return;
    state.day = state.day === b.getAttribute('data-d') ? null : b.getAttribute('data-d'); render();
    if (state.day && dayBox.scrollIntoView && innerHeight < 900) dayBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('ar-prev').addEventListener('click', function () { state.month = addMonth(state.month, -1); state.day = null; render(); });
  $('ar-next').addEventListener('click', function () { state.month = addMonth(state.month, 1); state.day = null; render(); });
  dayBox.addEventListener('click', function (e) {
    var a = e.target.closest('a.ar-row'); if (!a) return;
    track('archive_play', { type: a.getAttribute('data-type'), id: a.getAttribute('data-id') });
  });
  // Back from a puzzle, or a save from another tab: redraw the marks.
  function freshen() { state.saves = readSaves(); if (state.month) { renderList(); renderMonth(); renderDay(); } }
  addEventListener('pageshow', function (e) { if (e.persisted) freshen(); });
  addEventListener('storage', function (e) { if (!e.key || /^digi-.*-v1$/.test(e.key)) freshen(); });

  function load() {
    status.textContent = 'Loading the archive…';
    fetch('feed.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (feed) {
      var today = londonDay(); state.today = today;
      state.items = (feed.items || []).filter(function (it) {
        return it.kind === 'puzzle' && !it.badge && TYPES.indexOf(it.type) >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') && it.date < today;
      });
      state.byDay = {};
      state.items.forEach(function (it) { (state.byDay[it.date] = state.byDay[it.date] || []).push(it); });
      Object.keys(state.byDay).forEach(function (d) { state.byDay[d].sort(function (a, b) { return TYPES.indexOf(a.type) - TYPES.indexOf(b.type); }); });
      var days = Object.keys(state.byDay).sort();
      state.first = days[0] || null; state.last = days[days.length - 1] || null;
      state.saves = readSaves();
      var q = new URLSearchParams(location.search), m = q.get('m'), t = q.get('t'), d = q.get('d');
      // A month or day in the address (Back from a puzzle opened from the calendar, older links) opens the calendar.
      state.view = m || d || q.get('v') === 'cal' ? 'cal' : 'list';
      state.hide = q.get('h') === '1';
      state.type = TYPES.indexOf(t) >= 0 ? t : null;
      state.month = m && /^\d{4}-\d{2}$/.test(m) && state.first && m >= monthOf(state.first) && m <= monthOf(state.last) ? m : state.last ? monthOf(state.last) : monthOf(today);
      state.day = d && state.byDay[d] && monthOf(d) === state.month ? d : null;
      status.textContent = days.length ? '' : 'No past puzzles yet.';
      render();
    }).catch(function () {
      status.innerHTML = 'Couldn’t load the archive. <button type="button" class="ar-retry">Try again</button>';
    });
  }
  status.addEventListener('click', function (e) { if (e.target.closest('.ar-retry')) load(); });
  addEventListener('online', function () { if (!state.items.length) load(); });
  /* Switch (Alec, 6 Nov 2026): "archive": false in features.json turns this page off; it then sends
     anyone who opens it to Puzzles. Unknown or unreachable counts as on. */
  fetch('features.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (f) { if (f && f.archive === false) location.replace('puzzles.html'); }).catch(function () {});
  load();
  // dn-track.js is deferred, so it is ready by DOMContentLoaded.
  document.addEventListener('DOMContentLoaded', function () { track('archive_open', { from: (new URLSearchParams(location.search).get('from') || '').replace(/[^a-z_-]/g, '').slice(0, 24) }); });
})();
