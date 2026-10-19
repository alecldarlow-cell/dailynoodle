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
     { pid, leagues: [{code, name, nick, owner}], cur: code, ptype, fill: {n, aids} }
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
  function leave(code) {   // off the league's boards; nothing is deleted
    return rpc('board_leave', { p_player: pid(), p_code: code }).then(refresh);
  }
  function peek(code) { return rpc('board_peek', { p_code: code }); }
  function day(code, type, date) {
    return rpc('board_day', { p_player: pid(), p_code: code, p_type: type, p_date: date });
  }
  function owner(action, code, extra) {   // rename | new_code | remove | close
    var args = { p_player: pid(), p_code: code };
    for (var k in extra || {}) args[k] = extra[k];
    return rpc('board_' + action, args);
  }
  /* ---------- history: copied in when this browser is in a league, and again when it has more ----------
     Two sources, both from this browser only: the finished puzzles it
     remembers (each puzzle type's own save), and its earlier finishes in the
     visit records (the tracker's id, plus any older id the domain-move handoff
     brought into this browser as digi.aid.prev; used by the server for this
     copy only). The server prefers the saved result where both exist, applies
     the same checks as a live result and keeps the first result per puzzle,
     so copying again never changes a result already on the board.
     Copies again when the saves hold more finished puzzles than last time
     (e.g. after the handoff merged an old address's saves in) or a tracker
     id hasn't been read yet. Saved as fill: {n, aids} in noodle-board-v1
     (replaces the old one-off `filled` flag).                              */
  var SAVES = [   // key, id code in the save, board type, how to read a record
    { key: 'digi-mini-v1',    code: 'MINI',  t: 'mini',    read: function (r) { return { outcome: 'solved', secs: r.s }; } },
    { key: 'digi-doku-v1',    code: '',      t: 'doku',    read: function (r) { return { outcome: 'solved', secs: r.s }; } },
    { key: 'digi-path-v1',    code: 'PATH',  t: 'path',    read: function (r) { return { outcome: 'solved', secs: clock(r.t) }; } },
    { key: 'digi-link-v1',    code: 'LINK',  t: 'link',    read: function (r) { return { outcome: r.o === 'win' ? 'solved' : 'failed', secs: clock(r.t), mistakes: r.m }; } },
    { key: 'digi-sweep-v1',   code: 'SWEEP', t: 'sweep',   read: function (r) { return { outcome: r.o === 'win' ? 'solved' : r.o === 'loss' ? 'failed' : 'revealed', secs: r.s }; } },
    { key: 'digi-tangle-v1',  code: 'TANG',  t: 'tangle',  read: function (r) { return { outcome: 'scored', score: r.s }; } },
    { key: 'digi-borders-v1', code: 'BORD',  t: 'borders', read: function (r) { return { outcome: 'scored', score: r.p, secs: r.secs }; } }
  ];
  function clock(v) {
    var m = String(v || '').match(/^(\d{1,4}):(\d{2})$/);
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function savedResults(feed) {
    // puzzle id (e.g. "DP·MINI·0099", "DP·SWEEP·2026-10-18") -> file, via the feed
    var byKey = {};
    (feed || []).forEach(function (it) {
      var T = typeOfPath(it.path); if (!T || it.kind !== 'puzzle') return;
      var num = (it.path.match(/-(\d{3,5})\.html$/) || [])[1];
      byKey[T.id + '|' + (num ? String(+num) : dateOfPath(it.path))] = it.path;
    });
    var rows = [];
    SAVES.forEach(function (S) {
      var s = null; try { s = JSON.parse(localStorage.getItem(S.key) || 'null'); } catch (e) {}
      var done = s && s.done; if (!done || typeof done !== 'object') return;
      Object.keys(done).forEach(function (id) {
        var last = String(id).split('·').pop();
        var k = /^\d{4}-\d{2}-\d{2}$/.test(last) ? last : String(+last);
        var path = byKey[S.t + '|' + k]; if (!path) return;
        var r = done[id]; if (!r || typeof r !== 'object') return;
        var x = S.read(r); x.path = path; rows.push(x);
      });
    });
    return rows;
  }
  function trackerIds() {   // this browser's own tracker ids: current first, then any from the old address
    var out = [];
    try {
      if (localStorage.getItem('digi.optout') === '1') return out;
      var prev = JSON.parse(localStorage.getItem('digi.aid.prev') || '[]');
      [localStorage.getItem('digi.aid')].concat(Array.isArray(prev) ? prev : []).forEach(function (a) {
        if (a && /^[0-9a-f-]{36}$/i.test(a) && out.indexOf(a) < 0) out.push(a);
      });
    } catch (e) {}
    return out;
  }
  function backfillPlan(feed) {
    if (!inAny()) return null;
    var f = load().fill || { n: 0, aids: [] };
    var rows = savedResults(feed);
    var aids = trackerIds().filter(function (a) { return (f.aids || []).indexOf(a) < 0; });
    if (rows.length <= (f.n || 0) && !aids.length) return null;
    return { rows: rows.length > (f.n || 0) ? rows : [], aids: aids, n: Math.max(rows.length, f.n || 0), done: f.aids || [] };
  }
  function backfillDue(feed) { return !!backfillPlan(feed); }
  function backfill(feed) {
    var plan = backfillPlan(feed); if (!plan) return Promise.resolve(0);
    var calls = plan.aids.length ? plan.aids.map(function (a, i) { return { aid: a, rows: i ? [] : plan.rows }; })
                                 : [{ aid: null, rows: plan.rows }];
    var total = 0;
    return calls.reduce(function (p, c) {
      return p.then(function () {
        return rpc('board_backfill', { p_player: pid(), p_aid: c.aid, p_rows: c.rows }).then(function (n) { total += +n || 0; });
      });
    }, Promise.resolve()).then(function () {
      var s2 = load(); delete s2.filled;
      s2.fill = { n: plan.n, aids: plan.done.concat(plan.aids) };
      save(s2); return total;
    });
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
    peek: peek, backfill: backfill, backfillDue: backfillDue, leave: leave, day: day, owner: owner, current: current, setCurrent: setCurrent,
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
    var slot = box.querySelector('.fin-board-slot');   // the shared finish sheet (engines/finish.js) has a place for it
    if (slot) { slot.appendChild(w); return; }
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
    function check() { if (box.classList.contains('on') || box.classList.contains('fin-open')) { addLink(box); setTimeout(function () { addLink(box); }, 300); } }
    new MutationObserver(check).observe(box, { attributes: true, attributeFilter: ['class'] });
    check();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
