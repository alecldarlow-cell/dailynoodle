'use strict';
/* Cryptic pages: one hand-written cryptic clue a day, from the bank in tools/cryptic-clues.json (Lab, 12 Nov 2026).

     node tools/build-cryptic-batch.js --check                         # exit 1 if the bank, the ledger or any page fails the gate
     node tools/build-cryptic-batch.js --through D [--from D0] [--lab] # write days D0..D (default: the day after the newest page)
                                                                       # from the front of the reserve, as the next serials

   Built and stored like Link: hand-authored batches, a reserve, and a ledger. --through takes the next clue from
   the reserve, records {serial, date, answer} in the ledger and writes the page; it never touches an existing page
   or day, and refuses a clue whose type matches the day before. A page's clue never changes once written.

   The gate (--check), from the brief (claude/brief-cryptic.md › Build):
   - every bank entry passes tools/cryptic.js checkEntry: the answer's length matches the enumeration, the
     definition is at one end, the type, parse and two explanation lines are there, a hidden word really is in
     its fodder, an anagram's letters really match, a reversal/charade/container really gives the answer, a
     sound-alike's partner differs in length, nothing is on the blocklist or tools/word-veto.js;
   - no answer appears twice in the bank;
   - no type twice running, across the dated days and on into the reserve's order;
   - every page is exactly what its ledger entry makes (id, date, clue, data), carries the Cryptic icon, and
     shows the answer nowhere outside its wrapped data (no feed card, metadata or link-preview leak). */
const fs = require('fs'), path = require('path');
const C = require('./cryptic.js');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports'), BANK = path.join(__dirname, 'cryptic-clues.json');
const pad = n => String(n).padStart(4, '0');
const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const loadBank = () => JSON.parse(fs.readFileSync(BANK, 'utf8'));
const js = v => JSON.stringify(v);

function literal(d) {
  return '{type:"cryptic",id:"' + d.id + '",band:"medium",n:' + d.n + ',clue:' + js(d.clue) + ',enum:' + js(d.enum) + ',kind:' + js(d.kind) +
    ',def:' + js(d.def) + ',ind:' + js(d.ind) + ',sol:' + js(d.sol) + '}';
}
function page({ serial, date, entry, lab }) {
  const id = 'DP·CRYP·' + pad(serial), num = pad(serial), d = C.pageData(entry, id, serial);
  const stand = require('./standfirst').TEXT.cryptic;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="dn:headline"   content="Cryptic ${num}">
<meta name="dn:standfirst" content="${esc(stand)}">
<meta name="dn:topic"      content="Word">
<meta name="dn:date"       content="${date}">
<meta name="dn:kind"       content="puzzle">
<meta name="dn:read"       content="~1 min">
<meta name="dn:thumb"      content="assets/cryptic-thumb.svg">${lab ? '\n<meta name="dn:badge"      content="In development">' : ''}
<meta name="theme-color" content="#2E5BFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cryptic">
<title>Cryptic — Noodle Puzzles</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../engines/cryptic.css">
</head>
<body>
<div class="app" id="app">
<header>
  <div class="masthead">
    <div class="mono-mark">DP</div>
    <div class="mh-text">
      <div class="mh-name">Noodle<span class="accent">Puzzles</span></div>
      <div class="mh-eyebrow">Cryptic</div>
    </div>
  </div>
  <div class="streakbox">🔥 <b id="streakn">0</b></div>
</header>
<div class="meta">
  <span class="tag">Cryptic</span>
  <span id="pid">${id}</span>
  <span>·</span>
  <span id="pband">medium</span>
  <span id="timer">0:00</span>
</div>
<main id="play">
  <div class="cr-top">
    <div class="cr-label">Today’s clue</div>
    <p class="cr-clue" id="clue" aria-live="polite"></p>
    <div class="cr-grid" id="grid" role="group" aria-label="Your answer"></div>
    <div class="cr-panel" id="hintPanel" hidden></div>
    <div class="cr-actions">
      <button class="cr-btn" id="hintBtn" type="button">Hint 1 of 3</button>
      <button class="cr-btn cr-clear" id="clearBtn" type="button">Clear</button>
    </div>
    <p class="msg" id="msg">Type the answer. A hint underlines the definition first.</p>
  </div>
  <div class="cr-kb" id="kb" aria-label="Keyboard"></div>
</main>
<footer>SHELL — Cryptic v1 · ${id} · verified in code, not by eye</footer>
</div>

<div class="modal" id="winModal"><div class="modalcard">
  <h2 id="winTitle">Solved</h2>
  <div class="statrow">
    <div class="stat" id="rBig"><b id="winTime">0:00</b> <span id="rHints">no hints</span></div>
    <div class="stat"><b id="statStreak">0</b><span>Streak</span></div>
  </div>
  <div class="modalbtns">
    <button id="shareBtn">Share result</button>
    <button class="primary" id="closeBtn">Nice</button>
  </div>
</div></div>

<script>
/* This puzzle's data. The player is ../engines/cryptic.js, shared by every cryptic. The answer and its
   working are wrapped in sol (tools/cryptic.js), so they don't show on sight. */
window.DN_PUZZLE=${literal(d)};
</script>
<script src="../engines/cryptic.js"></script>
</body></html>
`;
}
const FILE = /^(\d{4}-\d{2}-\d{2})-word-cryptic-(\d{4})\.html$/;
function existing() {
  return fs.readdirSync(REPORTS).map(f => f.match(FILE)).filter(Boolean).map(m => ({ file: m[0], date: m[1], serial: +m[2] })).sort((a, b) => a.serial - b.serial);
}
function readPage(file) {
  const html = fs.readFileSync(path.join(REPORTS, file), 'utf8'), m = html.match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/);
  if (!m) throw new Error('no DN_PUZZLE in ' + file);
  return require('vm').runInNewContext('(' + m[1] + ')', {}, { timeout: 200 });
}
function check(bank) {
  bank = bank || loadBank();
  const errs = [], by = new Map(), veto = C.vetoSet();
  for (const c of bank.bank) {
    for (const e of C.checkEntry(c, veto)) errs.push(c.answer + ': ' + e);
    if (by.has(c.answer)) errs.push(c.answer + ' is in the bank twice'); else by.set(c.answer, c);
    if (!c.checked || !c.checked.solved) errs.push(c.answer + ' has no cold-solve record');
    else if (c.checked.solved !== c.answer) errs.push(c.answer + ': the cold solver found ' + c.checked.solved);
  }
  const L = bank.ledger || {}, days = (L.days || []).slice().sort((a, b) => a.date < b.date ? -1 : 1), reserve = L.reserve || [];
  const used = new Set();
  for (const a of days.map(d => d.answer).concat(reserve)) {
    if (!by.has(a)) errs.push('the ledger names ' + a + ', which is not in the bank');
    if (used.has(a)) errs.push(a + ' is used twice in the ledger'); used.add(a);
  }
  for (const c of bank.bank) if (!used.has(c.answer)) errs.push(c.answer + ' is neither dated nor in the reserve');
  const order = days.map(d => d.answer).concat(reserve).map(a => by.get(a)).filter(Boolean);
  for (let i = 1; i < order.length; i++) if (order[i].type === order[i - 1].type) errs.push(order[i - 1].answer + ' then ' + order[i].answer + ': the same type (' + order[i].type + ') twice running');
  for (let i = 1; i < days.length; i++) if (days[i].date !== addDay(days[i - 1].date, 1)) errs.push('the ledger skips from ' + days[i - 1].date + ' to ' + days[i].date);
  // pages: exactly what the ledger makes
  const pages = existing(), byDate = new Map(days.map(d => [d.date, d]));
  if (pages.length !== days.length) errs.push(pages.length + ' pages but ' + days.length + ' dated ledger entries');
  for (const e of pages) {
    const d = byDate.get(e.date), html = fs.readFileSync(path.join(REPORTS, e.file), 'utf8');
    if (!d) { errs.push(e.file + ' has no ledger entry'); continue; }
    if (d.serial !== e.serial) errs.push(e.file + ' serial differs from the ledger (' + d.serial + ')');
    let p; try { p = readPage(e.file); } catch (x) { errs.push(x.message); continue; }
    for (const x of C.check(p)) errs.push(e.file + ': ' + x);
    const want = C.pageData(by.get(d.answer) || {}, 'DP·CRYP·' + pad(e.serial));
    if (literal(p) !== literal(want)) errs.push(e.file + ' differs from its ledger clue (' + d.answer + ')');
    if (!html.includes('<meta name="dn:date"       content="' + e.date + '">')) errs.push(e.file + ' dn:date mismatch');
    if (!html.includes('content="assets/cryptic-thumb.svg"')) errs.push(e.file + ' has no fixed Cryptic icon');
    // no leak: outside the wrapped data the page never names the answer (metadata, og tags, the card's text)
    const outside = html.replace(/\nwindow\.DN_PUZZLE=\{.*\};\n/, '\n');
    if (new RegExp('\\b' + d.answer + '\\b', 'i').test(outside)) errs.push(e.file + ' names its answer outside the puzzle data');
    if (new RegExp('\\b' + d.answer + '\\b', 'i').test(literal(p).replace(/sol:"[^"]*"/, ''))) errs.push(e.file + ' shows its answer in the clear');
  }
  return errs;
}
function writeThrough(through, opts) {
  opts = opts || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error('--through needs a date, YYYY-MM-DD');
  const bank = loadBank(), errs = check(bank);
  if (errs.length) throw new Error('fix the bank first:\n' + errs.join('\n'));
  const by = new Map(bank.bank.map(c => [c.answer, c])), list = existing(), out = [];
  const taken = new Set(list.map(e => e.date));
  let serial = list.length ? Math.max(...list.map(e => e.serial)) + 1 : 1, date;
  if (opts.from) { if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.from)) throw new Error('--from needs a date, YYYY-MM-DD'); date = opts.from; }
  else if (list.length) date = addDay(list.map(e => e.date).sort().pop(), 1);
  else throw new Error('no Cryptic pages yet: --from D0 names the first day');
  if (list.length && date !== addDay(list.map(e => e.date).sort().pop(), 1)) throw new Error('Cryptic runs one a day with no gaps: the next day is ' + addDay(list.map(e => e.date).sort().pop(), 1));
  for (; date <= through; serial++, date = addDay(date, 1)) {
    if (taken.has(date)) throw new Error('there is already a Cryptic on ' + date);
    const answer = bank.ledger.reserve.shift();
    if (!answer) throw new Error('the reserve is empty: write and cold-check a new batch first');
    const entry = by.get(answer), prev = bank.ledger.days[bank.ledger.days.length - 1];
    if (prev && by.get(prev.answer).type === entry.type) throw new Error(answer + ' would repeat the type ' + entry.type + ' two days running');
    const file = date + '-word-cryptic-' + pad(serial) + '.html';
    fs.writeFileSync(path.join(REPORTS, file), page({ serial, date, entry, lab: !!opts.lab }), { flag: 'wx' });
    bank.ledger.days.push({ serial, date, answer });
    out.push(file + ' ' + entry.type);
  }
  fs.writeFileSync(BANK, JSON.stringify(bank, null, 2) + '\n');
  return out;
}
if (require.main === module) {
  const a = process.argv.slice(2), arg = k => a.includes(k) ? a[a.indexOf(k) + 1] : null;
  if (a.includes('--check')) {
    const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
    const b = loadBank(); console.log('Cryptic: ' + b.bank.length + ' clues pass the gate; ' + existing().length + ' pages match the ledger; ' + b.ledger.reserve.length + ' in reserve');
  } else if (a.includes('--through')) {
    const out = writeThrough(arg('--through'), { from: arg('--from'), lab: a.includes('--lab') });
    console.log(out.join('\n') + '\n' + out.length + ' pages written');
    const errs = check(); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  } else { console.log('usage: --check | --through D [--from D0] [--lab]'); process.exit(2); }
}
module.exports = { page, literal, check, existing, readPage, writeThrough, loadBank };
