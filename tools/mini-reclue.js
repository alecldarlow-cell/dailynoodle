#!/usr/bin/env node
/* tools/mini-reclue.js — change Mini clue text in place (Noodle Puzzles, 19 Oct 2026)

   For editorial clue passes (puzzle-quality framework, Phase 3): rewrites only
   the clue strings of existing Minis, plus dn:standfirst and og:description
   when given. Grid, answers, id, serial, band, file name and everything else
   stay byte for byte, so links, streaks and saved progress are untouched.

   Usage (from the repo root):
     node tools/mini-reclue.js --apply EDITS.json [--dry]
   EDITS.json: [{ "file": "2026-10-24-crossword-mini-0105.html",
                  "clues": { "more": "...", ... },      // every answer, or just the changed ones
                  "standfirst": "..., and .... Medium." }]   // optional

   Refuses (and writes nothing) if: a file is dated today or earlier (London),
   a clue key isn't an answer in the grid, a clue holds a double quote, brace,
   backslash, <, > or & (engines/mini.js inserts clue text as HTML), the
   engine gate fails after re-parsing from disk, anything outside the clue
   strings / standfirst / og:description changed (masked diff), or
   tools/check-mini-clues.js finds a problem in an edited Mini.
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const { checkMinis } = require("./check-mini-clues.js");
const { readMini } = require("./check-clue-leaks.js");

const ROOT = path.resolve(__dirname, "..");
const REPORTS = path.join(ROOT, "reports");
const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const htmlAttr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const CLUES_RE = /clues:\{[^\n]*\n[\s\S]*?\n\s*\}/;           // the clues block only
const parseText = (s, f) => { const tmp = path.join(require("os").tmpdir(), "reclue-" + process.pid + "-" + f);
  fs.writeFileSync(tmp, s); try { return readMini(tmp); } finally { fs.unlinkSync(tmp); } };

function engine() {
  const src = fs.readFileSync(path.join(ROOT, "engines", "mini.js"), "utf8");
  const code = src.slice(0, src.indexOf("/* ---- Digi Puzzles: Mini player"));
  const ctx = { window: {}, document: { write() {} } }; vm.createContext(ctx);
  vm.runInContext(code + "\n;globalThis.__E={findSlots,validate};", ctx);
  return ctx.__E;
}

function apply(file, dry) {
  const edits = JSON.parse(fs.readFileSync(file, "utf8"));
  const today = londonToday(), E = engine(), problems = [], before = {}, after = {};
  for (const ed of edits) {
    const f = ed.file, p = path.join(REPORTS, f);
    if (!/^\d{4}-\d{2}-\d{2}-crossword-mini-\d+\.html$/.test(f) || !fs.existsSync(p)) { problems.push(`${f}: not a Mini in reports/`); continue; }
    if (f.slice(0, 10) <= today) { problems.push(`${f}: dated ${f.slice(0, 10)}, today or earlier — never edit live or past puzzles`); continue; }
    let s = before[f] = fs.readFileSync(p, "utf8");
    const pz = readMini(p), keys = Object.keys(pz.clues);
    const cm = s.match(CLUES_RE);
    if (!cm) { problems.push(`${f}: clues block not found`); continue; }
    let block = cm[0];
    for (const [a, c] of Object.entries(ed.clues || {})) {
      if (!keys.includes(a)) { problems.push(`${f}: ${a} is not an answer in this grid`); continue; }
      if (typeof c !== "string" || !c.trim() || /["{}<>&\\\n]/.test(c)) { problems.push(`${f}: bad clue text for ${a}: ${JSON.stringify(c)}`); continue; }
      const re = new RegExp(`(\\n\\s*${a}:")((?:[^"\\\\]|\\\\.)*)(")`);
      if (!re.test(block)) { problems.push(`${f}: clue line for ${a} not found`); continue; }
      block = block.replace(re, (m, x, old, z) => x + c + z);
    }
    s = s.replace(CLUES_RE, () => block);
    if (ed.standfirst !== undefined) {
      if (!ed.standfirst.trim()) problems.push(`${f}: empty standfirst`);
      const v = htmlAttr(ed.standfirst);
      if (!/<meta name="dn:standfirst" content="[^"]*">/.test(s)) problems.push(`${f}: standfirst meta not found`);
      s = s.replace(/<meta name="dn:standfirst" content="[^"]*">/, `<meta name="dn:standfirst" content="${v}">`);
      s = s.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${v}">`);
    }
    after[f] = s;
  }
  if (!problems.length && !dry) for (const f of Object.keys(after)) fs.writeFileSync(path.join(REPORTS, f), after[f]);

  // re-parse from disk (or from the pending text on --dry) and re-gate
  const changed = { files: 0, clues: 0, standfirsts: 0 };
  for (const f of Object.keys(after)) {
    const s = dry ? after[f] : fs.readFileSync(path.join(REPORTS, f), "utf8"), o = before[f];
    if (s === o) continue;
    changed.files++;
    const pz = parseText(s, f), old = parseText(o, f);
    if (JSON.stringify(pz.grid) !== JSON.stringify(old.grid) || pz.id !== old.id || pz.band !== old.band || pz.type !== old.type)
      problems.push(`${f}: grid, id, band or type changed`);
    if (Object.keys(pz.clues).join() !== Object.keys(old.clues).join()) problems.push(`${f}: clue keys or their order changed`);
    for (const k of Object.keys(pz.clues)) if (pz.clues[k] !== old.clues[k]) changed.clues++;
    const lg = pz.grid.map(r => r.map(c => (c === "#" ? "#" : c.toLowerCase())));
    const slots = E.findSlots(lg), v = slots && E.validate(lg, slots, pz.band);
    if (!v || !v.pass) problems.push(`${f}: engine gate FAILS`);
    else if (v.meta.answers.slice().sort().join() !== Object.keys(pz.clues).sort().join()) problems.push(`${f}: clue keys != answers`);
    // masked diff: only clue strings, the standfirst and og:description may differ
    const mask = x => x.replace(CLUES_RE, b => b.replace(/(\n\s*[a-z]+:")((?:[^"\\]|\\.)*)(")/g, "$1…$3"))
      .replace(/<meta name="dn:standfirst" content="[^"]*">/, "").replace(/<meta property="og:description" content="[^"]*">/, "");
    if (mask(s) !== mask(o)) problems.push(`${f}: masked diff — something outside the clue text changed`);
    const sf = (s.match(/<meta name="dn:standfirst" content="([^"]*)">/) || [])[1], og = (s.match(/<meta property="og:description" content="([^"]*)">/) || [])[1];
    if (og !== undefined && sf !== og) problems.push(`${f}: og:description differs from the standfirst`);
    if (sf !== (o.match(/<meta name="dn:standfirst" content="([^"]*)">/) || [])[1]) changed.standfirsts++;
  }
  // clue gate over the edited Minis, as they now stand
  const override = dry ? Object.fromEntries(Object.keys(after).map(f => [f, { clues: parseText(after[f], f).clues }])) : null;
  for (const q of checkMinis({ from: "0000-00-00", files: Object.keys(after), override }).problems)
    problems.push(`${q.file}: ${q.kind} ${q.answer.toUpperCase()}: "${q.clue}" (${q.why})`);

  if (problems.length) {
    if (!dry) for (const f of Object.keys(before)) fs.writeFileSync(path.join(REPORTS, f), before[f]); // roll back
    console.log(`REFUSED — nothing written:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`${dry ? "would change" : "changed"} ${changed.clues} clue(s) and ${changed.standfirsts} standfirst(s) in ${changed.files} Mini(s); all gates pass`);
}

const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i < 0 ? undefined : a[i + 1]; };
if (a.includes("--apply")) apply(arg("--apply"), a.includes("--dry"));
else { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); process.exit(2); }
