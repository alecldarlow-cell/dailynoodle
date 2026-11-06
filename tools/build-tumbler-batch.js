'use strict';
/* Tumbler pages: a hidden word on four seven-letter wheels a day, from tools/tumbler.js (Lab, 6 Nov 2026).

     node tools/build-tumbler-batch.js --check                    # exit 1 if any page fails the gate, repeats a secret or differs from its seed
     node tools/build-tumbler-batch.js --through D [--from D0]    # continue from the newest page to date D (from D0, serial 1, when there are none); never touches an existing page
     add --lab to write pages with the "In development" badge

   Each page records its seed ("tumbler-0001", then "tumbler-0001-<k>"); --check regenerates it.
   No secret word is used twice. Boards are never changed once their day has passed. */
const fs = require('fs'), path = require('path');
const T = require('./tumbler.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const pad = n => String(n).padStart(4, '0');
const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

function boardFor(serial, used) {
  for (let k = 0; k < 300; k++) {
    const p = T.generate('tumbler-' + pad(serial) + (k ? '-' + k : ''), { avoid: used });
    if (!p) continue;
    if (used) used.add(p.secret);
    return p;
  }
  throw new Error('no board found for serial ' + serial);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function page({ serial, date, board, lab }) {
  const id = 'DP·TUMB·' + pad(serial), num = pad(serial);
  const stand = 'A four-letter word hidden in four wheels of letters. Turn them to make words, submit for clues, and close in on it.';
  const data = '{type:"tumbler",id:"' + id + '",band:"medium",n:4,wheels:[' + board.wheels.map(w => '"' + w + '"').join(',') + '],secret:"' + board.secret +
    '",words:[' + board.words.map(w => '"' + w + '"').join(',') + '],seed:"' + board.seed + '"}';
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="dn:headline"   content="Tumbler ${num}">
<meta name="dn:standfirst" content="${esc(stand)}">
<meta name="dn:topic"      content="Word">
<meta name="dn:date"       content="${date}">
<meta name="dn:kind"       content="puzzle">
<meta name="dn:read"       content="~1 min">
<meta name="dn:thumb"      content="assets/tumbler-thumb.svg">${lab ? '\n<meta name="dn:badge"      content="In development">' : ''}
<meta name="theme-color" content="#2E5BFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tumbler">
<title>Tumbler — Noodle Puzzles</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../engines/tumbler.css">
</head>
<body>
<div class="app" id="app">
<header>
  <div class="masthead">
    <div class="mono-mark">DP</div>
    <div class="mh-text">
      <div class="mh-name">Noodle<span class="accent">Puzzles</span></div>
      <div class="mh-eyebrow">Tumbler</div>
    </div>
  </div>
  <div class="streakbox">🔥 <b id="streakn">0</b></div>
</header>
<div class="meta">
  <span class="tag">Tumbler</span>
  <span id="pid">${id}</span>
  <span>·</span>
  <span id="pband">medium</span>
  <span id="timer">0:00</span>
</div>
<main>
  <div class="board" id="board" aria-label="Tumbler wheels"></div>
  <button class="submit" id="submitBtn" type="button">Submit</button>
  <p class="msg" id="msg">Make a word on the yellow line and submit it for clues.</p>
  <div class="tries" id="tries" aria-live="polite"></div>
</main>
<footer>SHELL — Tumbler v1 · ${id} · verified in code, not by eye</footer>
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
/* This puzzle's data. The player is ../engines/tumbler.js, shared by every tumbler. */
window.DN_PUZZLE=${data};
</script>
<script src="../engines/tumbler.js"></script>
</body></html>
`;
}
const FILE = /^(\d{4}-\d{2}-\d{2})-word-tumbler-(\d{4})\.html$/;
function existing() {
  return fs.readdirSync(REPORTS).map(f => f.match(FILE)).filter(Boolean).map(m => ({ file: m[0], date: m[1], serial: +m[2] })).sort((a, b) => a.serial - b.serial);
}
function readPage(file) {
  const html = fs.readFileSync(path.join(REPORTS, file), 'utf8'), m = html.match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/);
  if (!m) throw new Error('no DN_PUZZLE in ' + file);
  return require('vm').runInNewContext('(' + m[1] + ')', {}, { timeout: 200 });
}
function check() {
  const errs = [], used = new Map(), list = existing();
  if (!list.length) errs.push('no Tumbler pages');
  for (const e of list) {
    const p = readPage(e.file);
    for (const x of T.check(p)) errs.push(e.file + ': ' + x);
    if (p.id !== 'DP·TUMB·' + pad(e.serial)) errs.push(e.file + ' id ' + p.id);
    if (!String(p.seed || '').startsWith('tumbler-' + pad(e.serial))) errs.push(e.file + ' seed ' + p.seed + ' is not its serial’s');
    if (used.has(p.secret)) errs.push(e.file + ' repeats the secret of ' + used.get(p.secret)); else used.set(p.secret, e.file);
    const avoid = new Set([...used.keys()].filter(s => s !== p.secret));
    const want = T.generate(p.seed, { avoid: new Set([...avoid].filter(s => s !== p.secret)) });
    if (!want || want.secret !== p.secret || want.wheels.join() !== p.wheels.join()) errs.push(e.file + ' differs from its seed');
    const html = require('fs').readFileSync(path.join(REPORTS, e.file), 'utf8');
    if (!html.includes('content="' + e.date + '"')) errs.push(e.file + ' dn:date mismatch');
  }
  return errs;
}
function writeThrough(through, opts) {
  opts = opts || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error('--through needs a date, YYYY-MM-DD');
  const list = existing(), used = new Set(), out = [];
  for (const e of list) { const p = readPage(e.file), errs = T.check(p); if (errs.length) throw new Error(e.file + ': ' + errs.join('; ')); used.add(p.secret); }
  let serial, date;
  if (list.length) { const last = list[list.length - 1]; serial = last.serial + 1; date = addDay(last.date, 1); }
  else { if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.from || '')) throw new Error('no Tumbler pages yet: --from D0 names the first day'); serial = 1; date = opts.from; }
  for (; date <= through; serial++, date = addDay(date, 1)) {
    const board = boardFor(serial, used), file = date + '-word-tumbler-' + pad(serial) + '.html';
    fs.writeFileSync(path.join(REPORTS, file), page({ serial, date, board, lab: !!opts.lab }), { flag: 'wx' });
    out.push(file + ' ' + board.secret + ' everyday ' + board.grade.everyday + ' bot ' + board.grade.botMedian + '/' + board.grade.botP90 + ' (' + board.seed + ')');
  }
  return out;
}
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--check')) { const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); } console.log('Tumbler: ' + existing().length + ' pages pass the gate and match their seeds'); }
  else if (a.includes('--through')) {
    const out = writeThrough(a[a.indexOf('--through') + 1], { from: a.includes('--from') ? a[a.indexOf('--from') + 1] : null, lab: a.includes('--lab') });
    console.log(out.join('\n') + '\n' + out.length + ' pages written');
    const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  }
  else { console.log('usage: --check | --through D [--from D0] [--lab]'); process.exit(2); }
}
module.exports = { boardFor, page, check, existing, readPage, writeThrough };
