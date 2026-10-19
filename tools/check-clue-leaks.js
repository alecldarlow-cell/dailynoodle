#!/usr/bin/env node
/* tools/check-clue-leaks.js — Mini clue-leak gate (Noodle Puzzles)

   First written 11 Aug 2026 (it was handed over then but never committed);
   restored into the repo 19 Oct 2026 and taught to read the current page
   format (window.DN_PUZZLE={...}) as well as the July pages (const SAMPLE={...}).

   Mechanical gate for the Mini authoring rule "don't repeat the answer's root
   and don't give away a crossing entry" (3_typespec_mini_crossword-1.md,
   Clue authoring). The ship gate proves the grid; this proves the clues.

   Two failure classes:
     SELF-LEAK  — the clue contains the answer's own root
                  (PAY <- "What lands on payday")
     CROSS-LEAK — the clue contains another answer from the same grid
                  (DAM <- "Stem the river", where STEM is 5-Down)

   Matching is stem-aware, with two guards against false positives: a stem must
   keep at least 60% of the word ("rating" must not collapse to "rat"), and a
   function word that is itself an answer (THE, ALL, FOR) is exempt from the
   cross check unless the clue uses it verbatim.

   Usage:  node tools/check-clue-leaks.js [reports-dir] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
   Exit 1 if any leak is found. Also usable as a module: { readMini, auditPuzzle }.
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

// Function words can prefix an answer by coincidence (THE/THEM, ON/ONES) and
// are never a giveaway on their own.
const STOP = new Set(("the a an of to in on for and or is it its at as by so no up out off with "
  + "you your this that what not all one who how when where be am are was were do does did "
  + "has have had my me we he she they them their there here from into over under").split(" "));

const stem = w => w.replace(/(ies)$/, "y").replace(/(ing|ed|es|s|er|ers|ly)$/, "");
const words = s => (s.toLowerCase().match(/[a-z]+/g) || []);

/* Read the puzzle object from a Mini page: window.DN_PUZZLE={...} (current)
   or const SAMPLE={...} (the first pages, July 2026). Returns null if absent. */
function readMini(file) {
  const txt = fs.readFileSync(file, "utf8");
  let i = txt.indexOf("window.DN_PUZZLE=");
  if (i < 0) i = txt.indexOf("const SAMPLE=");
  if (i < 0) return null;
  let j = txt.indexOf("{", i), depth = 0, k = j, inStr = false, q = "";
  for (; k < txt.length; k++) {
    const c = txt[k];
    if (inStr) { if (c === "\\") { k++; continue; } if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { k++; break; } }
  }
  return vm.runInNewContext("(" + txt.slice(j, k) + ")");
}

function auditPuzzle(p) {
  const hits = [];
  const answers = Object.keys(p.clues).map(a => a.toLowerCase());
  for (const [ansRaw, clue] of Object.entries(p.clues)) {
    const A = ansRaw.toLowerCase(), sA = stem(A), cw = words(clue);

    for (const w of cw) {
      if (STOP.has(w) || w.length < 3) continue;
      const sW = stem(w);
      let why = null;
      if (w === A) why = "answer verbatim";
      else if (w.startsWith(A) || A.startsWith(w)) why = `shares root with "${w}"`;
      else if (sA.length >= 3 && sW.length >= 3 &&
               (sA === sW || sA.startsWith(sW) || sW.startsWith(sA))) why = `same stem as "${w}"`;
      else if (A.length >= 4 && w.includes(A)) why = `answer spelled inside "${w}"`;
      else if (A.length >= 5 && w.length >= 5 && sA.slice(0, 4) === sW.slice(0, 4))
        why = `first four letters match "${w}"`;
      if (why) { hits.push({ kind: "SELF-LEAK", ans: A.toUpperCase(), clue, why }); break; }
    }

    for (const other of answers) {
      // A function word that is itself an answer (THE, ALL, FOR) will appear
      // grammatically in other clues and is not a giveaway — exempt it.
      if (other === A || other.length < 3 || STOP.has(other)) continue;
      const sO = stem(other);
      if (sO.length < 3) continue;            // ONES -> "on": a particle, not a giveaway
      // a stem must retain most of the word, or "rating" collapses to "rat"
      const keeps = w => stem(w).length >= 0.6 * Math.max(w.length, other.length);
      // an exact match always counts
      const hit = cw.find(w => w === other)
        || cw.find(w => !STOP.has(w) && w.length >= 3 && stem(w).length >= 3
                     && stem(w) === sO && keeps(w));
      if (hit) hits.push({
        kind: "CROSS-LEAK", ans: A.toUpperCase(), clue,
        why: `${other.toUpperCase()} is also an answer here (via "${hit}")`
      });
    }
  }
  return hits;
}

module.exports = { readMini, auditPuzzle, STOP, stem, words };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : undefined; };
  const DIR = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))) || "reports";
  const FROM = opt("--from") || "0000-00-00", TO = opt("--to") || "9999-99-99";
  const files = fs.readdirSync(DIR).filter(f => /crossword-mini.*\.html$/i.test(f)).sort()
    .filter(f => f.slice(0, 10) >= FROM && f.slice(0, 10) <= TO);

  let total = 0;
  for (const f of files) {
    const p = readMini(path.join(DIR, f));
    if (!p) { console.log(`!! ${f}: no puzzle object found`); total++; continue; }
    for (const h of auditPuzzle(p)) {
      total++;
      console.log(`${f.slice(0, 10)}  ${p.id}  ${h.kind}  ${h.ans.padEnd(6)} <- ${JSON.stringify(h.clue)}  (${h.why})`);
    }
  }
  console.log(`\nchecked ${files.length} mini puzzle(s) from ${FROM}${TO < "9999" ? " to " + TO : ""} — ${total} leak(s)`);
  process.exit(total ? 1 : 0);
}
