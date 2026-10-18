/* ==========================================================================
   The Daily Noodle — leaderboards (dn-board.js)
   --------------------------------------------------------------------------
   Private leagues with a daily leaderboard per puzzle. No accounts: each
   browser gets a random board id (separate from the tracker's id, so the
   board works with visit recording switched off and can't be joined to it).
   The id is the player's key to their leagues, so it is never shown, and
   the server never sends ids back.

   Loaded by board.html, and by dn-track.js on every puzzle page. On a
   puzzle page it:
     - submits the result when the puzzle ends (dn-track.js fires the
       dn:puzzle_end event with the result it reads), but only if this
       browser is in at least one league; first finish only (the server
       keeps the first result for each puzzle);
     - adds a "See today's board" link to the result box.

   Saved in localStorage under noodle-board-v1:
     { pid, leagues: [{code, name, nick, owner}], cur: code, ptype }
   All server calls go through public.board_* functions (security definer);
   the board tables live in the private `board` schema.
   ========================================================================== */
(function () {
  if (window.noodleBoard) return;
  var API = 'https://gnehttjheoyutrfsvslq.supabase.co/rest/v1/rpc/';
  var KEY = 'sb_publishable_dEMntRNiElpGHn3Hd5Ef1Q_HvLa2wTB';   // public by design
  var LS = 'noodle-board-v1';

  /* The seven daily puzzles, in pill order. tv = the tracker's type name. */
  var TYPES = [
    { id: 'mini',    tv: 'crossword-mini', name: 'Mini',    emoji: '✏️' },
    { id: 'doku',    tv: 'logic-doku',     name: 'Doku',    emoji: '🔢' },
    { id: 'path',    tv: 'logic-path',     name: 'Path',    emoji: '〰️' },
    { id: 'sweep',   tv: 'logic-sweep',    name: 'Sweep',   emoji: '💣' },
    { id: 'link',    tv: 'word-link',      name: 'Link',    emoji: '🔗' },
    { id: 'tangle',  tv: 'word-tangle',    name: 'Tangle',  emoji: '🧶' },
    { id: 'borders', tv: 'geo-borders',    name: 'Borders', emoji: '🌍' }
  ];
  var BY_TV = {}, BY_ID = {};
  TYPES.forEach(function (t) { BY_TV[t.tv] = t; BY_ID[t.id] = t; });
  function typeOfPath(p) {
    var m = String(p || '').match(/(crossword-mini|logic-doku|logic-path|logic-sweep|word-link|word-tangle|geo-borders)/);
    return m ? BY_TV[m[1]] : null;
  }
  function dateOfPath(p) {
    var m = String(p || '').match(/(\d{4}-\d{2}-\d{2})-/);
    return m ? m[1] : '';
  }

  /* ---------- saved state ---------- */
  function load() {
    try { var s = JSON.parse(localStorage.getItem(LS)); return (s && typeof s === 'object') ? s : {}; }
    catch (e) { return {}; }
  }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function pid() { var s = load(); if (!s.pid) { s.pid = uuid(); save(s); } return s.pid; }
  function leagues() { return load().leagues || []; }
  function setLeagues(list) { var s = load(); s.leagues = list || []; save(s); }
  function inAny() { return leagues().length > 0; }

  /* ---------- server ---------- */
  var MESSAGES = {
    no_league: 'That league code doesn’t exist, or the league has closed.',
    nick_taken: 'Someone in that league already uses that nickname.',
    bad_nick: 'Nicknames are 2–16 letters or numbers.',
    bad_name: 'League names are 2–30 letters or numbers.',
    league_full: 'That league is full (50 players).',
    too_many_owned: 'You can run up to 3 leagues.',
    too_many_joined: 'You can be in up to 10 leagues.',
    not_member: 'You’re not in that league.',
    not_owner: 'Only the league’s owner can do that.',
    busy: 'Lots of new leagues right now — please try again later.',
    paused: 'New leagues are paused for now — please try again later.',
    already_member: 'You’re already in that league.'
  };
  function rpc(fn, args) {
    return fetch(API + fn, {
      method: 'POST', mode: 'cors',
      headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) {
          var code = (j && j.message) || 'error';
          var err = new Error(MESSAGES[code] || 'Something went wrong. Please try again.');
          err.code = code; throw err;
        }
        return j;
      });
    });
  }

  function refresh() {   // the server's view of this browser's leagues
    return rpc('board_mine', { p_player: pid() }).then(function (list) {
      setLeagues((list || []).map(function (l) {
        return { code: l.code, name: l.name, nick: l.nickname, owner: !!l.owner, members: l.members };
      }));
      return leagues();
    });
  }
  function create(name, nick) {
    return rpc('board_create', { p_player: pid(), p_name: name, p_nick: nick })
      .then(function (l) { return refresh().then(function () { setCurrent(l.code); return l; }); });
  }
  function join(code, nick) {
    return rpc('board_join', { p_player: pid(), p_code: code, p_nick: nick })
      .then(function (l) { return refresh().then(function () { setCurrent(l.code); return l; }); });
  }
  function peek(code) { return rpc('board_peek', { p_code: code }); }
  function day(code, type, date) {
    return rpc('board_day', { p_player: pid(), p_code: code, p_type: type, p_date: date });
  }
  function owner(action, code, extra) {   // rename | new_code
    var args = { p_player: pid(), p_code: code };
    for (var k in extra || {}) args[k] = extra[k];
    return rpc('board_' + action, args);
  }
  function current() { return load().cur || ''; }
  function setCurrent(code) { var s = load(); s.cur = code; save(s); }
  function lastType() { return load().ptype || ''; }
  function setLastType(t) { var s = load(); s.ptype = t; save(s); }

  /* ---------- London calendar date ---------- */
  function today() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  window.noodleBoard = {
    TYPES: TYPES, BY_ID: BY_ID, typeOfPath: typeOfPath, dateOfPath: dateOfPath,
    pid: pid, leagues: leagues, inAny: inAny, refresh: refresh, create: create, join: join,
    peek: peek, day: day, owner: owner, current: current, setCurrent: setCurrent,
    lastType: lastType, setLastType: setLastType, today: today, rpc: rpc
  };

  /* ---------- on a puzzle page ---------- */
  var here = (function () {
    var p = location.pathname.split('/').filter(Boolean);
    return p.slice(-2).join('/');
  })();
  var T = typeOfPath(here);
  if (!T || !/^reports\//.test(here)) return;
  var PDATE = dateOfPath(here);
  var BOARD = '../board.html?p=' + T.id + '&d=' + PDATE;

  // 1. Submit the result (members only; the server keeps the first one).
  document.addEventListener('dn:puzzle_end', function (e) {
    var d = e.detail || {};
    if (!inAny() || BY_TV[d.type] !== T) return;
    rpc('board_submit', {
      p_player: pid(), p_path: here, p_outcome: d.outcome || '',
      p_secs: d.secs == null ? null : d.secs,
      p_score: d.score == null ? null : d.score,
      p_mistakes: d.mistakes == null ? null : d.mistakes
    }).catch(function () {});
  });

  // 2. "See today's board" in the result box, next to Share.
  var CSS = '.nn-board-link{display:inline-flex;align-items:center;justify-content:center;gap:6px;' +
    'margin-top:10px;font:600 14px/1.2 Inter,system-ui,sans-serif;color:#0E7A4B;text-decoration:none;' +
    'padding:8px 12px;border-radius:999px}.nn-board-link:hover{text-decoration:underline}' +
    '.nn-board-wrap{text-align:center}';
  function addLink(box) {
    if (box.querySelector('.nn-board-link')) return;
    var st = document.getElementById('nn-board-css');
    if (!st) { st = document.createElement('style'); st.id = 'nn-board-css'; st.textContent = CSS; document.head.appendChild(st); }
    var a = document.createElement('a');
    a.className = 'nn-board-link'; a.href = BOARD + '&from=result';
    a.textContent = '🏆 See today’s board';
    var w = document.createElement('div'); w.className = 'nn-board-wrap'; w.appendChild(a);
    var share = box.querySelector('#winShare, #shareBtn, #shareAgain');
    var host = (share && share.parentNode) || box.querySelector('.modalbtns') || box.querySelector('.modalcard') || box;
    if (share && host === share.parentNode && host.classList && host.classList.contains('modalbtns')) {
      host.parentNode.insertBefore(w, host.nextSibling);   // under the button row, not squeezed into it
    } else if (share) {
      share.parentNode.insertBefore(w, share.nextSibling);
    } else {
      host.appendChild(w);
    }
  }
  function watch() {
    var box = document.getElementById('winModal') || document.getElementById('modal');
    if (!box || !('MutationObserver' in window)) return;
    function check() { if (box.classList.contains('on')) { addLink(box); setTimeout(function () { addLink(box); }, 300); } }
    new MutationObserver(check).observe(box, { attributes: true, attributeFilter: ['class'] });
    check();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
