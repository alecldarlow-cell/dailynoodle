#!/usr/bin/env node
/* tools/build-reckon-batch.js — build-time Reckon generator and gate (typespec: project doc
   claude/16_typespec_reckon.md, approved by Alec 19 Oct 2026).

   Reckon is the daily of the Ballpark game: ten questions a day from Ballpark's own bank,
   the same ten for everyone.
     - Facts are read by anchor from the `const PACKS=` block of
       reports/2026-10-15-quiz-ballpark.html and copied into each day as they are
       (question, unit, answer, note, flags). A fact's id is "<pack>:<index>"; Ballpark's
       own saves depend on those indexes, so facts are only ever appended to a pack.
     - Each day takes one fact from each of ten of the twelve packs (two sit out in
       rotation), opens with one of Ballpark's easy openers, allows at most two of a kind
       ("how tall is", "how many people" …) and never repeats a fact within MINGAP days.
       Within a pack it picks, seeded by the date, among the six longest-unasked facts, so
       gaps run ~100–130 days and no run of days repeats.
     - Where each answer sits on its two-decade scale is seeded per question (0.15–1.85
       decades up, as in the game), so everyone gets the same window.
   Released days are never changed: the schedule continues from what the pages in reports/
   already hold, so fixing or adding facts only moves forthcoming days (--restamp).

   Usage:
     node tools/build-reckon-batch.js --through 2027-12-31 [--dry] [--out DIR]
     node tools/build-reckon-batch.js --check          # gate every Reckon in reports/, exit 1 on any failure
     node tools/build-reckon-batch.js --verify         # also flag days whose facts no longer match Ballpark's bank
     node tools/build-reckon-batch.js --stats [--from D --days N]
     node tools/build-reckon-batch.js --restamp [--dry] # rebuild forthcoming days (after today, London) in place;
                                                        # only the DN_PUZZLE line may change
     node tools/build-reckon-batch.js --facts FROM THROUGH  # list the facts scheduled in a date range (for fact checks)
   New days are stamped from the newest Reckon page (tools/reckon-template.html for the first);
   only dn:headline, dn:date and the DN_PUZZLE line change. The workflow adds link-preview tags. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const BALLPARK = path.join(REPORTS, '2026-10-15-quiz-ballpark.html');
const TEMPLATE = path.join(__dirname, 'reckon-template.html');
const args = process.argv.slice(2), has = k => args.includes(k);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

/* ---- rules ---- */
const LAUNCH = '2026-10-20';       // serial 0001 (moved forward from 26 Oct by Alec, 20 Oct 2026)
const NQ = 10, MINGAP = 100, KIND_CAP = 2, WINDOW = 6, SPAN = 2;
const BAND = [1.15, 1.3, 1.6, 3];  // the game's scoring bands (100 / 75 / 50 / 25)
/* Facts kept out of Reckon (they stay in Ballpark): ones whose good sources disagree by more
   than 15%, or that can't be worded fairly. Add the id and the reason. First list: the fact check of
   20 Oct 2026 (tools/reckon-fact-fixes-2026-10-20.json). */
const EXCLUDE = {
  'science:35': "atom vs nucleus: sources run from about 23,000x to 145,000x depending on the atom and how its size is defined",
  'weather:88': "fresh snow: 50 to 150 kg per cubic metre depending on the snow",
  'science:36': "atoms across a hair: depends on which hair width and atom size you take",
  'food:78': "tomato varieties: estimates run from about 7,500 to over 15,000",
  'body:53': "cone cells: 4.6 million (direct counts) against 6 million (older textbooks)",
  'body:52': "rod cells: 92 million (direct counts) against 120 million (older textbooks)",
  'weather:64': "jet stream top speed: 320, 400 and 425 km/h are all quoted",
  'britain:38': "a trick question rather than an estimate (“Lake Windermere” in everyday speech)",
  'earth:76': "Andes length: 7,000 to 8,900 km depending on the source",
  'space:93': "Andromeda 'including its faint outer halo': the halo spans millions of light years; 220,000 is the visible disc",
  // the launch check of 20 Oct 2026 (tools/reckon-fact-fixes-2026-10-20-launch.json)
  'food:74': "oldest edible honey: 3,000 years (Egyptian tombs, an unverified tale) and 5,500 years (a Georgian tomb, 2003) are both quoted, and neither was shown to be edible",
  'food:17': "UK tea a day: 100 million and 165 million cups are both quoted by the UK tea industry",
  'food:76': "UK chocolate per person: about 8, 10 and 11 kg a year are all quoted, depending on the year and the survey",
};

/* ---- the bank, by anchor ---- */
function loadBank(file) {
  const s = fs.readFileSync(file || BALLPARK, 'utf8');
  const a = s.indexOf('const PACKS=['), b = s.indexOf('const TOUR=');
  if (a < 0 || b < 0 || b < a) throw new Error('const PACKS= / const TOUR= anchors not found in Ballpark');
  const packs = vm.runInNewContext('(' + s.slice(a + 12, b).trim().replace(/;$/, '') + ')', {});
  const facts = [];
  for (const p of packs) p.q.forEach((f, i) => facts.push({
    f: p.k + ':' + i, k: p.k, q: f[0],
    u: f[1] || (/^How many people/.test(f[0]) ? 'people' : ''),   // as the game's fact()
    a: f[2], n: f[3] || '', i: f[4] & 2 ? 1 : 0, e: f[4] & 1 ? 1 : 0 }));
  return { packs: packs.map(p => ({ k: p.k, name: p.name, sh: p.sh || '', c: p.c, ic: p.ic })), facts };
}
const BANK = loadBank();
const BY_ID = new Map(BANK.facts.map(x => [x.f, x]));
const PACK_KEYS = BANK.packs.map(p => p.k);
const kind = q => q.split(' ').slice(0, 3).join(' ').toLowerCase();

/* ---- hash / RNG (FNV-1a and mulberry32, as Borders) ---- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

/* ---- dates ---- */
const DAY0 = Date.parse(LAUNCH + 'T00:00:00Z');
const dayIdx = date => Math.round((Date.parse(date + 'T00:00:00Z') - DAY0) / 864e5);
const dateOf = idx => new Date(DAY0 + idx * 864e5).toISOString().slice(0, 10);
const londonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

/* ---- one day, given what every earlier day used ---- */
// last: Map fact id -> day index it was last used
function pickDay(di, last) {
  const date = dateOf(di), r = rng(hashStr('reckon-day-' + date));
  const out = new Set([(2 * di) % PACK_KEYS.length, (2 * di + 1) % PACK_KEYS.length]);
  const packs = shuffle(PACK_KEYS.filter((_, j) => !out.has(j)), r);
  const kinds = {}, picks = [];
  const ok = x => !EXCLUDE[x.f] && (last.get(x.f) == null || di - last.get(x.f) >= MINGAP) && (kinds[kind(x.q)] || 0) < KIND_CAP;
  // never asked first (in a fixed seeded order), then the longest unasked
  const order = (a, b) => {
    const la = last.get(a.f), lb = last.get(b.f);
    if (la == null && lb == null) return hashStr('reckon-' + a.f) - hashStr('reckon-' + b.f);
    if (la == null) return -1; if (lb == null) return 1;
    return la - lb || hashStr('reckon-' + a.f) - hashStr('reckon-' + b.f);
  };
  for (const k of packs) {
    const cands = BANK.facts.filter(x => x.k === k && ok(x)).sort(order);
    if (!cands.length) throw new Error(`${date}: pack ${k} has nothing it may ask (gap ${MINGAP}, kind cap ${KIND_CAP})`);
    const x = cands[Math.floor(r() * Math.min(WINDOW, cands.length))];
    kinds[kind(x.q)] = (kinds[kind(x.q)] || 0) + 1; picks.push(x);
  }
  // an easy opener: one of today's, or swap a pick for an easy fact from the same pack
  let open = picks.findIndex(x => x.e);
  if (open < 0) {
    for (let j = 0; j < picks.length && open < 0; j++) {
      const was = picks[j]; kinds[kind(was.q)]--;
      const easy = BANK.facts.filter(x => x.k === was.k && x.e && ok(x)).sort(order)[0];
      if (easy) { picks[j] = easy; kinds[kind(easy.q)] = (kinds[kind(easy.q)] || 0) + 1; open = j; }
      else kinds[kind(was.q)]++;
    }
    if (open < 0) throw new Error(`${date}: no easy opener available`);
  }
  const first = picks.splice(open, 1)[0];
  const rest = shuffle(picks, r);
  const qs = [first, ...rest].map((x, q) => {
    const rr = rng(hashStr(`reckon-lo-${date}-${q}`));
    let lo = +(Math.log10(x.a) - (0.15 + 1.7 * rr())).toFixed(3);
    if (x.i) lo = Math.max(lo, 0);
    return { f: x.f, k: x.k, q: x.q, u: x.u, a: x.a, n: x.n, i: x.i, e: x.e, lo };
  });
  return { id: 'DP·RECK·' + String(di + 1).padStart(4, '0'), date, serial: di + 1, qs };
}

/* ---- pages ---- */
const PZ_RE = /window\.DN_PUZZLE=\{id:.*\};/;
const pzLine = p => `window.DN_PUZZLE={id:${JSON.stringify(p.id)},date:${JSON.stringify(p.date)},qs:${JSON.stringify(p.qs)}};`;
const fileOf = p => `${p.date}-quiz-reckon-${String(dayIdx(p.date) + 1).padStart(4, '0')}.html`;
const FILE_RE = /^(\d{4}-\d{2}-\d{2})-quiz-reckon-(\d{4})\.html$/;
const live = dir => fs.readdirSync(dir || REPORTS).filter(f => FILE_RE.test(f)).sort();
function readPuzzle(file, dir) {
  const s = fs.readFileSync(path.join(dir || REPORTS, file), 'utf8'), m = s.match(PZ_RE);
  if (!m) throw new Error(file + ': no DN_PUZZLE line');
  const w = {}; vm.runInNewContext(m[0], { window: w }); return { src: s, p: w.DN_PUZZLE };
}
function stamp(tpl, p) {
  let s = tpl;
  s = s.replace(/(name="dn:headline"\s+content=")[^"]*(")/, `$1Reckon ${String(dayIdx(p.date) + 1).padStart(4, '0')}$2`);
  s = s.replace(/(name="dn:date"\s+content=")[^"]*(")/, `$1${p.date}$2`);
  if (!PZ_RE.test(s)) throw new Error('DN_PUZZLE line not found in template');
  return s.replace(PZ_RE, () => pzLine(p));
}
// everything but the headline, date and puzzle line must match the template exactly
const MASK = s => s.replace(/(name="dn:headline"\s+content=")[^"]*(")/, '$1H$2').replace(/(name="dn:date"\s+content=")[^"]*(")/, '$1D$2')
  .replace(PZ_RE, 'PZ').replace(/<!-- og:start[\s\S]*?<!-- og:end -->\n?/, '').replace(/<script src="\.\.\/dn-track\.js" defer><\/script>\n?/, '');

/* ---- the gate: one day on its own (the engine runs the same checks on load) ---- */
function gateDay(p) {
  const e = [];
  if (!/^DP·RECK·\d{4}$/.test(p.id || '')) e.push('id shape');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) e.push('date shape');
  if (!Array.isArray(p.qs) || p.qs.length !== NQ) { e.push('ten questions'); return e; }
  if (new Set(p.qs.map(q => q.f)).size !== NQ) e.push('distinct facts');
  if (new Set(p.qs.map(q => q.k)).size !== NQ) e.push('ten different packs');
  if (!p.qs[0].e) e.push('opener is not an easy one');
  const kinds = {}; p.qs.forEach(q => { kinds[kind(q.q)] = (kinds[kind(q.q)] || 0) + 1; });
  if (Object.values(kinds).some(v => v > KIND_CAP)) e.push('more than two of a kind');
  p.qs.forEach((q, j) => {
    if (!(typeof q.q === 'string' && q.q.length > 8)) e.push(`q${j + 1} question`);
    if (!(Number.isFinite(q.a) && q.a > 0)) e.push(`q${j + 1} answer`);
    if (!Number.isFinite(q.lo)) e.push(`q${j + 1} scale`);
    else {
      const a = Math.log10(q.a);
      // the 100- and 75-point zones must sit wholly on the scale
      if (a - Math.log10(BAND[1]) < q.lo - 1e-9 || a + Math.log10(BAND[1]) > q.lo + SPAN + 1e-9) e.push(`q${j + 1} zones off the scale`);
      if (q.i && q.lo < 0) e.push(`q${j + 1} whole-number scale below 1`);
    }
    if (!PACK_KEYS.includes(q.k) || !String(q.f).startsWith(q.k + ':')) e.push(`q${j + 1} pack`);
  });
  return e;
}
/* across days: contiguous, no fact inside MINGAP, no repeated ten */
function gateRun(list) {
  const e = [], last = new Map(), sets = new Map();
  list.forEach(({ file, p }, n) => {
    const m = FILE_RE.exec(file);
    if (!m || m[1] !== p.date || +m[2] !== dayIdx(p.date) + 1 || p.id !== 'DP·RECK·' + m[2]) e.push(`${file}: filename, id and date disagree`);
    if (n && dayIdx(p.date) !== dayIdx(list[n - 1].p.date) + 1) e.push(`${file}: not the day after ${list[n - 1].file}`);
    for (const q of p.qs) {
      const l = last.get(q.f);
      if (l != null && dayIdx(p.date) - l < MINGAP) e.push(`${file}: ${q.f} back after ${dayIdx(p.date) - l} days (min ${MINGAP})`);
      last.set(q.f, dayIdx(p.date));
    }
    const key = p.qs.map(q => q.f).sort().join(',');
    if (sets.has(key)) e.push(`${file}: same ten as ${sets.get(key)}`); else sets.set(key, file);
  });
  return e;
}
// a day's facts against the bank as it stands
function drift(p) {
  const d = [];
  for (const q of p.qs) {
    const x = BY_ID.get(q.f);
    if (!x) { d.push(`${q.f} no longer in the bank`); continue; }
    for (const k of ['q', 'u', 'a', 'n', 'i', 'e', 'k']) if (x[k] !== q[k]) d.push(`${q.f} ${k} changed`);
    if (EXCLUDE[q.f]) d.push(`${q.f} is excluded`);
  }
  return d;
}

/* the engine draws each question's pack chip from its own table: it must know every pack in the bank */
function enginePacks() {
  const e = fs.readFileSync(path.join(ROOT, 'engines', 'reckon.js'), 'utf8'), m = e.match(/const PACKS=\{([\s\S]*?)\n\};/);
  if (!m) return ['engines/reckon.js: PACKS table not found'];
  const have = [...m[1].matchAll(/^ (\w+):\{n:/gm)].map(x => x[1]);
  return PACK_KEYS.filter(k => !have.includes(k)).map(k => `engines/reckon.js has no chip for Ballpark pack "${k}"`);
}

/* ---- the run: released days as they are, then the schedule onwards ---- */
function history(files, dir) { return files.map(f => ({ file: f, p: readPuzzle(f, dir).p })); }
function continueFrom(hist, through, fromIdx) {
  const last = new Map(); hist.forEach(({ p }) => p.qs.forEach(q => last.set(q.f, dayIdx(p.date))));
  const out = [];
  for (let di = fromIdx; dateOf(di) <= through; di++) {
    const p = pickDay(di, last); p.qs.forEach(q => last.set(q.f, di)); out.push(p);
  }
  return out;
}

module.exports = { BANK, BY_ID, pickDay, gateDay, gateRun, drift, stamp, pzLine, fileOf, live, readPuzzle, dayIdx, dateOf, LAUNCH, MINGAP, NQ, BAND, SPAN, kind, EXCLUDE };
if (require.main === module) main();

function main() {
  const dir = arg('--out') ? path.resolve(arg('--out')) : REPORTS;
  if (dir !== REPORTS) fs.mkdirSync(dir, { recursive: true });
  const files = live(dir);
  const tplFile = files.length ? path.join(dir, files.at(-1)) : TEMPLATE;
  const tpl = fs.readFileSync(tplFile, 'utf8').replace(/<!-- og:start[\s\S]*?<!-- og:end -->\n?/, '').replace(/<script src="\.\.\/dn-track\.js" defer><\/script>\n?/, '');
  const tplMask = MASK(fs.readFileSync(TEMPLATE, 'utf8'));

  if (has('--check') || has('--verify')) {
    const hist = history(files, dir), errs = [];
    for (const { file, p } of hist) {
      gateDay(p).forEach(m => errs.push(`${file}: ${m}`));
      if (MASK(readPuzzle(file, dir).src) !== tplMask) errs.push(`${file}: differs from the template outside the headline, date and puzzle line`);
    }
    errs.push(...gateRun(hist), ...enginePacks());
    const today = londonToday(), drifted = [];
    if (has('--verify')) for (const { file, p } of hist) { const d = drift(p); if (d.length) drifted.push(`${file}${p.date <= today ? ' (released)' : ''}: ${d.join('; ')}`); }
    console.log(JSON.stringify({ days: hist.length, first: files[0] || null, last: files.at(-1) || null, errors: errs.length, drift: drifted.length }));
    errs.slice(0, 30).forEach(m => console.log('  ERROR ' + m));
    drifted.slice(0, 30).forEach(m => console.log('  drift ' + m));
    process.exit(errs.length || drifted.some(m => !/\(released\)/.test(m)) ? 1 : 0);
  }
  if (has('--stats')) {
    const hist = history(files, dir);
    const from = arg('--from', hist.length ? hist[0].p.date : LAUNCH), days = +arg('--days', 430);
    const through = dateOf(dayIdx(from) + days - 1);
    const known = hist.filter(h => h.p.date <= through);
    const run = known.map(h => h.p).concat(continueFrom(hist, through, hist.length ? dayIdx(hist.at(-1).p.date) + 1 : dayIdx(LAUNCH)));
    const last = new Map(), gaps = [], uses = new Map();
    run.forEach(p => p.qs.forEach(q => { const l = last.get(q.f); if (l != null) gaps.push(dayIdx(p.date) - l); last.set(q.f, dayIdx(p.date)); uses.set(q.f, (uses.get(q.f) || 0) + 1); }));
    gaps.sort((a, b) => a - b);
    const eligible = BANK.facts.filter(x => !EXCLUDE[x.f]).length;
    console.log(JSON.stringify({ from: run[0] && run[0].date, through, days: run.length, bank: BANK.facts.length, eligible, used: uses.size,
      repeats: gaps.length, minGap: gaps[0] || null, medianGap: gaps[Math.floor(gaps.length / 2)] || null, maxGap: gaps.at(-1) || null,
      gateErrors: run.flatMap(gateDay).length + gateRun(run.map(p => ({ file: fileOf(p), p }))).length }));
    return;
  }
  if (has('--facts')) {
    const i = args.indexOf('--facts'), from = args[i + 1], through = args[i + 2];
    const hist = history(files, dir), have = new Map(hist.map(h => [h.p.date, h.p]));
    const run = hist.map(h => h.p).concat(continueFrom(hist, through, hist.length ? dayIdx(hist.at(-1).p.date) + 1 : dayIdx(LAUNCH)));
    const seen = new Set(), out = [];
    run.filter(p => p.date >= from && p.date <= through).forEach(p => p.qs.forEach(q => { if (!seen.has(q.f)) { seen.add(q.f); out.push({ id: q.f, first: p.date, question: q.q, unit: q.u, answer: q.a, note: q.n }); } }));
    process.stdout.write(JSON.stringify(out, null, 1) + '\n');
    return;
  }
  if (has('--restamp')) {
    const today = londonToday(), keep = files.filter(f => f.slice(0, 10) <= today), redo = files.filter(f => f.slice(0, 10) > today);
    if (!redo.length) { console.log(JSON.stringify({ restamped: 0, note: 'no forthcoming days' })); return; }
    const hist = history(keep, dir);
    const days = continueFrom(hist, redo.at(-1).slice(0, 10), dayIdx(redo[0].slice(0, 10)));
    const all = hist.concat(days.map(p => ({ file: fileOf(p), p })));
    const errs = days.flatMap(p => gateDay(p).map(m => `${p.date}: ${m}`)).concat(gateRun(all));
    if (errs.length) { errs.slice(0, 20).forEach(m => console.log('  ERROR ' + m)); process.exit(1); }
    let n = 0, same = 0;
    for (const p of days) {
      const f = fileOf(p); if (!redo.includes(f)) throw new Error(`${f}: not an existing forthcoming file`);
      const before = fs.readFileSync(path.join(dir, f), 'utf8'), after = before.replace(PZ_RE, () => pzLine(p));
      if (after.replace(PZ_RE, 'PZ') !== before.replace(PZ_RE, 'PZ')) throw new Error(`${f}: masked diff`);
      if (after === before) { same++; continue; }
      if (!has('--dry')) {
        fs.writeFileSync(path.join(dir, f), after);
        const back = readPuzzle(f, dir).p; if (pzLine(back) !== pzLine(p) || gateDay(back).length) throw new Error(`${f}: re-read from disk failed the gate`);
      }
      n++;
    }
    console.log(JSON.stringify({ restamped: n, unchanged: same, from: redo[0].slice(0, 10), dry: has('--dry') }));
    return;
  }
  const through = arg('--through');
  if (!through) { console.error('need --through YYYY-MM-DD (or --check, --verify, --stats, --facts, --restamp)'); process.exit(2); }
  const hist = history(files, dir);
  const startIdx = hist.length ? dayIdx(hist.at(-1).p.date) + 1 : dayIdx(LAUNCH);
  const days = continueFrom(hist, through, startIdx);
  const all = hist.concat(days.map(p => ({ file: fileOf(p), p })));
  const errs = days.flatMap(p => gateDay(p).map(m => `${p.date}: ${m}`)).concat(gateRun(all), enginePacks());
  if (errs.length) { errs.slice(0, 20).forEach(m => console.log('  ERROR ' + m)); process.exit(1); }
  const written = [];
  for (const p of days) {
    const f = fileOf(p), out = stamp(tpl, p);
    if (MASK(out) !== tplMask) throw new Error(`${f}: masked diff against the template`);
    if (!has('--dry')) {
      fs.writeFileSync(path.join(dir, f), out);
      const back = readPuzzle(f, dir);                       // re-parse from disk and gate again
      if (pzLine(back.p) !== pzLine(p) || gateDay(back.p).length || MASK(back.src) !== tplMask) throw new Error(`${f}: re-read from disk failed`);
    }
    written.push(f);
  }
  console.log(JSON.stringify({ written: written.length, first: written[0] || null, last: written.at(-1) || null, dir: path.relative(ROOT, dir) || '.', dry: has('--dry') }));
}
