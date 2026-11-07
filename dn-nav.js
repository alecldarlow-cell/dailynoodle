/* The Daily Noodle: the puzzles nav (7 Nov 2026, Alec's call: the website takes the app's tabs).
   Today · Leagues · Archive (· Stats) · Account, in the app's order, on puzzles.html, board.html,
   archive.html and stats.html. The markup is in each page (so it is there at first paint); this
   script only:
   - puts the London date in Today's kicker ("Today · Sat 7 Nov"), as the app's masthead does;
   - shows Archive and Stats by features.json (false hides; can't be read = on, as front.js does).
     Stats starts hidden so a switched-off tab doesn't flash in and out;
   - sends an old board.html#account link to account.html (the Account page, 7 Nov 2026).
   No storage, no tracking of its own. */
(function () {
  'use strict';
  var doc = document;
  function each(sel, fn) { [].forEach.call(doc.querySelectorAll(sel), fn); }

  // Today's kicker: the London day
  var k = doc.getElementById('kickdate');
  if (k) {
    try {
      k.textContent = ' · ' + new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
    } catch (e) {}
  }

  // feature switches
  function apply(f) {
    each('.tabs [data-feature]', function (el) { el.hidden = !!f && f[el.getAttribute('data-feature')] === false; });
  }
  try {
    fetch('features.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(apply, function () { apply(null); });
  } catch (e) { apply(null); }

  // Account has its own page from 7 Nov 2026 (account.html); an old board.html#account link goes there
  if (location.hash === '#account' && /\/board\.html$/.test(location.pathname)) {
    try { location.replace('account.html' + location.search); } catch (e) {}
  }
})();
