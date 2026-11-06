'use strict';
/* Redact pages: a board a day, from tools/redact.js (Lab, 6 Nov 2026: ten 6×6, then ten 7×7).

     node tools/build-redact-batch.js --check                    # exit 1 if any Redact page fails the gate, repeats a board or differs from its seed
     node tools/build-redact-batch.js --through D [--from D0]    # write days D0..D (default: the day after the newest page) as the next serials; never touches an existing page or day
     add --lab to write pages with the "In development" badge, --size 7 for 7×7 (default 6),
     --updated D to give each new page dn:updated D (so back-dated Lab boards sit at the top of Lab)

   Every board passes tools/redact.js's gate (crossword norms, everyday answers, no
   trap, one black set only, solved by line logic and the count, effort in band).
   Each page records the seed that made it ("redact-0001", then "redact-0001-<k>"),
   and --check regenerates that seed to prove the page wasn't edited by hand.
   Boards are never changed once their day has passed. */
const fs = require('fs'), path = require('path');
const R = require('./redact.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const pad = n => String(n).padStart(4, '0');
const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

function fromSeed(seed, n) { const p = R.generate(seed, { n: n || R.BAND.n }); return p && !R.check(p).length ? p : null; }
/* the board for a serial: the first seed in its series that passes the gate and repeats no earlier board */
/* long answers (5+ letters) never come back: two boards sharing them read as the same puzzle */
const longs = p => p.words.filter(w => w.length >= 5);
function boardFor(serial, seen, used, n) {
  for (let k = 0; k < 600; k++) {
    const p = fromSeed('redact-' + pad(serial) + (k ? '-' + k : ''), n);
    if (!p) continue;
    const fp = R.fingerprint(p); if (seen && seen.has(fp)) continue;
    if (used && longs(p).some(w => used.has(w))) continue;
    if (seen) seen.add(fp);
    if (used) longs(p).forEach(w => used.add(w));
    return p;
  }
  throw new Error('no board found for serial ' + serial);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const SIZE = { 5: 'Five by five', 6: 'Six by six', 7: 'Seven by seven' };
const W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
function page({ serial, date, board, lab, updated }) {
  const id = 'DP·REDA·' + pad(serial), num = pad(serial), k = board.black.length;
  const stand = SIZE[board.n] + ', every square a letter. Black out the ' + W[k] + ' that don’t belong and the grid becomes a crossword.';
  const data = '{type:"redact",id:"' + id + '",band:"medium",n:' + board.n + ',letters:"' + board.letters + '",black:[' + board.black.join(',') +
    '],words:[' + board.words.map(w => '"' + w + '"').join(',') + '],seed:"' + board.seed + '"}';
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="dn:headline"   content="Redact ${num}">
<meta name="dn:standfirst" content="${esc(stand)}">
<meta name="dn:topic"      content="Word">
<meta name="dn:date"       content="${date}">${updated ? '\n<meta name="dn:updated"    content="' + updated + '">' : ''}
<meta name="dn:kind"       content="puzzle">
<meta name="dn:read"       content="~1 min">
<meta name="dn:thumb"      content="assets/redact-thumb.svg">${lab ? '\n<meta name="dn:badge"      content="In development">' : ''}
<meta name="theme-color" content="#2E5BFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Redact">
<title>Redact — Noodle Puzzles</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../engines/redact.css">
</head>
<body>
<div class="app" id="app">
<header>
  <div class="masthead">
    <div class="mono-mark">DP</div>
    <div class="mh-text">
      <div class="mh-name">Noodle<span class="accent">Puzzles</span></div>
      <div class="mh-eyebrow">Redact</div>
    </div>
  </div>
  <div class="streakbox">🔥 <b id="streakn">0</b></div>
</header>
<div class="meta">
  <span class="tag">Redact</span>
  <span id="pid">${id}</span>
  <span>·</span>
  <span id="pband">medium</span>
  <span id="timer">0:00</span>
</div>
<main>
  <div class="grid" id="grid" role="grid" aria-label="Redact board"></div>
  <div class="tools">
    <div class="count"><b id="count">0</b> of <span id="target">${k}</span> blacked out</div>
    <button id="undoBtn" type="button" disabled>Undo</button>
    <button id="clearBtn" type="button" disabled>Clear</button>
  </div>
  <p class="msg" id="msg">Tap a letter to black it out. Every row and column must read as words.</p>
</main>
<footer>SHELL — Redact v1 · ${id} · verified in code, not by eye</footer>
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
/* This puzzle's data. The player is ../engines/redact.js, shared by every redact. */
window.DN_PUZZLE=${data};
</script>
<script src="../engines/redact.js"></script>
</body></html>
`;
}
const FILE = /^(\d{4}-\d{2}-\d{2})-word-redact-(\d{4})\.html$/;
function existing() {
  return fs.readdirSync(REPORTS).map(f => f.match(FILE)).filter(Boolean).map(m => ({ file: m[0], date: m[1], serial: +m[2] })).sort((a, b) => a.serial - b.serial);
}
function readPage(file) {
  const html = fs.readFileSync(path.join(REPORTS, file), 'utf8'), m = html.match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/);
  if (!m) throw new Error('no DN_PUZZLE in ' + file);
  return require('vm').runInNewContext('(' + m[1] + ')', {}, { timeout: 200 });
}
function check() {
  const errs = [], seen = new Set(), used = new Map(), list = existing();
  if (!list.length) errs.push('no Redact pages');
  for (const e of list) {
    const p = readPage(e.file);
    for (const x of R.check(p)) errs.push(e.file + ': ' + x);
    if (p.id !== 'DP·REDA·' + pad(e.serial)) errs.push(e.file + ' id ' + p.id);
    if (!String(p.seed || '').startsWith('redact-' + pad(e.serial))) errs.push(e.file + ' seed ' + p.seed + ' is not its serial’s');
    const fp = R.fingerprint(p); if (seen.has(fp)) errs.push(e.file + ' repeats an earlier board'); seen.add(fp);
    for (const w of longs(p)) { if (used.has(w)) errs.push(e.file + ' reuses ' + w + ' from ' + used.get(w)); else used.set(w, e.file); }
    const want = R.generate(p.seed, { n: p.n });
    if (!want || want.letters !== p.letters || want.black.join() !== p.black.join()) errs.push(e.file + ' differs from its seed');
    const html = fs.readFileSync(path.join(REPORTS, e.file), 'utf8');
    if (!html.includes('content="' + e.date + '"')) errs.push(e.file + ' dn:date mismatch');
  }
  return errs;
}
function writeThrough(through, opts) {
  opts = opts || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error('--through needs a date, YYYY-MM-DD');
  const list = existing(), seen = new Set(), used = new Set(), out = [];
  for (const e of list) { const p = readPage(e.file), errs = R.check(p); if (errs.length) throw new Error(e.file + ': ' + errs.join('; ')); seen.add(R.fingerprint(p)); longs(p).forEach(w => used.add(w)); }
  /* serials always continue; days continue from the newest page unless --from names a free run of days
     (the 7×7 Lab boards fill 18–27 Oct, before the 6×6 ones: the registry wants one Redact a day, no gaps) */
  const taken = new Set(list.map(e => e.date));
  let serial = list.length ? Math.max(...list.map(e => e.serial)) + 1 : 1, date;
  if (opts.from) { if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.from)) throw new Error('--from needs a date, YYYY-MM-DD'); date = opts.from; }
  else if (list.length) date = addDay(list.map(e => e.date).sort().pop(), 1);
  else throw new Error('no Redact pages yet: --from D0 names the first day');
  if (opts.updated && !/^\d{4}-\d{2}-\d{2}$/.test(opts.updated)) throw new Error('--updated needs a date, YYYY-MM-DD');
  for (; date <= through; serial++, date = addDay(date, 1)) {
    if (taken.has(date)) throw new Error('there is already a Redact on ' + date);
    const board = boardFor(serial, seen, used, opts.size), file = date + '-word-redact-' + pad(serial) + '.html';
    fs.writeFileSync(path.join(REPORTS, file), page({ serial, date, board, lab: !!opts.lab, updated: opts.updated }), { flag: 'wx' });
    out.push(file + ' ' + board.n + '×' + board.n + ' k ' + board.black.length + ' effort ' + board.grade.effort + ' (' + board.seed + ') ' + board.words.join(','));
  }
  return out;
}
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--check')) { const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); } console.log('Redact: ' + existing().length + ' pages pass the gate and match their seeds'); }
  else if (a.includes('--through')) {
    const arg = k => a.includes(k) ? a[a.indexOf(k) + 1] : null;
    const out = writeThrough(arg('--through'), { from: arg('--from'), lab: a.includes('--lab'), size: arg('--size') ? +arg('--size') : 6, updated: arg('--updated') });
    console.log(out.join('\n') + '\n' + out.length + ' pages written');
    const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  }
  else { console.log('usage: --check | --through D [--from D0] [--lab]'); process.exit(2); }
}
module.exports = { boardFor, page, check, existing, readPage, writeThrough };
