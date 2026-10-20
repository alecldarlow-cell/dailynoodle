'use strict';
/* Reckon (20 Oct 2026): the daily of Ballpark. Its engine's load gate and the build gate must agree on
   every published day and both refuse a tampered one; its scoring and number wording must be Ballpark's
   own, so the game and the daily read alike. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../../..');
const R = require('../../build-reckon-batch');
const { read } = require('../read-puzzle');

const ENGINE = fs.readFileSync(path.join(ROOT, 'engines/reckon.js'), 'utf8');
const BALLPARK = fs.readFileSync(path.join(ROOT, 'reports/2026-10-15-quiz-ballpark.html'), 'utf8');
function slice(src, from, to) { const a = src.indexOf(from), b = src.indexOf(to, a); assert.ok(a >= 0 && b > a, 'markers ' + from); return src.slice(a, b); }
// the engine's constants and gate, run on their own
const engine = vm.createContext({});
vm.runInContext(slice(ENGINE, 'const NQ=10', 'const SQ=') + slice(ENGINE, 'const MANT=', '/* Ballpark') + slice(ENGINE, 'const L10=', 'const W=') + slice(ENGINE, '/*@GATE*/', '/*@GATE_END*/') +
  slice(ENGINE, 'function grp(', 'function longDate(') + ';this.X={GATE,zone,offText,fmt,fmtA,ladder};', engine);
const ball = vm.createContext({});
vm.runInContext(slice(BALLPARK, 'const NQ=10', 'const ZC=') + slice(BALLPARK, 'const MANT=', '/* ---------- small helpers') + 'const L10=Math.log10;' +
  slice(BALLPARK, 'function grp(', 'function shortLab(') + slice(BALLPARK, 'function zone(', 'function stars(') + slice(BALLPARK, 'function ladder(', '// The answer can sit') +
  slice(BALLPARK, 'function offText(', 'function reveal(') + ';this.X={zone,offText,fmt,fmtA,ladder};', ball);
const E = engine.X, B = ball.X;
const none = (x, m) => assert.equal(JSON.stringify(x), '[]', m);   // arrays from a vm context fail deepEqual on prototype
const files = R.live();

test('every Reckon passes the engine gate and the build gate', () => {
  assert.ok(files.length >= 30, 'at least a month of Reckons');
  for (const f of files) {
    const p = read(path.join(ROOT, 'reports', f));
    const meta = (fs.readFileSync(path.join(ROOT, 'reports', f), 'utf8').match(/name="dn:date"\s+content="([^"]+)"/) || [])[1];
    none(E.GATE(p, meta), f + ' engine gate');
    none(R.gateDay(p), f + ' build gate');
  }
  assert.deepEqual(R.gateRun(files.map(f => ({ file: f, p: read(path.join(ROOT, 'reports', f)) }))), [], 'schedule: contiguous, 100-day gap, no repeated ten');
});

test('a tampered day is refused by both gates', () => {
  const good = read(path.join(ROOT, 'reports', files[0]));
  const bad = {
    'nine questions': p => p.qs.pop(),
    'two from one pack': p => { p.qs[1].k = p.qs[2].k; },
    'answer off its scale': p => { p.qs[3].lo = Math.log10(p.qs[3].a) + 0.1; },
    'hard opener': p => { p.qs[0].e = 0; },
    'repeated fact': p => { p.qs[4].f = p.qs[5].f; },
    'negative answer': p => { p.qs[6].a = -5; },
    'bad id': p => { p.id = 'DP·RECK·12'; },
  };
  for (const [what, spoil] of Object.entries(bad)) {
    const p = JSON.parse(JSON.stringify(good)); spoil(p);
    assert.ok(E.GATE(p, p.date).length > 0, 'engine refuses: ' + what);
    assert.ok(R.gateDay(p).length > 0, 'build refuses: ' + what);
  }
  assert.ok(E.GATE(good, '2001-01-01').length > 0, 'engine refuses a dn:date that disagrees');
});

test('scoring, gaps and number wording are Ballpark’s own', () => {
  for (let a of [0.75, 3, 12, 99, 310, 8849, 384400, 1.5e8, 3.7e13]) for (let r = 0.2; r <= 5; r *= 1.037) {
    const g = +(a * r).toPrecision(3);
    assert.equal(E.zone(g, a), B.zone(g, a), `zone ${g} vs ${a}`);
    assert.equal(E.offText(g, a), B.offText(g, a), `offText ${g} vs ${a}`);
    assert.equal(E.fmt(g), B.fmt(g)); assert.equal(E.fmtA(a), B.fmtA(a));
  }
  assert.deepEqual([100, 115, 115.01, 130, 130.01, 160, 160.01, 300, 300.01].map(x => E.zone(x, 100)), [0, 0, 1, 1, 2, 2, 3, 3, 4]);
  for (const lo of [-0.4, 0, 0.7, 2.31, 5.9]) for (const i of [0, 1]) assert.equal(JSON.stringify(E.ladder(lo, i)), JSON.stringify(B.ladder(lo, i)), `ladder ${lo} ${i}`);
});

test('each day’s facts are Ballpark’s bank as it stands, and excluded facts never appear', () => {
  for (const f of files) {
    const p = read(path.join(ROOT, 'reports', f)), today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
    if (p.date <= today) continue;                       // a released day keeps the facts it was played with
    assert.deepEqual(R.drift(p), [], f + ' matches the bank');
  }
});

test('the engine has a chip for every Ballpark pack', () => {
  const have = [...slice(ENGINE, 'const PACKS={', '\n};').matchAll(/^ (\w+):\{n:/gm)].map(m => m[1]);
  for (const p of R.BANK.packs) assert.ok(have.includes(p.k), 'chip for ' + p.k);
});
