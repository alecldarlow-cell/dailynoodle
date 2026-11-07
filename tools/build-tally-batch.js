'use strict';
/* Tally pages: 4×4 calcudoku, one steady band, from tools/tally.js.

     node tools/build-tally-batch.js --check          # exit 1 if any Tally page in reports/ fails the gate or its DN_PUZZLE differs from its seed
     node tools/build-tally-batch.js --through D      # continue from the newest page to date D; never touches an existing page

   Every board: exactly one solution, finished by cage arithmetic, naked and
   hidden singles only (no naked pair, so no guess), 3–5 solver rounds, 5–7
   cages with at least two two-cell cages and one of three or four cells, at
   least one − or ÷ clue, at most one lone digit. Seeds are fixed per serial
   ("tally-0001"), so a page is reproducible and --check proves it was not
   edited by hand. Boards are never changed once their day has passed. */
const fs = require('fs'), path = require('path');
const T = require('./tally.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const N = 4;
const BAND = g => g.rounds >= 3 && g.rounds <= 5 && g.hidden <= 3 && g.pairs === 0;
function shape(p) {
  const twos = p.cages.filter(c => c.c.length === 2).length, bigs = p.cages.filter(c => c.c.length >= 3).length;
  return p.cages.length >= 5 && p.cages.length <= 7 && twos >= 2 && bigs >= 1 &&
    p.cages.some(c => c.op === '-' || c.op === '/') && p.cages.filter(c => c.op === '=').length <= 1;
}
const pad = n => String(n).padStart(4, '0');
const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

/* the board for a serial: the first seed in its series that passes the band, the shape and the gate */
function boardFor(serial, seen) {
  for (let k = 0; k < 500; k++) {
    const p = T.generate('tally-' + pad(serial) + (k ? '-' + k : ''), { n: N });
    if (!p || !BAND(p.grade) || !shape(p)) continue;
    const fp = T.fingerprint(p); if (seen && seen.has(fp)) continue;
    if (seen) seen.add(fp);
    return { n: N, cages: p.cages, sol: p.sol, seed: p.seed };
  }
  throw new Error('no board found for serial ' + serial);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function page({ serial, date, board }) {
  const id = 'DP·TALLY·' + pad(serial), num = pad(serial);
  const stand = require('./standfirst').TEXT.tally;   // Alec, 7 Nov 2026: tools/standfirst.js
  // a JS literal with bare keys, like every other type's DN_PUZZLE (the registry and feed read `id:"DP·…"`)
  const data = '{type:"tally",id:"' + id + '",band:"medium",n:' + board.n + ',cages:[' +
    board.cages.map(c => '{c:[' + c.c.join(',') + '],op:"' + c.op + '",t:' + c.t + '}').join(',') + '],sol:"' + board.sol + '"}';
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="dn:headline"   content="Tally ${num}">
<meta name="dn:standfirst" content="${esc(stand)}">
<meta name="dn:topic"      content="Logic">
<meta name="dn:date"       content="${date}">
<meta name="dn:kind"       content="puzzle">
<meta name="dn:read"       content="~2 min">
<meta name="dn:thumb"      content="assets/tally-thumb.svg">
<meta name="theme-color" content="#2E5BFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tally">
<title>Tally — Noodle Puzzles</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../engines/tally.css">
</head>
<body>
<div class="app" id="app">
<header>
  <div class="masthead">
    <div class="mono-mark">DP</div>
    <div class="mh-text">
      <div class="mh-name">Noodle<span class="accent">Puzzles</span></div>
      <div class="mh-eyebrow">Tally</div>
    </div>
  </div>
  <div class="streakbox">🔥 <b id="streakn">0</b></div>
</header>
<div class="meta">
  <span class="tag">Tally</span>
  <span id="pid">${id}</span>
  <span>·</span>
  <span id="pband">medium</span>
  <span id="timer">0:00</span>
</div>
<main>
  <div class="grid" id="grid" role="grid" aria-label="Tally board"></div>
  <div class="pad">
    <div class="keys" id="keys"></div>
    <div class="tools">
      <button id="notesBtn" type="button" aria-pressed="false">Notes</button>
      <button id="eraseBtn" type="button">Erase</button>
      <button id="undoBtn" type="button">Undo</button>
    </div>
    <p class="msg" id="msg">Tap a square, then a number.</p>
  </div>
</main>
<footer>SHELL — Tally v1 · ${id} · verified in code, not by eye</footer>
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
/* This puzzle's data. The player is ../engines/tally.js, shared by every tally. */
window.DN_PUZZLE=${data};
</script>
<script src="../engines/tally.js"></script>
</body></html>
`;
}
const FILE = /^(\d{4}-\d{2}-\d{2})-logic-tally-(\d{4})\.html$/;
function existing() {
  return fs.readdirSync(REPORTS).map(f => f.match(FILE)).filter(Boolean).map(m => ({ file: m[0], date: m[1], serial: +m[2] })).sort((a, b) => a.serial - b.serial);
}
function readPage(file) {
  const html = fs.readFileSync(path.join(REPORTS, file), 'utf8'), m = html.match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/);
  if (!m) throw new Error('no DN_PUZZLE in ' + file);
  return require('vm').runInNewContext('(' + m[1] + ')', {}, { timeout: 200 });
}
function check() {
  const errs = [], seen = new Set(), wanted = new Set(), list = existing();
  if (!list.length) errs.push('no Tally pages');
  for (const e of list) {
    const p = readPage(e.file);
    for (const x of T.check(p)) errs.push(e.file + ': ' + x);
    const g = T.grade(p); if (g && g.pairs) errs.push(e.file + ' needs a naked pair');
    if (p.id !== 'DP·TALLY·' + pad(e.serial)) errs.push(e.file + ' id ' + p.id);
    const fp = T.fingerprint(p); if (seen.has(fp)) errs.push(e.file + ' repeats an earlier board'); seen.add(fp);
    const want = boardFor(e.serial, wanted);   // in serial order, so a seed skipped as a repeat is skipped here too
    if (JSON.stringify(want.cages) !== JSON.stringify(p.cages) || want.sol !== p.sol) errs.push(e.file + ' differs from its seed');
    const html = fs.readFileSync(path.join(REPORTS, e.file), 'utf8');
    if (!html.includes('content="' + e.date + '"')) errs.push(e.file + ' dn:date mismatch');
    if (/name="dn:badge"/.test(html)) errs.push(e.file + ' still carries a Lab badge');
  }
  return errs;
}
/* continue from the newest page to `through`: every existing board is re-read from disk and re-gated
   first, so a new board can't repeat one (D4, cages and clues), and no existing file is written */
function writeThrough(through) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error('--through needs a date, YYYY-MM-DD');
  const list = existing(), seen = new Set(), out = [];
  if (!list.length) throw new Error('no Tally pages to continue from');
  for (const e of list) {
    const p = readPage(e.file), errs = T.check(p);
    if (errs.length) throw new Error(e.file + ': ' + errs.join('; '));
    seen.add(T.fingerprint(p));
  }
  const last = list[list.length - 1];
  for (let serial = last.serial + 1, date = addDay(last.date, 1); date <= through; serial++, date = addDay(date, 1)) {
    const board = boardFor(serial, seen), file = date + '-logic-tally-' + pad(serial) + '.html';
    const errs = T.check(board); if (errs.length) throw new Error(file + ': ' + errs.join('; '));
    fs.writeFileSync(path.join(REPORTS, file), page({ serial, date, board }), { flag: 'wx' });
    out.push(file + ' r' + T.grade(board).rounds + ' ' + board.cages.map(T.label).join(' '));
  }
  return out;
}
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--check')) { const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); } console.log('Tally: ' + existing().length + ' pages pass the gate and match their seeds'); }
  else if (a.includes('--through')) { const out = writeThrough(a[a.indexOf('--through') + 1]); console.log(out.length + ' pages written' + (out.length ? ', last ' + out[out.length - 1] : '')); const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); } }
  else { console.log('usage: --check | --through D'); process.exit(2); }
}
module.exports = { boardFor, page, check, existing, readPage, writeThrough, BAND, shape };
