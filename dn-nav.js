/* The Daily Noodle: the puzzles nav (7 Nov 2026, Alec's call: the website takes the app's tabs).
   Today · Leagues · Archive (· Stats) · Account, in the app's order, on puzzles.html, board.html,
   archive.html and stats.html. The markup is in each page (so it is there at first paint); this
   script only:
   - puts the London date in Today's kicker ("Today · Sat 7 Nov"), as the app's masthead does;
   - shows Archive and Stats by features.json (false hides; can't be read = on, as front.js does).
     Stats starts hidden so a switched-off tab doesn't flash in and out;
   - on board.html#account, marks Account as the current tab and brings the sign-in card into
     view once dn-sync.js has drawn it (the site's Account page comes later).
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

  // Account, for now: the sign-in card on the board page
  function account() {
    if (location.hash !== '#account') return;
    each('.tabs a', function (a) { if (a.getAttribute('data-tab') === 'account') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var box = doc.getElementById('dnsync');
    if (!box) return;
    // The board above it is drawn after the card, so keep the card at the top while the page
    // settles (3 s), and stop as soon as the player scrolls or taps.
    var stop = false, end = Date.now() + 3000;
    function quit() { stop = true; }
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (e) { window.addEventListener(e, quit, { once: true, passive: true }); });
    function align() { if (!stop && !box.hidden && Date.now() < end) box.scrollIntoView({ block: 'start' }); }
    align();
    if (!('MutationObserver' in window)) return;
    var mo = new MutationObserver(align);
    mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    setTimeout(function () { mo.disconnect(); }, 3000);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', account); else account();
  if (doc.getElementById('dnsync')) window.addEventListener('hashchange', function () {
    if (location.hash === '#account') account();
    else each('.tabs a', function (a) { if (a.getAttribute('data-tab') === 'leagues') a.setAttribute('aria-current', 'page'); else if (a.getAttribute('data-tab') === 'account') a.removeAttribute('aria-current'); });
  });
})();
