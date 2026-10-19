#!/usr/bin/env node
/* tools/check-mini-clues.js — Mini clue gate (Noodle Puzzles, 19 Oct 2026)

   The mechanical half of the Mini clue rules in the puzzle-quality framework
   (Phase 3). Runs beside tools/check-clue-leaks.js and includes its checks.
   Each Mini clue in the date range is checked for:

     LEAK      the clue holds its own answer's root, or another answer in the
               same grid (tools/check-clue-leaks.js)
     PRONOUN   a stray "it"/"them": an object the answer doesn't carry
               ("Keeping quiet about it" for MUM, "Finish it off" for END).
               Fine when the pronoun is the answer itself in a descriptive clue
               ("The rabbit comes out of it" for HAT) or a subject ("it comes
               back"), or inside a "___" blank.
     PADDING   filler that does no work: "in a word", "plainly", "all told",
               "plural", and trailing "with up" / "with from" style particles
               (clue the phrase with a blank instead: "Own ___ (admit)")
     AMERICAN  US-only words and usage: skillet, "thirteen through nineteen",
               "ready, set, go", baseball and gridiron terms, -or spellings
     REPEAT    the same answer with the same clue text (ignoring case and
               punctuation) on another Mini within 365 days either side

   What it can't do: the substitution test (same part of speech, number and
   tense), facts and fair misdirection still need an editor; see the Mini
   section of the puzzle-quality framework.

   Usage (from the repo root):
     node tools/check-mini-clues.js [--from YYYY-MM-DD] [--to YYYY-MM-DD]
                                    [--days 365] [--only KIND,KIND] [--quiet]
     --from defaults to today (London); --to to the last Mini.
   Exit 1 if any clue in range fails. As a module:
     { clueProblems(answer, clue), checkMinis({from, to, days, dir, override}) }
   override: { file: {clues} } checks proposed clues before they are written.
*/
"use strict";
const fs = require("fs"), path = require("path");
const { readMini, auditPuzzle } = require("./check-clue-leaks.js");

const ROOT = path.resolve(__dirname, "..");

/* ---------- PRONOUN ------------------------------------------------------ */
// A clue part starting with one of these is a description of the answer, where
// "it"/"them" usually stands for the answer itself.
const STARTERS = new Set(("the a an you your what where who whose which when how there here "
  + "everything everyone something someone anything one this that these those it they he she we "
  + "its his her their our my as like if once some many most each every any "
  + "you'll you're you've you'd it's there's that's what's who's they're we're i'm").split(" "));
// idioms where "it" belongs to the phrase, not a stray object ("Past it" for OLD)
const IDIOM = /\b(past it|that's it|got it|lost it|made it|make it|beat it|go for it|this is it|battle it out|call it a day)\b/i;
const AUX = new Set(("is are was were be been has have had can could will would shall should may "
  + "might must do does did isn't aren't wasn't weren't doesn't don't didn't won't can't").split(" "));
const PREP = new Set(("of to for at on in into onto with without about from by through over under off out up "
  + "against across around behind beside beyond towards toward upon past along after before between below above "
  + "inside outside within near").split(" "));
const IRREG_PAST = new Set(("made gave took got came kept left lost put set sold told went brought bought caught "
  + "taught thought found held hid led let meant met paid sent spent stood stole struck swore threw tore "
  + "wore won wrote ran rode rose saw sang sank sat slept spoke stuck swam drove ate fell felt fought flew "
  + "forgot froze grew hung knew laid lay lit rang shook shot shut slid spun split spread sprang").split(" "));
const looksVerb = w => /^(didn't|doesn't|don't|won't|can't|couldn't|wouldn't|shouldn't)$/.test(w)
  || (w.length > 4 && /ing$/.test(w)) || (w.length > 4 && /ed$/.test(w)) || IRREG_PAST.has(w);

const PRON = new Set(["it", "them"]);
const NOT_S = new Set("yes this his hers its was us plus less thus bus gas lens yours ours theirs always perhaps".split(" "));
const isS = x => x.length > 2 && /[a-z]s$/.test(x) && !/ss$/.test(x) && !NOT_S.has(x) && !PREP.has(x) && !PRON.has(x) && !AUX.has(x);
// does a part that opens with "the"/"a"/"an" contain a finite verb? ("The drum keeps it",
// "The flowers stand on them") — if not, it's a noun phrase and a pronoun in it is stray
function hasFinite(w) {
  if (w.some(x => AUX.has(x) || IRREG_PAST.has(x) || (x.length > 4 && /ed$/.test(x)))) return true;
  if (w.slice(2).some(isS)) return true;
  return w.length > 2 && /s$/.test(w[1]) && !PREP.has(w[2]) && !PRON.has(w[2]) && !/ing$/.test(w[2]) && !["and", "or"].includes(w[2]);
}
function strayPronoun(clue) {
  if (/_{2,}/.test(clue)) return null;                          // idiom clued with a blank
  const bare = clue.replace(/[‘’]/g, "'").replace(/(^|\s)['"“][^'"”]*['"”]/g, " ").replace(IDIOM, " "); // quoted speech, idioms
  // split double definitions and asides: "X, or Y" / "X — or Y" / "X; Y"
  const parts = bare.split(/\s*(?:[,;:—–()!?]|\bor\b)\s*/i).filter(Boolean);
  for (const part of parts) {
    const w = (part.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []);
    while (w.length && ["and", "but", "so", "yet"].includes(w[0])) w.shift();
    // "Sled dog, or a voice with gravel in it": the pronoun is the head noun
    if (/\bwith\b.*\b(in|on|through|inside) (it|them)$/.test(w.join(" "))) continue;
    for (let i = 1; i < w.length; i++) {                         // a part that opens with "It"/"Them" is fine
      if (!PRON.has(w[i])) continue;
      if (w[i] === "it" && i + 1 < w.length && (AUX.has(w[i + 1]) || isS(w[i + 1]))) continue; // "it comes back"
      const first = w[0];
      if (!STARTERS.has(first)) {
        // a sentence with a noun subject ("Sock covers it", "Birthdays count them") is a description
        if (i > 1 && (isS(w[1]) || (/s$/.test(first) && !AUX.has(first) && !PREP.has(w[1]) && !PRON.has(w[1]) && !/ing$/.test(w[1]))))
          continue;
        return `"${w[i]}" with nothing to refer to (clue the bare verb or noun)`;
      }
      if (["the", "a", "an"].includes(first) && !hasFinite(w))
        return `"${w[i]}" inside a noun phrase, with nothing to refer to`;
    }
  }
  return null;
}

/* ---------- PADDING ------------------------------------------------------ */
const PADDING = [
  [/\bin a word\b/i, '"in a word"'],
  [/\bplainly\b/i, '"plainly"'],
  [/\ball told\b/i, '"all told"'],
  [/\bplural\b/i, '"plural"'],
  [/\bwith\s+["'‘“]?(from|up|out|off|on|in|down|over|away|back|to|for|at|by|into|about|after)["'’”]?\s*[.!?)]?\s*$/i, m => `"with ${m[1]}" (use a blank)`],
];

/* ---------- AMERICAN ----------------------------------------------------- */
const NUM = "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|\\d+)";
const DAY = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)";
const MON = "(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";
const AMERICAN = [
  [new RegExp(`\\b(${NUM}|${DAY}|${MON})\\s+through\\s+(${NUM}|${DAY}|${MON})\\b`, "i"), '"through" for a range (say "to")'],
  [/\bready,?\s+set,?\s+go\b/i, '"ready, set, go" (UK: ready, steady, go)'],
  [/\b(?:in the|this|last|next|every) fall\b/i, '"fall" for autumn'],
  [/\bbaseball\b(?!\s+cap)|\bball ?park\b|\bhome runs?\b|\binnings?\b|\bshortstop\b|\bdugout\b|\bbullpen\b|\bpitcher's mound\b|\bworld series\b/i, "baseball"],
  [/\btouchdowns?\b|\bquarterbacks?\b|\bsuper bowl\b|\bgridiron\b/i, "American football"],
  [/\bsoccer\b/i, '"soccer" (UK: football)'],
  [/\bskillets?\b/i, "skillet (UK: frying pan)"],
  [/\bcandy\b(?!\s*(?:floss|cane|stripe))/i, "candy (UK: sweets)"],
  [/\bcookies?\b/i, "cookie (UK: biscuit)"],
  [/\bsidewalks?\b|\bfaucets?\b|\bdiapers?\b|\bstrollers?\b|\bpacifiers?\b|\belevators?\b|\bflashlights?\b|\bfreeways?\b|\bwindshields?\b|\bparking lots?\b|\bzip codes?\b|\bcell ?phones?\b|\bgasoline\b|\bgas (?:station|tank|pedal)s?\b|\btrash\b|\bgarbage\b|\bmailman\b|\brealtors?\b|\bkindergarten\b|\bvacations?\b|\bapartments?\b|\bairplanes?\b|\brailroads?\b|\bsemesters?\b|\bfreshman\b|\bsophomores?\b|\bzucchini\b|\beggplants?\b|\bcilantro\b|\barugula\b|\bscallions?\b|\bpopsicles?\b/i, "US word"],
  [/\bmoms?\b|\bmommy\b|\bmath\b|\bgotten\b|\bthanksgiving\b|\bfourth of july\b/i, "US usage"],
  [/\b(?:colou?rs?|flavou?rs?|favou?rs?|honou?rs?|humou?rs?|labou?rs?|neighbou?rs?|rumou?rs?|harbou?rs?|odou?rs?|vigou?r|behaviou?rs?|armou?rs?)\b/i, null],   // checked below
  [/\b(?:center|centers|theater|theaters|liter|liters|fiber|fibers|gray|plow|cozy|jewelry|aluminum|pajamas|skeptic|traveled|traveling|canceled|defense|offense|catalog)\b/i, "US spelling"],
];
function american(clue) {
  for (const [re, why] of AMERICAN) {
    const m = clue.match(re);
    if (!m) continue;
    if (why === null) { if (!/ou/i.test(m[0])) return `US spelling "${m[0]}"`; continue; }
    return why;
  }
  return null;
}

/* ---------- per-clue checks ---------------------------------------------- */
function clueProblems(answer, clue) {
  const out = [];
  const pr = strayPronoun(clue);
  if (pr) out.push({ kind: "PRONOUN", why: pr });
  for (const [re, why] of PADDING) { const m = clue.match(re); if (m) out.push({ kind: "PADDING", why: typeof why === "function" ? why(m) : why }); }
  const am = american(clue);
  if (am) out.push({ kind: "AMERICAN", why: am });
  return out;
}

/* ---------- whole-schedule checks --------------------------------------- */
const norm = s => s.toLowerCase().replace(/[‘’]/g, "'").replace(/_+/g, " _ ").replace(/[^a-z0-9_' ]+/g, " ").replace(/\s+/g, " ").trim();
const dayNum = d => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);
const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

function loadMinis(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-crossword-mini-\d+\.html$/.test(f)).sort()) {
    const p = readMini(path.join(dir, f));
    if (p) out.push({ file: f, date: f.slice(0, 10), id: p.id, clues: p.clues });
  }
  return out;
}

function checkMinis(opts = {}) {
  const dir = opts.dir || path.join(ROOT, "reports");
  const from = opts.from || londonToday(), to = opts.to || "9999-12-31", days = opts.days || 365;
  const all = loadMinis(dir);
  if (opts.override) for (const m of all) if (opts.override[m.file]) m.clues = opts.override[m.file].clues;
  const byAnswer = {};
  for (const m of all) for (const [a, c] of Object.entries(m.clues)) (byAnswer[a] ||= []).push({ m, n: norm(c) });
  const problems = [];
  const targets = all.filter(m => m.date >= from && m.date <= to && (!opts.files || opts.files.includes(m.file)));
  for (const m of targets) {
    for (const h of auditPuzzle({ clues: m.clues }))
      problems.push({ file: m.file, date: m.date, id: m.id, answer: h.ans.toLowerCase(), clue: h.clue, kind: "LEAK", why: `${h.kind}: ${h.why}` });
    for (const [a, c] of Object.entries(m.clues)) {
      for (const p of clueProblems(a, c)) problems.push({ file: m.file, date: m.date, id: m.id, answer: a, clue: c, ...p });
      const n = norm(c), d = dayNum(m.date);
      const twin = byAnswer[a].filter(x => x.m !== m && x.n === n && Math.abs(dayNum(x.m.date) - d) <= days)
        .sort((x, y) => Math.abs(dayNum(x.m.date) - d) - Math.abs(dayNum(y.m.date) - d))[0];
      if (twin) problems.push({ file: m.file, date: m.date, id: m.id, answer: a, clue: c, kind: "REPEAT",
        why: `same clue for ${a.toUpperCase()} on ${twin.m.date} (${Math.abs(dayNum(twin.m.date) - d)} days apart)` });
    }
  }
  const only = opts.only ? new Set(opts.only) : null;
  return { checked: targets.length, clues: targets.reduce((s, m) => s + Object.keys(m.clues).length, 0),
    problems: only ? problems.filter(p => only.has(p.kind)) : problems };
}

module.exports = { clueProblems, checkMinis, strayPronoun, norm };

if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i < 0 ? undefined : a[i + 1]; };
  const r = checkMinis({ from: arg("--from"), to: arg("--to"), days: arg("--days") ? +arg("--days") : 365,
    only: arg("--only") ? arg("--only").toUpperCase().split(",") : null });
  const counts = {};
  for (const p of r.problems) counts[p.kind] = (counts[p.kind] || 0) + 1;
  if (!a.includes("--quiet")) for (const p of r.problems)
    console.log(`${p.date}  ${p.id}  ${p.kind.padEnd(8)} ${p.answer.toUpperCase().padEnd(6)} <- ${JSON.stringify(p.clue)}  (${p.why})`);
  console.log(`\nchecked ${r.clues} clues in ${r.checked} Mini(s) — ${r.problems.length} problem(s)` +
    (r.problems.length ? ": " + Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ") : ""));
  process.exit(r.problems.length ? 1 : 0);
}
