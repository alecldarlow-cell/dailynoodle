/* Noodle Games: score share (20 Oct 2026).

   Loaded by dn-track.js on every game page. Games already report each round
   to the tracker (digi.track('game_end', {game, win, level, score, stars, …}));
   dn-track passes that on as a dn:game_end browser event, and this shows a
   small "Share score" pill after a won round or one that scored. The pill
   shares one line plus a short link to the game:

     🫧 Bubble Burst — level 82 · 12,562 pts · ⭐⭐⭐
     dailynoodle.co.uk/bubble-burst

   The short link is a page written at build time by tools/short-links.js that
   opens the game tagged ?via=share. Nothing in the game is changed, so a game
   re-uploaded from its project keeps the pill as long as it still sends
   game_end. Games with their own share (Paper Planes) are skipped.
   The pill goes away on the next round (dn:game_start), on ×, or once shared.
   Taps are recorded as share_click / share_done {method, type:'game', game}.
*/
(function () {
  'use strict';
  if (window.__dnGameShare) return; window.__dnGameShare = true;

  var SKIP = { 'paper-planes': 1 };   // has its own Share on the daily flight
  /* name and emoji by game slug (from the file name); anything else uses the page headline */
  var GAMES = {
    'bubble-burst': ['🫧', 'Bubble Burst'],
    'lighthouse-keeper': ['🗼', 'Lighthouse Keeper'],
    'lantern-drift': ['🏮', 'Lantern Drift'],
    'sea-glass': ['🐚', 'Sea Glass'],
    'borderline': ['🗺️', 'Borderline'],
    'archipelago': ['🏝️', 'Archipelago'],
    'ballpark': ['🎯', 'Ballpark'],
    'ancient-cities': ['🏛️', 'Ancient Cities'],
    'campfire-watch': ['🔥', 'Campfire Watch'],
    'two-dots-landscape': ['⚫', 'Two Dots'],
    'paper-planes': ['✈️', 'Paper Planes']
  };
  var GAME_RE = /\/reports\/\d{4}-\d{2}-\d{2}-(?:arcade|strategy|quiz)-([a-z0-9-]+)\.html$/;
  var m = location.pathname.match(GAME_RE);
  var SLUG = m ? m[1] : '';
  if (!SLUG || SKIP[SLUG]) return;
  var ALIAS = { 'two-dots-landscape': 'two-dots' };   // short-link name; keep in step with tools/short-links.js
  // Lab games ("In development" badge) get no short link, so they share their own address
  var LAB = !!document.querySelector('meta[name="dn:badge"]');
  var LINK = LAB ? 'dailynoodle.co.uk' + location.pathname : 'dailynoodle.co.uk/' + (ALIAS[SLUG] || SLUG);

  function headline() { var e = document.querySelector('meta[name="dn:headline"]'); return (e && e.content) || document.title.split(' — ')[0] || 'Noodle Games'; }
  var G = GAMES[SLUG] || ['🎮', headline()];
  function n(v) { v = Number(v); return isFinite(v) ? v : null; }
  function fmt(v) { try { return v.toLocaleString('en-GB'); } catch (e) { return String(v); } }

  /* Lighthouse Keeper's headlands, in order (COAST in the game file; keep in step) */
  var LK_COAST = ['Hunstanton', 'Holme', 'Brancaster', 'Wells', 'Blakeney Point', 'Sheringham', 'Cromer', 'Mundesley', 'Happisburgh', 'Winterton', 'Gorleston', 'Lowestoft Ness'];
  function line(x) {
    var parts = [], lv = n(x.level), sc = n(x.score), st = n(x.stars);
    if (SLUG === 'archipelago') {
      if (x.win && lv) parts.push('level ' + lv + ' won' + (n(x.turns) ? ' in ' + n(x.turns) + (n(x.turns) === 1 ? ' turn' : ' turns') : ''));
      else if (lv) parts.push('level ' + lv);
    } else if (SLUG === 'lighthouse-keeper') {
      // the game's own names: coast headlands 1-12, then "Open sea N" (level 99 = Open sea 87)
      if (lv) parts.push(lv <= LK_COAST.length ? LK_COAST[lv - 1] : 'Open sea ' + (lv - LK_COAST.length));
    } else if (SLUG === 'ancient-cities') {
      if (sc !== null) parts.push(fmt(sc) + ' pts');
      if (n(x.margin) !== null) parts.push(x.win ? 'won by ' + Math.abs(n(x.margin)) : 'lost by ' + Math.abs(n(x.margin)));
    } else {
      if (lv) parts.push('level ' + lv);
      if (sc) parts.push(fmt(sc) + ' pts');
    }
    if (st && st > 0) parts.push(new Array(Math.min(3, st) + 1).join('⭐'));
    if (!parts.length) parts.push(x.win ? 'won' : 'played');
    return G[0] + ' ' + G[1] + ' — ' + parts.join(' · ');
  }
  function worth(x) { return !!x && (x.win === true || (n(x.score) || 0) > 0); }

  /* ---------- the pill ---------- */
  var CSS = '.dngs{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translate(-50%,24px);opacity:0;' +
    'z-index:2147483000;display:flex;align-items:center;gap:2px;padding:4px;border-radius:28px;background:#6A2BC9;color:#fff;' +
    'box-shadow:0 6px 24px rgba(20,10,40,.35);transition:transform .25s ease,opacity .25s ease;font:600 16px/1 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:calc(100vw - 32px)}' +
    '.dngs.on{transform:translate(-50%,0);opacity:1}' +
    /* games carry their own type styles; keep the pill's own */
    '.dngs,.dngs *{color:#fff!important;white-space:nowrap;letter-spacing:normal;text-transform:none;text-shadow:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.dngs .lab{font-size:16px;font-weight:600;line-height:1;opacity:1}' +
    '.dngs button{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-height:44px;border-radius:24px;-webkit-tap-highlight-color:transparent}' +
    '.dngs .go{gap:8px;padding:0 16px 0 14px}' +
    '.dngs .x{width:44px;font-size:20px;opacity:.85}' +
    '.dngs button:focus-visible{outline:2px solid #fff;outline-offset:-4px}' +
    '.dngs svg{width:18px;height:18px}' +
    '.dngs-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' +
    /* short landscape screens (Two Dots): the bottom is where the taps go, so sit at the top */
    '@media (max-height:500px) and (orientation:landscape){.dngs{bottom:auto;top:calc(10px + env(safe-area-inset-top,0px));transform:translate(-50%,-24px)}.dngs.on{transform:translate(-50%,0)}}' +
    '@media (prefers-reduced-motion:reduce){.dngs{transition:none}}';
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  var pill = null, lab = null, live = null, text = '', showT = 0, resetT = 0;

  function track(ev, method) { try { window.digi && window.digi.track(ev, { method: method, type: 'game', game: SLUG }); } catch (e) {} }
  function build() {
    if (pill) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    pill = document.createElement('div'); pill.className = 'dngs'; pill.hidden = true;
    pill.innerHTML = '<button type="button" class="go">' + ICON + '<span class="lab">Share score</span></button>' +
      '<button type="button" class="x" aria-label="Close">×</button><span class="dngs-live" role="status" aria-live="polite"></span>';
    lab = pill.querySelector('.lab'); live = pill.querySelector('.dngs-live');
    pill.querySelector('.x').addEventListener('click', hide);
    pill.querySelector('.go').addEventListener('click', share);
    document.body.appendChild(pill);
  }
  function say(t) { lab.textContent = t; live.textContent = t; clearTimeout(resetT); resetT = setTimeout(hide, 1600); }
  function copy(t) {
    function legacy() {
      try { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta); ta.select(); var ok = document.execCommand && document.execCommand('copy'); document.body.removeChild(ta);
        if (ok) { say('Copied'); track('share_done', 'copy'); } else say('Couldn’t copy');
      } catch (e) { say('Couldn’t copy'); }
    }
    try { navigator.clipboard.writeText(t).then(function () { say('Copied'); track('share_done', 'copy'); }, legacy); } catch (e) { legacy(); }
  }
  var coarse = (function () { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
  function share() {
    var t = text;
    if (coarse && navigator.share) {
      try {
        track('share_click', 'native');
        navigator.share({ text: t }).then(function () { track('share_done', 'native'); hide(); },
          function (e) { if (!e || e.name !== 'AbortError') copy(t); });
        return;
      } catch (e) {}
    }
    track('share_click', 'copy'); copy(t);
  }
  function show(x) {
    build();
    text = line(x) + '\n' + LINK;
    lab.textContent = 'Share score'; live.textContent = '';
    pill.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { pill.classList.add('on'); }); });
  }
  function hide() {
    clearTimeout(showT); clearTimeout(resetT);
    if (!pill || pill.hidden) return;
    pill.classList.remove('on');
    setTimeout(function () { if (pill && !pill.classList.contains('on')) pill.hidden = true; }, 260);
  }
  document.addEventListener('dn:game_start', hide);
  document.addEventListener('dn:game_end', function (e) {
    var x = e.detail || {};
    hide();
    if (!worth(x)) return;
    // after the game's own end screen has had a moment to appear
    showT = setTimeout(function () { show(x); }, 900);
  });

  window.dnGameShare = { line: line, slug: SLUG, link: LINK, show: show, hide: hide };   // for tests
})();
