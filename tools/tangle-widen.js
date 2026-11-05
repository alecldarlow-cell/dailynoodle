#!/usr/bin/env node
/* tools/tangle-widen.js — add tools/tangle-extra-words.json to forthcoming daily Tangles' rarer lists.

   A word joins a board's `bonus` only if it traces on that board and is shorter than the star: the
   star must stay the unique longest word (engine GATE, and the longest-word pill says its length).
   Only the bonus array on the DN_PUZZLE line changes. Today and the next two days are never touched.
   Idempotent.  Usage: node tools/tangle-widen.js [--from YYYY-MM-DD] [--check]   (--check writes nothing, exit 1 if a board needs it) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { traceable, extrasFor } = require('./build-tangle-batch.js');
const REPORTS = path.resolve(__dirname, '../reports');
const args = process.argv.slice(2), arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const london = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const addDay = (d, k) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };
const earliest = addDay(london, 3), from = arg('--from') || earliest;
if (from < earliest) { console.error(`refusing: boards before ${earliest} are not edited`); process.exit(1); }
const byLen = (a, b) => a.length - b.length || (a < b ? -1 : 1);
let boards = 0, changed = 0, added = 0;
for (const f of fs.readdirSync(REPORTS).filter(n => /^\d{4}-\d{2}-\d{2}-word-tangle-\d{4}\.html$/.test(n)).sort()) {
  if (f.slice(0, 10) < from) continue;
  const p = path.join(REPORTS, f), s = fs.readFileSync(p, 'utf8'), m = s.match(/window\.DN_PUZZLE=(\{.*\});/);
  if (!m) throw new Error('no DN_PUZZLE line: ' + f);
  const P = vm.runInNewContext('(' + m[1] + ')'); boards++;
  const add = extrasFor(P, traceable);
  if (!add.length) continue;
  changed++; added += add.length;
  const old = 'bonus:' + JSON.stringify(P.bonus) + '}', neu = 'bonus:' + JSON.stringify(P.bonus.concat(add).sort(byLen)) + '}';
  const out = s.replace(old, () => neu);
  if (out === s) throw new Error('bonus list not found: ' + f);
  if (!args.includes('--check')) fs.writeFileSync(p, out);
}
console.log(JSON.stringify({ from, boards, changed, added }));
if (args.includes('--check') && changed) process.exit(1);
