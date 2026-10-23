#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Digi Puzzles — build-registry.js  (v2.1, 17 Oct 2026)
   Derives the whole published state from the repo. Nothing here is authored
   by hand; if it disagrees with a document, the repo is right.

   v2: all seven types (mini, doku, path, sweep, link, borders, tangle); reads
   thin engine pages (window.DN_PUZZLE={…}) as well as self-contained files;
   Mini answer repeats reported against the length ladder (3:30d, 4:60d, 5:75d).
   v2.1: spinning ("pinwheel") 5x5 layouts are refused alongside the swastika
   screen — see the visual screen below.
   (18 Oct 2026: copied into the repo from project knowledge, unchanged.)
   (23 Oct 2026: explicit LEGACY file map; ids written with \\u00b7 escapes read.)

   Usage (from the repo root):
     node tools/build-registry.js                 # write registry.json + published.json, print report
     node tools/build-registry.js --check         # report only, exit 1 on any ERROR
     node tools/build-registry.js --dir reports   # override scan directory
     node tools/build-registry.js --today 2026-10-15   # pin "today" for runway maths

   Outputs (repo root, build products — never edit):
     registry.json   one record per published puzzle + per-type summary
     published.json  dedup ledger per type (D4 key for grids, canonical key for Link)
--------------------------------------------------------------------------- */
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const CHECK_ONLY = args.includes("--check");
const DIR = opt("--dir") || "reports";
const TODAY = opt("--today") || new Date().toISOString().slice(0, 10);
const ROOT = process.cwd();
const SCAN = path.join(ROOT, DIR);

/* --- type table --------------------------------------------------------
   slug      : the filename slug (also what dn-track.js / admin key on)
   id        : the DP·<ID>· prefix
   serial    : filename ends -NNNN (Sweep is dated instead)
   gridMask  : the feed tile is read from a plain `grid` literal; required
   gridChars : what that literal may contain (shape only — never a solve)    */
const TYPES = {
  "crossword-mini": { key: "mini",    id: "MINI",  serial: true,  topic: "Crossword", gridMask: true },
  "logic-doku":     { key: "doku",    id: "LEXI",  serial: true,  topic: "Logic",     gridMask: true },
  "logic-path":     { key: "path",    id: "PATH",  serial: true,  topic: "Logic",     gridMask: true, gridChars: /^[.]*$/ },
  "logic-sweep":    { key: "sweep",   id: "SWEEP", serial: false, topic: "Logic",     gridMask: true, gridChars: /^[.o]*$/ },
  "word-link":      { key: "link",    id: "LINK",  serial: true,  topic: "Word",      gridMask: false },
  "geo-borders":    { key: "borders", id: "BORD",  serial: true,  topic: "Geography", gridMask: false },
  "quiz-reckon":    { key: "reckon",  id: "RECK",  serial: true,  topic: "Quiz",      gridMask: false },
  "word-tangle":    { key: "tangle",  id: "TANG",  serial: true,  topic: "Word",      gridMask: true, gridChars: /^[.]*$/ }
};
const PUZZLE_TOPICS = new Set(Object.values(TYPES).map(t => t.topic));
const FNAME = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})-(${Object.keys(TYPES).join("|")})(?:-(\\d{4}))?\\.html$`);
/* Legacy files (23 Oct 2026): July pages published before the naming pattern.
   Their URLs are shared and saved, so they are never renamed; this explicit
   map (file -> type slug, date, serial) lets the registry see them. Each date
   must still match the page's own dn:date. digi-doku-0004.html is deliberately
   absent: it is a pre-pattern copy of 2026-07-17-logic-doku-0004.html (same id
   and grid), so listing it would only report a duplicate (accepted history in
   tools/tests/fixtures/registry-debt.json).                                */
const LEGACY = {
  "DP-SWEEP-2026-07-17.html": { slug: "logic-sweep", date: "2026-07-17", serial: null },
  "digi-path-0002.html":      { slug: "logic-path",  date: "2026-07-20", serial: "0002" }
};
const REPEAT_LADDER = { 3: 30, 4: 60, 5: 75 };   // Mini answer reuse, days, by answer length

const problems = [];
const note = (level, type, file, msg) => problems.push({ level, type, file, msg });

/* --- small parsers ------------------------------------------------------
   Deliberately not a JS parser. We read the plain literals the feed contract
   guarantees are there; if a literal has been minified away, that is itself
   the finding we want to report.                                          */
function meta(src, name) {
  const m = src.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`));
  return m ? m[1] : null;
}
/* the puzzle object: thin page (window.DN_PUZZLE=) or self-contained (SAMPLE / PUZZLE =) */
function puzzleObject(src) {
  const at = src.search(/(?:window\.DN_PUZZLE|const\s+SAMPLE|const\s+PUZZLE)\s*=\s*\{/);
  return at < 0 ? src : src.slice(at);
}
function balanced(src, i, open, close) {
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close) { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return null;
}
function literal(src, key) {
  const at = src.search(new RegExp(`\\b${key}\\s*:\\s*\\[`));
  if (at < 0) return null;
  const raw = balanced(src, src.indexOf("[", at), "[", "]");
  if (!raw) return null;
  try { return JSON.parse(raw.replace(/\/\/[^\n]*/g, "").replace(/'/g, '"').replace(/,\s*([\]}])/g, "$1")); }
  catch { return null; }
}
function scalar(src, key) {
  const m = src.match(new RegExp(`\\b${key}\\s*:\\s*"([^"]*)"`));
  return m ? m[1] : null;
}
function linkGroups(src) {
  const at = src.search(/\bgroups\s*:\s*\[/);
  if (at < 0) return null;
  const raw = balanced(src, src.indexOf("[", at), "[", "]");
  if (!raw) return null;
  const groups = [...raw.matchAll(/members\s*:\s*\[([^\]]*)\]/g)]
    .map(m => [...m[1].matchAll(/"([^"]*)"/g)].map(x => x[1].toUpperCase()));
  return groups.length ? groups : null;
}

/* --- dedup keys ---------------------------------------------------------
   D4: eight symmetries of the square; the key is the smallest rendering,
   namespaced by board size so a 5x5 entry can never protect a 6x6 grid.   */
function d4Key(grid) {
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0])) return null;
  const n = grid.length;
  const rot = g => g[0].map((_, c) => g.map(r => r[c]).reverse());
  const mir = g => g.map(r => [...r].reverse());
  let best = null, g = grid.map(r => [...r]);
  for (let i = 0; i < 4; i++) {
    for (const cand of [g, mir(g)]) {
      const s = cand.map(r => r.join(",")).join("|");
      if (best === null || s < best) best = s;
    }
    g = rot(g);
  }
  return `${n}:${best}`;
}
/* Link: the same four groups in any order, tiles in any order, is the same puzzle */
const linkKey = groups => groups ? "L:" + groups.map(g => [...g].sort().join("+")).sort().join("|") : null;
function mineGrid(rec, n, withOpening) {
  if (!Array.isArray(rec.mines)) return null;
  const g = Array.from({ length: n }, () => Array(n).fill("."));
  for (const [r, c] of rec.mines) { if (g[r - 1]) g[r - 1][c - 1] = "x"; }
  /* The opening is part of the puzzle: same mines + different free square is
     a different solve. Mine-set-only collisions are reported as a warning. */
  if (withOpening && Array.isArray(rec.start) && g[rec.start[0] - 1]) g[rec.start[0] - 1][rec.start[1] - 1] = "o";
  return g;
}

/* --- visual screen (added 15 Oct 2026 after Doku 0088; widened 17 Oct) --
   The card and the board show the grid's shape. Two things are refused:
   1. a 5x5 letter or black-square mask within one cell of a swastika, in any
      rotation or mirror;
   2. a "spinning" layout: one that a quarter turn leaves unchanged but a
      mirror changes, e.g. the four-dot pinwheel ...#.|#....|.....|....#|.#...
      Its black squares merge with the card's dark frame into four notches
      turning the same way, which reads as a swastika at thumbnail size.
      (Alec, 17 Oct 2026 — this reverses the 15 Oct allowance.)
   Spinning layouts still dated beyond SPIN_GRACE days are a WARN while the
   nightly clean-up (tools/pinwheel-regen.js) works through them.         */
const SPIN_GRACE = 21;
const SWASTIKA = ["XXX.X", "..X.X", "XXXXX", "X.X..", "X.XXX"];
const SW_REFS = (() => {
  const out = []; let g = SWASTIKA.map(r => [...r]);
  for (let i = 0; i < 4; i++) {
    out.push(g.map(r => r.join(""))); out.push(g.map(r => [...r].reverse().join("")));
    g = g[0].map((_, c) => g.map(r => r[c]).reverse());
  }
  return out;
})();
function badShape(grid) {
  if (!Array.isArray(grid) || grid.length !== 5) return false;
  const letters = grid.map(r => r.map(c => (c === "#" ? "." : "X")).join(""));
  const blacks = grid.map(r => r.map(c => (c === "#" ? "X" : ".")).join(""));
  const dist = (a, b) => a.reduce((n, row, i) => n + [...row].filter((ch, j) => ch !== b[i][j]).length, 0);
  return [letters, blacks].some(m => SW_REFS.some(ref => dist(m, ref) <= 1));
}
function spinning(grid) {
  if (!Array.isArray(grid) || grid.length !== 5) return false;
  const m = grid.map(r => r.map(c => (c === "#" ? "#" : ".")).join(""));
  const rot = x => x[0].split("").map((_, c) => x.map(r => r[c]).reverse().join(""));
  const k = m.join("|");
  return k.includes("#") && rot(m).join("|") === k && m.map(r => [...r].reverse().join("")).join("|") !== k;
}

/* --- per-type extraction ----------------------------------------------- */
function extract(full, t) {
  const src = puzzleObject(full);
  const rec = {};
  const foot = full.match(/<footer[^>]*>([\s\S]*?)<\/footer>/);
  rec.shell = foot ? ((foot[1].match(/SHELL[^·]*/i) || ["(no shell label)"])[0].replace(/SHELL\s*[—-]\s*/i, "SHELL ").trim()) : "(no footer)";
  rec.thin = /<script\s+src="\.\.\/engines\//.test(full);
  /* the id may write its middle dots as the JS escape \u00b7 (Doku 0002); same string at runtime */
  rec.pid = ((src.match(/\bid\s*:\s*"(DP(?:[·\-]|\\u00b7)[A-Z]+(?:[·\-]|\\u00b7)[0-9\-]+)"/) || [, null])[1] || "").replace(/\\u00b7/g, "·") || null;
  rec.band = scalar(src, "band");
  rec.grid = literal(src, "grid");

  if (t.key === "mini") {
    const cb = src.match(/clues\s*:\s*\{([\s\S]*?)\}/);
    rec.answers = cb ? [...cb[1].matchAll(/^\s*([a-z]+)\s*:/gm)].map(m => m[1]) : [];
    rec.d4 = d4Key(rec.grid);
  } else if (t.key === "doku") {
    rec.d4 = d4Key(rec.grid);
  } else if (t.key === "path") {
    rec.d4 = d4Key(literal(src, "solution"));
  } else if (t.key === "sweep") {
    rec.mines = literal(src, "mines");
    rec.start = literal(src, "start");
    const n = Array.isArray(rec.grid) ? rec.grid.length : 6;
    if (!Array.isArray(rec.start) && Array.isArray(rec.grid)) {   // opening marked "o" in the grid
      rec.grid.forEach((row, r) => row.forEach((c, k) => { if (c === "o") rec.start = [r + 1, k + 1]; }));
    }
    const mg = mineGrid(rec, n, false); rec.mineKey = mg ? d4Key(mg) : null;
    rec.d4 = d4Key(mineGrid(rec, n, true));
  } else if (t.key === "link") {
    rec.d4 = linkKey(linkGroups(src));
  } else if (t.key === "tangle") {
    const tiles = literal(src, "tiles");
    rec.d4 = Array.isArray(tiles) && tiles.length === 16
      ? d4Key([0, 1, 2, 3].map(r => tiles.slice(r * 4, r * 4 + 4))) : null;
  } else if (t.key === "borders") {
    rec.d4 = null;   // country sets repeat by design (shared atlas); no dedup key
  } else if (t.key === "reckon") {
    rec.d4 = null;   // facts repeat by design (shared Ballpark bank, 100-day gap gated by build-reckon-batch.js)
  }
  rec.n = Array.isArray(rec.grid) ? rec.grid.length : null;
  return rec;
}

/* --- scan -------------------------------------------------------------- */
if (!fs.existsSync(SCAN)) { console.error(`no such directory: ${SCAN}`); process.exit(2); }
const files = fs.readdirSync(SCAN).filter(f => f.endsWith(".html"));
const records = [];

for (const f of files.sort()) {
  const L = LEGACY[f];
  const m = FNAME.exec(f) || (L && [f, L.date, L.slug, L.serial]);
  if (!m) {
    const src = fs.readFileSync(path.join(SCAN, f), "utf8");
    if (meta(src, "dn:kind") === "puzzle") {
      const tp = meta(src, "dn:topic");
      if (PUZZLE_TOPICS.has(tp)) note("ERROR", "?", f, "puzzle file does not match YYYY-MM-DD-<type-slug>[-NNNN].html — invisible to the registry");
      else note("WARN", "?", f, `non-puzzle article carries dn:kind="puzzle" (topic "${tp}") — it will sit in the puzzle feed`);
    }
    continue; // articles and games are not our business
  }
  const [, date, slug, serial] = m;
  const t = TYPES[slug];
  const src = fs.readFileSync(path.join(SCAN, f), "utf8");
  const r = extract(src, t);

  const rec = {
    file: f, type: t.key, date,
    serial: serial ? parseInt(serial, 10) : null,
    id: r.pid, band: r.band, shell: r.shell, thin: r.thin, d4: r.d4, mineKey: r.mineKey, size: r.n,
    dn: { headline: meta(src, "dn:headline"), topic: meta(src, "dn:topic"), date: meta(src, "dn:date"), kind: meta(src, "dn:kind") },
    hasGridLiteral: Array.isArray(r.grid),
    answers: r.answers || undefined,
    bytes: src.length
  };
  records.push(rec);

  /* --- per-file checks (the pre-publish checklist, mechanised) --- */
  if (rec.dn.date !== date) note("ERROR", t.key, f, `dn:date ${rec.dn.date} != filename date ${date}`);
  if (rec.dn.kind !== "puzzle") note("ERROR", t.key, f, `dn:kind is "${rec.dn.kind}", expected "puzzle"`);
  if (rec.dn.topic !== t.topic) note("WARN", t.key, f, `dn:topic "${rec.dn.topic}", expected "${t.topic}"`);
  if (t.gridMask && !rec.hasGridLiteral) note("ERROR", t.key, f, "no readable `grid` array literal — feed tile will fall back to the Play glyph");
  if (/TODO —/.test(src)) note("ERROR", t.key, f, "template TODO placeholder text survives");
  if (!rec.id) note("ERROR", t.key, f, "no readable puzzle id");
  else if (!rec.id.includes(`·${t.id}·`) && !rec.id.includes(`-${t.id}-`)) note("ERROR", t.key, f, `puzzle id ${rec.id} is not a DP·${t.id}· id`);
  else if (t.serial && !rec.id.endsWith(String(serial))) note("ERROR", t.key, f, `visible id ${rec.id} disagrees with filename serial ${serial}`);
  else if (!t.serial && !rec.id.endsWith(date)) note("ERROR", t.key, f, `visible id ${rec.id} disagrees with filename date ${date}`);
  if (t.key !== "borders" && t.key !== "reckon" && !rec.d4) note("WARN", t.key, f, "could not compute a dedup key (solution literal unreadable)");
  if (rec.hasGridLiteral && (t.key === "mini" || t.key === "doku") && badShape(r.grid))
    note("ERROR", t.key, f, "grid layout reads as a swastika (letters or black squares) — never ship");
  if (rec.hasGridLiteral && (t.key === "mini" || t.key === "doku") && spinning(r.grid)) {
    const days = (Date.parse(date) - Date.parse(TODAY)) / 864e5;
    note(days <= SPIN_GRACE ? "ERROR" : "WARN", t.key, f, "spinning (pinwheel) layout — reads as a swastika on the card; replace with tools/pinwheel-regen.js");
  }
  if (rec.hasGridLiteral && t.gridChars) {
    const flat = r.grid.flat().join("");
    if (!t.gridChars.test(flat)) note("ERROR", t.key, f, `grid literal leaks solved values ("${[...new Set(flat)].join("")}") — a card must not spoil its own puzzle`);
  }
}

/* --- cross-file checks -------------------------------------------------- */
const byType = {};
for (const r of records) (byType[r.type] ||= []).push(r);

const keySeen = new Map();
for (const r of records) {
  if (!r.d4) continue;
  const k = `${r.type}|${r.d4}`;
  if (keySeen.has(k)) note("ERROR", r.type, r.file, `duplicate puzzle (D4/canonical key) with ${keySeen.get(k)}`);
  else keySeen.set(k, r.file);
}
const mineSeen = new Map();
for (const r of records) {
  if (r.type !== "sweep" || !r.mineKey) continue;
  if (mineSeen.has(r.mineKey)) note("WARN", "sweep", r.file, `same mine set as ${mineSeen.get(r.mineKey)} (different opening — allowed under house rule, listed for visibility)`);
  else mineSeen.set(r.mineKey, r.file);
}

const addDay = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const summary = {};
for (const [type, rows] of Object.entries(byType)) {
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const dates = rows.map(r => r.date);
  const dupDates = dates.filter((d, i) => dates.indexOf(d) !== i);
  for (const d of new Set(dupDates)) note("ERROR", type, "-", `two puzzles share date ${d}`);

  const set = new Set(dates), gaps = [];
  for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDay(d, 1)) if (!set.has(d)) gaps.push(d);

  const ser = rows.map(r => r.serial).filter(n => n != null);
  const serSet = new Set(ser), missingSer = [];
  const sMin = ser.length ? ser.reduce((a, b) => Math.min(a, b)) : null;
  const sMax = ser.length ? ser.reduce((a, b) => Math.max(a, b)) : null;
  if (ser.length) for (let s = sMin; s <= sMax; s++) if (!serSet.has(s)) missingSer.push(s);

  // a type that hasn't launched yet (first day still ahead, e.g. Reckon before 20 Oct 2026) counts its runway from its first day
  let runway = 0, d = dates[0] > TODAY ? dates[0] : TODAY;
  while (set.has(d) && runway <= 2000) { runway++; d = addDay(d, 1); }
  const firstMissing = d;

  const shells = [...new Set(rows.map(r => r.shell))];
  const thin = rows.filter(r => r.thin).length;

  summary[type] = {
    count: rows.length, thinPages: thin, selfContained: rows.length - thin,
    dateFirst: dates[0], dateLast: dates[dates.length - 1],
    serialFirst: sMin, serialLast: sMax,
    nextFreeSerial: sMax != null ? sMax + 1 : null,
    missingSerials: missingSer,
    calendarGaps: gaps,
    runwayDays: runway,
    firstMissingDay: firstMissing,
    shells,
    bands: rows.reduce((a, r) => (a[r.band] = (a[r.band] || 0) + 1, a), {})
  };
  if (gaps.length) note("ERROR", type, "-", `${gaps.length} missing day(s); first is ${gaps[0]}`);
  if (runway < 30) note("ERROR", type, "-", `only ${runway} days of runway left — goes dark ${firstMissing}`);
}

/* --- answer repetition (Mini), against the length ladder --------------- */
const answerUse = {};
for (const r of (byType.mini || [])) for (const a of (r.answers || [])) (answerUse[a] ||= []).push(r.date);
const tightRepeats = [];
for (const [w, ds] of Object.entries(answerUse)) {
  const limit = REPEAT_LADDER[w.length] || 75;
  ds.sort();
  for (let i = 1; i < ds.length; i++) {
    const gap = (new Date(ds[i]) - new Date(ds[i - 1])) / 864e5;
    if (gap < limit) tightRepeats.push({ answer: w, days: gap, limit, on: [ds[i - 1], ds[i]] });
  }
}
tightRepeats.sort((a, b) => a.days - b.days);

/* --- write + report ----------------------------------------------------- */
const registry = { generatedAt: new Date().toISOString(), today: TODAY, scanned: DIR, summary, records };
const published = {};
for (const r of records) if (r.d4) (published[r.type] ||= []).push({ key: r.d4, file: r.file, date: r.date });

if (!CHECK_ONLY) {
  fs.writeFileSync(path.join(ROOT, "registry.json"), JSON.stringify(registry, null, 2));
  fs.writeFileSync(path.join(ROOT, "published.json"), JSON.stringify(published, null, 2));
}

const errs = problems.filter(p => p.level === "ERROR");
const warns = problems.filter(p => p.level === "WARN");
const pad4 = n => String(n).padStart(4, "0");

console.log(`Digi Puzzles — registry (today ${TODAY})\n`);
for (const [t, s] of Object.entries(summary)) {
  console.log(`${t.padEnd(8)} ${String(s.count).padStart(4)} files  ${s.dateFirst} .. ${s.dateLast}` +
    (s.serialLast != null ? `  serials ${pad4(s.serialFirst)}-${pad4(s.serialLast)}  next ${pad4(s.nextFreeSerial)}` : "  (dated)"));
  console.log(`         runway ${s.runwayDays}d (dark from ${s.firstMissingDay})` +
    (s.calendarGaps.length ? `  · ${s.calendarGaps.length} missing day(s)` : "") +
    (s.missingSerials.length ? `  · ${s.missingSerials.length} missing serial(s)` : "") +
    `  · ${s.thinPages} thin / ${s.selfContained} self-contained`);
}
console.log(`\n${errs.length} error(s), ${warns.length} warning(s)`);
const show = (list, n) => { for (const p of list.slice(0, n)) console.log(`  [${p.level}] ${p.type} ${p.file}: ${p.msg}`); if (list.length > n) console.log(`  … and ${list.length - n} more`); };
if (errs.length) { console.log("\nERRORS"); show(errs, 40); }
if (warns.length) { console.log("\nWARNINGS"); show(warns, 15); }
if (tightRepeats.length) {
  console.log(`\nMini answer repeats inside the ladder (3:30d 4:60d 5:75d): ${tightRepeats.length}`);
  for (const r of tightRepeats.slice(0, 10)) console.log(`  ${r.answer} — ${r.days}d apart, limit ${r.limit} (${r.on.join(" → ")})`);
}
if (!CHECK_ONLY) console.log("\nwrote registry.json, published.json");
if (opt("--report")) fs.writeFileSync(opt("--report"), JSON.stringify({ today: TODAY, summary, problems }, null, 2) + "\n");
process.exit(CHECK_ONLY && errs.length ? 1 : 0);
