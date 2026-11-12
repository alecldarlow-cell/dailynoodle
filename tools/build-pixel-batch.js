'use strict';
/* Pixel pages: a picture a day from tools/pixel-pictures.json (Lab build, 12 Nov 2026; brief: project doc claude/brief-nonogram.md).

     node tools/build-pixel-batch.js --check                         # exit 1 if any Pixel page fails the gate, repeats a picture too soon or differs from the library
     node tools/build-pixel-batch.js --pictures                      # the library: which pictures pass the gate, with the bot's grade (exit 1 on a malformed library)
     node tools/build-pixel-batch.js --report                        # the bot report by size: rounds, line-steps, predicted median times, pass rate
     node tools/build-pixel-batch.js --through D [--from D0] [--lab] [--size 8]   # write days D0..D as the next serials; never touches an existing page or day

   A page's picture is chosen from the library pictures of its size that pass tools/pixel.js's gate (unique, line logic
   alone, not exact-fit lines alone, at least 3 rounds, 25–70% filled, in the bot's band), are distinct from every other
   library picture under rotation and reflection, are in season for the day (a pumpkin only in late Oct, a snowman in
   winter), and whose subject hasn't been used in the 90 days before. The pick is seeded by the serial ("pixel-0001"),
   so --check can prove a page wasn't edited by hand. Pages are never changed once their day has passed. */
const fs = require('fs'), path = require('path');
const X = require('./pixel.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const LIB = path.join(__dirname, 'pixel-pictures.json');
const pad = n => String(n).padStart(4, '0');
const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const REPEAT_DAYS = 90;

function library() {
  const lib = JSON.parse(fs.readFileSync(LIB, 'utf8'));
  if (!lib || !Array.isArray(lib.pictures) || !lib.palette) throw new Error('tools/pixel-pictures.json: no pictures or palette');
  const ids = new Set();
  for (const p of lib.pictures) {
    if (!/^[a-z]+-(8|10)$/.test(p.id || '') || ids.has(p.id)) throw new Error('picture id ' + p.id + ' malformed or repeated');
    ids.add(p.id);
    if (p.id !== p.subject + '-' + p.size) throw new Error(p.id + ': id must be subject-size');
    if (!/^(A|An|The) [a-z][a-z ]*$/.test(p.name || '')) throw new Error(p.id + ': a plain name like "A teapot"');
    X.parse(p);
    for (const ch of p.rows.join('')) if (ch !== '.' && !lib.palette[ch]) throw new Error(p.id + ': colour ' + ch + ' not in the palette');
    if (p.season && !/^\d{2}-\d{2}\.\.\d{2}-\d{2}$/.test(p.season)) throw new Error(p.id + ': season MM-DD..MM-DD');
  }
  return lib;
}
/* every library picture with its gate result; D4 twins of an earlier picture of the same size fail */
function graded(lib) {
  const seen = new Map();
  return lib.pictures.map(pic => {
    const b = X.board(pic), errs = X.check(b), g = X.grade(b), fp = X.fingerprint(b.sol, b.n);
    if (seen.has(fp)) errs.push('the same picture as ' + seen.get(fp) + ' turned or mirrored'); else seen.set(fp, pic.id);
    return { pic, board: b, grade: g, errs, pass: !errs.length };
  });
}
function inSeason(season, date) {
  if (!season) return true;
  const [a, b] = season.split('..'), md = date.slice(5);
  return a <= b ? md >= a && md <= b : md >= a || md <= b;
}
/* the picture for a serial on a date: seeded by the serial among those eligible that day */
function pictureFor(serial, date, size, recent, all) {
  const ok = all.filter(x => x.pass && x.pic.size === size && inSeason(x.pic.season, date) && !recent.has(x.pic.subject));
  if (!ok.length) throw new Error('no eligible ' + size + '×' + size + ' picture for ' + date + ' (library too small for a ' + REPEAT_DAYS + '-day gap)');
  // a seasonal picture in its season goes first; then any picture, seeded
  const seasonal = ok.filter(x => x.pic.season);
  const pool = seasonal.length ? seasonal : ok;
  const r = X.rng(X.hashSeed('pixel-' + pad(serial)));
  return pool[Math.floor(r() * pool.length)];
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function record(serial, x) {
  const b = x.board, id = 'DP·PIXEL·' + pad(serial);
  return '{type:"pixel",id:"' + id + '",band:"medium",n:' + b.n + ',rows:' + JSON.stringify(b.rows) + ',cols:' + JSON.stringify(b.cols) +
    ',sol:"' + b.sol + '",colours:"' + b.colours + '",name:"' + b.name + '",pic:"' + x.pic.id + '",seed:"pixel-' + pad(serial) + '"}';
}
function page({ serial, date, x, lab, palette }) {
  const id = 'DP·PIXEL·' + pad(serial), num = pad(serial);
  const stand = require('./standfirst').TEXT.pixel;
  const used = {}; for (const ch of x.board.colours) if (ch !== '.') used[ch] = palette[ch];
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="dn:headline"   content="Pixel ${num}">
<meta name="dn:standfirst" content="${esc(stand)}">
<meta name="dn:topic"      content="Logic">
<meta name="dn:date"       content="${date}">
<meta name="dn:kind"       content="puzzle">
<meta name="dn:read"       content="~1 min">
<meta name="dn:thumb"      content="assets/pixel-thumb.svg">${lab ? '\n<meta name="dn:badge"      content="In development">' : ''}
<meta name="theme-color" content="#2E5BFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Pixel">
<title>Pixel — Noodle Puzzles</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../engines/pixel.css">
</head>
<body>
<div class="app" id="app">
<header>
  <div class="masthead">
    <div class="mono-mark">DP</div>
    <div class="mh-text">
      <div class="mh-name">Noodle<span class="accent">Puzzles</span></div>
      <div class="mh-eyebrow">Pixel</div>
    </div>
  </div>
  <div class="streakbox">🔥 <b id="streakn">0</b></div>
</header>
<div class="meta">
  <span class="tag">Pixel</span>
  <span id="pid">${id}</span>
  <span>·</span>
  <span id="pband">medium</span>
  <span id="timer">0:00</span>
</div>
<main>
  <div class="board" id="board">
    <div class="corner" aria-hidden="true"></div>
    <div class="colclues" id="colClues" aria-hidden="true"></div>
    <div class="rowclues" id="rowClues" aria-hidden="true"></div>
    <div class="grid" id="grid" role="grid" aria-label="Pixel board"></div>
  </div>
  <div class="tools">
    <div class="mode" role="group" aria-label="What a tap does">
      <button id="fillMode" type="button" aria-pressed="true"><span class="sw-fill" aria-hidden="true"></span>Fill</button>
      <button id="crossMode" type="button" aria-pressed="false"><svg class="sw-x" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg>Mark</button>
    </div>
    <button id="undoBtn" type="button" disabled>Undo</button>
    <button id="checkBtn" type="button">Check</button>
  </div>
  <p class="progress"><b id="linesDone">0</b> of <span id="linesAll">${2 * x.board.n}</span> lines done</p>
  <p class="msg" id="msg">Tap a square to fill it, again to cross it out, again to clear it. Drag to paint a line.</p>
</main>
<footer>SHELL — Pixel v1 · ${id} · verified in code, not by eye</footer>
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
/* This puzzle's data. The player is ../engines/pixel.js, shared by every Pixel. The picture comes from tools/pixel-pictures.json. */
window.DN_PUZZLE=${record(serial, x)};
window.DN_PALETTE=${JSON.stringify(used)};
</script>
<script src="../engines/pixel.js"></script>
</body></html>
`;
}
const FILE = /^(\d{4}-\d{2}-\d{2})-logic-pixel-(\d{4})\.html$/;
function existing() {
  return fs.readdirSync(REPORTS).map(f => f.match(FILE)).filter(Boolean).map(m => ({ file: m[0], date: m[1], serial: +m[2] })).sort((a, b) => a.serial - b.serial);
}
function readPage(file) {
  const html = fs.readFileSync(path.join(REPORTS, file), 'utf8'), m = html.match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/);
  if (!m) throw new Error('no DN_PUZZLE in ' + file);
  return require('vm').runInNewContext('(' + m[1] + ')', {}, { timeout: 200 });
}
/* subjects used in the REPEAT_DAYS before a date (by any page, either size) */
function recentSubjects(list, date) {
  const out = new Set();
  for (const e of list) { const d = daysBetween(e.date, date); if (d > 0 && d <= REPEAT_DAYS) out.add(e.subject); }
  return out;
}
function check() {
  const errs = [], lib = library(), all = graded(lib), byId = new Map(all.map(x => [x.pic.id, x])), list = existing().map(e => Object.assign(e, { p: readPage(e.file) }));
  if (!list.length) errs.push('no Pixel pages');
  const days = new Set();
  for (const e of list) {
    const p = e.p, x = byId.get(p.pic);
    for (const m of X.check(p)) errs.push(e.file + ': ' + m);
    if (p.id !== 'DP·PIXEL·' + pad(e.serial)) errs.push(e.file + ' id ' + p.id);
    if (p.seed !== 'pixel-' + pad(e.serial)) errs.push(e.file + ' seed ' + p.seed + ' is not its serial’s');
    if (days.has(e.date)) errs.push('two Pixels on ' + e.date); days.add(e.date);
    if (!x) { errs.push(e.file + ': picture ' + p.pic + ' is not in the library'); continue; }
    e.subject = x.pic.subject;
    if (!x.pass) errs.push(e.file + ': picture ' + p.pic + ' fails the gate: ' + x.errs.join('; '));
    if (p.sol !== x.board.sol || p.colours !== x.board.colours || p.name !== x.board.name) errs.push(e.file + ' differs from library picture ' + p.pic);
    const html = fs.readFileSync(path.join(REPORTS, e.file), 'utf8');
    if (!html.includes('content="' + e.date + '"')) errs.push(e.file + ' dn:date mismatch');
    if (!html.includes('content="assets/pixel-thumb.svg"')) errs.push(e.file + ' must carry the fixed thumb, never the day’s picture');
  }
  for (const e of list) {
    if (!e.subject) continue;
    const clash = list.find(o => o !== e && o.subject === e.subject && daysBetween(o.date, e.date) > 0 && daysBetween(o.date, e.date) <= REPEAT_DAYS);
    if (clash) errs.push(e.file + ' repeats ' + e.subject + ' from ' + clash.file + ' within ' + REPEAT_DAYS + ' days');
    // the seed must still pick this picture (so a page can't be swapped by hand)
    const prior = list.filter(o => o.date < e.date && o.subject);
    try { const want = pictureFor(e.serial, e.date, e.p.n, recentSubjects(prior, e.date), graded(lib)); if (want.pic.id !== e.p.pic) errs.push(e.file + ' is not what its seed picks (' + want.pic.id + ')'); }
    catch (err) { errs.push(e.file + ': ' + err.message); }
  }
  return errs;
}
function writeThrough(through, opts) {
  opts = opts || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error('--through needs a date, YYYY-MM-DD');
  const size = opts.size || 8;
  if (!X.SIZES.includes(size)) throw new Error('--size 8 or 10');
  const lib = library(), all = graded(lib), byId = new Map(all.map(x => [x.pic.id, x]));
  const list = existing().map(e => { const p = readPage(e.file), x = byId.get(p.pic); if (!x) throw new Error(e.file + ': unknown picture ' + p.pic); return Object.assign(e, { subject: x.pic.subject }); });
  const taken = new Set(list.map(e => e.date)), out = [];
  let serial = list.length ? Math.max(...list.map(e => e.serial)) + 1 : 1, date;
  if (opts.from) { if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.from)) throw new Error('--from needs a date, YYYY-MM-DD'); date = opts.from; }
  else if (list.length) date = addDay(list.map(e => e.date).sort().pop(), 1);
  else throw new Error('no Pixel pages yet: --from D0 names the first day');
  for (; date <= through; serial++, date = addDay(date, 1)) {
    if (taken.has(date)) throw new Error('there is already a Pixel on ' + date);
    const x = pictureFor(serial, date, size, recentSubjects(list, date), all), file = date + '-logic-pixel-' + pad(serial) + '.html';
    fs.writeFileSync(path.join(REPORTS, file), page({ serial, date, x, lab: !!opts.lab, palette: lib.palette }), { flag: 'wx' });
    list.push({ file, date, serial, subject: x.pic.subject });
    out.push(file + ' ' + x.pic.id + ' rounds ' + x.grade.rounds + ' bot ' + x.grade.bot.steps + ' steps, ~' + x.grade.secs.sweepRate + ' s');
  }
  return out;
}
function report(all) {
  const med = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
  const lines = [];
  for (const n of X.SIZES) {
    const xs = all.filter(x => x.pic.size === n), ok = xs.filter(x => x.pass);
    lines.push(n + '×' + n + ': ' + ok.length + ' of ' + xs.length + ' pictures pass the gate (' + Math.round(100 * ok.length / Math.max(1, xs.length)) + '%)' +
      '; rounds median ' + med(ok.map(x => x.grade.rounds)) + ' (' + Math.min(...ok.map(x => x.grade.rounds)) + '–' + Math.max(...ok.map(x => x.grade.rounds)) + ')' +
      '; bot line-steps median ' + med(ok.map(x => x.grade.bot.steps)) + ' (' + Math.min(...ok.map(x => x.grade.bot.steps)) + '–' + Math.max(...ok.map(x => x.grade.bot.steps)) + ')' +
      '; predicted median ' + med(ok.map(x => x.grade.secs.sweepRate)) + ' s at Sweep’s pace, ' + med(ok.map(x => x.grade.secs.tallyRate)) + ' s at Tally’s');
  }
  lines.push('Rates: ' + X.SECS_NOTE);
  return lines;
}
if (require.main === module) {
  const a = process.argv.slice(2), arg = k => a.includes(k) ? a[a.indexOf(k) + 1] : null;
  if (a.includes('--check')) { const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); } console.log('Pixel: ' + existing().length + ' pages pass the gate, match the library and their seeds'); }
  else if (a.includes('--pictures') || a.includes('--report')) {
    const all = graded(library());
    if (a.includes('--pictures')) for (const x of all) console.log((x.pass ? 'ok   ' : 'FAIL ') + x.pic.id.padEnd(12) + ' fill ' + Math.round(x.grade.fill * 100) + '% rounds ' + x.grade.rounds + ' bot ' + (x.grade.bot ? x.grade.bot.steps : '-') + (x.grade.secs ? ' ~' + x.grade.secs.sweepRate + ' s' : '') + (x.errs.length ? '  ' + x.errs.join('; ') : ''));
    console.log(report(all).join('\n'));
  }
  else if (a.includes('--through')) {
    const out = writeThrough(arg('--through'), { from: arg('--from'), lab: a.includes('--lab'), size: arg('--size') ? +arg('--size') : 8 });
    console.log(out.join('\n') + '\n' + out.length + ' pages written');
    const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  }
  else { console.log('usage: --check | --pictures | --report | --through D [--from D0] [--lab] [--size 8|10]'); process.exit(2); }
}
module.exports = { library, graded, inSeason, pictureFor, page, record, check, existing, readPage, writeThrough, report, REPEAT_DAYS };
