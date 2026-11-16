'use strict';
/* Reckon's imperial switch (16 Nov 2026). Display only: guesses are kept and scored in the fact's own
   metric unit, so a guess must score the same whichever way it was shown, and every converted question
   must read cleanly. The block is run on its own, exactly as the engine carries it. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../../..');
const { read } = require('../read-puzzle');
const ENGINE = fs.readFileSync(path.join(ROOT, 'engines/reckon.js'), 'utf8');
function slice(src, from, to) { const a = src.indexOf(from), b = src.indexOf(to, a); assert.ok(a >= 0 && b > a, 'markers ' + from); return src.slice(a, b); }
const cx = vm.createContext({});
vm.runInContext(slice(ENGINE, 'const NQ=10', 'const SQ=') + slice(ENGINE, 'const MANT=', '/* Ballpark') + slice(ENGINE, 'const L10=', 'const W=') +
  slice(ENGINE, '/* units:start', '/* units:end */') + slice(ENGINE, 'function grp(', 'function longDate(') +
  ';this.X={dnUnits,ladder,zone,useRules,RULES,SPAN};', cx);
const { dnUnits: U, ladder, zone, SPAN } = cx.X;
const J = x => JSON.parse(JSON.stringify(x));

// every fact in every Reckon page, once each
const facts = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'reports')).filter(f => /-quiz-reckon-\d{4}\.html$/.test(f)))
  for (const q of read(path.join(ROOT, 'reports', f)).qs) if (!facts.has(q.f)) facts.set(q.f, q);

test('UNITS-01 most facts with a metric unit get the switch; a question naming an imperial unit keeps metric', () => {
  let on = 0, off = 0;
  for (const q of facts.values()) { if (!U.U[q.u]) { assert.equal(U.spec(q), null, q.f); continue; } U.spec(q) ? on++ : off++; }
  assert.ok(on >= 500 && off <= 15, `switch on ${on} facts, metric only on ${off}`);
  assert.equal(U.spec({ q: 'How many kilometres are in a mile?', u: 'km', a: 1.609 }), null);
  assert.equal(U.spec({ q: 'How much does a pint of milk weigh, in grams?', u: 'g', a: 586 }), null);
  assert.ok(U.spec({ q: 'How tall are the biggest standing stones at Stonehenge, in metres?', u: 'm', a: 7 }), 'stones are not stone');
  for (const u of ['°C', 'mm', 'm/s', 'km/s', 'light years', '%', '']) assert.equal(U.spec({ q: 'How much, in x?', u, a: 5 }), null, u);
});

test('UNITS-02 converted questions name the imperial unit and never keep the metric word', () => {
  for (const q of facts.values()) {
    const s = U.spec(q); if (!s) continue;
    assert.ok(!new RegExp('\\b' + U.U[q.u].w + '\\b').test(s.q), q.f + ': ' + s.q);
    if (/\bin [a-z ]+\?$/.test(q.q) && new RegExp('in ' + U.U[q.u].w).test(q.q)) assert.notEqual(s.q, q.q, q.f);
  }
  const s = U.spec({ q: 'How long is the Pennine Way, in kilometres?', u: 'km', a: 431, n: 'From the Peak District to the Scottish Borders.' });
  assert.deepEqual(J(s), { k: 'dist', f: U.U.km.f, du: 'miles', mu: 'km', iu: 'miles', q: 'How long is the Pennine Way, in miles?',
    n: 'From the Peak District to the Scottish Borders.', tip: 'Distances stay in miles until you switch back.' });
  assert.equal(U.spec({ q: 'What is the wingspan of a golden eagle, in metres?', u: 'm', a: 2 }).q, 'What is the wingspan of a golden eagle, in feet and inches?');
  assert.equal(U.spec({ q: 'How many litres does a jeroboam of champagne hold?', u: 'litres', a: 3 }).q, 'How many pints does a jeroboam of champagne hold?');
  assert.equal(U.spec({ q: 'How much water does a modern washing machine use per load, in litres?', u: 'litres', a: 50 }).du, 'gallons');
  assert.equal(U.spec({ q: 'How much does an elephant’s brain weigh, in grams?', u: 'g', a: 5000 }).q, 'How much does an elephant’s brain weigh, in pounds?');
});

test('UNITS-03 a guess scores the same in either unit: every imperial rung maps back to the metric it is scored on', () => {
  let checked = 0;
  for (const q of facts.values()) {
    const s = U.spec(q); if (!s) continue;
    const rungs = U.rungs(q.lo, s, ladder);
    assert.ok(rungs.length >= 40, q.f + ' has ' + rungs.length + ' rungs');
    for (let i = 1; i < rungs.length; i++) assert.ok(rungs[i] > rungs[i - 1], q.f + ' rungs rise');
    const lo = q.lo + Math.log10(s.f);
    assert.ok(Math.log10(rungs[0]) >= lo - 0.03 && Math.log10(rungs[rungs.length - 1]) <= lo + SPAN + 0.03, q.f + ' rungs stay on the scale');
    for (const r of rungs) {
      const g = r / s.f;   // what the engine keeps
      assert.equal(zone(g, q.a), zone(r, q.a * s.f), q.f + ' zone at ' + r);
      checked++;
    }
    // the answer's own rung scores a bullseye, as on the metric scale
    const near = rungs.reduce((a, b) => Math.abs(Math.log10(b / (q.a * s.f))) < Math.abs(Math.log10(a / (q.a * s.f))) ? b : a);
    assert.equal(zone(near / s.f, q.a), 0, q.f + ' nearest rung to the answer is a bullseye');
  }
  assert.ok(checked > 20000, checked + ' rungs checked');
});

test('UNITS-04 numbers read as Brits write them', () => {
  const t = (v, du) => U.text(v, du);
  assert.equal(t(2 * U.U.m.f, 'ft'), '6 ft 7 in');
  assert.equal(t(1.8 * U.U.m.f, 'ft'), '5 ft 11 in');
  assert.equal(t(1.83 * U.U.m.f, 'ft'), '6 ft');
  assert.equal(t(15 * U.U.m.f, 'ft'), '49.2 ft');
  assert.equal(t(175 * U.U.cm.f, 'in'), '5 ft 9 in');
  assert.equal(t(2 * U.U.cm.f, 'in'), '0.787 in');
  assert.equal(t(431 * U.U.km.f, 'miles'), '268 miles');
  assert.equal(t(149.6e6 * U.U.km.f, 'miles'), '93 million miles');
  assert.equal(t(105 * U.U['km/h'].f, 'mph'), '65.2 mph');
  assert.deepEqual(J(U.parts(66, 'in')), [['5', 'ft'], ['6', 'in']]);
  assert.deepEqual(J(U.parts(11.99, 'ft')), [['12', 'ft']]);
});

test('UNITS-05 notes convert their metric figures, ranges and adjectives; a note already in imperial is left alone', () => {
  const n = U.note;
  assert.equal(n('Around 100 to 110 km/h, but only in short bursts.'), 'Around 62 to 68 mph, but only in short bursts.');
  assert.equal(n('Around 70,000 km, from the Arctic to the Antarctic and back.'), 'Around 43,000 miles, from the Arctic to the Antarctic and back.');
  assert.equal(n('93 m including its pedestal; the statue alone is 46 m.'), '305 ft including its pedestal; the statue alone is 151 ft.');
  assert.equal(n('About 76 m longer than the Titanic.'), 'About 250 ft longer than the Titanic.');
  assert.equal(n('A 3.8 km swim, a 180 km bike ride, then a marathon.'), 'A 2.36-mile swim, a 112-mile bike ride, then a marathon.');
  assert.equal(n('Between 60 and 80 metres into the race.'), 'Between 200 and 260 ft into the race.');
  assert.equal(n('About 7.69 million km².'), 'About 2.97 million sq miles.');
  assert.equal(n('About 7,200 litres: 5 litres a minute, all day.'), 'About 1,600 gallons: 8.8 pints a minute, all day.');
  assert.equal(n('About 1.8 m, yet it has only seven bones.'), 'About 5 ft 11 in, yet it has only seven bones.');
  assert.equal(n('272 cm, or 8 ft 11 in.'), '272 cm, or 8 ft 11 in.');
  assert.equal(n('About 188 km (117 miles).'), 'About 188 km (117 miles).');
  assert.equal(n('A 660-tonne steel ball near the top steadies it in typhoons.'), 'A 660-tonne steel ball near the top steadies it in typhoons.');
  assert.equal(n('Each of 8 pawns has two, and each knight two.'), 'Each of 8 pawns has two, and each knight two.');
  assert.equal(n('Older machines used twice as much, and 1 mm of rain.'), 'Older machines used twice as much, and 1 mm of rain.');
  // every converted note still reads: no "NaN", no doubled unit, no dangling metric figure from a range
  for (const q of facts.values()) {
    const s = U.spec(q); if (!s || !q.n) continue;
    assert.ok(!/NaN|undefined|Infinity/.test(s.n), q.f + ': ' + s.n);
    assert.ok(!/\b(miles|ft|mph|lb|oz|pints|gallons) (miles|ft|mph|lb|oz|pints|gallons)\b/.test(s.n), q.f + ': ' + s.n);
  }
});

test('UNITS-06 the engine keeps and scores guesses in the fact’s own unit and remembers one setting per kind', () => {
  assert.ok(/R\.cur=mv\(LAD\[i\]\)/.test(ENGINE), 'the live guess is kept in metric');
  assert.ok(/const g=mv\(LAD\[CI\]\),z=zone\(g,F\.a\)/.test(ENGINE), 'lock-in scores the metric guess');
  assert.ok(/save\.un\[SP\.k\]='i'/.test(ENGINE) && !/digi-reckon-v2/.test(ENGINE), 'a new key in the same save, nothing renamed');
});
