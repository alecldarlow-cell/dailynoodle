#!/usr/bin/env node
'use strict';
/* tools/yarn-words.js — keep Yarn's word lists on the shared word rule (tools/word-rules.js), so Yarn and the
   daily Tangle accept the same words (Alec, 9 Nov 2026).
   Removes every refused word from Yarn's common (M) and rarer (B) lists, in place. The lists are front-coded:
   each entry is "<shared prefix length 0-9><rest>", in the order the page unpacks them.
   Usage: node tools/yarn-words.js [--check]   (--check writes nothing; exit 1 if a refused word is in a list) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { refused } = require('./word-rules.js');
const FILE = path.resolve(__dirname, '../reports/2026-10-24-quiz-yarn.html');
const DICT_RE = /\nconst DICT=(\{.*?\});\n/;

function unpack(s) { const r = []; let prev = ''; const re = /(\d)([a-z]*)/g; let m; while ((m = re.exec(s))) { const w = prev.slice(0, +m[1]) + m[2]; r.push(w); prev = w; } return r; }
function pack(words) {
  let out = '', prev = '';
  for (const w of words) { let k = 0; const max = Math.min(9, prev.length, w.length); while (k < max && prev[k] === w[k]) k++; out += k + w.slice(k); prev = w; }
  return out;
}

if (require.main === module) {
  const html = fs.readFileSync(FILE, 'utf8'), m = html.match(DICT_RE);
  if (!m) throw new Error('DICT line not found');
  const D = vm.runInNewContext('(' + m[1] + ')'), report = {};
  for (const k of ['M', 'B']) {
    const ws = unpack(D[k]);
    if (pack(ws) !== D[k]) throw new Error(k + ': repacking the current list does not give it back byte for byte');
    const gone = ws.filter(w => refused(w));
    report[k] = { before: ws.length, removed: gone.length, sample: gone.slice(0, 12) };
    D[k] = pack(ws.filter(w => !refused(w)));
  }
  console.log(JSON.stringify(report));
  const changed = report.M.removed + report.B.removed;
  if (process.argv.includes('--check')) process.exit(changed ? 1 : 0);
  if (changed) fs.writeFileSync(FILE, html.replace(DICT_RE, () => '\nconst DICT=' + JSON.stringify(D) + ';\n'));
}
module.exports = { unpack, pack };
