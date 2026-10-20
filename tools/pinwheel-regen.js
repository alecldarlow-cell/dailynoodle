#!/usr/bin/env node
/* Digi Puzzles — pinwheel clean-up (added 17 Oct 2026).

   The 5x5 block layout  ...#. / #.... / ..... / ....# / .#...  has four black
   squares turning the same way. In the feed thumbnail they merge with the dark
   frame and the grid reads as a swastika-like pinwheel, so it must never ship.
   More generally any 5x5 Mini/Doku layout that is unchanged by a quarter turn
   but changed by a mirror (a "spinning" layout) is refused.

   This tool swaps such puzzles for fresh ones IN PLACE: same file, URL, id,
   serial, date and band, so players' links, streaks and done-state survive.

   Usage (run from the repo root):
     node tools/pinwheel-regen.js --check [--days N]
         list every pinwheel puzzle left; exit 1 if any is dated within N days
         (default 21) — the safety net for the nightly batches.
     node tools/pinwheel-regen.js --plan OUT.json (--until YYYY-MM-DD | --next N) [--seed S]
         generate replacement grids (engine filler + engine validator, plus
         layout ban, blocklist, answer-reuse gaps and D4 dedup) and write them
         to OUT.json for clue authoring. Minis need clues + a standfirst.
     node tools/pinwheel-regen.js --plan OUT.json --gaps --from YYYY-MM-DD --until YYYY-MM-DD [--secs S]
         (added 19 Oct 2026) target Minis instead of layouts: the fewest Minis
         dated in the range whose replacement clears every answer that comes
         back sooner than the reuse ladder allows (3:30d 4:60d 5:75d). These
         are always filled at the full ladder, never the relaxed one.
         Also: --strict (full ladder for --only/--next too), --exclude w,w (keep
         these words out of this plan's fills).
     node tools/pinwheel-regen.js --apply PLAN.json
         stamp the authored plan into reports/, then re-parse every written file
         from disk and re-run the engine gate, the layout ban, the clue checks
         (self-leak, cross-leak, the same clue text on any Mini within a year, and tools/check-mini-clues.js:
         stray it/them, padding, Americanisms, same clue within a year) and a
         masked diff. og:description is kept equal to the new standfirst.
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
// Dokus must also have no second fill in everyday British words, not just in the engine list (19 Oct 2026)
const { broadAlts } = require("./doku-broad-check.js");
// Mini clue gate: stray it/them, padding, Americanisms, same clue within 365 days (19 Oct 2026)
const { checkMinis } = require("./check-mini-clues.js");
// Doku difficulty rule (19 Oct 2026): easy needs a crossing deduction, medium/hard never need trial and error
const { fitsOK: gradeFits, shapeOK: lockShapeOK } = require("./doku-grade.js");

const ROOT = path.resolve(__dirname, "..");
const REPORTS = path.join(ROOT, "reports");
const BLOCKED = ["anal","anus","arse","bastard","bitch","boob","boobs","cunt","cunts","dick","dicks","dildo","fuck","fucks","heroin","homo","jihad","meth","nazi","nazis","negro","nude","nudes","opium","orgy","penis","pimp","porn","porno","pussy","rape","raped","rapes","semen","sex","sexy","sperm","twat","whore"];
const SENSITIVE = ["ass","bra","coke","crack","damn","hell","jew","jews","slave","suck","sucks","tit","tits"];
// weak fill: Roman numerals, month/day/unit abbreviations, foreign function words
const VETO = ["non","abuse","pic","anti","amino","rep","xxx","iii","vii","viii","xiii","aaa","abc",
  "jan","feb","apr","jun","jul","aug","sep","sept","oct","nov","dec","mon","tue","wed","thu","fri",
  "sec","cos","est","las","das","neo","eds","hes","pac","pos","rom","alt","tho","med","mil","col","chi","calif","exec",
  "armor","color","colors","favor","labor","humor","honor","odor","rumor","tumor","valor","vapor","arbor",
  "meter","liter","fiber","plow","cozy","mold","molds","gray","center","theater","jewelry",
  "asses","feces","horny","urine","bowel","sexes","moron","lynch","trump","pepsi","cisco","omaha","iowa","unix",
  "crore","malik","mecca","torah","islam","hindu","hindi","iraqi","saudi","tamil","malay","norse","shiva","sunni","imam","urdu","erie",
  "thai","rome","york","japan","yang","afro","frat","feds","gaga","asap","nato","xmas","sync","exec","spec","sept","docs","bots","offs",
  "coco","duff","sire","mater","prima","synod","assay","basal","nodes","ionic","lymph","sinus","toxin","dandy","limbo","aides","overs",
  "arab","arabs","aryan","turk","turks","brits","scots","danes","amish","gays","dyke","queer","slut","shia","sunni","sikh","jihad",
  // 19 Oct 2026 (Mini clue pass): US spelling, slang, a unit symbol, breakfast test
  "edema","eon","eons","gonna","wanna","gotta","mol","balls","sera","lea","rad","aging","hath","thine","thou","thee"];
const GAP = { 3: 30, 4: 60, 5: 75 };            // Mini answer-reuse ladder (days)

/* ---------- layout screen ---------------------------------------------- */
const maskOf = g => g.map(r => r.map(c => (c === "#" ? "#" : ".")).join(""));
const rot = m => m[0].split("").map((_, c) => m.map(r => r[c]).reverse().join(""));
const mir = m => m.map(r => r.split("").reverse().join(""));
function spins(m) {                       // quarter-turn symmetric but chiral
  const k = m.join("|");
  return m.join("").includes("#") && rot(m).join("|") === k && mir(m).join("|") !== k;
}
const SWASTIKA = ["XXX.X", "..X.X", "XXXXX", "X.X..", "X.XXX"];
const SW_REFS = (() => { const o = []; let g = SWASTIKA.map(r => r.replace(/X/g, "#"));
  for (let i = 0; i < 4; i++) { o.push(g.join("|")); o.push(mir(g).join("|")); g = rot(g); } return o; })();
function nearSwastika(m) {
  const inv = m.map(r => r.replace(/[#.]/g, ch => (ch === "#" ? "." : "#")));
  const d = (a, b) => [...a].filter((ch, i) => ch !== b[i]).length;
  return [m, inv].some(x => SW_REFS.some(ref => d(x.join("|"), ref) <= 1));
}
const badLayout = m => spins(m) || nearSwastika(m);

/* ---------- engines ------------------------------------------------------ */
function loadEngine(file, cutMarker, extra) {
  const src = fs.readFileSync(path.join(ROOT, "engines", file), "utf8");
  let code = src.slice(0, src.indexOf(cutMarker));
  if (extra) { const a = src.indexOf(extra[0]), b = src.indexOf(extra[1]); code += "\n" + src.slice(a, b); }
  // the engines open with the finish-sheet stub (window.dnFinish, document.write) since 18 Oct 2026
  const ctx = { window: {}, document: { write() {} } }; vm.createContext(ctx);
  vm.runInContext(code + "\n;globalThis.__E={WORDS,BANDS,findSlots,fillBand,validate,mulberry32" +
    (extra ? ",countSolutions,validateLexi,DENSITY" : "") + "};", ctx);
  return ctx.__E;
}
const engines = () => ({
  mini: loadEngine("mini.js", "/* ---- Digi Puzzles: Mini player"),
  doku: loadEngine("doku.js", "/* ---- Digi Puzzles: The Digi Doku player",
    ["/* ---- blocklist re-asserted", "/* ---- state ---- */"]),
});

/* ---------- repo scan ---------------------------------------------------- */
const GRID_RE = /grid:\s*(\[\s*\[[\s\S]*?\]\s*\])/;
function entries(E, g) {
  const lg = g.map(r => r.map(c => (c === "#" ? "#" : String(c).toLowerCase())));
  const slots = E.findSlots(lg) || [];
  return slots.map(s => ({ t: s.t, r: s.r, c: s.c, word: s.cells.map(([r, c]) => lg[r][c]).join("") }));
}
function scan(E) {
  const out = [];
  for (const f of fs.readdirSync(REPORTS).sort()) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})-(crossword-mini|logic-doku)-(\d+)\.html$/);
    if (!m) continue;
    const s = fs.readFileSync(path.join(REPORTS, f), "utf8"), gm = s.match(GRID_RE);
    if (!gm) continue;
    let g; try { g = JSON.parse(gm[1]); } catch (e) { continue; }
    if (g.length !== 5) continue;
    const type = m[2] === "crossword-mini" ? "mini" : "doku";
    const band = (s.match(/band:\s*"(\w+)"/) || [])[1];
    const clues = [];
    if (type === "mini") { const cb = s.match(/clues:\{[\s\S]*?\n\s*\}/);
      if (cb) for (const x of cb[0].matchAll(/^\s*([a-z]+):"((?:[^"\\]|\\.)*)"/gm)) clues.push(x[2]); }
    out.push({ file: f, date: m[1], type, serial: m[3], band, grid: g, mask: maskOf(g),
      words: entries(E[type], g).map(e => e.word), clues });
  }
  return out;
}
const dayNum = d => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);
function canon(g) {
  let m = g.map(r => r.join("").toLowerCase()); const o = [];
  for (let i = 0; i < 4; i++) { o.push(m.join("|")); o.push(mir(m).join("|")); m = rot(m); }
  return o.sort()[0];
}

/* ---------- --check ------------------------------------------------------- */
function check(days) {
  const E = engines(), all = scan(E), today = new Date().toISOString().slice(0, 10);
  const left = all.filter(p => badLayout(p.mask));
  const soon = left.filter(p => dayNum(p.date) - dayNum(today) <= days);
  console.log(`spinning/near-swastika layouts left: ${left.length} (mini ${left.filter(p => p.type === "mini").length}, doku ${left.filter(p => p.type === "doku").length})`);
  if (left.length) console.log(`  next: ${left.slice(0, 6).map(p => p.date + " " + p.type + p.serial).join(", ")}`);
  if (soon.length) { console.log(`ERROR ${soon.length} dated within ${days} days: ${soon.map(p => p.file).join(", ")}`); process.exit(1); }
  console.log("OK");
}

/* ---------- --plan --------------------------------------------------------- */
function plan(outFile, opts) {
  const E = engines(), all = scan(E);
  let targets = all.filter(p => badLayout(p.mask)).sort((a, b) => a.date.localeCompare(b.date) || a.file.localeCompare(b.file));
  if (opts.until) targets = targets.filter(p => p.date <= opts.until);
  if (opts.next) targets = targets.slice(0, opts.next);
  // --only FILE,FILE: (re)do exactly these, even if already clean (e.g. a weak fill)
  if (opts.only) targets = all.filter(p => opts.only.split(",").includes(p.file));
  // --gaps: the fewest Minis in [from, until] whose replacement clears every ladder breach touching the range
  if (opts.gaps) targets = gapTargets(all, opts.from || "0000-00-00", opts.until || "9999-12-31");
  if (!targets.length) { console.log("nothing to do"); fs.writeFileSync(outFile, "[]\n"); return; }

  // vocabulary: answers already used in shipped Minis (each vetted when it shipped), minus lists
  const ban = new Set([...BLOCKED, ...SENSITIVE, ...VETO, ...(opts.exclude ? opts.exclude.split(",") : [])]);
  // Mini answers were each clued by hand when they shipped, so they are trusted.
  // Doku-only fill is looser: its 4- and 5-letter words are admitted (minus the
  // vetoes above), its 3-letter words mostly are not (abbreviations).
  const DOKU3 = new Set(["ark", "bow", "gig", "ore", "pig", "wan", "yay"]);
  const vetted = new Set(all.filter(p => p.type === "mini").flatMap(p => p.words));
  // approved additions (tools/mini-word-additions.json) join the shipped answers
  const ADD = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "mini-word-additions.json"), "utf8")).words;
  for (const L of ["3", "4", "5"]) for (const w of ADD[L]) vetted.add(w);
  for (const p of all) if (p.type === "doku") for (const w of p.words) if (w.length > 3 || DOKU3.has(w)) vetted.add(w);
  for (const t of ["mini", "doku"]) for (const L of ["3", "4", "5"]) {
    // generation pool only; the gate below still validates against the full engine dictionary
    const W = E[t].WORDS[L];
    E[t].GEN = E[t].GEN || {};
    E[t].GEN[L] = Object.fromEntries(Object.entries(W).filter(([w]) => vetted.has(w) && !ban.has(w)));
  }
  const genE = {};
  for (const t of ["mini", "doku"]) {
    genE[t] = t === "mini" ? loadEngine("mini.js", "/* ---- Digi Puzzles: Mini player")
      : loadEngine("doku.js", "/* ---- Digi Puzzles: The Digi Doku player", ["/* ---- blocklist re-asserted", "/* ---- state ---- */"]);
    for (const L of ["3", "4", "5"]) { const W = genE[t].WORDS[L]; for (const w of Object.keys(W)) if (!(w in E[t].GEN[L])) delete W[w]; }
  }
  // per-target pool: drop words that would break the Mini reuse ladder on that date
  function poolFor(t, day, scale) {
    for (const L of ["3", "4", "5"]) {
      const W = genE[t].WORDS[L];
      for (const w of Object.keys(W)) delete W[w];
      for (const [w, tier] of Object.entries(E[t].GEN[L]))
        if (t !== "mini" || !(usage[w] || []).some(d => Math.abs(d - day) < GAP[w.length] * scale)) W[w] = tier;
    }
  }

  // layouts actually shipped by each type, minus banned ones, weighted by use
  const layouts = {};
  for (const t of ["mini", "doku"]) {
    const c = {};
    for (const p of all) if (p.type === t && !badLayout(p.mask)) c[p.mask.join("|")] = (c[p.mask.join("|")] || 0) + 1;
    layouts[t] = Object.entries(c).filter(([k]) => {
      const m = k.split("|"); for (let r = 0; r < 5; r++) for (let x = 0; x < 5; x++) if ((m[r][x] === "#") !== (m[4 - r][4 - x] === "#")) return false;
      return true; }).sort((a, b) => b[1] - a[1]);
  }

  const canonSeen = new Set(all.filter(p => !targets.includes(p)).map(p => canon(p.grid)));
  const usage = {};  // word -> [day,...] across Minis not being replaced
  for (const p of all) if (p.type === "mini" && !targets.includes(p)) for (const w of p.words) (usage[w] || (usage[w] = [])).push(dayNum(p.date));
  const seed0 = opts.seed || (Date.now() % 1e9);
  const result = [];

  for (const [ti, tg] of targets.entries()) {
    const G = genE[tg.type], gate = E[tg.type], day = dayNum(tg.date);
    const pick = (rnd) => { const L = layouts[tg.type], tot = L.reduce((s, x) => s + x[1], 0); let r = rnd() * tot;
      for (const [k, n] of L) { if ((r -= n) <= 0) return k.split("|"); } return L[0][0].split("|"); };
    const rnd = G.mulberry32((seed0 + ti * 7919) >>> 0);
    let got = null, ladder = 1;
    // The schedule is already full both sides, so the full reuse ladder (3:30d
    // 4:60d 5:75d, checked in both directions) is often unfillable mid-run.
    // Try it first, then relax to half, then a quarter; the plan records which.
    // --gaps and --strict fill at the full ladder only; the pinwheel clean-up may relax it
    const tries = opts.gaps || opts.strict ? [[1, opts.secs || 120]] : [[1, opts.secs || 15], [0.5, 60], [0.25, 60]];
    for (const [scale, secs] of tries) {
    if (got) break;
    ladder = scale; poolFor(tg.type, day, scale);
    const T0 = Date.now();
    for (let attempt = 0; attempt < 20000 && !got && Date.now() - T0 < secs * 1000; attempt++) {
      const pat = pick(rnd);
      if (badLayout(pat)) continue;
      const f = G.fillBand(pat, tg.band, (seed0 * 31 + ti * 104729 + attempt * 2654435761) >>> 0, 12000);
      if (!f) continue;
      const v = gate.validate(f.sol, f.slots, tg.band);          // full-dictionary engine gate
      if (!v.pass) continue;
      const words = v.meta.answers;
      if (words.some(w => ban.has(w))) continue;
      if (words.some((w, i) => words.some((x, j) => i !== j && (x === w + "s" || x === w + "es" || x === w + "d" || x === w + "ed")))) continue; // LET + LETS
      if (tg.type === "mini" && words.some(w => (usage[w] || []).some(d => Math.abs(d - day) < GAP[w.length] * scale))) continue;
      const grid = f.sol.map(r => r.map(c => (c === "#" ? "#" : c.toUpperCase())));
      if (canonSeen.has(canon(grid))) continue;
      let extra = {};
      if (tg.type === "doku") { extra = lockFor(gate, grid, tg.band, rnd); if (!extra) continue; }
      got = { grid, words, ...extra };
    }
    }
    if (!got) { console.log(`FAILED ${tg.file}`); continue; }
    canonSeen.add(canon(got.grid));
    if (tg.type === "mini") for (const w of got.words) (usage[w] || (usage[w] = [])).push(day);
    const ent = entries(gate, got.grid);
    result.push({ file: tg.file, date: tg.date, type: tg.type, serial: tg.serial, band: tg.band, ladder,
      grid: got.grid, locked: got.locked, bank: got.bank,
      across: ent.filter(e => e.t === "A").map(e => e.word), down: ent.filter(e => e.t === "D").map(e => e.word),
      ...(tg.type === "mini" ? { standfirst: "", clues: Object.fromEntries(ent.map(e => [e.word, ""])) } : {}) });
    console.log(`${tg.date} ${tg.type} ${tg.serial} ${tg.band} ladder×${ladder}  ${got.grid.map(r => r.join("")).join("|")}`);
  }
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1) + "\n");
  console.log(`wrote ${result.length}/${targets.length} to ${outFile}`);
}

/* Ladder breaches: consecutive uses of a Mini answer closer than GAP days.
   Returns a small set of Minis dated in [from, until] that covers every breach
   with at least one end in the range (greedy cover; a breach whose other end
   is outside the range can only be fixed from inside it). */
function gapTargets(all, from, until) {
  const minis = all.filter(p => p.type === "mini"), use = {};
  for (const p of minis) for (const w of p.words) (use[w] || (use[w] = [])).push(p);
  const inR = p => p.date >= from && p.date <= until, pairs = [];
  for (const [w, L] of Object.entries(use)) {
    L.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < L.length; i++)
      if (dayNum(L[i].date) - dayNum(L[i - 1].date) < GAP[w.length] && (inR(L[i]) || inR(L[i - 1]))) pairs.push([L[i - 1], L[i], w]);
  }
  const pick = [];
  let left = pairs;
  while (left.length) {
    const n = new Map();
    for (const [a, b] of left) for (const x of [a, b]) if (inR(x)) n.set(x, (n.get(x) || 0) + 1);
    const best = [...n].sort((x, y) => y[1] - x[1] || x[0].date.localeCompare(y[0].date))[0][0];
    pick.push(best); left = left.filter(([a, b]) => a !== best && b !== best);
  }
  console.log(`ladder breaches touching ${from}..${until}: ${pairs.length}; regenerating ${pick.length} Mini(s)`);
  return pick.sort((a, b) => a.date.localeCompare(b.date));
}

// Locks for a new Doku: within the band's density, passing the engine gate, with
// no second fill in everyday words, and meeting the difficulty rule of
// tools/doku-grade.js (easy: at least one crossing deduction and no stall;
// medium/hard: at most one stall). The first 300 tries also ask a medium or
// hard one for a way in (first move a deduction); the last 150 drop that.
// The lock pattern is screened like a layout too, as the feed card shades it.
function lockFor(E, grid, band, rnd) {
  const cells = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (grid[r][c] !== "#") cells.push([r, c]);
  const [lo, hi] = E.DENSITY[band];
  const nMin = Math.ceil(lo * cells.length - 1e-9), nMax = Math.floor(hi * cells.length + 1e-9);
  for (let t = 0; t < 450; t++) {
    const n = nMin + Math.floor(rnd() * (Math.max(nMax, nMin) - nMin + 1));
    const sh = cells.slice().sort(() => rnd() - 0.5).slice(0, n).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const locked = sh.map(([r, c]) => [r + 1, c + 1]);
    const lk = new Set(sh.map(([r, c]) => r + "," + c));
    const bank = cells.filter(([r, c]) => !lk.has(r + "," + c)).map(([r, c]) => grid[r][c]).sort(() => rnd() - 0.5);
    const pz = { grid, locked, bank, band };
    if (!lockShapeOK(grid, locked) || !gradeFits(pz, t < 300)) continue;   // cheapest checks first
    if (E.validateLexi(pz).pass && broadAlts(pz) === 0) return { locked, bank };
  }
  return null;
}

/* ---------- --apply -------------------------------------------------------- */
const DOKU_SF = [
  [/^\d+ letters are locked in, \d+ wait in the bank\./, (L, B) => `${L} letters are locked in, ${B} wait in the bank. Place them so every across and down run reads as a word — there's exactly one arrangement that works.`],
  [/^No clues today — just \d+ loose letters and \d+ locked ones\./, (L, B) => `No clues today — just ${B} loose letters and ${L} locked ones. Slot them so every run is a real word; only one fill clears the board.`],
  [/^The bank holds \d+ letters this round; \d+ are already fixed\./, (L, B) => `The bank holds ${B} letters this round; ${L} are already fixed. Get every run reading as a word — exactly one way through.`],
  [/^\d+ letters in the bank, \d+ already set\./, (L, B) => `${B} letters in the bank, ${L} already set. Place each tile so every across and down run is a real word — one solution, no guessing.`],
  [/^\d+ anchors, \d+ tiles to place\./, (L, B) => `${L} anchors, ${B} tiles to place. Every across and down run has to read true, and there's a single arrangement that does it.`],
];
const esc = s => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const htmlAttr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const gridLit = g => "[" + g.map(r => "[" + r.map(c => JSON.stringify(c)).join(",") + "]").join(",") + "]";
const stem = w => w.replace(/(es|s|ed|ing|er|ly)$/, "");

function apply(planFile) {
  const E = engines(), planned = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const before = Object.fromEntries(planned.map(p => [p.file, fs.readFileSync(path.join(REPORTS, p.file), "utf8")]));
  const files = new Set(planned.map(p => p.file));
  const others = scan(E).filter(p => !files.has(p.file));
  // the same clue text on any other Mini within a year (any answer) is refused; further apart is
  // allowed, as in tools/check-mini-clues.js, so clue-bank reuse works for new grids too (20 Oct 2026)
  const clueSeen = new Map(), near = (a, b) => Math.abs(dayNum(a) - dayNum(b)) <= 365;
  const seen = (k, f, d) => (clueSeen.get(k) || []).find(x => x.file !== f && near(x.date, d));
  for (const p of others) for (const c of p.clues) { const k = c.toLowerCase().trim(); clueSeen.set(k, [...(clueSeen.get(k) || []), { file: p.file, date: p.date }]); }
  const problems = [];

  for (const p of planned) {
    let s = before[p.file], o = s;
    const swap = (re, txt, what) => { const n = s.replace(re, () => txt); if (n === s && !re.test(s)) problems.push(`${p.file}: ${what} not found`); s = n; };
    swap(/grid:\s*\[\s*\[[\s\S]*?\]\s*\]/, "grid:" + (p.type === "doku" ? " " : "") + gridLit(p.grid), "grid");
    if (p.type === "mini") {
      const words = [...p.across, ...p.down];
      for (const w of words) if (!p.clues[w] || !p.clues[w].trim()) problems.push(`${p.file}: no clue for ${w}`);
      if (!p.standfirst || !p.standfirst.trim()) problems.push(`${p.file}: no standfirst`);
      const order = []; // clue block in the house order: across then down
      for (const w of words) order.push(`    ${w}:"${esc(p.clues[w] || "")}"`);
      swap(/clues:\{[^\n]*\n[\s\S]*?\n\s*\}/, "clues:{ // keyed by answer (unique within a puzzle)\n" + order.join(",\n") + "\n  }", "clues");
      if (!/<meta name="dn:standfirst" content="[^"]*">/.test(s)) problems.push(`${p.file}: standfirst meta not found`);
      s = s.replace(/<meta name="dn:standfirst" content="[^"]*">/, `<meta name="dn:standfirst" content="${htmlAttr(p.standfirst || "")}">`);
      // link preview: tools/og-tags.js copies the standfirst on the next build; keep them equal now
      s = s.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${htmlAttr(p.standfirst || "")}">`);
      // clue screens
      for (const w of words) {
        const c = (p.clues[w] || "").toLowerCase(), toks = c.match(/[a-z]+/g) || [];
        if (toks.some(t => t === w || (stem(w).length >= 3 && stem(t) === stem(w)))) problems.push(`${p.file}: SELF-LEAK ${w}: ${p.clues[w]}`);
        for (const x of words) if (x !== w && toks.includes(x)) problems.push(`${p.file}: CROSS-LEAK ${x} in clue for ${w}`);
        const k = c.trim(), dup = seen(k, p.file, p.date);
        if (dup) problems.push(`${p.file}: duplicate clue text "${p.clues[w]}" within a year (also ${dup.file})`);
        clueSeen.set(k, [...(clueSeen.get(k) || []), { file: p.file, date: p.date }]);
      }
    } else {
      swap(/locked:\s*\[[\s\S]*?\]\s*\],?\s*\n/, "locked: " + JSON.stringify(p.locked).replace(/,/g, ",") + ",\n", "locked");
      swap(/bank:\s*\[[^\]]*\]/, "bank: " + JSON.stringify(p.bank), "bank");
      const cur = (s.match(/<meta name="dn:standfirst" content="([^"]*)">/) || [])[1] || "";
      const tpl = (DOKU_SF.find(([re]) => re.test(cur)) || DOKU_SF[0])[1];
      s = s.replace(/<meta name="dn:standfirst" content="[^"]*">/, `<meta name="dn:standfirst" content="${htmlAttr(tpl(p.locked.length, p.bank.length))}">`);
    }
    if (s === o) problems.push(`${p.file}: unchanged`);
    fs.writeFileSync(path.join(REPORTS, p.file), s);
  }

  // re-parse from disk and re-gate
  for (const p of planned) {
    const s = fs.readFileSync(path.join(REPORTS, p.file), "utf8");
    const m = s.match(/window\.DN_PUZZLE=(\{[\s\S]*?\n\});/);
    let pz; try { pz = vm.runInNewContext("(" + m[1] + ")"); } catch (e) { problems.push(`${p.file}: puzzle object does not parse`); continue; }
    if (badLayout(maskOf(pz.grid))) problems.push(`${p.file}: banned layout`);
    if (pz.band !== p.band) problems.push(`${p.file}: band changed`);
    if (p.type === "mini") {
      const lg = pz.grid.map(r => r.map(c => (c === "#" ? "#" : c.toLowerCase())));
      const slots = E.mini.findSlots(lg), v = slots && E.mini.validate(lg, slots, pz.band);
      if (!v || !v.pass) problems.push(`${p.file}: engine gate FAILS ${JSON.stringify(v && v.checks)}`);
      const keys = Object.keys(pz.clues).sort().join(","), ans = (v ? v.meta.answers : []).slice().sort().join(",");
      if (keys !== ans) problems.push(`${p.file}: clue keys != answers`);
    } else {
      const v = E.doku.validateLexi(pz);
      if (!v.pass) problems.push(`${p.file}: Doku gate FAILS ${JSON.stringify(v.checks)}`);
      if (broadAlts(pz)) problems.push(`${p.file}: Doku has a second fill in everyday words (tools/doku-broad-check.js)`);
      if (!gradeFits(pz, false)) problems.push(`${p.file}: Doku breaks the difficulty rule (tools/doku-grade.js)`);
    }
    // masked diff: only the grid/locked/bank/clues block and the standfirst may differ
    const strip = x => x.replace(/<meta name="dn:standfirst" content="[^"]*">/, "")
      .replace(/<meta property="og:description" content="[^"]*">/, "")
      .replace(/window\.DN_PUZZLE=\{[\s\S]*?\n\};/, "");
    if (strip(s) !== strip(before[p.file])) problems.push(`${p.file}: masked diff — unexpected change outside the puzzle data`);
    const keep = x => (x.match(/id:"[^"]+"/) || [])[0] + (x.match(/type:"[^"]+"/) || [])[0];
    if (keep(s) !== keep(before[p.file])) problems.push(`${p.file}: id/type changed`);
  }
  // the Mini clue gate, run on what is now on disk
  const miniFiles = planned.filter(p => p.type === "mini").map(p => p.file);
  if (miniFiles.length) for (const q of checkMinis({ from: "0000-00-00", files: miniFiles }).problems)
    problems.push(`${q.file}: ${q.kind} ${q.answer.toUpperCase()}: "${q.clue}" (${q.why})`);
  if (problems.length) {
    for (const p of planned) fs.writeFileSync(path.join(REPORTS, p.file), before[p.file]); // roll back
    console.log("REFUSED — nothing written:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  console.log(`applied ${planned.length}: ${planned.map(p => p.date + " " + p.type + p.serial).join(", ")}`);
}

/* ---------- cli ------------------------------------------------------------ */
const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i < 0 ? undefined : a[i + 1]; };
if (a.includes("--check")) check(+(arg("--days") || 21));
else if (a.includes("--plan")) plan(arg("--plan"), { until: arg("--until"), next: arg("--next") ? +arg("--next") : 0, seed: arg("--seed") ? +arg("--seed") : 0, only: arg("--only"),
  gaps: a.includes("--gaps"), strict: a.includes("--strict"), from: arg("--from"), secs: arg("--secs") ? +arg("--secs") : 0, exclude: arg("--exclude") });
else if (a.includes("--apply")) apply(arg("--apply"));
else { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); process.exit(2); }
