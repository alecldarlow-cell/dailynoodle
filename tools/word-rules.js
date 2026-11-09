'use strict';
/* tools/word-rules.js — one word rule for the daily Tangle and Yarn (Alec, 9 Nov 2026: "align the lists").
   A word is accepted unless the shared blocklist (tools/word-blocklist.json: stems and exact words, plus the
   HOUSE list in build-tangle-batch.js) or tools/word-rejects.json turns it down. tools/tangle-extra-words.json
   outranks both: everyday words the blocklist stems would catch (Alec, 5 Nov 2026: no slurs; a word with an
   innocent everyday meaning is fine). Used by Yarn's tests and tools/yarn-words.js; the daily Tangle's
   lists are checked against it by tools/tests/unit/tangle-words.test.js. */
const fs = require('fs'), path = require('path');
const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const BL = read('word-blocklist.json'), REJ = new Set(read('word-rejects.json').words), EXTRA = new Set(read('tangle-extra-words.json').words);
const HOUSE = fs.readFileSync(path.join(__dirname, 'build-tangle-batch.js'), 'utf8').match(/const HOUSE = (\[[\s\S]*?\]);/)[1]
  .replace(/\/\/.*$/gm, '').match(/"[a-z]+"/g).map(s => s.slice(1, -1));
const WORDS = new Set(BL.words.concat(HOUSE));
/** why a word is refused ('' when accepted) */
function refused(w) {
  if (EXTRA.has(w)) return '';
  if (WORDS.has(w)) return 'blocked word';
  const st = BL.stems.find(s => w.startsWith(s)); if (st) return 'blocked stem ' + st;
  if (REJ.has(w)) return 'rejected';
  return '';
}
const accepted = w => !refused(w);
module.exports = { accepted, refused, EXTRA, REJ, HOUSE };
