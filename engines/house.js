/* ---------------------------------------------------------------------------
   The Daily Noodle: shared chrome for the grid and tile players (Mini, Doku,
   Sweep, Path, Link). 18 Oct 2026, approved from the mocks:
   - a slim bar in place of the DP masthead and the meta row: back to
     Puzzles, name and number, difficulty, streak, clock;
   - a start card before a puzzle you haven't finished: name, date, one-line
     rule, Play, your stats, How to play;
   - Archivo and Instrument Serif instead of Space Grotesk and Space Mono, and
     dark mode (engines/house.css).

   Loaded by the engine's stub (see engines/finish.js), after the engine has
   run. It only moves the engine's own id'd elements (#pid, #pband, #rank,
   #timer, #streak / #streakn) into the bar, so the engines keep updating
   them exactly as before. The Play button is #dnPlay, deliberately outside
   dn-track.js's PLAY_AREA: a puzzle still counts as started on the first
   tap on the board, as it always has.
--------------------------------------------------------------------------- */
(function () {
  'use strict';
  var P = window.DN_PUZZLE || {};
  var TYPE = { mini: 'mini', lexi: 'doku', sweep: 'sweep', path: 'path', link: 'link' }[P.type];
  if (!TYPE) return;
  var $ = function (id) { return document.getElementById(id); };
  var W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
  var cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  var meta = function (n) { var m = document.querySelector('meta[name="' + n + '"]'); return m ? m.content : ''; };
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }

  var NAME = { mini: 'Mini', doku: 'Doku', sweep: 'Sweep', path: 'Path', link: 'Link' }[TYPE];
  var NUM = parseInt((meta('dn:headline').match(/(\d+)\s*$/) || [])[1], 10) || '';
  var DATE = meta('dn:date');
  var SAVE = { mini: 'digi-mini-v1', doku: 'digi-doku-v1', sweep: 'digi-sweep-v1', path: 'digi-path-v1', link: 'digi-link-v1' }[TYPE];
  var STREAK = { mini: 'digi-mini-streak', doku: 'digi-doku-streak', sweep: 'digi-sweep-streak', path: 'digi-path-streak', link: 'digi-link-streak' }[TYPE];

  /* ---- fonts: Archivo for the interface, Instrument Serif for the big moments ---- */
  if (!document.querySelector('link[data-fin-fonts]')) {
    var lf = document.createElement('link'); lf.rel = 'stylesheet'; lf.setAttribute('data-fin-fonts', '');
    lf.href = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Instrument+Serif:ital@0;1&display=block';
    document.head.appendChild(lf);
  }
  var root = document.documentElement;
  root.classList.add('dn-house', 'dn-dark', 'dn-' + TYPE);   // dn-dark: this player has a dark palette (house.css)

  /* ---- the slim bar ---- */
  var app = document.querySelector('.app') || document.body;
  var bar = document.createElement('div'); bar.className = 'dn-bar';
  bar.innerHTML = '<a class="dn-back" href="../puzzles.html" aria-label="Back to Puzzles"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11.5 3 5.5 9l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
    '<div class="dn-mid"><b class="dn-name"></b><small class="dn-sub"></small></div><div class="dn-right"><span class="dn-streak" title="Day streak"><span aria-hidden="true">🔥</span></span></div>';
  app.insertBefore(bar, app.firstChild);
  var mid = bar.querySelector('.dn-name'), sub = bar.querySelector('.dn-sub'), right = bar.querySelector('.dn-right');
  if ($('pid')) mid.appendChild($('pid'));
  if ($('pband')) sub.appendChild($('pband'));
  if ($('rank')) sub.appendChild($('rank'));
  var sk = $('streak') || $('streakn');
  if (sk) {   // the flame only once there is a streak to show
    bar.querySelector('.dn-streak').appendChild(sk);
    var zero = function () { bar.classList.toggle('dn-nostreak', !(parseInt(sk.textContent, 10) > 0)); };
    zero(); try { new MutationObserver(zero).observe(sk, { childList: true, characterData: true, subtree: true }); } catch (e) {}
  } else bar.classList.add('dn-nostreak');
  if ($('timer')) right.appendChild($('timer'));

  /* ---- the start card (only before a puzzle you haven't finished) ---- */
  var save = read(SAVE), myId = P.id;
  var finished = !!(save && save.done && save.done[myId]);
  if (finished) return;

  function art() {
    var g = P.grid, s = '';
    if (TYPE === 'mini' || TYPE === 'doku') {
      s = '<rect x="4" y="4" width="112" height="112" rx="8" fill="var(--block)"/>';
      for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) {
        var blk = g && g[r] && g[r][c] === '#', lit = r === 0 && !blk && c > 0 && c < 4;
        s += '<rect x="' + (9 + c * 21.6) + '" y="' + (9 + r * 21.6) + '" width="19.6" height="19.6" rx="2" fill="' + (blk ? 'var(--block)' : lit ? (c === 1 ? '#FFD54A' : '#FFF0B8') : 'var(--card)') + '"/>';
      }
    } else if (TYPE === 'sweep' || TYPE === 'path') {
      var hot = TYPE === 'sweep' ? P.start && [P.start[0] - 1, P.start[1] - 1] : null, one = null;
      if (TYPE === 'path' && P.locked) P.locked.forEach(function (x) { if (x[2] === 1) one = [x[0] - 1, x[1] - 1]; });
      s = '<rect x="4" y="4" width="112" height="112" rx="8" fill="var(--block)"/>';
      for (var i = 0; i < 6; i++) for (var j = 0; j < 6; j++) {
        var on = (hot && hot[0] === i && hot[1] === j) || (one && one[0] === i && one[1] === j);
        s += '<rect x="' + (8 + j * 17.5) + '" y="' + (8 + i * 17.5) + '" width="16" height="16" rx="2" fill="' + (on ? '#FFD54A' : TYPE === 'sweep' ? 'var(--hidden-cell)' : 'var(--card)') + '"/>';
      }
    } else {
      for (var k = 0; k < 16; k++) {
        var row = Math.floor(k / 4), col = k % 4, sel = row === 1 && col < 3 || k === 9;
        s += '<rect x="' + (6 + col * 28) + '" y="' + (6 + row * 28) + '" width="24" height="24" rx="5" fill="' + (sel ? '#FFF0B8' : 'var(--card)') + '" stroke="' + (sel ? '#FFD54A' : 'var(--line-soft)') + '" stroke-width="2"/>';
      }
    }
    return '<svg width="132" height="132" viewBox="0 0 120 120" aria-hidden="true">' + s + '</svg>';
  }
  var tiles = (P.bank || []).length, mines = (P.mines || []).length, nClues = P.clues ? Object.keys(P.clues).length : 10;
  var RULE = {
    mini: (cap(W[nClues] || nClues)) + ' clues, across and down. The clock starts with your first letter.',
    doku: 'Place the ' + (W[tiles] || tiles) + ' letter tiles so every word across and down is real.',
    sweep: 'Clear the board without hitting one of the ' + (W[mines] || mines) + ' mines. Start on the highlighted square.',
    path: 'Join 1 to 36 in one unbroken thread, through every given number.',
    link: 'Sixteen words, four hidden groups of four. Four mistakes and it’s over.'
  }[TYPE];
  var HOW = {
    mini: ['Tap a square and type. Tap the clue bar to switch between across and down; the arrows either side step through the clues.', 'Check word and Check all mark wrong letters; Reveal word fills one in. The clock stops when the grid is right.'],
    doku: ['Tap a tile in the bank, then tap a square to place it; or tap a square and type. Every run of letters, across and down, must make a real word.', 'Shaded letters are given. With Hints on, a word turns green once it matches the answer.'],
    sweep: ['Tap to dig, or switch to Flag and tap to mark a mine. Each number counts the mines touching that square.', 'Every square can be worked out by deduction, so one mine ends the game. Hint shows a square you could have reasoned out, and why.'],
    path: ['Tap the marigold 1, then tap a touching square to place 2, and so on. Tap the 1 or the 36 to grow the thread from either end.', 'Given numbers are checkpoints the thread must pass through. Undo takes back a step; Hint shows a square that is forced.'],
    link: ['Tap four words you think belong together, then Submit. Three right gets a “one away”.', 'Groups run easiest to hardest: green, blue, yellow, then black. Guessing the same four twice costs nothing.']
  }[TYPE];
  var st = read(STREAK) || {}, played = save && save.done ? Object.keys(save.done).length : 0;
  var longDate = (function () { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(DATE + 'T12:00:00Z')).replace(',', ''); } catch (e) { return DATE; } })();
  var liveStreak = (function () {
    try {
      var t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      var y = new Date(t + 'T12:00:00Z'); y.setUTCDate(y.getUTCDate() - 1); y = y.toISOString().slice(0, 10);
      return st.last === t || st.last === y ? (st.streak || 0) : 0;
    } catch (e) { return st.streak || 0; }
  })();

  var card = document.createElement('section'); card.className = 'dn-start'; card.setAttribute('aria-label', NAME + ' ' + NUM);
  card.innerHTML = '<div class="dn-start-in">' +
    '<div class="dn-start-top"><a class="dn-back-text" href="../puzzles.html"><span aria-hidden="true">←</span> Puzzles</a>' + (liveStreak >= 1 ? '<span class="dn-start-streak">' + liveStreak + '-day streak</span>' : '') + '</div>' +
    '<h1 class="dn-start-title">' + NAME + '</h1><p class="dn-start-date">No. ' + NUM + ', ' + longDate + '</p>' +
    '<div class="dn-start-card"><div class="dn-start-art">' + art() + '</div><div><h2>Today’s ' + NAME + '</h2><p>' + RULE + '</p></div>' +
    '<div><button type="button" class="dn-pill" id="dnPlay">Play</button></div></div>' +
    '<div class="dn-start-stats"><div><b>' + liveStreak + '</b><span>day streak</span></div><div><b>' + (st.best || 0) + '</b><span>best streak</span></div><div><b>' + played + '</b><span>' + NAME + 's played</span></div></div>' +
    '<details class="dn-how"><summary>How to play</summary>' + HOW.map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</details></div>';
  document.body.appendChild(card);
  root.classList.add('dn-starting');
  $('dnPlay').addEventListener('click', function () {
    root.classList.remove('dn-starting'); card.hidden = true;
    window.dispatchEvent(new Event('dn:play'));   // Path and Link start their clocks when the board is shown
    // Doku: keep the bank at its starting height, so the grid doesn't jump as it empties
    var bank = TYPE === 'doku' && $('bank'); if (bank) requestAnimationFrame(function () { bank.style.minHeight = bank.offsetHeight + 'px'; });
    try { window.scrollTo(0, 0); } catch (e) {}
    window.dispatchEvent(new Event('resize'));   // let app-mode layouts refit now the board shows
  });
})();
