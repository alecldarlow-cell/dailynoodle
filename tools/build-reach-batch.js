'use strict';
/* Reach pages (working name): six numbers and a target a day, from tools/reach.js (Lab build, 12 Nov 2026).

     node tools/build-reach-batch.js --check                    # exit 1 if any Reach page in reports/ fails the gate, repeats a board or differs from its seed
     node tools/build-reach-batch.js --through D [--from D0]    # continue from the newest page to date D (from D0, serial 1, when there are no pages); never touches an existing page
     add --lab to write pages with the "In development" badge (Lab cards; the Puzzles page is untouched)
     node tools/build-reach-batch.js --report [N]               # the bot report: the first N serials' boards (default 30), minOps/routes spread and predicted times

   Every board passes tools/reach.js's gate (SITE.md › Reach): an exact answer exists in 3–5
   operations, 20–300 routes, a near miss, the target isn't a tile or a tile × 10/100, the
   stored way is legal and shortest, and the human-proxy bot's predicted median is 30–95 s.
   Seeds are fixed per serial ("reach-0001", then "reach-0001-<k>" until one passes and
   repeats no earlier board, same multiset of tiles and same target), so a page is
   reproducible and --check proves it was not edited by hand. Boards never change once
   their day has passed. */
const fs = require('fs'), path = require('path');
const R = require('./reach.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const pad = n => String(n).padStart(4, '0');
const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

/* the board for a serial: the first seed in its series that passes the gate and repeats no earlier board */
function boardFor(serial, seen) {
  for (let k = 0; k < 4000; k++) {
    const p = R.generate('reach-' + pad(serial) + (k ? '-' + k : ''));
    if (!p) continue;
    const fp = R.fingerprint(p); if (seen && seen.has(fp)) continue;
    if (seen) seen.add(fp);
    return p;
  }
  throw new Error('no board found for serial ' + serial);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const OPBTN = [['+', 'opAdd', 'Add', '+'], ['-', 'opSub', 'Subtract', '−'], ['*', 'opMul', 'Multiply', '×'], ['/', 'opDiv', 'Divide', '÷']];
function page({ serial, date, board, lab }) {
  const id = 'DP·REACH·' + pad(serial), num = pad(serial);
  const stand = require('./standfirst').TEXT.reach;
  // a JS literal with bare keys, like every other type's DN_PUZZLE (the registry and feed read `id:"DP·…"`)
  const data = '{type:"reach",id:"' + id + '",band:"medium",tiles:[' + board.tiles.join(',') + '],target:' + board.target +
    ',way:[' + board.way.map(s => '[' + s[0] + ',"' + s[1] + '",' + s[2] + ',' + s[3] + ']').join(',') + ']}';
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="dn:headline"   content="Reach ${num}">
<meta name="dn:standfirst" content="${esc(stand)}">
<meta name="dn:topic"      content="Logic">
<meta name="dn:date"       content="${date}">
<meta name="dn:kind"       content="puzzle">
<meta name="dn:read"       content="~1 min">
<meta name="dn:thumb"      content="assets/reach-thumb.svg">${lab ? '\n<meta name="dn:badge"      content="In development">' : ''}
<meta name="theme-color" content="#2E5BFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Reach">
<title>Reach — Noodle Puzzles</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../engines/reach.css">
</head>
<body>
<div class="app" id="app">
<header>
  <div class="masthead">
    <div class="mono-mark">DP</div>
    <div class="mh-text">
      <div class="mh-name">Noodle<span class="accent">Puzzles</span></div>
      <div class="mh-eyebrow">Reach</div>
    </div>
  </div>
  <div class="streakbox">🔥 <b id="streakn">0</b></div>
</header>
<div class="meta">
  <span class="tag">Reach</span>
  <span id="pid">${id}</span>
  <span>·</span>
  <span id="pband">medium</span>
  <span id="timer">0:00</span>
</div>
<main>
  <div class="play" id="board">
    <div class="target"><span>Target</span><b id="target">${board.target}</b></div>
    <div class="tiles" id="tiles" role="group" aria-label="Number tiles"></div>
    <div class="ops" id="ops" role="group" aria-label="Operations">
${OPBTN.map(([op, bid, label, sign]) => `      <button type="button" id="${bid}" data-op="${op}" aria-label="${label}" aria-pressed="false">${sign}</button>`).join('\n')}
    </div>
    <ol class="working" id="working" aria-label="Your working" aria-live="polite"></ol>
  </div>
  <div class="tools">
    <div class="toolrow">
      <button id="undoBtn" type="button" disabled>Undo</button>
      <button id="resetBtn" type="button" disabled>Reset</button>
      <button id="wayBtn" type="button">Show a way</button>
      <button id="revealAll" type="button" hidden>Yes, show it</button>
    </div>
    <p class="msg" id="msg">Pick a tile, a sign, then another tile.</p>
  </div>
</main>
<footer>SHELL — Reach v1 · ${id} · verified in code, not by eye</footer>
</div>

<div class="modal" id="modal"><div class="modalcard">
  <h2>Solved</h2>
  <div class="sub" id="modalsub">${id} · MEDIUM</div>
  <div class="statrow">
    <div class="stat"><b id="statTime">0:00</b><span>Time</span></div>
    <div class="stat"><b id="statStreak">0</b><span>Streak</span></div>
  </div>
  <div class="modalbtns">
    <button id="shareBtn">Share result</button>
    <button class="primary" id="closeBtn">Nice</button>
  </div>
</div></div>

<script>
/* This puzzle's data. The player is ../engines/reach.js, shared by every reach. */
window.DN_PUZZLE=${data};
</script>
<script src="../engines/reach.js"></script>
</body></html>
`;
}
const FILE = /^(\d{4}-\d{2}-\d{2})-logic-reach-(\d{4})\.html$/;
function existing() {
  return fs.readdirSync(REPORTS).map(f => f.match(FILE)).filter(Boolean).map(m => ({ file: m[0], date: m[1], serial: +m[2] })).sort((a, b) => a.serial - b.serial);
}
function readPage(file) {
  const html = fs.readFileSync(path.join(REPORTS, file), 'utf8'), m = html.match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/);
  if (!m) throw new Error('no DN_PUZZLE in ' + file);
  return require('vm').runInNewContext('(' + m[1] + ')', {}, { timeout: 200 });
}
const same = (a, b) => a.tiles.join() === b.tiles.join() && a.target === b.target && JSON.stringify(a.way) === JSON.stringify(b.way);
function check() {
  const errs = [], seen = new Set(), wanted = new Set(), list = existing();
  if (!list.length) errs.push('no Reach pages');
  for (const e of list) {
    const p = readPage(e.file);
    for (const x of R.check(p)) errs.push(e.file + ': ' + x);
    if (p.id !== 'DP·REACH·' + pad(e.serial)) errs.push(e.file + ' id ' + p.id);
    const fp = R.fingerprint(p); if (seen.has(fp)) errs.push(e.file + ' repeats an earlier board'); seen.add(fp);
    const want = boardFor(e.serial, wanted);   // in serial order, so a seed skipped as a repeat is skipped here too
    if (!same(want, p)) errs.push(e.file + ' differs from its seed');
    const html = fs.readFileSync(path.join(REPORTS, e.file), 'utf8');
    if (!html.includes('content="' + e.date + '"')) errs.push(e.file + ' dn:date mismatch');
  }
  return errs;
}
/* continue from the newest page (or from `from`, serial 1, when there are none) to `through`; every existing
   board is re-read from disk and re-gated first, so a new one can't repeat it, and no existing file is written */
function writeThrough(through, opts) {
  opts = opts || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error('--through needs a date, YYYY-MM-DD');
  const list = existing(), seen = new Set(), out = [];
  for (const e of list) {
    const p = readPage(e.file), errs = R.check(p);
    if (errs.length) throw new Error(e.file + ': ' + errs.join('; '));
    seen.add(R.fingerprint(p));
  }
  let serial, date;
  if (list.length) { const last = list[list.length - 1]; serial = last.serial + 1; date = addDay(last.date, 1); }
  else { if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.from || '')) throw new Error('no Reach pages yet: --from D0 names the first day'); serial = 1; date = opts.from; }
  for (; date <= through; serial++, date = addDay(date, 1)) {
    const board = boardFor(serial, seen), file = date + '-logic-reach-' + pad(serial) + '.html';
    const p = { tiles: board.tiles, target: board.target, way: board.way }, errs = R.check(p);
    if (errs.length) throw new Error(file + ': ' + errs.join('; '));
    fs.writeFileSync(path.join(REPORTS, file), page({ serial, date, board, lab: !!opts.lab }), { flag: 'wx' });
    const g = board.grade;
    out.push(file + ' ' + board.tiles.join(' ') + ' → ' + board.target + ' minOps ' + g.minOps + ' routes ' + g.routes + ' near ' + g.nearMiss + ' bot ' + g.bot + 's (' + board.seed + ')');
  }
  return out;
}
/* the bot report: the boards serials 1..n would get, and how the bot rates them */
function report(n) {
  const seen = new Set(), rows = [];
  for (let s = 1; s <= n; s++) { const b = boardFor(s, seen); rows.push(Object.assign({ serial: s, tiles: b.tiles, target: b.target }, b.grade)); }
  const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };
  const tally = k => rows.reduce((m, x) => (m[x[k]] = (m[x[k]] || 0) + 1, m), {});
  return { boards: rows.length, botMedian: q(rows.map(r => r.bot), 0.5), botQ25: q(rows.map(r => r.bot), 0.25), botQ75: q(rows.map(r => r.bot), 0.75),
    minOps: tally('minOps'), large: tally('large'),
    routes: { min: Math.min(...rows.map(r => r.routes)), q25: q(rows.map(r => r.routes), 0.25), median: q(rows.map(r => r.routes), 0.5), q75: q(rows.map(r => r.routes), 0.75), max: Math.max(...rows.map(r => r.routes)) },
    rows };
}
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--check')) { const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); } console.log('Reach: ' + existing().length + ' pages pass the gate and match their seeds'); }
  else if (a.includes('--report')) {
    const n = +a[a.indexOf('--report') + 1] || 30, r = report(n);
    for (const x of r.rows) console.log(pad(x.serial) + '  ' + x.tiles.join(' ').padEnd(18) + ' → ' + x.target + '  minOps ' + x.minOps + '  routes ' + String(x.routes).padStart(3) + '  near ' + x.nearMiss + '  large ' + x.large + '  bot ' + x.bot + 's');
    console.log(JSON.stringify(Object.assign({}, r, { rows: undefined })));
  }
  else if (a.includes('--through')) {
    const out = writeThrough(a[a.indexOf('--through') + 1], { from: a.includes('--from') ? a[a.indexOf('--from') + 1] : null, lab: a.includes('--lab') });
    console.log(out.join('\n') + '\n' + out.length + ' pages written');
    const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  }
  else { console.log('usage: --check | --report [N] | --through D [--from D0] [--lab]'); process.exit(2); }
}
module.exports = { boardFor, page, check, existing, readPage, writeThrough, report };
