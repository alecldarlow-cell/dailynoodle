/* ==========================================================================
   Sign-in sync on the website (25 Oct 2026). The website half of the Daily Noodle
   app's optional sign-in (SITE.md › Sign-in sync). A player who signs in with their
   email gets the same results, streaks and league identity in every browser and in
   the app.

   board.html loads this file first (before its own script, so it can read a sign-in
   link's #access_token before anything rewrites the address) and shows the card in
   #dnsync. Puzzle pages load it from dn-track.js only for a signed-in player, to send
   the result when the puzzle ends.

   One sync (29 Oct 2026, with revisions): pull the account's copy with each document's
   revision (sync_pull_rev), merge it in with dn-track.js's #dnmove= import rules
   (dnMove.importData: first result kept, better streak wins, a different league player
   is asked about on the board page, never adopted silently), then push the documents
   that changed, each with the revision it was merged from (sync_push_rev). The server
   stores them only if no other phone or browser wrote in between (compare-and-swap, all
   or nothing); if one did, nothing is stored, and this browser pulls again, merges again
   and retries (at most 3 tries). Results here are never dropped: they stay in this
   browser whatever the server says. A result the account already holds for a puzzle
   stays the account's (first result kept there too), while this browser keeps its own.
   Until the live database has the revision functions, the old sync_pull / sync_push
   path is used instead (pull first, merge, push: a push made between another browser's
   pull and push could replace that browser's merge until its next sync). The app does
   the same.

   ON since 25 Oct 2026 (Alec's call, after the sign-in email went through Resend and
   https://dailynoodle.co.uk/board.html was allowed as a redirect URL in Supabase Auth).
   Set ON to false to switch it off again: nothing here runs, and supabase-js is never
   fetched, while it is off. Puzzle pages load this file only for a signed-in player.
   ========================================================================== */
(function () {
  'use strict';
  var ON = true;
  if (window.__dnSyncTest) ON = true;   // tools/tests only
  if (!ON || window.dnSync) return;

  var URL_ = 'https://gnehttjheoyutrfsvslq.supabase.co';
  var KEY = 'sb_publishable_dEMntRNiElpGHn3Hd5Ef1Q_HvLa2wTB';   // public by design; the sync functions need a signed-in user
  // The same pinned supabase-js build as admin.html, with its integrity hash.
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
  var SRI = 'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok';
  var AUTH = 'noodle-sync-auth';   // the signed-in session (supabase-js storageKey); dn-track.js checks it
  var LAST = 'noodle-sync-last';   // when this browser last synced, for the card
  var SYNC_KEY = /^digi-(mini|doku|sweep|path|link|tangle|borders|reckon)-(v1|streak)$/;
  var BOARD = 'noodle-board-v1';
  var ON_BOARD = /\/board\.html$/.test(location.pathname);

  function isObj(x){ return !!x && typeof x === 'object' && !Array.isArray(x); }
  function parse(s){ try { return JSON.parse(s); } catch (e) { return undefined; } }
  function get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  function same(a, b){
    if (a === b) return true;
    if (!isObj(a) && !Array.isArray(a) || !isObj(b) && !Array.isArray(b) || Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(function (k) { return Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]); });
  }

  /* A sign-in link lands on board.html#access_token=…&refresh_token=… (or #error=…).
     Read it now and take it out of the address bar at once, so the tokens are never
     shared, bookmarked or left in the history. */
  function readLink(hash){
    if (!hash || hash.indexOf('#dnmove=') === 0) return null;
    var q = new URLSearchParams(hash.replace(/^#/, ''));
    var err = q.get('error_description') || q.get('error');
    if (err) return { error: err.replace(/\+/g, ' ') };
    if (q.get('access_token') && q.get('refresh_token')) return { access_token: q.get('access_token'), refresh_token: q.get('refresh_token') };
    return null;
  }
  var link = ON_BOARD ? readLink(location.hash) : null;
  if (link) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }

  /* ---------- the client: supabase-js, fetched only when needed ---------- */
  var made = null;
  function lib(){
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = LIB; s.integrity = SRI; s.crossOrigin = 'anonymous';
      s.onload = function () { window.supabase ? ok(window.supabase) : no(new Error('Sign-in couldn’t load. Try again.')); };
      s.onerror = function () { no(new Error('Sign-in couldn’t load. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
  }
  function client(){
    if (!made) made = lib().then(function (S) {
      return S.createClient(URL_, KEY, { auth: {
        storageKey: AUTH, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit'
      } });
    }, function (e) { made = null; throw e; });   // a failed load is tried again next time, not cached
    return made;
  }
  // Signed in on this browser before? Until then the card needs no library: a visitor who
  // never signs in never fetches supabase-js (Alec: not intrusive to current players).
  function known(){ return !!get(AUTH); }
  function session(sb){
    return sb.auth.getSession().then(function (r) { return (r && r.data && r.data.session) || null; });
  }
  function rpc(sb, fn, args){
    return sb.rpc(fn, args || {}).then(function (r) {
      if (r.error) {
        var e = new Error(r.error.message || 'Sync failed. Try again.');
        e.code = r.error.code; e.status = r.status;
        throw e;
      }
      return r.data;
    });
  }
  // The database hasn't got the revision functions yet (PostgREST: PGRST202, 404).
  function missing(e){
    return !!e && (e.code === 'PGRST202' || e.code === '42883' || e.status === 404 ||
      /could not find the function|function .* does not exist/i.test(e.message || ''));
  }

  /* ---------- one sync ---------- */
  function local(){
    var out = {}, n = 0;
    try { n = localStorage.length; } catch (e) {}
    for (var i = 0; i < n; i++) {
      var k = null; try { k = localStorage.key(i); } catch (e) {}
      if (!k || !(SYNC_KEY.test(k) || k === BOARD)) continue;
      var v = parse(get(k));
      if (isObj(v)) out[k] = v;
    }
    return out;
  }
  /* Merge the account's documents into this browser (dnMove.importData). */
  function mergeIn(remote){
    var d = {};
    for (var k in remote) if (SYNC_KEY.test(k) && isObj(remote[k])) d[k] = JSON.stringify(remote[k]);
    // League identity: only another player's needs the import's adopt-or-ask rule;
    // the same player's leagues come from the server when the board opens.
    var rb = remote[BOARD], mine = parse(get(BOARD));
    var b = isObj(rb) && !(isObj(mine) && mine.pid && mine.pid === rb.pid) ? rb : undefined;
    if (!window.dnMove) throw new Error('Sync couldn’t start. Reload the page and try again.');
    window.dnMove.importData(d, b);
    var after = local(), out = {};
    // While this browser hasn't chosen between its own league player and the
    // account's, the account keeps the one it had.
    for (var j in after) if (!(j === BOARD && after[j].pend)) out[j] = after[j];
    return out;
  }
  /* What to send for one key: this browser's merged document, except that a puzzle the
     account already has a result for keeps the account's result (the first one stored). */
  var UNION = { done: 1, days: 1, found: 1 };
  function forAccount(mine, theirs){
    if (!isObj(theirs)) return mine;
    var out = {}, k, j;
    for (k in mine) out[k] = mine[k];
    for (k in UNION) if (isObj(mine[k]) && isObj(theirs[k])) {
      var u = {};
      for (j in mine[k]) u[j] = mine[k][j];
      for (j in theirs[k]) u[j] = theirs[k][j];
      out[k] = u;
    }
    return out;
  }
  var TRIES = 3, legacy = false;
  function syncRev(sb){
    var before = local(), n = 0;
    function once(){
      n++;
      return rpc(sb, 'sync_pull_rev').then(function (pulled) {
        pulled = isObj(pulled) ? pulled : {};
        var remote = {}, revs = {}, k;
        for (k in pulled) if (isObj(pulled[k])) { remote[k] = pulled[k].doc; revs[k] = +pulled[k].rev || 0; }
        var out = mergeIn(remote), saves = {}, any = false;
        for (k in out) {
          var doc = forAccount(out[k], remote[k]);
          if (isObj(remote[k]) && same(doc, remote[k])) continue;   // the account has it already
          saves[k] = { doc: doc, rev: revs[k] || 0 }; any = true;
        }
        if (!any) return true;
        return rpc(sb, 'sync_push_rev', { p_saves: saves }).then(function (r) {
          if (isObj(r) && r.ok) return true;
          // Another phone or browser wrote in between: nothing was stored. Pull, merge, try again.
          if (n < TRIES) return once();
          throw new Error('Sync couldn’t finish: another device was syncing. Your results are safe here. Try again.');
        });
      });
    }
    return once().then(function () { return !same(before, local()); });
  }
  function syncOld(sb){
    return rpc(sb, 'sync_pull').then(function (remote) {
      remote = isObj(remote) ? remote : {};
      var before = local(), out = mergeIn(remote), changed = !same(before, local());
      var send = Object.keys(out).length ? rpc(sb, 'sync_push', { p_saves: out }) : Promise.resolve(0);
      return send.then(function () { return changed; });
    });
  }
  var running = null;
  function sync(){
    if (running) return running;
    running = client().then(function (sb) {
      return session(sb).then(function (s) {
        if (!s) return { signedIn: false, changed: false };
        var go = legacy ? syncOld(sb) : syncRev(sb).catch(function (e) {
          if (!missing(e)) throw e;
          legacy = true;   // not migrated yet: the old path, for the rest of this page
          return syncOld(sb);
        });
        return go.then(function (changed) {
          set(LAST, JSON.stringify({ at: Date.now() }));
          return { signedIn: true, changed: changed };
        });
      });
    });
    var done = function () { running = null; };
    running.then(done, done);
    return running;
  }

  window.dnSync = { sync: sync, readLink: readLink };
  // The page's first sync has finished and nothing more will happen on its own (no reload
  // coming): <html data-dn-sync="done">. Lets tests (and anything else) wait for it.
  function settled(){ try { document.documentElement.setAttribute('data-dn-sync', 'done'); } catch (e) {} }

  /* ---------- puzzle pages: start from the account's copy, send the result at the end ----------
     Pulling as the page opens means a streak continues from a day played elsewhere (the
     app, another browser) before this puzzle is finished: the page's own save writes then
     merge with it (dnCore.saveProgress). A round in progress here is kept (the import
     keeps this browser's fields). */
  if (!ON_BOARD) {
    sync().then(settled, settled);
    document.addEventListener('dn:puzzle_end', function () {
      // Let the page finish writing its save first.
      setTimeout(function () { sync().catch(function () {}); }, 1200);
    });
    return;
  }

  /* ---------- board.html: the card ---------- */
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(){
    var l = parse(get(LAST)), at = isObj(l) ? +l.at : 0;
    if (!at) return 'Not synced yet';
    var m = Math.round((Date.now() - at) / 60000);
    if (m < 1) return 'Synced just now';
    if (m < 60) return 'Synced ' + m + ' min ago';
    var h = Math.round(m / 60);
    return h < 24 ? 'Synced ' + h + ' h ago' : 'Synced ' + Math.round(h / 24) + ' d ago';
  }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var ui = { sent: '', msg: '', bad: false, busy: false, confirm: '' };
  var box = null;

  function render(s){
    if (!box) return;
    var h = '<h2>' + (s ? 'Your account' : 'Sign in or create an account') + '</h2>';
    if (s) {
      h += '<p>Signed in as <b>' + esc(s.user && s.user.email) + '</b></p>' +
        '<p class="fine" id="dnsyncLast">' + esc(ago()) + '</p>' +
        '<div class="acts"><button class="btn" type="button" data-sync="now"' + (ui.busy ? ' disabled' : '') + '>Sync now</button>' +
        '<button class="btn" type="button" data-sync="out"' + (ui.busy ? ' disabled' : '') + '>Sign out</button></div>';
      if (ui.confirm === 'forget') {
        // Confirmed on the page, never with a browser pop-up.
        h += '<div class="confirm" id="dnsyncConfirm" role="group" aria-labelledby="dnsyncConfirmQ" ' +
          'style="margin-top:14px;padding:12px 14px;border:1px solid var(--bad);border-radius:10px">' +
          '<p id="dnsyncConfirmQ"><b>Delete your saved data?</b> This deletes the copy of your results, streaks and leagues ' +
          'kept for your email, and signs you out. This browser’s results stay here.</p>' +
          '<div class="acts"><button class="btn warn" type="button" data-sync="forget-yes"' + (ui.busy ? ' disabled' : '') + '>Delete my saved data</button>' +
          '<button class="btn" type="button" data-sync="cancel"' + (ui.busy ? ' disabled' : '') + '>Keep it</button></div></div>';
      } else {
        h += '<p><button class="lnk warn" type="button" data-sync="forget"' + (ui.busy ? ' disabled' : '') + '>Delete my saved data</button></p>';
      }
    } else if (ui.sent) {
      h += '<p id="dnsyncSent">Check your email: we sent a sign-in link to <b>' + esc(ui.sent) + '</b>. Open it on this device.</p>' +
        '<div class="acts"><button class="btn" type="button" data-sync="again">Use a different email</button></div>';
    } else {
      h += '<p>Enter your email and we’ll send you a link. It signs you in, or sets up a free account if you’re new.</p>' +
        '<p class="fine">Optional. Keeps your results, streaks and leagues on every phone, browser and the app. No password.</p>' +
        '<form id="dnsyncForm" novalidate><label class="flab" for="dnsyncEmail">Your email</label>' +
        '<div class="inline"><input id="dnsyncEmail" type="email" autocomplete="email" inputmode="email" ' +
        'placeholder="you@example.com" required>' +
        '<button class="btn go" type="submit"' + (ui.busy ? ' disabled' : '') + '>Email me a sign-in link</button></div></form>';
    }
    h += '<p class="msg' + (ui.msg && !ui.bad ? ' ok' : '') + '" id="dnsyncMsg" role="status">' + esc(ui.msg) + '</p>';
    box.innerHTML = h;
    box.hidden = false;
  }
  function refresh(){
    if (!known()) { render(null); return Promise.resolve(); }
    return client().then(session).then(render, function (e) { ui.msg = e.message; ui.bad = true; render(null); });
  }
  function act(fn, okMsg){
    ui.busy = true; ui.msg = ''; ui.bad = false;
    return client().then(fn).then(function () { ui.msg = okMsg || ''; }, function (e) {
      ui.msg = (e && e.message) || 'Something went wrong. Try again.'; ui.bad = true;
    }).then(function () { ui.busy = false; return refresh(); });
  }
  // A sync that brought in results or a league: reload once so the board shows them.
  function afterSync(r){
    if (!r || !r.changed) return settled();
    var k = 'noodle-sync-reload', last = 0;
    try { last = +sessionStorage.getItem(k) || 0; } catch (e) {}
    if (Date.now() - last < 60000) return settled();
    try { sessionStorage.setItem(k, String(Date.now())); } catch (e) {}
    location.reload();
  }

  function start(){
    box = document.getElementById('dnsync');
    if (!box) return;
    box.addEventListener('submit', function (e) {
      if (e.target.id !== 'dnsyncForm') return;
      e.preventDefault();
      var email = String(document.getElementById('dnsyncEmail').value || '').trim().toLowerCase();
      if (!EMAIL.test(email)) { ui.msg = 'Enter your email address, like you@example.com.'; ui.bad = true; return refresh(); }
      act(function (sb) {
        return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + '/board.html' } }).then(function (r) {
          if (r && r.error) throw new Error(r.error.message);
          ui.sent = email;
        });
      });
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-sync]');
      if (!b || b.disabled) return;
      var what = b.getAttribute('data-sync');
      if (what === 'again') { ui.sent = ''; ui.msg = ''; refresh(); }
      else if (what === 'now') act(function () { return sync().then(function (r) { setTimeout(function () { afterSync(r); }, 0); }); }, 'Synced.');
      else if (what === 'out') act(function (sb) { return sb.auth.signOut(); });
      else if (what === 'forget') { ui.confirm = 'forget'; ui.msg = ''; refresh().then(function () {
        var y = box.querySelector('[data-sync="forget-yes"]'); if (y) y.focus(); }); }
      else if (what === 'cancel') { ui.confirm = ''; refresh(); }
      else if (what === 'forget-yes') {
        ui.confirm = '';
        act(function (sb) { return rpc(sb, 'sync_forget').then(function () { return sb.auth.signOut(); }); }, 'Your saved data is deleted. This browser’s results are still here.');
      }
    });

    var first;
    if (link && link.error) { ui.msg = 'That sign-in link didn’t work: ' + link.error + '. Ask for a new one.'; ui.bad = true; first = refresh(); }
    else if (link) first = act(function (sb) {
      return sb.auth.setSession(link).then(function (r) { if (r && r.error) throw new Error(r.error.message); });
    }, 'You’re signed in.');
    else first = refresh();
    first.then(function () {
      if (!known()) return settled();
      return client().then(session).then(function (s) {
        if (!s) return settled();
        return sync().then(function (r) { refresh(); afterSync(r); }, function (e) { ui.msg = e.message; ui.bad = true; refresh(); settled(); });
      });
    }).catch(function (e) {   // never an uncaught error on the board page (a blocked CDN, no connection)
      ui.msg = (e && e.message) || 'Sign-in couldn’t load. Try again.'; ui.bad = true; render(null); settled();
    });
  }
  // dn-track.js (deferred) provides dnMove; it has run by DOMContentLoaded.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
