#!/usr/bin/env node
/* tools/mini-clue-batch.js — the Mini clue-editing pipeline (Noodle Puzzles, 19 Oct 2026)

   Puzzle-quality Phase 3 runs month by month: each batch of forthcoming Minis
   gets an editorial pass against the Mini clue rules (tools/mini-clue-brief.md)
   and ships with tools/mini-reclue.js (clue text only) or, for grids that
   break the answer-reuse ladder, tools/pinwheel-regen.js --apply. This tool is
   the glue, so a batch is mostly mechanical:

     1. node tools/pinwheel-regen.js --plan DIR/gap-plan.json --gaps --from A --until B
        (the few grids to regenerate; skip if it finds none)
     2. node tools/mini-clue-batch.js --prep A B DIR [--plan DIR/gap-plan.json] [--sheets 3]
        writes DIR/pkg.json and DIR/sheetN.txt: each grid, every entry with its
        current clue, the checker's flags (MUST CHANGE), clues already used for
        that answer within a year (don't reuse), and BANK clues: ones used for
        the same answer only more than a year away that pass every check, so a
        forced repeat can often be swapped rather than rewritten.
     3. editors write changes only (see the brief) to DIR/outN.json and run
        node tools/mini-clue-batch.js --validate DIR DIR/outN.json
     4. node tools/mini-clue-batch.js --merge DIR DIR/out1.json ... [DIR/fixes.json]
        later files win; writes DIR/final.json (every clue), DIR/edits.json (for
        mini-reclue.js) and DIR/regen-filled.json (for pinwheel-regen.js --apply),
        then runs the clue gate over the whole range as it will stand and lists
        near-duplicate clues within the batch.
     5. checks on the merged batch (toolchain/mini-clue-editing.md has the prompts):
        --show DIR FILE (an editor's changes beside the old clues, for your review),
        --review-sheets DIR [N] (the changed clues and standfirsts, for fresh reviewers),
        --blind DIR then --blind-score DIR (old and new wording of every changed clue,
        shuffled, for two blind solvers; changed clues must not get harder)
     6. node tools/pinwheel-regen.js --apply DIR/regen-filled.json, then
        node tools/mini-reclue.js --apply DIR/edits.json, then
        node tools/mini-clue-batch.js --smoke DIR (every page in Chromium: no errors,
        the new clues and standfirst showing; plays three to the end)

   Edits format (changes only): [{ "file": "...html", "clues": { "ans": "new clue" },
     "md": ["ans"], "standfirst": "..., and .... Medium." }]  — "standfirst" only
   when it changes; "md" = the grid's one or two misdirection/double-definition
   answers. For a regenerated grid every clue and the standfirst are required.
*/
"use strict";
const fs = require("fs"), path = require("path");
const { readMini, auditPuzzle } = require("./check-clue-leaks.js");
const { clueProblems, checkMinis, norm } = require("./check-mini-clues.js");

const ROOT = path.resolve(__dirname, ".."), REPORTS = path.join(ROOT, "reports");
const dayNum = d => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);
const YEAR = 365;

function loadAll() {
  return fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-crossword-mini-\d+\.html$/.test(f)).sort()
    .map(f => { const p = readMini(path.join(REPORTS, f)); return { file: f, date: f.slice(0, 10), id: p.id, grid: p.grid, clues: p.clues,
      standfirst: (fs.readFileSync(path.join(REPORTS, f), "utf8").match(/<meta name="dn:standfirst" content="([^"]*)">/) || [])[1] }; });
}
// numbered entries in clue order (across then down)
function entries(grid) {
  const G = grid.map(r => r.map(c => (c === "#" ? "#" : String(c).toLowerCase()))), out = []; let n = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if (G[r][c] === "#") continue;
    const a = (c === 0 || G[r][c - 1] === "#") && c + 1 < 5 && G[r][c + 1] !== "#";
    const d = (r === 0 || G[r - 1][c] === "#") && r + 1 < 5 && G[r + 1][c] !== "#";
    if (a || d) n++;
    if (a) { let w = ""; for (let k = c; k < 5 && G[r][k] !== "#"; k++) w += G[r][k]; out.push({ n, dir: "A", ans: w }); }
    if (d) { let w = ""; for (let k = r; k < 5 && G[k][c] !== "#"; k++) w += G[k][c]; out.push({ n, dir: "D", ans: w }); }
  }
  return out.sort((x, y) => (x.dir === y.dir ? x.n - y.n : x.dir < y.dir ? -1 : 1));
}

/* ---------- --prep ---------------------------------------------------- */
function prep(from, to, dir, planFile, sheets) {
  fs.mkdirSync(dir, { recursive: true });
  const all = loadAll(), plan = planFile ? JSON.parse(fs.readFileSync(planFile, "utf8")) : [];
  const flags = {};
  for (const p of checkMinis({ from, to }).problems) (flags[p.file + "|" + p.answer] ||= []).push(`${p.kind}: ${p.why}`);
  // clue bank by answer: text -> every date it is used
  const bank = {};
  for (const m of all) for (const [a, c] of Object.entries(m.clues)) ((bank[a] ||= {})[norm(c)] ||= { text: c, days: [] }).days.push(dayNum(m.date));
  const pkg = [];
  for (const m of all.filter(m => m.date >= from && m.date <= to)) {
    const rg = plan.find(x => x.file === m.file), grid = rg ? rg.grid : m.grid, d = dayNum(m.date);
    const ents = entries(grid), answers = ents.map(e => e.ans);
    pkg.push({ file: m.file, date: m.date, id: m.id, regenerated: !!rg, grid: grid.map(r => r.join("")), standfirst: rg ? null : m.standfirst,
      entries: ents.map(e => {
        const avoid = [...new Set(all.filter(q => q.file !== m.file && q.clues[e.ans] && Math.abs(dayNum(q.date) - d) <= YEAR).map(q => q.clues[e.ans]))];
        const current = rg ? null : m.clues[e.ans];
        const others = Object.fromEntries(answers.map(a => [a, "x"]));
        const sugg = Object.values(bank[e.ans] || {}).filter(b => (!current || norm(b.text) !== norm(current))
          && b.days.every(x => Math.abs(x - d) > YEAR) && !clueProblems(e.ans, b.text).length && !/["{}<>&\\]/.test(b.text)
          && !auditPuzzle({ clues: { ...others, [e.ans]: b.text } }).some(h => h.clue === b.text)).map(b => b.text);
        return { ...e, current, flags: rg ? [] : (flags[m.file + "|" + e.ans] || []), avoid, bank: sugg };
      }) });
  }
  fs.writeFileSync(path.join(dir, "pkg.json"), JSON.stringify(pkg, null, 1));
  const size = Math.ceil(pkg.length / sheets);
  for (let b = 0; b < sheets; b++) {
    let t = "";
    for (const p of pkg.slice(b * size, (b + 1) * size)) {
      t += `\n=== ${p.file}  (${p.id}, ${p.date})${p.regenerated ? "  NEW GRID: write every clue and a standfirst" : ""}\n`;
      t += p.grid.map(r => "   " + r.split("").join(" ")).join("\n") + "\n";
      for (const e of p.entries) {
        t += `  ${e.n}${e.dir} ${e.ans.toUpperCase()}: ${e.current ? JSON.stringify(e.current) : "(new)"}${e.flags.length ? "   ⚑ MUST CHANGE — " + e.flags.join("; ") : ""}\n`;
        if (e.avoid.length) t += `        don't reuse (within a year): ${e.avoid.map(x => JSON.stringify(x)).join(" | ")}\n`;
        if (e.bank.length && (e.flags.length || !e.current)) t += `        BANK (free to reuse): ${e.bank.slice(0, 4).map(x => JSON.stringify(x)).join(" | ")}\n`;
      }
      t += `  standfirst: ${p.standfirst ? JSON.stringify(p.standfirst) : "(new grid: write one)"}\n`;
    }
    fs.writeFileSync(path.join(dir, `sheet${b + 1}.txt`), t);
  }
  const n = pkg.reduce((s, p) => s + p.entries.length, 0), must = pkg.reduce((s, p) => s + p.entries.filter(e => e.flags.length).length, 0);
  const swappable = pkg.reduce((s, p) => s + p.entries.filter(e => e.flags.length && e.bank.length).length, 0);
  console.log(`${pkg.length} Minis, ${n} clues: ${must} must change (${swappable} have a bank clue), ${pkg.filter(p => p.regenerated).length} new grid(s); ${sheets} sheet(s) in ${dir}`);
}

/* ---------- shared: merge edits onto the package ----------------------- */
function merged(pkg, outs) {
  const byFile = Object.fromEntries(pkg.map(p => [p.file, { clues: Object.fromEntries(p.entries.map(e => [e.ans, e.current])), md: [], standfirst: p.standfirst, changed: new Set() }]));
  for (const o of outs) for (const ed of o) {
    const t = byFile[ed.file]; if (!t) continue;
    for (const [a, c] of Object.entries(ed.clues || {})) { t.clues[a] = c; t.changed.add(a); }
    if (ed.md) t.md = ed.md;
    if (ed.standfirst) t.standfirst = ed.standfirst;
  }
  return byFile;
}
function problemsFor(pkg, byFile, files) {
  const out = [], say = (f, m) => out.push(`${f}: ${m}`);
  for (const p of pkg.filter(p => files.has(p.file))) {
    const t = byFile[p.file], ans = p.entries.map(e => e.ans);
    for (const a of ans) if (!t.clues[a] || !String(t.clues[a]).trim()) say(p.file, `no clue for ${a.toUpperCase()}`);
    for (const h of auditPuzzle({ clues: t.clues })) say(p.file, `${h.kind} ${h.ans}: "${h.clue}" (${h.why})`);
    for (const e of p.entries) {
      const c = t.clues[e.ans]; if (!c) continue;
      for (const q of clueProblems(e.ans, c)) say(p.file, `${q.kind} ${e.ans.toUpperCase()}: "${c}" (${q.why})`);
      if (e.flags.length && c === e.current) say(p.file, `${e.ans.toUpperCase()} is flagged and must change: "${c}"`);
      if (e.avoid.some(x => norm(x) === norm(c))) say(p.file, `REPEAT ${e.ans.toUpperCase()}: "${c}" was used within a year`);
      if (/["{}<>&\\]|[“”]/.test(c)) say(p.file, `PUNCTUATION ${e.ans.toUpperCase()}: single quotes only; no double quotes, braces, <, >, & or backslashes: "${c}"`);
      if (/\.\s*$/.test(c) && !/\.\.\.$/.test(c)) say(p.file, `STYLE ${e.ans.toUpperCase()}: no full stop at the end: "${c}"`);
      if (c.split(/\s+/).length > 11) say(p.file, `LENGTH ${e.ans.toUpperCase()}: "${c}"`);
      if (/_/.test(c) && !/(^|[^_])___([^_]|$)/.test(c)) say(p.file, `BLANK ${e.ans.toUpperCase()}: blanks are exactly three underscores: "${c}"`);
    }
    if (t.md.length < 1 || t.md.length > 2) say(p.file, `md lists ${t.md.length} misdirection/double-definition answers; need 1 or 2`);
    for (const a of t.md) if (!ans.includes(a)) say(p.file, `md answer not in grid: ${a}`);
    const sf = t.standfirst || "";
    if (!/^[A-Z‘'].*, and .+\. Medium\.$/.test(sf)) say(p.file, `STANDFIRST format "<phrase>, and <phrase>. Medium.": "${sf}"`);
    const sw = sf.replace(/, and /, " , ").replace(/ Medium\.$/, "").toLowerCase().match(/[a-z]+/g) || [];
    for (const a of ans) if (sw.includes(a) || sw.includes(a + "s")) say(p.file, `STANDFIRST contains the answer ${a.toUpperCase()}`);
    if (/["{}<>&\\]/.test(sf)) say(p.file, "STANDFIRST: no double quotes, braces, <, >, & or backslashes");
    // a standfirst left as it was must not quote a clue that changed
    if (!p.regenerated && sf === p.standfirst) for (const e of p.entries) if (t.changed.has(e.ans) && e.current) {
      const old = norm(e.current).replace(/^(a|an|the) /, "");
      if (old.length > 8 && norm(sf).includes(old)) say(p.file, `STANDFIRST still quotes the old ${e.ans.toUpperCase()} clue; write a new one`);
    }
  }
  return out;
}

/* ---------- --validate ---------------------------------------------- */
function validate(dir, outFile) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "pkg.json"), "utf8"));
  const out = JSON.parse(fs.readFileSync(outFile, "utf8"));
  const unknown = out.filter(o => !pkg.some(p => p.file === o.file)).map(o => o.file);
  const keyErr = [];
  for (const o of out) { const p = pkg.find(x => x.file === o.file); if (p) for (const k of Object.keys(o.clues || {})) if (!p.entries.some(e => e.ans === k)) keyErr.push(`${o.file}: ${k} is not an answer in this grid`); }
  const byFile = merged(pkg, [out]);
  const probs = [...unknown.map(f => `${f}: not in this batch`), ...keyErr, ...problemsFor(pkg, byFile, new Set(out.map(o => o.file)))];
  for (const p of probs) console.log(p);
  console.log(`\n${out.length} Minis, ${probs.length} problem(s)`);
  process.exit(probs.length ? 1 : 0);
}

/* ---------- --merge -------------------------------------------------- */
function merge(dir, outFiles) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "pkg.json"), "utf8"));
  const outs = outFiles.map(f => JSON.parse(fs.readFileSync(f, "utf8")));
  const byFile = merged(pkg, outs);
  const probs = problemsFor(pkg, byFile, new Set(pkg.map(p => p.file)));
  const planFile = path.join(dir, "gap-plan.json"), plan = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, "utf8")) : [];
  const final = [], edits = [], regen = [];
  for (const p of pkg) {
    const t = byFile[p.file];
    final.push({ file: p.file, clues: t.clues, md: t.md, standfirst: t.standfirst });
    if (p.regenerated) {
      const pl = plan.find(x => x.file === p.file);
      regen.push({ ...pl, clues: Object.fromEntries([...pl.across, ...pl.down].map(w => [w, t.clues[w]])), standfirst: t.standfirst });
    } else {
      const ch = Object.fromEntries(p.entries.filter(e => t.clues[e.ans] !== e.current).map(e => [e.ans, t.clues[e.ans]]));
      if (Object.keys(ch).length || t.standfirst !== p.standfirst) edits.push({ file: p.file, clues: ch, ...(t.standfirst !== p.standfirst ? { standfirst: t.standfirst } : {}) });
    }
  }
  fs.writeFileSync(path.join(dir, "final.json"), JSON.stringify(final, null, 1));
  fs.writeFileSync(path.join(dir, "edits.json"), JSON.stringify(edits, null, 1));
  fs.writeFileSync(path.join(dir, "regen-filled.json"), JSON.stringify(regen, null, 1));
  // the whole range as it will stand (repeats against every other Mini, either side)
  const from = pkg[0].date, to = pkg[pkg.length - 1].date;
  for (const q of checkMinis({ from, to, override: Object.fromEntries(final.map(o => [o.file, { clues: o.clues }])) }).problems)
    probs.push(`${q.file}: ${q.kind} ${q.answer.toUpperCase()}: "${q.clue}" (${q.why})`);
  // near-duplicates inside the batch: same answer with much the same wording, or one clue text on two answers
  const toks = s => new Set(s.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !["the", "and", "for", "with", "what", "one", "who"].includes(w)));
  const rows = []; for (const o of final) for (const [a, c] of Object.entries(o.clues)) rows.push({ f: o.file, a, c, t: toks(c) });
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const x = rows[i], y = rows[j], inter = [...x.t].filter(w => y.t.has(w)).length, uni = new Set([...x.t, ...y.t]).size, jac = uni ? inter / uni : 0;
    if ((x.a === y.a && jac >= 0.5) || (x.a !== y.a && norm(x.c) === norm(y.c)))
      probs.push(`NEAR-DUPLICATE ${x.f.slice(0, 10)} ${x.a.toUpperCase()} "${x.c}" | ${y.f.slice(0, 10)} ${y.a.toUpperCase()} "${y.c}"`);
  }
  const changed = edits.reduce((s, e) => s + Object.keys(e.clues).length, 0);
  for (const p of probs) console.log(p);
  console.log(`\nmerged ${final.length} Minis: ${changed} clue(s) changed on existing grids, ${regen.length} new grid(s), ${edits.filter(e => e.standfirst).length} standfirst(s); ${probs.length} problem(s)`);
  process.exit(probs.length ? 1 : 0);
}

/* ---------- --show: an editor's changes beside the old clues ------------- */
function show(dir, outFile) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "pkg.json"), "utf8"));
  for (const o of JSON.parse(fs.readFileSync(outFile, "utf8"))) {
    const p = pkg.find(x => x.file === o.file); if (!p) continue;
    const ch = Object.keys(o.clues || {}), kept = (o.md || []).filter(a => !ch.includes(a));
    console.log(`\n## ${p.id.slice(-4)} ${p.date}${p.regenerated ? " NEW" : ""} ${p.grid.join("|")} md=${(o.md || []).join(",")}` +
      (kept.length ? ` (kept: ${kept.map(a => JSON.stringify(p.entries.find(e => e.ans === a).current)).join(", ")})` : ""));
    for (const e of p.entries) if (ch.includes(e.ans))
      console.log(` ${e.flags.length ? "⚑" : " "}${e.ans.toUpperCase().padEnd(5)} ${o.clues[e.ans]}${e.bank.includes(o.clues[e.ans]) ? " [bank]" : ""}${e.current ? "   ⟵ " + e.current : ""}`);
    if (o.standfirst) console.log(`   SF: ${o.standfirst}${p.standfirst ? "   ⟵ " + p.standfirst : ""}`);
  }
}

/* ---------- --review-sheets: changed clues for fresh reviewers ------------ */
function reviewSheets(dir, n) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "pkg.json"), "utf8"));
  const fin = JSON.parse(fs.readFileSync(path.join(dir, "final.json"), "utf8"));
  const size = Math.ceil(fin.length / n); let total = 0;
  for (let k = 0; k < n; k++) {
    let t = "";
    for (const o of fin.slice(k * size, (k + 1) * size)) {
      const p = pkg.find(x => x.file === o.file);
      const ch = p.entries.filter(e => p.regenerated || o.clues[e.ans] !== e.current), sfch = p.regenerated || o.standfirst !== p.standfirst;
      if (!ch.length && !sfch) continue;
      t += `\n=== ${o.file}\n` + p.grid.map(r => "   " + r.split("").join(" ")).join("\n") + "\n";
      for (const e of ch) t += `  ${e.n}${e.dir} ${e.ans.toUpperCase()}: ${o.clues[e.ans]}${(o.md || []).includes(e.ans) ? "   [misdirection/double definition]" : ""}\n`;
      total += ch.length;
      if (sfch) t += `  standfirst: ${o.standfirst}\n  (it quotes two of this grid's clues; all clues: ${Object.values(o.clues).join(" / ")})\n`;
    }
    fs.writeFileSync(path.join(dir, `review${k + 1}.txt`), t);
  }
  console.log(`${total} changed clue(s) in ${n} review sheet(s) in ${dir}`);
}

/* ---------- --blind / --blind-score: is the new wording any harder? ------- */
function blind(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "pkg.json"), "utf8"));
  const fin = JSON.parse(fs.readFileSync(path.join(dir, "final.json"), "utf8"));
  const rows = [];
  for (const o of fin) { const p = pkg.find(x => x.file === o.file); if (p.regenerated) continue;
    for (const e of p.entries) if (o.clues[e.ans] !== e.current) rows.push({ key: o.file + "|" + e.ans, ans: e.ans, old: e.current, neu: o.clues[e.ans], md: (o.md || []).includes(e.ans) }); }
  for (const [tag, field, seed] of [["old", "old", 11], ["new", "neu", 29]]) {
    let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const r = rows.map(x => ({ ...x })); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    r.forEach((x, i) => (x.q = "Q" + String(i + 1).padStart(3, "0")));
    fs.writeFileSync(path.join(dir, `blind-${tag}-key.json`), JSON.stringify(r));
    fs.writeFileSync(path.join(dir, `blind-${tag}.txt`), r.map(x => `${x.q} | ${x.ans.length} letters | ${x[field]}`).join("\n") + "\n");
  }
  console.log(`${rows.length} changed clue(s): ${dir}/blind-old.txt and blind-new.txt for two blind solvers (answers to blind-old.ans.txt and blind-new.ans.txt)`);
}
function blindScore(dir) {
  const res = {};
  for (const tag of ["old", "new"]) {
    const key = JSON.parse(fs.readFileSync(path.join(dir, `blind-${tag}-key.json`), "utf8")), K = Object.fromEntries(key.map(r => [r.q, r])), a = {};
    for (const l of fs.readFileSync(path.join(dir, `blind-${tag}.ans.txt`), "utf8").split("\n")) { const m = l.split("|").map(x => x.trim()); if (K[m[0]]) a[K[m[0]].key] = (m[1] || "").toLowerCase().replace(/[^a-z]/g, ""); }
    res[tag] = { ok: key.filter(r => a[r.key] === r.ans).length, n: key.length, a };
  }
  const pct = r => (100 * r.ok / r.n).toFixed(1) + "%";
  console.log(`changed clues solved from the clue alone: old ${res.old.ok}/${res.old.n} (${pct(res.old)}), new ${res.new.ok}/${res.new.n} (${pct(res.new)})`);
  for (const r of JSON.parse(fs.readFileSync(path.join(dir, "blind-new-key.json"), "utf8")))
    if (res.new.a[r.key] !== r.ans) console.log(`  missed: ${r.key.slice(0, 10)} ${r.ans.toUpperCase()} ${JSON.stringify(r.neu)} -> ${res.new.a[r.key] || "?"}${res.old.a[r.key] === r.ans ? "  (old wording was solved)" : ""}${r.md ? "  (misdirection)" : ""}`);
}

/* ---------- --smoke: every page in Chromium --------------------------- */
async function smoke(dir, playList) {
  const H = require("./tests/harness.js"), play = require("./tests/play.js");
  const fin = JSON.parse(fs.readFileSync(path.join(dir, "final.json"), "utf8"));
  const playSet = new Set(playList.length ? playList : [fin[0].file, fin[Math.floor(fin.length / 2)].file, fin[fin.length - 1].file]);
  const b = await H.launch(); let bad = 0;
  for (const o of fin) {
    const { ctx, p } = await H.open(b, o.file, { time: o.file.slice(0, 10) + "T12:00:00+00:00" });
    const shown = await p.evaluate(() => [...document.querySelectorAll("#across .clue span, #down .clue span")].map(e => e.textContent));
    const want = Object.values(o.clues), miss = want.filter(c => !shown.includes(c));
    const sf = await p.evaluate(() => [document.querySelector('meta[name="dn:standfirst"]').content, (document.querySelector('meta[property="og:description"]') || {}).content]);
    let msg = "";
    if (miss.length || shown.length !== want.length) msg += ` clues shown ${shown.length}/${want.length}, missing ${JSON.stringify(miss)}`;
    if (sf[0] !== o.standfirst || sf[1] !== o.standfirst) msg += " standfirst/og:description mismatch";
    if (playSet.has(o.file)) { await play.grid(p); if (!(await play.boxOn(p))) msg += " did not finish"; }
    if (p.errs.length) msg += " page errors: " + p.errs.join(" | ");
    if (msg) { bad++; console.log("FAIL " + o.file + msg); }
    await ctx.close();
  }
  await b.close();
  console.log(`${fin.length} Mini page(s) opened, ${playSet.size} played to the end, ${bad} problem(s)`);
  process.exit(bad ? 1 : 0);
}

/* ---------- cli ------------------------------------------------------- */
const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i < 0 ? undefined : a[i + 1]; };
if (a[0] === "--prep") prep(a[1], a[2], a[3], arg("--plan"), +(arg("--sheets") || 3));
else if (a[0] === "--validate") validate(a[1], a[2]);
else if (a[0] === "--merge") merge(a[1], a.slice(2));
else if (a[0] === "--show") show(a[1], a[2]);
else if (a[0] === "--review-sheets") reviewSheets(a[1], +(a[2] || 2));
else if (a[0] === "--blind") blind(a[1]);
else if (a[0] === "--blind-score") blindScore(a[1]);
else if (a[0] === "--smoke") smoke(a[1], a.slice(2));
else { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); process.exit(2); }
