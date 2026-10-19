/* ==========================================================================
   The Daily Noodle — notifications test panel (dn-push.js), 19 Oct 2026
   --------------------------------------------------------------------------
   Notifications are built but switched off. This file is the only way in:
   board.html loads it only when the address has ?push=test, and it adds one
   card under the board to turn notifications on for this browser, send one
   test notification to itself, and turn them off again. No player sees it
   unless they're given that address.

   On:   asks permission (from the tap), subscribes with the server's public
         key (board-push edge function, action 'key') and saves the
         subscription against this browser's board id (board_push_save).
   Test: board-push action 'test': one fixed message to this browser's own
         subscriptions, once a minute at most.
   Off:  unsubscribes here and marks it gone on the server (board_push_drop).
   iPhone: only works when the site was opened from its Home Screen icon.
   ========================================================================== */
(function () {
  var FN = 'https://gnehttjheoyutrfsvslq.supabase.co/functions/v1/board-push';
  var NB = window.noodleBoard;
  if (!NB || document.getElementById('nnPush')) return;

  function unb64u(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var b = atob(s), out = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  }
  function fn(body) {
    return fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); });
  }
  function save(sub) {
    var j = sub.toJSON();
    return NB.rpc('board_push_save', { p_player: NB.pid(), p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  }

  var box = document.createElement('section');
  box.id = 'nnPush'; box.className = 'bcard';
  box.innerHTML = '<h2>Notifications (test)</h2><p id="nnPushMsg">Checking this phone…</p>' +
    '<div class="acts"><button class="btn go" id="nnPushOn" hidden>Turn on for this phone</button>' +
    '<button class="btn" id="nnPushTest" hidden>Send me a test</button>' +
    '<button class="btn warn" id="nnPushOff" hidden>Turn off</button></div>';
  var app = document.getElementById('app');
  (app && app.parentNode ? app.parentNode : document.body).insertBefore(box, app ? app.nextSibling : null);
  var $m = box.querySelector('#nnPushMsg'), $on = box.querySelector('#nnPushOn'),
      $test = box.querySelector('#nnPushTest'), $off = box.querySelector('#nnPushOff');
  function say(t) { $m.textContent = t; }
  function show(on) { $on.hidden = on; $test.hidden = !on; $off.hidden = !on; }

  var standaloneIOS = navigator.standalone === true;
  var iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    say(iOS && !standaloneIOS ? 'On iPhone, add the site to your Home Screen (Share → Add to Home Screen), open it from there, then come back to this page.'
                              : 'This browser can’t get notifications.');
    return;
  }
  var reg = null;
  var ready = navigator.serviceWorker.getRegistration().then(function (r) {
    if (r) return navigator.serviceWorker.ready;
    return navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; });
  }).then(function (r) { reg = r; return r; });

  function refresh() {
    return ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (sub) {
      if (sub) {
        show(true);
        say('On for this phone. Nothing sends notifications yet apart from the test button.');
        return save(sub).catch(function () {});   // keeps the server's copy current
      }
      show(false);
      say(Notification.permission === 'denied'
        ? 'Notifications are blocked for this site. Allow them in the browser’s site settings, then reload.'
        : 'Off for this phone.');
    }).catch(function () { say('Couldn’t start the offline helper on this browser, so notifications can’t work here.'); });
  }

  $on.addEventListener('click', function () {
    $on.disabled = true; say('Asking…');
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'You said no. Allow notifications in the site settings to try again.' : 'No answer, so nothing changed.');
      return Promise.all([ready, fn({ action: 'key' })]);
    }).then(function (x) {
      if (!x[1].key) throw new Error('Couldn’t reach the notifications server.');
      return x[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(x[1].key) });
    }).then(save).then(refresh, function (e) { say(e.message || 'Something went wrong.'); })
      .then(function () { $on.disabled = false; });
  });

  $test.addEventListener('click', function () {
    $test.disabled = true; say('Sending…');
    fn({ action: 'test', player: NB.pid() }).then(function (r) {
      if (r.status === 429) say('Wait a minute between tests (or turn off and on again).');
      else if (r.sent) say('Sent. It should arrive in a few seconds, even with the site closed.');
      else say('The push service refused it (' + (r.gone ? 'subscription expired, so turn off and on again' : 'try again later') + ').');
    }, function () { say('Couldn’t reach the notifications server.'); })
      .then(function () { setTimeout(function () { $test.disabled = false; }, 3000); });
  });

  $off.addEventListener('click', function () {
    $off.disabled = true;
    ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return;
      var ep = sub.endpoint;
      return sub.unsubscribe().then(function () { return NB.rpc('board_push_drop', { p_player: NB.pid(), p_endpoint: ep }).catch(function () {}); });
    }).then(refresh).then(function () { $off.disabled = false; });
  });

  refresh();
})();
