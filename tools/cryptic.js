'use strict';
/* Cryptic (Lab, built 12 Nov 2026): one hand-written cryptic clue a day. The clue bank and ledger are
   tools/cryptic-clues.json; pages are written by tools/build-cryptic-batch.js; the player is engines/cryptic.js.

   A page carries, in the clear, only what the player shows before the answer: the clue, the enumeration,
   the definition span (hint 1), the clue type and its signpost span (hint 2). The answer, the parse, the
   letters to mark and the two explanation lines travel in `sol`, a small XOR-and-base64 wrap keyed on the
   page id, so a look at the page source (or a search snippet) doesn't hand over the answer. It is not
   security, only "no spoilers on sight": the answer has to be in the page for the player to check it.

   check(p) is the ship gate, re-run on every page by build-cryptic-batch.js --check and tools/tests/content.js. */
const TYPES = { anagram: 'Anagram', hidden: 'Hidden word', charade: 'Charade', sounds: 'Sounds like', reversal: 'Reversal', container: 'Container', double: 'Double definition' };

/* the clue's words, punctuation ignored, with each word's [start, end) in the clue string */
function words(clue) {
  const out = []; const re = /[A-Za-z’']+/g; let m;
  while ((m = re.exec(clue))) out.push({ w: m[0].replace(/[’']/g, ''), at: m.index, end: m.index + m[0].length });
  return out;
}
const letters = s => String(s).toUpperCase().replace(/[^A-Z]/g, '');
const spanText = (clue, sp) => { const W = words(clue); return W.slice(sp[0], sp[1]).map(x => x.w).join(' '); };
const spanChars = (clue, sp) => { const W = words(clue); return [W[sp[0]].at, W[sp[1] - 1].end]; };
const enumLen = e => String(e).split(/[,-]/).reduce((n, x) => n + (+x || 0), 0);
const sorted = s => letters(s).split('').sort().join('');

/* the letters to mark marigold on the finish sheet ("How it works"): [start, end) ranges in the clue */
function marks(c) {
  if (c.type === 'hidden') {
    const [a, b] = spanChars(c.clue, c.fod), text = c.clue.slice(a, b);
    const flat = []; for (let i = 0; i < text.length; i++) if (/[A-Za-z]/.test(text[i])) flat.push(a + i);
    const at = flat.map(i => c.clue[i].toUpperCase()).join('').indexOf(c.answer);
    if (at < 0) return [];
    const idx = flat.slice(at, at + c.answer.length), out = [];
    for (const i of idx) { const last = out[out.length - 1]; if (last && !/[A-Za-z]/.test(c.clue.slice(last[1], i))) last[1] = i + 1; else out.push([i, i + 1]); }   // one run across spaces, as the mock
    return out;
  }
  if (c.fod) return [spanChars(c.clue, c.fod)];
  if (c.type === 'double') return [];
  return (c.parts || []).map(p => spanChars(c.clue, p.w));
}

/* ---- the wrap ---- */
function wrap(obj, id) {
  const key = Buffer.from(String(id), 'utf8'), data = Buffer.from(JSON.stringify(obj), 'utf8');
  for (let i = 0; i < data.length; i++) data[i] ^= key[i % key.length];
  return data.toString('base64');
}
function unwrap(s, id) {
  const key = Buffer.from(String(id), 'utf8'), data = Buffer.from(String(s), 'base64');
  for (let i = 0; i < data.length; i++) data[i] ^= key[i % key.length];
  return JSON.parse(data.toString('utf8'));
}

/* ---- the bank entry gate (the brief's quality rules that a machine can check) ---- */
function vetoSet() {
  const v = require('./word-veto'), set = new Set([...v.BLOCKED, ...v.SENSITIVE, ...v.VETO]);
  let stems = [];
  try { const b = require('./word-blocklist.json'); for (const w of b.words || []) set.add(String(w).toLowerCase()); stems = (b.stems || []).map(x => String(x).toLowerCase()); } catch (e) {}
  return { has: w => set.has(w) || stems.some(st => w.startsWith(st)) };   // the Tangle kit's stems block every word they start
}
function checkEntry(c, veto) {
  const errs = [], A = c.answer, W = words(c.clue || ''), n = W.length;
  veto = veto || vetoSet();
  const span = (sp, what) => { if (!Array.isArray(sp) || sp.length !== 2 || !(sp[0] >= 0 && sp[1] > sp[0] && sp[1] <= n)) { errs.push(what + ' span is not words of the clue'); return false; } return true; };
  if (typeof A !== 'string' || !/^[A-Z]{4,8}$/.test(A)) errs.push('answer must be 4–8 capitals');
  if (enumLen(c.enum) !== (A || '').length) errs.push('enumeration (' + c.enum + ') does not match the answer’s length');
  if (!TYPES[c.type]) errs.push('unknown clue type ' + c.type);
  if (!c.parse || !String(c.parse).trim()) errs.push('no parse');
  if (!Array.isArray(c.explain) || c.explain.length !== 2 || c.explain.some(l => !String(l || '').trim())) errs.push('needs two explanation lines');
  if (span(c.def, 'definition') && c.def[0] !== 0 && c.def[1] !== n) errs.push('the definition is not at one end of the clue');
  const needsInd = !['charade', 'double'].includes(c.type);
  if (needsInd) { if (!c.ind) errs.push('a ' + c.type + ' needs a signpost'); else span(c.ind, 'signpost'); }
  else if (c.ind) errs.push('a ' + c.type + ' has no signpost');
  // the clue must not show the answer, except where it is hidden in the fodder (and never as a whole word)
  if (W.some(x => x.w.toUpperCase() === A)) errs.push('the clue contains the answer as a word');
  if (c.type !== 'hidden' && letters(c.clue).includes(A)) errs.push('the answer can be read straight off the clue');
  for (const x of W) if (veto.has(x.w.toLowerCase())) errs.push('blocked word in the clue: ' + x.w);
  if (veto.has(String(A).toLowerCase())) errs.push('the answer is on the blocklist');
  // the wordplay must give exactly the answer
  const t = c.type;
  if (t === 'anagram' || t === 'hidden' || t === 'reversal') {
    if (span(c.fod, 'fodder')) {
      const f = letters(spanText(c.clue, c.fod));
      if (t === 'anagram' && (sorted(f) !== sorted(A) || f === A)) errs.push('the anagram’s letters do not match the answer');
      if (t === 'hidden' && (!f.includes(A) || spanText(c.clue, c.fod).split(' ').some(w => letters(w) === A))) errs.push('the answer is not hidden across the fodder');
      if (t === 'reversal' && f.split('').reverse().join('') !== A) errs.push('the reversal does not give the answer');
      if (t === 'hidden' && c.fod[0] < c.def[1] && c.fod[1] > c.def[0]) errs.push('the hidden word overlaps the definition');
    }
  } else if (t === 'charade') {
    if (!Array.isArray(c.parts) || c.parts.length < 2) errs.push('a charade needs two or more parts');
    else { c.parts.forEach((p, i) => span(p.w, 'part ' + (i + 1))); if (c.parts.map(p => letters(p.gives)).join('') !== A) errs.push('the charade’s parts do not join to the answer'); }
  } else if (t === 'container') {
    if (!Array.isArray(c.parts) || c.parts.length !== 2) errs.push('a container needs an outer and an inner part');
    else {
      c.parts.forEach((p, i) => span(p.w, 'part ' + (i + 1)));
      const o = letters(c.parts[0].gives), i = letters(c.parts[1].gives);
      let ok = false; for (let k = 1; k < o.length; k++) if (o.slice(0, k) + i + o.slice(k) === A) ok = true;
      if (!ok) errs.push('the inner part inside the outer does not give the answer');
    }
  } else if (t === 'sounds') {
    if (!Array.isArray(c.parts) || c.parts.length !== 1) errs.push('a sound-alike needs the word it sounds like');
    else {
      span(c.parts[0].w, 'sounds-like part');
      const g = letters(c.parts[0].gives);
      if (g === A) errs.push('the sound-alike is the answer itself');
      // 12 Nov 2026: the answer is checked letter for letter, so a sound-alike whose partner has the same
      // length (PLAIN/PLANE, BREAK/BRAKE) lets a fair guess shake as wrong. Partners must differ in length.
      if (g.length === A.length) errs.push('the sound-alike’s partner (' + g + ') has the answer’s length, so the wrong twin would be a fair entry');
    }
  } else if (t === 'double') {
    if (!Array.isArray(c.parts) || c.parts.length !== 1) errs.push('a double definition needs its second definition');
    else if (span(c.parts[0].w, 'second definition') && c.parts[0].w[0] < c.def[1] && c.parts[0].w[1] > c.def[0]) errs.push('the two definitions overlap');
  }
  // spans must not overlap the definition (bar a double definition's two halves, checked above)
  for (const [name, sp] of [['signpost', c.ind], ['fodder', c.fod]].concat((c.parts || []).map((p, i) => ['part ' + (i + 1), p.w])))
    if (Array.isArray(sp) && c.type !== 'double' && sp[0] < c.def[1] && sp[1] > c.def[0]) errs.push(name + ' overlaps the definition');
  return errs;
}

/* ---- the page record ---- */
function pageData(c, id, serial) {
  return {
    type: 'cryptic', id, band: 'medium', n: c.answer.length, clue: c.clue, enum: String(c.enum), kind: c.type,
    def: c.def, ind: c.ind || null,
    sol: wrap({ a: c.answer, parse: c.parse, explain: c.explain, mark: marks(c), def: spanChars(c.clue, c.def), sec: c.type === 'double' ? spanChars(c.clue, c.parts[0].w) : null }, id)
  };
}
/* the gate for a page record, alone (the bank match is the batch tool's) */
function check(p) {
  const errs = [];
  if (!p || p.type !== 'cryptic') return ['not a cryptic record'];
  if (!/^DP·CRYP·\d{4}$/.test(p.id || '')) errs.push('bad id ' + p.id);
  let s;
  try { s = unwrap(p.sol, p.id); } catch (e) { return errs.concat('the answer data does not unwrap with this page’s id'); }
  const A = String(s.a || ''), W = words(p.clue || ''), n = W.length, veto = vetoSet();
  if (!/^[A-Z]{4,8}$/.test(A)) errs.push('answer must be 4–8 capitals');
  if (p.n !== A.length || enumLen(p.enum) !== A.length) errs.push('the enumeration does not match the answer’s length');
  if (!TYPES[p.kind]) errs.push('unknown clue type ' + p.kind);
  if (!Array.isArray(p.def) || !(p.def[0] >= 0 && p.def[1] > p.def[0] && p.def[1] <= n) || (p.def[0] !== 0 && p.def[1] !== n)) errs.push('the definition is not at one end of the clue');
  if (['charade', 'double'].includes(p.kind) ? !!p.ind : !(Array.isArray(p.ind) && p.ind[0] >= 0 && p.ind[1] > p.ind[0] && p.ind[1] <= n)) errs.push('signpost span wrong for a ' + p.kind);
  if (!s.parse || !Array.isArray(s.explain) || s.explain.length !== 2) errs.push('no parse or explanation');
  if (W.some(x => x.w.toUpperCase() === A) || (p.kind !== 'hidden' && letters(p.clue).includes(A))) errs.push('the answer shows in the clear');
  for (const x of W) if (veto.has(x.w.toLowerCase())) errs.push('blocked word in the clue: ' + x.w);
  if (veto.has(A.toLowerCase())) errs.push('the answer is on the blocklist');
  return errs;
}
module.exports = { TYPES, words, letters, spanText, spanChars, enumLen, marks, wrap, unwrap, checkEntry, vetoSet, pageData, check };
