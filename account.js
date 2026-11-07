/* The Daily Noodle: Account (account.html, 7 Nov 2026), the app's Account tab on the web.
   - Your account: dn-sync.js draws the sign-in card into #dnsync as rows (data-layout="rows").
   - Settings: plain switches, no descriptions, as the app. Site-wide keys, read by the puzzles:
       dn-sound   "0" = off (on by default): the grid puzzles' jingle, and Tangle, Borders and Reckon's sounds
       dn-motion  "reduced" = Animations off; "phone" = follow the phone (the default when unset)
       dn-vibrate "0" = off: Reckon's buzz (shown only where the browser can vibrate)
     Tangle, Borders and Reckon still keep their own settings (save.snd/.rm/.hap); these win over them.
   - Help & privacy: Delete my data opens in place: delete the saved copy (dn-sync's on-page confirm)
     or ask by email for the account to be deleted. */
(function () {
  'use strict';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var SW = {
    sound:   { on: function () { return get('dn-sound') !== '0'; },        put: function (v) { set('dn-sound', v ? '1' : '0'); } },
    motion:  { on: function () { return get('dn-motion') !== 'reduced'; }, put: function (v) { set('dn-motion', v ? 'phone' : 'reduced'); } },
    vibrate: { on: function () { return get('dn-vibrate') !== '0'; },      put: function (v) { set('dn-vibrate', v ? '1' : '0'); } }
  };
  if ('vibrate' in navigator) { var vr = document.getElementById('ac-vib'); if (vr) vr.hidden = false; }
  [].forEach.call(document.querySelectorAll('input[data-set]'), function (box) {
    var s = SW[box.getAttribute('data-set')]; if (!s) return;
    box.checked = s.on();
    box.addEventListener('change', function () { s.put(box.checked); });
  });

  // Delete my data
  var btn = document.getElementById('ac-del'), panel = document.getElementById('ac-delete');
  var forget = document.getElementById('ac-forget'), out = panel && panel.querySelector('.ac-signedout');
  function signedIn() { var c = document.getElementById('dnsync'); return !!c && c.getAttribute('data-signed-in') === 'yes'; }
  function paint() { if (!forget) return; var s = signedIn(); forget.parentNode.hidden = !s; if (out) out.hidden = s; }
  if (btn && panel) btn.addEventListener('click', function () {
    var open = panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); paint();
  });
  if (forget) forget.addEventListener('click', function () {
    try { document.dispatchEvent(new CustomEvent('dn:sync-forget')); } catch (e) {}
  });
  var card = document.getElementById('dnsync');
  if (card && 'MutationObserver' in window) new MutationObserver(paint).observe(card, { attributes: true, attributeFilter: ['data-signed-in'] });
})();
