'use strict';
/* Tilt pages: a 10×10 rolling-ball maze a day, from tools/tilt.js (Lab, 6 Nov 2026).

     node tools/build-tilt-batch.js --check                    # exit 1 if any Tilt page in reports/ fails the gate, repeats a maze or differs from its seed
     node tools/build-tilt-batch.js --through D [--from D0]    # continue from the newest page to date D (from D0, serial 1, when there are no pages); never touches an existing page
     add --lab to write pages with the "In development" badge (Lab cards; the Puzzles page is untouched)

   Every maze passes tools/tilt.js's gate (SITE.md › Tilt): shortest route 12–14
   turns of long slides, no near miss far from the exit, 50–100 reachable
   positions, a random spinner far slower than the route, a three-ahead planner
   in range, inert walls added for the look. Seeds are fixed per serial
   ("tilt-0001", then "tilt-0001-<k>" until one passes), so a page is
   reproducible and --check proves it was not edited by hand. Mazes are never
   changed once their day has passed. */
const fs = require('fs'), path = require('path');
const T = require('./tilt.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const pad = n => String(n).padStart(4, '0');
const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

/* the maze for a serial: the first seed in its series that passes the gate and repeats no earlier maze */
function mazeFor(serial, seen) {
  for (let k = 0; k < 4000; k++) {
    const p = T.generate('tilt-' + pad(serial) + (k ? '-' + k : ''));
    if (!p) continue;
    const fp = T.fingerprint(p); if (seen && seen.has(fp)) continue;
    if (seen) seen.add(fp);
    return { n: p.n, walls: p.walls, start: p.start, exit: p.exit, par: p.par, seed: p.seed, grade: p.grade };
  }
  throw new Error('no maze found for serial ' + serial);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function page({ serial, date, maze, lab }) {
  const id = 'DP·TILT·' + pad(serial), num = pad(serial);
  const stand = 'A ball in a maze. Turn the maze a quarter at a time and the ball drops until it hits a wall: get it out through the gap. The clock is the score.';
  // a JS literal with bare keys, like every other type's DN_PUZZLE (the registry and feed read `id:"DP·…"`)
  const data = '{type:"tilt",id:"' + id + '",band:"medium",n:' + maze.n + ',walls:[' + maze.walls.map(r => '[' + r.join(',') + ']').join(',') +
    '],start:[' + maze.start.join(',') + '],exit:[' + maze.exit.join(',') + '],par:' + maze.par + '}';
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="dn:headline"   content="Tilt ${num}">
<meta name="dn:standfirst" content="${esc(stand)}">
<meta name="dn:topic"      content="Logic">
<meta name="dn:date"       content="${date}">
<meta name="dn:kind"       content="puzzle">
<meta name="dn:read"       content="~1 min">
<meta name="dn:thumb"      content="assets/tilt-thumb.svg">${lab ? '\n<meta name="dn:badge"      content="In development">' : ''}
<meta name="theme-color" content="#2E5BFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tilt">
<title>Tilt — Noodle Puzzles</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../engines/tilt.css">
</head>
<body>
<div class="app" id="app">
<header>
  <div class="masthead">
    <div class="mono-mark">DP</div>
    <div class="mh-text">
      <div class="mh-name">Noodle<span class="accent">Puzzles</span></div>
      <div class="mh-eyebrow">Tilt</div>
    </div>
  </div>
  <div class="streakbox">🔥 <b id="streakn">0</b></div>
</header>
<div class="meta">
  <span class="tag">Tilt</span>
  <span id="pid">${id}</span>
  <span>·</span>
  <span id="pband">medium</span>
  <span id="timer">0:00</span>
</div>
<main>
  <div class="play" id="board">
    <div class="mazewrap"><div class="maze" id="maze" role="img" aria-label="Tilt maze"></div></div>
    <div class="controls">
      <button id="leftBtn" type="button" aria-label="Turn the maze left"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg></button>
      <div class="turns"><b id="turns">0</b><span>turns</span></div>
      <button id="rightBtn" type="button" aria-label="Turn the maze right"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg></button>
    </div>
  </div>
  <div class="tools">
    <button id="undoBtn" type="button" disabled>Undo</button>
    <p class="msg" id="msg">Turn the maze; the ball drops until it hits a wall.</p>
  </div>
</main>
<footer>SHELL — Tilt v1 · ${id} · verified in code, not by eye</footer>
</div>

<div class="modal" id="modal"><div class="modalcard">
  <h2>Out</h2>
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
/* This puzzle's data. The player is ../engines/tilt.js, shared by every tilt. */
window.DN_PUZZLE=${data};
</script>
<script src="../engines/tilt.js"></script>
</body></html>
`;
}
const FILE = /^(\d{4}-\d{2}-\d{2})-logic-tilt-(\d{4})\.html$/;
function existing() {
  return fs.readdirSync(REPORTS).map(f => f.match(FILE)).filter(Boolean).map(m => ({ file: m[0], date: m[1], serial: +m[2] })).sort((a, b) => a.serial - b.serial);
}
function readPage(file) {
  const html = fs.readFileSync(path.join(REPORTS, file), 'utf8'), m = html.match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/);
  if (!m) throw new Error('no DN_PUZZLE in ' + file);
  return require('vm').runInNewContext('(' + m[1] + ')', {}, { timeout: 200 });
}
const sameMaze = (a, b) => JSON.stringify(a.walls) === JSON.stringify(b.walls) && a.start.join() === b.start.join() && a.exit.join() === b.exit.join() && a.par === b.par;
function check() {
  const errs = [], seen = new Set(), wanted = new Set(), list = existing();
  if (!list.length) errs.push('no Tilt pages');
  for (const e of list) {
    const p = readPage(e.file);
    for (const x of T.check(p)) errs.push(e.file + ': ' + x);
    if (p.id !== 'DP·TILT·' + pad(e.serial)) errs.push(e.file + ' id ' + p.id);
    const fp = T.fingerprint(p); if (seen.has(fp)) errs.push(e.file + ' repeats an earlier maze'); seen.add(fp);
    const want = mazeFor(e.serial, wanted);   // in serial order, so a seed skipped as a repeat is skipped here too
    if (!sameMaze(want, p)) errs.push(e.file + ' differs from its seed');
    const html = fs.readFileSync(path.join(REPORTS, e.file), 'utf8');
    if (!html.includes('content="' + e.date + '"')) errs.push(e.file + ' dn:date mismatch');
  }
  return errs;
}
/* continue from the newest page (or from `from`, serial 1, when there are none) to `through`: every existing
   maze is re-read from disk and re-gated first, so a new one can't repeat it (D4), and no existing file is written */
function writeThrough(through, opts) {
  opts = opts || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error('--through needs a date, YYYY-MM-DD');
  const list = existing(), seen = new Set(), out = [];
  for (const e of list) {
    const p = readPage(e.file), errs = T.check(p);
    if (errs.length) throw new Error(e.file + ': ' + errs.join('; '));
    seen.add(T.fingerprint(p));
  }
  let serial, date;
  if (list.length) { const last = list[list.length - 1]; serial = last.serial + 1; date = addDay(last.date, 1); }
  else { if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.from || '')) throw new Error('no Tilt pages yet: --from D0 names the first day'); serial = 1; date = opts.from; }
  for (; date <= through; serial++, date = addDay(date, 1)) {
    const maze = mazeFor(serial, seen), file = date + '-logic-tilt-' + pad(serial) + '.html';
    const errs = T.check(maze); if (errs.length) throw new Error(file + ': ' + errs.join('; '));
    fs.writeFileSync(path.join(REPORTS, file), page({ serial, date, maze, lab: !!opts.lab }), { flag: 'wx' });
    const g = maze.grade;
    out.push(file + ' par ' + g.par + ' states ' + g.states + ' slide ' + g.avgSlide + ' tease ' + g.tease + ' rnd ' + g.rnd + ' look3 ' + g.look3 + ' (' + maze.seed + ')');
  }
  return out;
}
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--check')) { const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); } console.log('Tilt: ' + existing().length + ' pages pass the gate and match their seeds'); }
  else if (a.includes('--through')) {
    const out = writeThrough(a[a.indexOf('--through') + 1], { from: a.includes('--from') ? a[a.indexOf('--from') + 1] : null, lab: a.includes('--lab') });
    console.log(out.join('\n') + '\n' + out.length + ' pages written');
    const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  }
  else { console.log('usage: --check | --through D [--from D0] [--lab]'); process.exit(2); }
}
module.exports = { mazeFor, page, check, existing, readPage, writeThrough };
