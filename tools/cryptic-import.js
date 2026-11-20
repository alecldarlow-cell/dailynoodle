'use strict';
/* Cryptic: add a hand-written batch of clues to the bank (15 Nov 2026).

   A batch is a text file in toolchain/cryptic-batches/, one clue a line (blank lines and # comments ignored):

     ANSWER | clue with its parts marked | type

   Marks in the clue (they are stripped from the clue the player sees):
     {…}        the definition (at one end)
     […]        the signpost (indicator)
     <…>        fodder used as written: an anagram's letters, the words a hidden answer sits in, a word read
                backwards, a word that loses a letter, the words whose first or alternate letters are taken
     (…=WORD)   a piece that stands for WORD: (pub=BAR). (…) alone means the words as written: (in), or,
                in a double definition, the second definition
   Any word left unmarked must be a link word (tools/cryptic.js LINKS).
   Types: anagram, hidden, charade, sounds, reversal, container, double, deletion, acrostic, alternate.

     node tools/cryptic-import.js <batch> --check            # parse and gate every line; exit 1 on any error
     node tools/cryptic-import.js <batch> --sheet [seed]     # the cold-solve sheet: "n. clue (enum)", shuffled; and the key, as JSON on stderr
     node tools/cryptic-import.js <batch> --add <results.json> --on YYYY-MM-DD
        results.json is {ANSWER: {solved, confidence, note}} from the independent cold solve. Only clues the solver
        got (solved === ANSWER) are added, each with its cold-solve record; the rest are listed and left out.
        New clues join the end of the reserve, spread so no type runs twice in a row.

   The parse and the two explanation lines the finish sheet shows are written here from the marks, so every clue
   of a type explains itself the same way. tools/build-cryptic-batch.js --check re-gates the whole bank. */
const fs = require('fs'), path = require('path');
const C = require('./cryptic.js');
const BANK = path.join(__dirname, 'cryptic-clues.json');
const q = s => '“' + s + '”';
const clean = s => s.replace(/^[\s,;:.!?—–-]+|[\s,;:.!?—–-]+$/g, '');

function parseLine(line, at) {
  const cols = line.split('|').map(s => s.trim());
  if (cols.length !== 3) throw new Error('line ' + at + ': needs ANSWER | clue | type');
  const [answer, marked, type] = cols;
  let clue = '', def = null, ind = null, fod = null; const parts = [];
  const nWords = () => C.words(clue).length;
  const re = /\{([^}]*)\}|\[([^\]]*)\]|<([^>]*)>|\(([^)]*)\)/g; let m, last = 0;
  while ((m = re.exec(marked))) {
    clue += marked.slice(last, m.index); last = re.lastIndex;
    const from = nWords(), inner = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
    let text = inner, gives = null;
    if (m[4] !== undefined) { const k = inner.lastIndexOf('='); if (k >= 0) { text = inner.slice(0, k); gives = inner.slice(k + 1).trim().toUpperCase(); } }
    clue += text;
    const sp = [from, nWords()];
    if (sp[1] <= sp[0]) throw new Error('line ' + at + ' (' + answer + '): an empty mark');
    if (m[1] !== undefined) { if (def) throw new Error('line ' + at + ': two definitions'); def = sp; }
    else if (m[2] !== undefined) { if (ind) throw new Error('line ' + at + ': two signposts'); ind = sp; }
    else if (m[3] !== undefined) { if (fod) throw new Error('line ' + at + ': two fodder spans'); fod = sp; }
    else parts.push({ w: sp, gives: gives || (type === 'double' ? answer : C.letters(text)), asWritten: !gives && type !== 'double' });
  }
  clue += marked.slice(last);
  clue = clue.replace(/\s+/g, ' ').trim();
  if (!def) throw new Error('line ' + at + ' (' + answer + '): no {definition}');
  const c = { answer, enum: String(answer.length), clue, type, def, ind: ind || null };
  if (fod) c.fod = fod;
  if (parts.length) c.parts = parts;
  return explain(c);
}

/* the parse and the two lines the finish sheet shows (Signpost, Wordplay) */
function explain(c) {
  // a span's words as the clue has them, without the capital a clue's first word carries (proper names keep theirs)
  const PROPER = /^(Italian|Irish|British|Halloween|TV|Christmas|Sir|Oscar|Scrabble|London|England|Kent|May|I)\b/;
  const A = c.answer, W = C.words(c.clue), text = sp => { const t = clean(c.clue.slice(W[sp[0]].at, W[sp[1] - 1].end)); return sp[0] === 0 && !PROPER.test(t) ? t[0].toLowerCase() + t.slice(1) : t; };
  const D = q(text(c.def)), I = c.ind ? q(text(c.ind)) : '', F = c.fod ? C.letters(text(c.fod)) : '';
  const piece = p => p.gives + (p.asWritten ? ' (as written)' : ' (' + text(p.w) + ')');
  let sign, play;
  const t = c.type;
  if (t === 'anagram') { sign = I + ' says the letters of ' + text(c.fod).toUpperCase() + ' are jumbled.'; play = text(c.fod).toUpperCase() + ' rearranged → ' + A + ' (' + D + ').'; }
  else if (t === 'hidden') {
    const raw = text(c.fod).toLowerCase(), flat = []; for (let i = 0; i < raw.length; i++) if (/[a-z]/.test(raw[i])) flat.push(i);
    const at = flat.map(i => raw[i]).join('').toUpperCase().indexOf(A), on = new Set(at < 0 ? [] : flat.slice(at, at + A.length));
    sign = I + ' says the answer is hidden in the words beside it.';
    play = raw.split('').map((ch, i) => on.has(i) ? ch.toUpperCase() : ch).join('') + ' → ' + A + ' (' + D + ').';
  } else if (t === 'charade') { sign = 'No signpost: the pieces sit side by side.'; play = c.parts.map(piece).join(' + ') + ' = ' + A + ' (' + D + ').'; }
  else if (t === 'container') {
    // which piece goes around the other is worked out here; the outer one is listed first
    const fits = (o, i) => { o = C.letters(o.gives); i = C.letters(i.gives); for (let k = 1; k < o.length; k++) if (o.slice(0, k) + i + o.slice(k) === A) return true; return false; };
    if (c.parts && c.parts.length === 2 && !fits(c.parts[0], c.parts[1]) && fits(c.parts[1], c.parts[0])) c.parts.reverse();
    sign = I + ' says one piece goes inside another.';
    play = c.parts && c.parts.length === 2 ? piece(c.parts[0]) + ' around ' + piece(c.parts[1]) + ' → ' + A + ' (' + D + ').' : '';
  } else if (t === 'reversal') { sign = I + ' says a word is read backwards.'; play = (c.fod ? F : piece(c.parts[0])) + ' backwards → ' + A + ' (' + D + ').'; }
  else if (t === 'sounds') { sign = I + ' says the answer sounds like another word.'; play = piece(c.parts[0]) + ' sounds like ' + A + ' (' + D + ').'; }
  else if (t === 'double') { sign = 'No signpost: the clue is two definitions of one word.'; play = D + ' and ' + q(text(c.parts[0].w)) + ' both mean ' + A + '.'; }
  else if (t === 'deletion') {
    const src = c.fod ? F : C.letters(c.parts[0].gives); c.cut = C.cutOf(src, A) || 'head';
    const which = { head: 'first', tail: 'last', middle: 'middle' }[c.cut];
    sign = I + ' says a word loses its ' + which + ' letter.';
    play = (c.fod ? F : piece(c.parts[0])) + ' without its ' + which + ' letter → ' + A + ' (' + D + ').';
  } else if (t === 'acrostic') {
    sign = I + ' says take the first letter of each word beside it.';
    play = W.slice(c.fod[0], c.fod[1]).map(x => { const w = c.clue.slice(x.at, x.end); return w[0].toUpperCase() + w.slice(1).toLowerCase(); }).join(' ') + ' → ' + A + ' (' + D + ').';
  } else if (t === 'alternate') {
    const f = C.letters(text(c.fod)), from = C.everyOther(f, 0) === A ? 0 : 1;
    sign = I + ' says take every other letter.';
    play = f.split('').map((ch, i) => i % 2 === from ? ch : ch.toLowerCase()).join('') + ' → ' + A + ' (' + D + ').';
  } else { sign = ''; play = ''; }
  (c.parts || []).forEach(p => { delete p.asWritten; });
  c.parse = (C.TYPES[t] || t) + ': ' + play.replace(/ \(“[^”]*”\)\.$/, '').replace(/\.$/, '');
  c.explain = [sign, play];
  return c;
}

function readBatch(file) {
  const out = [], errs = [];
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    try { out.push(parseLine(line, i + 1)); } catch (e) { errs.push(e.message); }
  });
  return { entries: out, errs };
}
function gate(entries, bank) {
  const errs = [], veto = C.vetoSet(), seen = new Map((bank ? bank.bank : []).map(c => [c.answer, 'the bank']));
  for (const c of entries) {
    for (const e of C.checkEntry(c, veto)) errs.push(c.answer + ': ' + e + '  [' + c.clue + ']');
    if (seen.has(c.answer)) errs.push(c.answer + ' is already in ' + seen.get(c.answer)); else seen.set(c.answer, 'this batch');
  }
  return errs;
}
/* deterministic shuffle for the cold-solve sheet, so the order gives no type away */
function shuffled(list, seed) {
  let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const out = list.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
/* spread the types evenly, never the same type twice running (prev: the type just before these) */
function arrange(entries, prev) {
  const by = {}; for (const c of entries) (by[c.type] = by[c.type] || []).push(c);
  const types = Object.keys(by).sort(), total = entries.length, credit = Object.fromEntries(types.map(t => [t, 0])), out = [];
  const size = Object.fromEntries(types.map(t => [t, by[t].length]));
  while (out.length < total) {
    for (const t of types) if (by[t].length) credit[t] += size[t];
    const pick = types.filter(t => by[t].length && t !== prev).sort((a, b) => credit[b] - credit[a] || a.localeCompare(b))[0];
    if (!pick) throw new Error('cannot arrange without repeating a type: only ' + prev + ' clues are left');
    credit[pick] -= total; out.push(by[pick].shift()); prev = pick;
  }
  return out;
}
if (require.main === module) {
  const a = process.argv.slice(2), file = a[0], arg = k => a.includes(k) ? a[a.indexOf(k) + 1] : null;
  if (!file || !fs.existsSync(file)) { console.log('usage: cryptic-import.js <batch> --check | --sheet [seed] | --add <results.json> --on YYYY-MM-DD'); process.exit(2); }
  const bank = JSON.parse(fs.readFileSync(BANK, 'utf8')), { entries, errs } = readBatch(file);
  errs.push(...gate(entries, bank));
  if (a.includes('--check')) {
    if (errs.length) { console.error(errs.join('\n')); console.error(errs.length + ' problems'); process.exit(1); }
    const n = {}; for (const c of entries) n[c.type] = (n[c.type] || 0) + 1;
    console.log(entries.length + ' clues pass the gate: ' + Object.entries(n).map(([t, k]) => t + ' ' + k).join(', '));
  } else if (a.includes('--sheet')) {
    if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
    const order = shuffled(entries, arg('--sheet') || 'sheet');
    console.log(order.map((c, i) => (i + 1) + '. ' + c.clue + ' (' + c.enum + ')').join('\n'));
    console.error(JSON.stringify(order.map(c => c.answer)));
  } else if (a.includes('--add')) {
    if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
    const on = arg('--on'), res = JSON.parse(fs.readFileSync(arg('--add'), 'utf8'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on || '')) throw new Error('--on needs the date of the cold solve');
    const ok = [], out = [];
    for (const c of entries) {
      const r = res[c.answer];
      if (r && r.solved === c.answer) { c.checked = { on, solved: r.solved, confidence: r.confidence || 'high' }; if (r.note) c.checked.note = r.note; ok.push(c); }
      else out.push(c.answer + ': ' + (r ? 'solver found ' + r.solved : 'not cold-solved'));
    }
    const byA = new Map(bank.bank.map(c => [c.answer, c])), L = bank.ledger;
    const tail = L.reserve.length ? L.reserve[L.reserve.length - 1] : (L.days.length ? L.days[L.days.length - 1].answer : null);
    const placed = arrange(ok, tail ? byA.get(tail).type : null);
    bank.bank.push(...placed); L.reserve.push(...placed.map(c => c.answer));
    fs.writeFileSync(BANK, C.bankText(bank));
    console.log(placed.length + ' clues added to the bank and the reserve' + (out.length ? '; left out:\n' + out.join('\n') : ''));
  }
}
module.exports = { parseLine, explain, readBatch, gate, arrange, shuffled };
