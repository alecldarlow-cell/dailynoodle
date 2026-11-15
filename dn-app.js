/* dn-app.js — "Get the app" on the website (15 Nov 2026, Alec's go-ahead: send the
   website's players to the Daily Noodle Android app on Google Play). SITE.md › Getting the app.

   Never shown inside the app's own web view (window.__DN_APP === 2, or ?via=app) or on an
   iPhone or iPad (no iOS app yet), or to crawlers. Where it shows:
   - Puzzles (today): a card above the list, Android browsers only, and only for a returning
     player (saved results on 2+ days), until they tap Get the app or Not now.
   - The finish sheet (engines/finish.js loads this file): a quiet "Get the Daily Noodle app ›"
     line after a solve, same rule as the card.
   - Account and About: a plain link, for Android and desktop, always (the player went looking).
   Kept: noodle-getapp-v1 = {no: <ms>} after Not now, {got: <ms>} after a tap (new key).
   Sent (dn-track.js, only when it's recording): app_promo_view / app_promo_tap /
   app_promo_dismiss, each with {place}. The Play link carries an install referrer
   (utm_campaign = the place), so Play Console's acquisition report shows which place worked. */
(function () {
  'use strict';
  var PKG = 'uk.co.dailynoodle.app', KEY = 'noodle-getapp-v1';
  function ua() { return navigator.userAgent || ''; }
  function inApp() { return window.__DN_APP === 2 || /[?&]via=app\b/.test(location.search); }
  function ios() { var u = ua(); return /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1); }
  function android() { return /Android/.test(ua()); }
  function bot() { return /bot|crawl|spider|slurp|Lighthouse|HeadlessChrome|Google-InspectionTool/i.test(ua()); }
  function offered() { return !inApp() && !ios() && !bot(); }
  function url(place) {
    return 'https://play.google.com/store/apps/details?id=' + PKG + '&referrer=' +
      encodeURIComponent('utm_source=dailynoodle&utm_medium=website&utm_campaign=' + place);
  }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  /* distinct days in this browser's puzzle saves: ids and results carry ISO dates */
  function days() {
    var seen = {}, n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/^digi-[a-z]+-v1$/.test(k)) continue;
        var m = (localStorage.getItem(k) || '').match(/20\d\d-\d\d-\d\d/g) || [];
        for (var j = 0; j < m.length; j++) if (!seen[m[j]]) { seen[m[j]] = 1; n++; }
      }
    } catch (e) {}
    return n;
  }
  /* the card and the finish line: Android browsers, returning players, not turned down */
  function nudge() { var s = load(); return offered() && android() && !s.no && !s.got && days() >= 2; }
  function track(ev, place) { try { if (window.digi) { window.digi.track(ev, { place: place }); window.digi.flush(); } } catch (e) {} }
  function link(a, place) {
    a.href = url(place); a.rel = 'noopener';
    a.addEventListener('click', function () { var s = load(); s.got = Date.now(); save(s); track('app_promo_tap', place); });
  }
  var styled = false;
  function style() {
    if (styled) return; styled = true;
    var s = document.createElement('style');
    s.textContent =
      '.dn-getapp{margin:12px 0 4px;padding:14px 16px;border:1px solid var(--hair,#E6E6E2);border-radius:14px;background:var(--paper,#fff);color:var(--ink,#15171C)}' +
      '.dn-getapp b{display:block;font:700 16px/1.3 var(--display,Arial,sans-serif)}' +
      '.dn-getapp p{margin:4px 0 12px;font:14px/1.45 var(--body,Arial,sans-serif);color:var(--muted,#5F636B)}' +
      '.dn-getapp p a{color:inherit}' +
      '.dn-getapp .acts{display:flex;gap:10px;align-items:center}' +
      '.dn-getapp .go{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;background:var(--accent,#0E7A4B);color:var(--on-accent,#fff);font:600 15px/1 var(--body,Arial,sans-serif);text-decoration:none}' +
      '.dn-getapp .no{min-height:44px;padding:0 12px;border:0;background:none;color:var(--muted,#5F636B);font:500 15px/1 var(--body,Arial,sans-serif);cursor:pointer}' +
      '.fin-getapp{order:5}';
    document.head.appendChild(s);
  }

  /* Puzzles: the card */
  function card(box) {
    if (!nudge()) return;
    style();
    box.className = 'dn-getapp';
    box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Get the app');
    box.innerHTML = '<b>Daily Noodle is on Google Play</b>' +
      '<p>The same puzzles, made for your phone. To bring your streaks and leagues, <a href="account.html?via=getapp">sign in</a> here and in the app.</p>' +
      '<div class="acts"><a class="go">Get the app</a><button type="button" class="no">Not now</button></div>';
    link(box.querySelector('.go'), 'today');
    box.querySelector('.no').addEventListener('click', function () {
      var s = load(); s.no = Date.now(); save(s); box.hidden = true; track('app_promo_dismiss', 'today');
    });
    box.hidden = false;
    track('app_promo_view', 'today');
  }
  /* Account and About: a plain link, shown wherever the app can be installed from */
  function plain(a, place) {
    if (!offered()) { if (a.hasAttribute('data-getapp-hide')) a.hidden = true; return; }
    link(a, place); a.hidden = false;
  }
  /* the finish sheet's line (engines/finish.js calls this after a solve) */
  function finish(foot) {
    if (!foot || foot.querySelector('.fin-getapp') || !nudge()) return;
    style();
    var a = document.createElement('a');
    a.className = 'fin-how fin-getapp'; a.textContent = 'Get the Daily Noodle app ›';
    link(a, 'finish'); foot.appendChild(a);
    track('app_promo_view', 'finish');
  }

  window.dnApp = { url: url, finish: finish, nudge: nudge };
  function run() {
    var els = document.querySelectorAll('[data-getapp]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], place = el.getAttribute('data-getapp');
      if (place === 'today') card(el); else plain(el, place);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
