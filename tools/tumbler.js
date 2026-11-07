'use strict';
/* Tumbler: a hidden four-letter word on four letter wheels (Lab, 6 Nov 2026).

   Each wheel holds seven letters: its letter of the secret word and six decoys, in
   random order. The player turns wheels down to make any real word on the read line
   and submits it for Wordle feedback against the secret (green right letter right
   wheel, amber in the word on another wheel, grey not in it). Submitting the secret
   solves it; the clock is the score.

   Gate (Alec, 6 Nov 2026, after five prototype rounds and a 300-board simulation):
   - the secret is an everyday word (the Mini bank's common tiers) with four
     different letters, never a vetoed, unkind or acronym word;
   - 12–25 everyday words can be made on the line: enough real choices for the
     clues to matter (a 4×5 board made ~6 and played too easily), not a word hunt;
   - no offensive word, or offensive 3-letter run, can be spelt on the line at all,
     whether or not it is a listed word (the first boards could spell DICK and SCAG:
     the check looked only at listed words);
   - a bot that submits a random word consistent with all feedback so far needs a
     median of 2–4 submits and at most 5 in nine runs out of ten;
   - the secret is not on the read line at the start.

   Accepted submits (Alec, 6 Nov 2026, after the first plays): words in the Mini
   crossword's bank, every tier, less the banned, unkind and proper-noun words. The
   wide British list let players submit FOHN, FROE or YEAN and get clues from words
   nobody would try; the everyday tiers alone refused SCAR and POTS.
   Widened (Alec, 7 Nov 2026, after OBOE and DEAD were refused): plus the hand-screened
   tools/tumbler-extra-words.json (dictionary words with wordfreq Zipf >= 2.3), and the
   UNKIND screen now keeps those words out of secrets only: a player may submit DEAD,
   SICK or HATE, except the few in GUESS_NO (US spellings, slang, lynch, nazi).

   Puzzle record (the page's window.DN_PUZZLE, plain data):
     { type:"tumbler", id, band, n:4, wheels:["7 capitals" ×4], secret:"word",
       words:[every accepted word that can be made], seed }
   The page carries its own accepted-word list, so the player needs no dictionary. */
const R = require('./redact.js');
const N = 4, P = 7, READ = 1;
const BAND = { everyday: [12, 25], botMedian: [2, 4], botP90: 5 };
const UNKIND = new Set(['hate', 'kill', 'dead', 'gun', 'guns', 'drug', 'die', 'dies', 'bomb', 'gore', 'slay', 'lynch', 'hang', 'stab', 'evil', 'sick', 'ugly', 'fat',
  'prof', 'papa', 'mama', 'nope', 'yeah', 'okay', 'info', 'demo', 'memo', 'tech', 'euro', 'nazi', 'kiwi', 'tire', 'mold', 'plow', 'curb', 'mom', 'moms']);
/* names, abbreviations and odd entries in the Mini bank that a player shouldn't be able to submit */
const NAMES = new Set(['erie', 'laos', 'york', 'etna', 'exec', 'yeah', 'iowa', 'ohio', 'oslo', 'peru', 'rome', 'mali', 'chad', 'cuba', 'fiji', 'iran', 'iraq', 'nile', 'utah', 'asia', 'bali', 'java', 'eric', 'alan', 'jane', 'john', 'mary', 'paul', 'otto', 'nato', 'sars', 'rbis', 'soli', 'ness', 'deco', 'yuan', 'july', 'june', 'nuke', 'blah']);
/* spelt on the line, these read as rude or as drug slang even when they aren't accepted words */
const NASTY = new Set(['scag', 'skag', 'turd', 'piss', 'crap', 'smut', 'puke', 'shag', 'knob', 'cock', 'toke', 'wank', 'slut', 'twat', 'jizz', 'bums', 'poof', 'spaz', 'homo', 'fags', 'muff', 'pube', 'pimp', 'porn', 'meth', 'coke', 'damn', 'hell', 'fag', 'nazi', 'kkk', 'dong']);
/* UNKIND words a player still can't submit: the rest are ordinary words, only kept out of secrets */
const GUESS_NO = new Set(['lynch', 'prof', 'papa', 'mama', 'nope', 'yeah', 'okay', 'nazi', 'tire', 'mold', 'plow', 'curb', 'mom', 'moms']);
const EXTRA = require('./tumbler-extra-words.json').words;
const FREQ = 'eeeeeeaaaaarrrriiiooootttnnnsssllcuudpmhgbfywkvxzjq';

let CACHE = null;
function lists() {
  if (CACHE) return CACHE;
  const L = R.lists(), ok = w => !L.banned.has(w) && !UNKIND.has(w) && !NAMES.has(w) && !NASTY.has(w) && !L.offensive.has(w);
  /* secrets are drawn from the list as it stood for the first boards, so their seeds still make them; generate() skips any the screens now refuse */
  const base = L.answers[N].filter(w => !L.banned.has(w) && !UNKIND.has(w));
  const guess = w => !L.banned.has(w) && !GUESS_NO.has(w) && !NAMES.has(w) && !NASTY.has(w) && !L.offensive.has(w);
  const everyday = new Set(base.filter(ok)), known = new Set([...L.bank[N], ...EXTRA].filter(w => w.length === N && guess(w)));
  for (const w of everyday) known.add(w);
  const offensive = new Set([...L.offensive, ...NASTY]);
  CACHE = { wide: L.wide[N], everyday, known, offensive, secrets: base.filter(w => new Set(w).size === N).sort() };
  return CACHE;
}
function feedback(g, s) {
  const res = ['x', 'x', 'x', 'x'], left = {};
  for (let i = 0; i < N; i++) if (g[i] === s[i]) res[i] = 'g'; else left[s[i]] = (left[s[i]] || 0) + 1;
  for (let i = 0; i < N; i++) if (res[i] !== 'g' && left[g[i]]) { res[i] = 'a'; left[g[i]]--; }
  return res.join('');
}
function makeable(wheels, set) {
  const out = [];
  for (const a of wheels[0]) for (const b of wheels[1]) for (const c of wheels[2]) for (const d of wheels[3]) { const w = (a + b + c + d).toLowerCase(); if (set.has(w)) out.push(w); }
  return out.sort();
}
function rude(w, offensive) { for (let i = 0; i < N; i++) for (let j = i + 3; j <= N; j++) if (offensive.has(w.slice(i, j))) return true; return false; }
/* the first offensive string the wheels can spell on the line, listed word or not */
function spellsRude(wheels, offensive) {
  for (const a of wheels[0]) for (const b of wheels[1]) for (const c of wheels[2]) for (const d of wheels[3]) { const w = (a + b + c + d).toLowerCase(); if (rude(w, offensive)) return w; }
  return null;
}
function bot(words, secret, r) {
  let c = words.slice(), n = 0;
  while (n < 30) { const g = c[Math.floor(r() * c.length)]; n++; if (g === secret) return n; const f = feedback(g, secret); c = c.filter(w => feedback(g, w) === f); }
  return n;
}
/* the bots grade an everyday-word player, seeded by the board so a page grades the same every time */
function grade(p) {
  const { everyday } = lists(), ev = makeable(p.wheels, everyday), r = R.rng(R.hashSeed(p.wheels.join('') + p.secret));
  const runs = []; for (let i = 0; i < 150; i++) runs.push(bot(ev, p.secret, r)); runs.sort((a, b) => a - b);
  return { everyday: ev.length, botMedian: runs[75], botP90: runs[135] };
}
function check(p) {
  const errs = [], { known, everyday, offensive } = lists();
  if (!p || p.n !== N || !Array.isArray(p.wheels) || p.wheels.length !== N || p.wheels.some(w => typeof w !== 'string' || !new RegExp('^[A-Z]{' + P + '}$').test(w) || new Set(w).size !== P)) return ['malformed wheels'];
  if (typeof p.secret !== 'string' || p.secret.length !== N) return ['malformed secret'];
  if (!everyday.has(p.secret) || new Set(p.secret).size !== N) errs.push(p.secret + ' is not an everyday word with four different letters');
  for (let k = 0; k < N; k++) if (!p.wheels[k].includes(p.secret[k].toUpperCase())) errs.push('wheel ' + (k + 1) + ' lacks ' + p.secret[k]);
  const all = makeable(p.wheels, known);
  if (!Array.isArray(p.words) || p.words.join() !== all.join()) errs.push('the page’s word list is not every accepted word the wheels make');
  const bad = spellsRude(p.wheels, offensive); if (bad) errs.push('the line can spell something offensive: ' + bad);
  if (p.wheels.every((w, k) => w[READ] === p.secret[k].toUpperCase())) errs.push('the secret is on the line at the start');
  if (errs.length) return errs;   // the bots need a well-formed board
  const g = grade(p);
  if (g.everyday < BAND.everyday[0] || g.everyday > BAND.everyday[1]) errs.push(g.everyday + ' everyday words');
  if (g.botMedian < BAND.botMedian[0] || g.botMedian > BAND.botMedian[1] || g.botP90 > BAND.botP90) errs.push('bot ' + g.botMedian + '/' + g.botP90);
  return errs;
}
function generate(seed, opts) {
  opts = opts || {};
  const { known, everyday, offensive, secrets } = lists(), r = R.rng(R.hashSeed(seed)), avoid = opts.avoid || new Set();
  for (let t = 0; t < 3000; t++) {
    const secret = secrets[Math.floor(r() * secrets.length)];
    if (avoid.has(secret) || !everyday.has(secret)) continue;
    const wheels = [...secret].map(ch => { const x = new Set([ch]); while (x.size < P) x.add(FREQ[Math.floor(r() * FREQ.length)]); const a = [...x]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join('').toUpperCase(); });
    const ev = makeable(wheels, everyday);
    if (ev.length < BAND.everyday[0] || ev.length > BAND.everyday[1]) continue;
    if (spellsRude(wheels, offensive)) continue;
    const words = makeable(wheels, known);
    const p = { n: N, wheels, secret, words, seed };
    if (check(p).length) continue;
    p.grade = grade(p);
    return p;
  }
  return null;
}
module.exports = { N, P, READ, BAND, lists, feedback, makeable, spellsRude, grade, check, generate };
