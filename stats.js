/* Your stats (stats.html, 6 Nov 2026, Alec's call: free for everyone, no sign-in).
   Everything comes from this device's saves through dn-stats.js; nothing is stored or sent
   except the anonymous stats_open event. feed.json gives each puzzle's date, so plays can be
   split into on the day and catch-ups; without it the page still works, showing "All" only.
   Calm and celebratory (the site's rule for streaks): personal bests, never "slower than usual",
   and no comparison with other players (leagues do that). */
(function () {
  'use strict';
  var S = window.dnStats, $ = function (id) { return document.getElementById(id); };
  var state = { mode: 'all', dates: null };
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
  function fmtNum(n) { return Number(n).toLocaleString('en-GB'); }
  function plural(n, w) { return fmtNum(n) + ' ' + w + (n === 1 ? '' : 's'); }
  function short(m) { return S.monthName(m).slice(0, 3); }

  function tile(label, value, extra) {
    return '<div class="st-tile"><span>' + esc(label) + '</span><b>' + value + '</b>' + (extra ? '<i>' + esc(extra) + '</i>' : '') + '</div>';
  }
  function kv(label, value) { return value == null || value === '' ? '' : '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }

  /* A simple spread: one column per bin, thin, rounded at the top, square at the baseline. */
  function spreadChart(t, bins) {
    if (!bins) return '';
    var max = Math.max.apply(null, bins.map(function (b) { return b.n; })) || 1, timed = !t.scored;
    var lab = function (b) { return timed ? S.clock(b.from) + (b.open ? '+' : '–' + S.clock(b.to)) : fmtNum(b.from) + (b.open ? '+' : '–' + fmtNum(b.to - 1)); };
    var cols = bins.map(function (b) {
      var h = b.n ? Math.max(4, Math.round(56 * b.n / max)) : 0;
      return '<span class="st-col" title="' + esc(lab(b) + ': ' + plural(b.n, 'puzzle')) + '"><i style="height:' + h + 'px"></i></span>';
    }).join('');
    var first = bins[0], last = bins[bins.length - 1];
    var lo = timed ? S.clock(first.from) : fmtNum(first.from), hi = timed ? S.clock(last.open ? last.from : last.to) + (last.open ? '+' : '') : fmtNum(last.open ? last.from : last.to) + (last.open ? '+' : '');
    var list = bins.map(function (b) { return '<li>' + esc(lab(b)) + ': ' + plural(b.n, 'puzzle') + '</li>'; }).join('');
    return '<figure class="st-fig"><figcaption>' + (timed ? 'Your times' : 'Your scores') + '</figcaption>' +
      '<div class="st-bars" aria-hidden="true">' + cols + '</div>' +
      '<div class="st-axis" aria-hidden="true"><span>' + esc(lo) + '</span><span>' + esc(hi) + '</span></div>' +
      '<ul class="sr-only">' + list + '</ul></figure>';
  }
  /* Median time or average score by month: a 2px line, end dot labelled, gaps where a month has under 5. */
  function trendChart(t, pts) {
    if (!pts) return '';
    var W = 300, H = 64, padL = 6, padR = 42, padT = 10, padB = 10, timed = !t.scored;
    var vals = pts.filter(function (p) { return p.value != null; }).map(function (p) { return p.value; });
    // From zero, so a slower month reads as a small change, not a cliff (calm, never pressure).
    var lo = 0, hi = Math.max.apply(null, vals) || 1;
    var x = function (i) { return padL + i * (W - padL - padR) / (pts.length - 1); };
    var y = function (v) { return padT + (hi - v) * (H - padT - padB) / (hi - lo); };
    var segs = [], cur = [], last = null;
    pts.forEach(function (p, i) {
      if (p.value == null) { if (cur.length) segs.push(cur); cur = []; return; }
      cur.push([x(i), y(p.value), p]); last = [x(i), y(p.value), p];
    });
    if (cur.length) segs.push(cur);
    var fmt = function (v) { return timed ? S.clock(v) : fmtNum(v); };
    var lines = segs.map(function (s) { return s.length > 1 ? '<polyline points="' + s.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '"/>' : ''; }).join('');
    var dots = [].concat.apply([], segs).map(function (q) {
      return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="4"><title>' + esc(S.monthName(q[2].month) + ': ' + fmt(q[2].value)) + '</title></circle>';
    }).join('');
    var label = last ? '<text x="' + (last[0] + 8).toFixed(1) + '" y="' + (last[1] + 4).toFixed(1) + '">' + esc(fmt(last[2].value)) + '</text>' : '';
    var list = pts.filter(function (p) { return p.value != null; }).map(function (p) { return '<li>' + esc(S.monthName(p.month) + ': ' + fmt(p.value)) + '</li>'; }).join('');
    return '<figure class="st-fig"><figcaption>' + (timed ? 'Median time by month' : 'Average score by month') + '</figcaption>' +
      '<svg class="st-trend" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><line class="st-base" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (H - padB) + '" y2="' + (H - padB) + '"/>' + lines + dots + label + '</svg>' +
      '<div class="st-axis" aria-hidden="true"><span>' + esc(short(pts[0].month)) + '</span><span>' + esc(short(pts[pts.length - 1].month)) + '</span></div>' +
      '<ul class="sr-only">' + list + '</ul></figure>';
  }

  function typeCard(t) {
    var head = '<div class="st-cardhead"><h3>' + esc(t.label) + '</h3><span>' + plural(t.n, 'puzzle') + ' finished</span></div>';
    var rows = '';
    if (t.scored) {
      rows += kv('Best', t.best != null ? fmtNum(t.best) + ' pts' : null);
      rows += kv('Average', t.average != null ? fmtNum(t.average) + ' pts' : null);
      if (t.type === 'borders') { rows += kv('Most right', t.bestCorrect != null ? t.bestCorrect + '/10' : null); rows += kv('Average right', t.averageCorrect != null ? t.averageCorrect + '/10' : null); }
      if (t.type === 'tangle') { rows += kv('Most words', t.mostWords); rows += kv('Star word', t.stars + ' of ' + t.n); }
      if (t.type === 'reckon') rows += kv('Bullseyes', fmtNum(t.bullseyes));
    } else {
      rows += kv('Best', t.best != null ? S.clock(t.best) : null);
      rows += kv('Median', t.median != null ? S.clock(t.median) : null);
      if (t.solveRate != null) rows += kv('Solved', t.won + ' of ' + t.n + ' (' + t.solveRate + '%)');
      else if (t.won != null) rows += kv('Solved', t.won + ' of ' + t.n);
      if (t.type === 'link') rows += kv('Average mistakes', t.mistakes);
    }
    var small = t.n < S.MIN_SHOW ? '<p class="st-small">Medians and charts appear after ' + S.MIN_SHOW + ' finished.</p>' : '';
    return '<article class="st-card" id="st-' + t.type + '">' + head + '<dl class="st-kv">' + rows + '</dl>' + small + spreadChart(t, t.spread) + trendChart(t, t.trend) + '</article>';
  }

  function yearBlock(y) {
    if (!y) return '';
    var bests = y.bests.map(function (b) { return '<li>' + esc(b.label) + ' ' + (b.secs != null ? S.clock(b.secs) : fmtNum(b.score) + ' pts') + '</li>'; }).join('');
    return '<section class="st-year" aria-labelledby="st-year-h"><h2 id="st-year-h">Your ' + y.year + ' in Noodle</h2>' +
      '<p>' + plural(y.finished, 'puzzle') + ' over ' + plural(y.days, 'day') + (y.longest >= 2 ? ' · longest run ' + y.longest + ' days' : '') +
      (y.favourite ? ' · favourite: ' + esc(y.favourite.label) : '') + (y.busiest ? ' · busiest month: ' + esc(S.monthName(y.busiest)) : '') + '</p>' +
      (bests ? '<p class="st-yb">Personal bests</p><ul class="st-bests">' + bests + '</ul>' : '') +
      '<button type="button" class="st-share" id="st-share">Share</button><span class="st-shared" id="st-shared" role="status"></span></section>';
  }

  function render() {
    var saved = S.read(localStorage), today = londonDay();
    var sum = S.summary(saved, { today: today, dates: state.dates, mode: state.mode });
    var y = S.yearCard(saved, { today: today, dates: state.dates });
    var all = state.mode === 'all' ? sum : S.summary(saved, { today: today, dates: state.dates });
    var out = [];
    if (!all.overall.finished) {
      $('st-body').innerHTML = '<div class="st-empty"><p>Finish a puzzle and your stats start here.</p><a class="st-go" href="puzzles.html">Today’s puzzles</a></div>';
      $('st-modes').hidden = true; return;
    }
    out.push(yearBlock(y));
    var o = sum.overall;
    out.push('<section aria-label="Overall"><div class="st-tiles">' +
      tile('Puzzles finished', fmtNum(o.finished)) + tile('Days played', fmtNum(o.days)) +
      tile('Current run', o.run >= 2 ? '🔥 ' + o.run : String(o.run), o.run === 1 ? 'day' : 'days') + tile('Longest run', String(o.longest), o.longest === 1 ? 'day' : 'days') +
      '</div>' + (o.favourite ? '<p class="st-fav">Favourite: <b>' + esc(o.favourite.label) + '</b> (' + fmtNum(o.favourite.n) + ' finished)</p>' : '') + '</section>');
    var played = S.TYPES.map(function (t) { return sum.types[t]; }).filter(function (t) { return t.n; });
    var not = S.TYPES.filter(function (t) { return !sum.types[t].n; }).map(function (t) { return S.LABEL[t]; });
    out.push('<section aria-label="By puzzle">' + played.map(typeCard).join('') +
      (played.length ? '' : '<p class="st-small">None of these yet.</p>') +
      (not.length && played.length ? '<p class="st-small">Not played yet' + (state.mode === 'all' ? '' : ' this way') + ': ' + esc(not.join(', ')) + '.</p>' : '') + '</section>');
    $('st-body').innerHTML = out.join('');
    $('st-modes').hidden = !state.dates;
    [].forEach.call($('st-modes').querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-m') === state.mode)); });
    var sh = $('st-share');
    if (sh) sh.addEventListener('click', function () {
      var text = S.yearShare(y), done = function (m) { $('st-shared').textContent = m; };
      if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ text: text }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { done('Copied'); }, function () { done(text); });
      else done(text);
      track('share_click', { type: 'year' });
    });
  }

  $('st-modes').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-m]'); if (!b) return;
    state.mode = b.getAttribute('data-m'); render();
  });
  addEventListener('pageshow', function (e) { if (e.persisted) render(); });
  addEventListener('storage', function (e) { if (!e.key || /^digi-/.test(e.key)) render(); });
  /* Switch (Alec, 6 Nov 2026): "stats": false in features.json turns this page off; it then sends
     anyone who opens it to Puzzles. Unknown or unreachable counts as on. */
  fetch('features.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (f) { if (f && f.stats === false) location.replace('puzzles.html'); }).catch(function () {});
  render();
  fetch('feed.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (feed) {
    var d = {};
    (feed.items || []).forEach(function (it) { if (it.kind === 'puzzle' && it.id && it.date) d[it.id] = it.date; });
    state.dates = d; render();
  }).catch(function () {});
  document.addEventListener('DOMContentLoaded', function () { track('stats_open', { from: (new URLSearchParams(location.search).get('from') || '').replace(/[^a-z_-]/g, '').slice(0, 24) }); });
})();
