'use strict';
/* Cryptic (engines/cryptic.js; Lab pages reports/*-word-cryptic-NNNN.html, built 12 Nov 2026): the clue bank, ledger and
   every page pass tools/build-cryptic-batch.js's gate; the gate refuses broken clues; the answer never shows outside
   the page's wrapped data. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const C = require(path.join(ROOT, 'tools/cryptic.js'));
const B = require(path.join(ROOT, 'tools/build-cryptic-batch.js'));

test('CRYPTIC-01: the bank, the ledger and every page pass the gate', () => {
  assert.ok(B.existing().length >= 14, 'the fourteen Lab days');
  assert.deepStrictEqual(B.check(), []);
  const bank = B.loadBank();
  for (const e of B.existing()) assert.deepStrictEqual(C.check(B.readPage(e.file)), [], e.file);
  assert.ok(bank.ledger.reserve.length >= 1, 'a reserve is kept');
});

test('CRYPTIC-02: the clue gate refuses broken clues', () => {
  const base = { answer: 'STUDY', enum: '5', clue: 'Dusty, messy den', type: 'anagram', def: [2, 3], ind: [1, 2], fod: [0, 1], parse: 'x', explain: ['a', 'b'] };
  const errs = (patch) => C.checkEntry(Object.assign({}, base, patch));
  assert.deepStrictEqual(errs({}), []);
  assert.ok(errs({ enum: '6' }).some(e => /enumeration/.test(e)));
  assert.ok(errs({ clue: 'Dusty messy den here', def: [1, 2], ind: [2, 3], fod: [0, 1] }).some(e => /one end/.test(e)));
  assert.ok(errs({ answer: 'STUDS' }).some(e => /anagram/.test(e)));
  assert.ok(errs({ explain: ['only one'] }).some(e => /two explanation/.test(e)));
  assert.ok(errs({ type: 'pun' }).some(e => /unknown clue type/.test(e)));
  // a hidden word must really be there, and not overlap the definition
  const hid = { answer: 'CABIN', enum: '5', clue: 'Hut found in taxicab interior', type: 'hidden', def: [0, 1], ind: [1, 3], fod: [3, 5], parse: 'x', explain: ['a', 'b'] };
  assert.deepStrictEqual(C.checkEntry(hid), []);
  assert.ok(C.checkEntry(Object.assign({}, hid, { clue: 'Hut found in taxicar interior' })).some(e => /hidden/.test(e)));
  // a sound-alike whose partner has the answer's length lets the wrong twin shake: refused
  const snd = { answer: 'PLAIN', enum: '5', clue: 'Simple aircraft, we hear', type: 'sounds', def: [0, 1], ind: [2, 4], parts: [{ w: [1, 2], gives: 'PLANE' }], parse: 'x', explain: ['a', 'b'] };
  assert.ok(C.checkEntry(snd).some(e => /length/.test(e)));
  // charades and containers must build the answer
  assert.ok(C.checkEntry({ answer: 'WARDEN', enum: '6', clue: 'Battle lair for keeper', type: 'charade', def: [3, 4], ind: null, parts: [{ w: [0, 1], gives: 'WAR' }, { w: [1, 2], gives: 'DEB' }], parse: 'x', explain: ['a', 'b'] }).some(e => /join/.test(e)));
  assert.ok(C.checkEntry({ answer: 'SWEAT', enum: '5', clue: 'Sat outside, we perspire', type: 'container', def: [3, 4], ind: [1, 2], parts: [{ w: [0, 1], gives: 'SIT' }, { w: [2, 3], gives: 'WE' }], parse: 'x', explain: ['a', 'b'] }).some(e => /inner/.test(e)));
  // nothing blocked, in the clue or the answer
  assert.ok(errs({ clue: 'Dusty, messy hell den', def: [3, 4], ind: [1, 2], fod: [0, 1] }).some(e => /blocked/.test(e)));
});

test('CRYPTIC-03: the answer travels wrapped, and never shows outside the puzzle data', () => {
  for (const e of B.existing()) {
    const html = fs.readFileSync(path.join(ROOT, 'reports', e.file), 'utf8'), p = B.readPage(e.file), s = C.unwrap(p.sol, p.id);
    assert.match(s.a, /^[A-Z]{4,8}$/);
    assert.strictEqual(C.wrap(s, p.id), p.sol, 'the wrap round-trips');
    assert.ok(!new RegExp('\\b' + s.a + '\\b', 'i').test(html), e.file + ' shows its answer');
    assert.ok(!html.includes(s.parse), e.file + ' shows its parse');
    assert.ok(/<meta name="dn:badge"\s+content="In development">/.test(html), e.file + ' is a Lab page');
  }
});

test('CRYPTIC-04: the ledger refuses a repeated answer or the same type two days running', () => {
  const bank = B.loadBank(), clone = () => JSON.parse(JSON.stringify(bank));
  let b = clone(); b.ledger.reserve.push(b.ledger.reserve[0]);
  assert.ok(B.check(b).some(e => /twice/.test(e)));
  // put a reserve clue of the last dated day's type at the front of the reserve
  b = clone(); const r = b.ledger.reserve, by = new Map(b.bank.map(c => [c.answer, c])), last = b.ledger.days[b.ledger.days.length - 1];
  const i = r.findIndex(a => by.get(a).type === by.get(last.answer).type);
  assert.ok(i > 0, 'the reserve holds another clue of that type');
  r.unshift(r.splice(i, 1)[0]);
  assert.ok(B.check(b).some(e => /twice running/.test(e)));
});

/* 15 Nov 2026: three more clue types (deletion, first letters, alternate letters), the every-word-earns-its-place rule,
   and the batch format that tools/cryptic-import.js reads (toolchain/cryptic-batches/). */
const I = require(path.join(ROOT, 'tools/cryptic-import.js'));

test('CRYPTIC-05: deletions, first letters and alternate letters are gated, and a stray word is refused', () => {
  const one = line => I.parseLine(line, 1), errs = line => C.checkEntry(one(line));
  assert.deepStrictEqual(errs('LEASE | <Please> [don\'t start] to {rent} | deletion'), []);
  assert.strictEqual(one('LEASE | <Please> [don\'t start] to {rent} | deletion').cut, 'head');
  assert.strictEqual(one('PLAN | [Unfinished] <plane> {design} | deletion').cut, 'tail');
  assert.strictEqual(one('NICE | [Heartless] <niece> is {pleasant} | deletion').cut, 'middle');
  assert.strictEqual(one('COST | (Shore=COAST) [loses heart], {price} | deletion').cut, 'middle');
  assert.ok(errs('NICE | [Heartless] <nieces> is {pleasant} | deletion').some(e => /removing/.test(e)));
  assert.deepStrictEqual(errs('PIANO | {Instrument} [starts to] <play in a new orchestra> | acrostic'), []);
  assert.ok(errs('PIANO | {Instrument} [starts to] <play in a big orchestra> | acrostic').some(e => /first letters/.test(e)));
  assert.deepStrictEqual(errs('POET | <Protect>, [regularly], {a writer of verse} | alternate'), []);
  assert.deepStrictEqual(errs('LADY | <Clear day> [regularly] for {gentlewoman} | alternate'), []);   // the even letters
  assert.ok(errs('POET | <Proteins>, [regularly], {a writer of verse} | alternate').some(e => /every other/.test(e)));
  // every word earns its place: "the" is neither definition, signpost, wordplay nor a link word
  assert.ok(errs('STUDY | <Dusty>, [messy] the {den} | anagram').some(e => /does no work/.test(e)));
  assert.deepStrictEqual(errs('BREAD | <Beard> [tangled] in {loaf} | anagram'), []);
  // a reversal may use a word the clue only hints at
  assert.deepStrictEqual(errs('STAR | (Rodents=RATS) [return] with {celebrity} | reversal'), []);
  // the page record of each new type passes the page gate, with letters to mark on the finish sheet
  for (const line of ['LEASE | <Please> [don\'t start] to {rent} | deletion', 'PIANO | {Instrument} [starts to] <play in a new orchestra> | acrostic', 'POET | <Protect>, [regularly], {a writer of verse} | alternate']) {
    const c = one(line), p = C.pageData(c, 'DP·CRYP·0999');
    assert.deepStrictEqual(C.check(p), [], line);
    const s = C.unwrap(p.sol, p.id), marked = s.mark.map(([a, b]) => c.clue.slice(a, b)).join('').toUpperCase();
    if (c.type !== 'deletion') assert.strictEqual(marked, c.answer, line); else assert.strictEqual(marked, 'PLEASE');
  }
});

test('CRYPTIC-06: the batch files still make the bank\'s clues, a container lists its outer piece first, and types never run twice', () => {
  const bank = B.loadBank(), by = new Map(bank.bank.map(c => [c.answer, c])), dir = path.join(ROOT, 'toolchain/cryptic-batches');
  let n = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt'))) {
    const { entries, errs } = I.readBatch(path.join(dir, f));
    assert.deepStrictEqual(errs, [], f);
    for (const c of entries) {
      const b = by.get(c.answer); assert.ok(b, c.answer + ' of ' + f + ' is in the bank');
      for (const k of ['clue', 'type', 'def', 'ind', 'parse', 'explain']) assert.deepStrictEqual(b[k], c[k], c.answer + ' ' + k);
      n++;
    }
  }
  assert.ok(n >= 340, 'the year-one batch');
  assert.ok(bank.bank.length >= 365, 'a year of clues');
  const c = I.parseLine('HEATER | (Dine=EAT) [in] (her) {radiator} | container', 1);
  assert.deepStrictEqual(c.parts.map(p => p.gives), ['HER', 'EAT']);
  assert.strictEqual(c.explain[1], 'HER (as written) around EAT (dine) → HEATER (“radiator”).');
  const placed = I.arrange(bank.bank.slice(24), 'reversal');
  for (let i = 1; i < placed.length; i++) assert.notStrictEqual(placed[i].type, placed[i - 1].type);
  assert.notStrictEqual(placed[0].type, 'reversal');
  // the bank file is written one clue a line, and writing it again changes nothing
  assert.strictEqual(C.bankText(bank), fs.readFileSync(path.join(ROOT, 'tools/cryptic-clues.json'), 'utf8'));
});
