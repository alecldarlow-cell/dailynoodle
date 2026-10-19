#!/usr/bin/env node
/* Daily Noodle: Doku difficulty grade (added 19 Oct 2026).

   A human-solver model for Doku. Alec's rule (19 Oct 2026): Doku keeps mixed
   bands, but no Doku may need trial and error, and easy ones must not be pure
   form-filling:
     easy          must need at least one crossing deduction (not solvable by
                   T1 alone);
     medium, hard  at most ONE stall.

   The solver knows the engine word list plus tools/doku-check-words.json (an
   everyday British vocabulary), and repeats these techniques until the grid is
   full:
     T1  a word slot with exactly one candidate word, given the letters already
         placed and the letters left in the bank: place the word.
     T2  a square where the candidates of its across slot and of its down slot
         leave exactly one letter in common (or, for a square in one slot only,
         where every candidate agrees): place it.
     T3  a bank letter with exactly as many copies left as squares that can
         still take it: place it in all of them.
   A "stall" is a moment with no T1-T3 move while squares remain. The model
   then places the true letter of the most constrained square (fewest letters
   allowed) and carries on, counting stalls.

   Usage (run from the repo root):
     node tools/doku-grade.js --check [--from YYYY-MM-DD] [--all]
         list forthcoming Dokus that break the rule; exit 1 if any do.
         --all prints every Doku's grade, not just the failures.
     node tools/doku-grade.js --fix [--from YYYY-MM-DD] [--dry]
         repair failing Dokus IN PLACE by re-choosing which squares are locked
         (grid, words, file, id, date and band unchanged; locked count kept
         within the band's density, the same count preferred). Every fix must
         pass the engine gate (validateLexi) and the broad second-fill check
         (tools/doku-broad-check.js broadAlts === 0). Only the `locked` line,
         the `bank` line and the two counts in dn:standfirst / og:description
         change (masked diff). Every written file is re-parsed from disk and
         re-checked. Prints the ones it couldn't fix (exit 1 if any).
         A fixed easy one also needs no stall; a fixed medium or hard one must
         start with a way in (its first move a deduction, not a stall) where
         any lock set allows it.

   T2 reads "every candidate of both its slots agrees on one letter" as: the
   letters the across candidates allow there and the letters the down
   candidates allow there have exactly one in common (the crossing
   deduction). Run with the engine list alone over all 747 Dokus on 19 Oct
   2026 (before --fix), this model came close to the audit's counts (140/152
   easy T1-only vs 138; 89/149 hard stalling vs 91); with the everyday list
   added, as here, more slots stay open.
   --from defaults to three days ahead (London): today, tomorrow and the day
   after are never edited.

   For other tools (tools/pinwheel-regen.js):
     const { grade, ruleOK } = require("./doku-grade.js");
     grade(pz)        -> { t1only, stalls, moves: {t1, t2, t3, stall} }
     ruleOK(pz)       -> true when the Doku meets the rule for its band
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.resolve(__dirname, ".."), REPORTS = path.join(ROOT, "reports");
const { broadAlts } = require("./doku-broad-check.js");

/* ---- engine (the ship gate) and the solver's vocabulary ---- */
function loadDoku() {
  const src = fs.readFileSync(path.join(ROOT, "engines", "doku.js"), "utf8");
  let code = src.slice(0, src.indexOf("/* ---- Digi Puzzles: The Digi Doku player"));
  const a = src.indexOf("/* ---- blocklist re-asserted"), b = src.indexOf("/* ---- state ---- */");
  code += "\n" + src.slice(a, b);
  const ctx = { window: {}, document: { write() {} } }; vm.createContext(ctx);   // the engine opens with the finish-sheet stub
  vm.runInContext(code + "\n;globalThis.__E={WORDS,findSlots,validateLexi,DENSITY};", ctx);
  return ctx.__E;
}
const GATE = loadDoku();
const VOCAB = {};
{
  const extra = JSON.parse(fs.readFileSync(path.join(__dirname, "doku-check-words.json"), "utf8"));
  for (const L of [3, 4, 5]) VOCAB[L] = [...new Set([...Object.keys(GATE.WORDS[String(L)]), ...extra[String(L)]])].filter(w => /^[a-z]+$/.test(w) && w.length === L);
}
const A = 97;   // char code of "a"
const VCODES = {};   // each word as letter codes 0-25
for (const L of [3, 4, 5]) VCODES[L] = VOCAB[L].map(w => Array.from(w, ch => ch.charCodeAt(0) - A));

/* ---- the solver model ---- */
// Per grid: the slots, and each slot's starting candidates. A word whose letters
// the whole grid can't supply can never be a candidate, whichever squares are
// locked, so dropping it up front changes no result (it only saves time).
const PREP = new Map();
function prep(grid) {
  const k = grid.map(r => r.join("")).join("|").toLowerCase();
  if (PREP.has(k)) return PREP.get(k);
  const lg = grid.map(r => r.map(x => x === "#" ? "#" : String(x).toLowerCase()));
  const slots = GATE.findSlots(lg); if (!slots) throw new Error("bad grid");
  const have = new Array(26).fill(0);
  for (const row of lg) for (const ch of row) if (ch !== "#") have[ch.charCodeAt(0) - A]++;
  const n = new Array(26);
  const start = slots.map(s => VCODES[s.L].filter(w => { n.fill(0); for (const v of w) if (++n[v] > have[v]) return false; return true; }));
  const P = { slots, start };
  if (PREP.size > 2000) PREP.clear();
  PREP.set(k, P); return P;
}

// pz: { grid (letters, "#" for blocks; any case), locked [[r,c] 1-indexed], bank, band }
// opts.t1only: use T1 alone (and stop at the first stall)
// Returns { solved, moves, firstStall (squares still empty at the first stall,
// 0 if none), t1min (fewest single-candidate slots seen in a T1 round) }.
function solve(pz, opts = {}) {
  const sol = pz.grid.map(r => r.map(x => x === "#" ? -1 : String(x).toLowerCase().charCodeAt(0) - A));
  const { slots, start } = prep(pz.grid);
  const cur = sol.map(r => r.map(v => v < 0 ? -1 : -2));   // -1 block, -2 empty, else letter
  for (const [r, c] of pz.locked) cur[r - 1][c - 1] = sol[r - 1][c - 1];
  const bank = new Array(26).fill(0);
  for (const ch of pz.bank) bank[String(ch).toLowerCase().charCodeAt(0) - A]++;
  const at = {};   // "r,c" -> [[slotIndex, position]]
  slots.forEach((s, i) => s.cells.forEach(([r, c], p) => (at[r + "," + c] || (at[r + "," + c] = [])).push([i, p])));
  let empty = 0; for (const row of cur) for (const v of row) if (v === -2) empty++;
  let cand = start;
  const moves = { t1: 0, t2: 0, t3: 0, stall: 0 };
  let firstStall = 0, t1min = 99;
  const need = new Array(26);

  const put = (r, c, v) => {
    if (cur[r][c] !== -2) return false;
    if (v !== sol[r][c]) throw new Error("solver placed a wrong letter at r" + (r + 1) + "c" + (c + 1));
    if (bank[v] <= 0) throw new Error("bank ran out of " + String.fromCharCode(A + v));
    cur[r][c] = v; bank[v]--; empty--; return true;
  };
  const refresh = () => {
    cand = cand.map((list, i) => {
      const cells = slots[i].cells;
      const out = list.filter(w => {
        need.fill(0);
        for (let p = 0; p < w.length; p++) {
          const v = cur[cells[p][0]][cells[p][1]];
          if (v >= 0) { if (v !== w[p]) return false; }
          else if (++need[w[p]] > bank[w[p]]) return false;
        }
        return true;
      });
      if (!out.length) throw new Error("slot " + i + " lost its true word");
      return out;
    });
  };
  // letters each empty square may take: intersection over its slots
  const allowed = () => {
    const m = {};
    for (const k of Object.keys(at)) {
      const [r, c] = k.split(",").map(Number); if (cur[r][c] !== -2) continue;
      let set = null;
      for (const [i, p] of at[k]) {
        let s = 0; for (const w of cand[i]) s |= 1 << w[p];
        set = set === null ? s : set & s;
      }
      m[k] = set;
    }
    return m;
  };
  const bits = s => { let n = 0; while (s) { s &= s - 1; n++; } return n; };

  while (empty > 0) {
    refresh();
    // T1
    let did = false, singles = 0;
    for (let i = 0; i < slots.length; i++) {
      if (cand[i].length !== 1) continue;
      const w = cand[i][0]; let any = false;
      slots[i].cells.forEach(([r, c], p) => { if (put(r, c, w[p])) any = true; });
      if (any) { moves.t1++; did = true; singles++; }
    }
    if (did) { t1min = Math.min(t1min, singles); continue; }
    if (opts.t1only) return { solved: false, moves, firstStall: empty, t1min: 0 };
    const al = allowed();
    // T2
    for (const [k, s] of Object.entries(al)) {
      if (bits(s) !== 1) continue;
      const [r, c] = k.split(",").map(Number);
      if (put(r, c, 31 - Math.clz32(s))) { moves.t2++; did = true; }
    }
    if (did) continue;
    // T3
    for (let v = 0; v < 26 && !did; v++) {
      if (!bank[v]) continue;
      const can = Object.keys(al).filter(k => al[k] & (1 << v));
      if (can.length === bank[v]) {
        for (const k of can) { const [r, c] = k.split(",").map(Number); put(r, c, v); }
        moves.t3++; did = true;
      }
    }
    if (did) continue;
    // stall: place the true letter of the most constrained square
    let best = null, bestN = 99;
    for (const [k, s] of Object.entries(al)) { const n = bits(s); if (n < bestN) { bestN = n; best = k; } }
    const [r, c] = best.split(",").map(Number);
    if (!moves.stall) firstStall = empty;
    put(r, c, sol[r][c]); moves.stall++;
  }
  return { solved: true, moves, firstStall, t1min };
}

function grade(pz) {
  const t1 = solve(pz, { t1only: true });
  const full = solve(pz);
  return { t1only: t1.solved, stalls: full.moves.stall, moves: full.moves, firstStall: full.firstStall, t1min: t1.solved ? t1.t1min : 0 };
}
// The rule (Alec, 19 Oct 2026). medium/hard: at most one stall. easy: at least
// one crossing deduction (not T1 alone); and no band may need trial and error,
// so an easy one with 2+ stalls breaks it too (none did when this was written).
const breaks = (band, g) => g.stalls > 1 || (band === "easy" && g.t1only);
function ruleOK(pz) { try { return !breaks(pz.band, grade(pz)); } catch (e) { return false; } }
// What new or repaired locks must also do (--fix, pinwheel-regen.js lockFor):
// an easy one needs no stall at all; a medium or hard one starts with a way in
// (its first move is a deduction, not a stall), unless wayIn is false.
function fits(pz, g, wayIn = true) {
  if (breaks(pz.band, g)) return false;
  if (pz.band === "easy") return g.stalls === 0;
  return !wayIn || g.stalls === 0 || g.firstStall < pz.bank.length;
}
function fitsOK(pz, wayIn = true) { try { return fits(pz, grade(pz), wayIn); } catch (e) { return false; } }

// The feed card shades locked squares, so a new lock pattern is screened like a
// block layout (same tests as tools/pinwheel-regen.js badLayout): neither the
// locks alone nor blocks + locks may spin or sit one square from a swastika.
const rot = m => m[0].split("").map((_, c) => m.map(r => r[c]).reverse().join(""));
const mir = m => m.map(r => r.split("").reverse().join(""));
const spins = m => { const k = m.join("|"); return m.join("").includes("#") && rot(m).join("|") === k && mir(m).join("|") !== k; };
const SW_REFS = (() => { const o = []; let g = ["XXX.X", "..X.X", "XXXXX", "X.X..", "X.XXX"].map(r => r.replace(/X/g, "#"));
  for (let i = 0; i < 4; i++) { o.push(g.join("|")); o.push(mir(g).join("|")); g = rot(g); } return o; })();
const nearSwastika = m => { const inv = m.map(r => r.replace(/[#.]/g, ch => (ch === "#" ? "." : "#")));
  const d = (a, b) => [...a].filter((ch, i) => ch !== b[i]).length; return [m, inv].some(x => SW_REFS.some(ref => d(x.join("|"), ref) <= 1)); };
function shapeOK(grid, locked) {
  const L = Array.from({ length: 5 }, () => Array(5).fill("."));
  for (const [r, c] of locked) L[r - 1][c - 1] = "#";
  const lm = L.map(r => r.join("")), cm = grid.map((row, r) => row.map((x, c) => (x === "#" || L[r][c] === "#") ? "#" : ".").join(""));
  return ![lm, cm].some(m => spins(m) || nearSwastika(m));
}

module.exports = { grade, ruleOK, breaks, fits, fitsOK, shapeOK, solve };
if (require.main !== module) return;

/* ---- CLI ---- */
const args = process.argv.slice(2), has = f => args.includes(f), val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
function londonDay(offset = 0) {
  const t = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = new Date(t + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}

/* ---- page parsing (same regexes as tools/doku-broad-check.js) ---- */
const LOCK_RE = /(\n\s*locked:\s*)(\[[^\n]*\])(,?)/, BANK_RE = /(\n\s*bank:\s*)(\[[^\n]*\])(,?)/;
const BLURB_RE = /(<meta (?:name="dn:standfirst"|property="og:description"|name="twitter:description")\s+content=")([^"]*)(")/g;
function grab(s, re) { const m = s.match(re); if (!m) throw new Error("no " + re); return JSON.parse(m[2]); }
function parsePage(file) {
  const s = fs.readFileSync(file, "utf8");
  const i = s.indexOf("window.DN_PUZZLE"); if (i < 0) return null;
  const g = s.slice(i).match(/grid:\s*(\[\[[\s\S]*?\]\])/); if (!g) return null;
  const grid = JSON.parse(g[1]).map(r => r.map(x => String(x).toUpperCase()));
  const band = (s.slice(i).match(/band:\s*"(\w+)"/) || [])[1];
  const id = (s.slice(i).match(/id:\s*"([^"]+)"/) || [])[1];
  const type = (s.slice(i).match(/type:\s*"(\w+)"/) || [])[1];
  if (type !== "lexi") return null;
  return { s, grid, band, id, locked: grab(s, LOCK_RE), bank: grab(s, BANK_RE) };
}
// the two counts in each standfirst template, in the order they appear
const SF = [
  [/^(\d+) letters are locked in, (\d+) wait in the bank\./, "LB"],
  [/^No clues today — just (\d+) loose letters and (\d+) locked ones\./, "BL"],
  [/^The bank holds (\d+) letters this round; (\d+) are already fixed\./, "BL"],
  [/^(\d+) letters in the bank, (\d+) already set\./, "BL"],
  [/^(\d+) anchors, (\d+) tiles to place\./, "LB"],
];
function blurbCounts(t) {
  for (const [re, order] of SF) { const m = t.match(re); if (m) return order === "LB" ? { L: +m[1], B: +m[2] } : { L: +m[2], B: +m[1] }; }
  return null;
}
function setBlurbCounts(t, L, B) {
  for (const [re, order] of SF) if (re.test(t))
    return t.replace(re, m0 => { let k = 0; const v = order === "LB" ? [L, B] : [B, L]; return m0.replace(/\d+/g, () => String(v[k++])); });
  return null;
}
const blurbs = s => [...s.matchAll(BLURB_RE)].map(m => m[2]);
const pzOf = p => ({ grid: p.grid, band: p.band, locked: p.locked, bank: p.bank });

/* ---- scan ---- */
const from = val("--from") || londonDay(3);
const files = fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-logic-doku-\d+\.html$/.test(f) && f.slice(0, 10) >= from).sort();
const rows = [];
for (const f of files) {
  const p = parsePage(path.join(REPORTS, f)); if (!p) continue;
  const g = grade(pzOf(p));
  rows.push({ f, p, g, bad: breaks(p.band, g) });
}
const tally = rs => {
  const t = {};
  for (const b of ["easy", "medium", "hard"]) {
    const x = rs.filter(r => r.p.band === b);
    t[b] = { n: x.length, t1only: x.filter(r => r.g.t1only).length, stalls0: x.filter(r => r.g.stalls === 0).length,
      stalls1: x.filter(r => r.g.stalls === 1).length, stalls2plus: x.filter(r => r.g.stalls > 1).length, breaking: x.filter(r => r.bad).length };
  }
  return t;
};
const line = r => [r.f.slice(0, 10), r.p.id, r.p.band, "locks " + r.p.locked.length, r.g.t1only ? "T1-only" : "needs T2/T3", "stalls " + r.g.stalls,
  "t1/t2/t3 " + r.g.moves.t1 + "/" + r.g.moves.t2 + "/" + r.g.moves.t3].join("  ");

if (has("--check")) {
  for (const r of rows) if (r.bad || has("--all")) console.log((r.bad ? "BREAKS  " : "ok      ") + line(r));
  const t = tally(rows);
  console.log(JSON.stringify({ checked: rows.length, from, breaking: rows.filter(r => r.bad).length, bands: t }));
  process.exit(rows.some(r => r.bad) ? 1 : 0);
}

if (has("--fix")) {
  const dry = has("--dry"), fixed = [], stuck = [];
  const sol = p => p.grid.map(r => r.map(x => x.toLowerCase()));
  for (const r of rows.filter(r => r.bad)) {
    const t0 = Date.now(), res = repair(r.p);
    if (!res) { stuck.push({ f: r.f, id: r.p.id, band: r.p.band, why: "no lock set within the band meets the rule and both gates", g: r.g }); continue; }
    const p = r.p, { locked, bank } = res;
    // stamp the locked + bank lines and the two counts in the blurbs
    const oldL = p.locked.length, oldB = p.bank.length, newL = locked.length, newB = bank.length;
    const fmt = a => "[" + a.map(v => Array.isArray(v) ? "[" + v.join(",") + "]" : JSON.stringify(v)).join(",") + "]";
    let s = p.s, why = null;
    s = s.replace(LOCK_RE, (m, a, b, c) => a + fmt(locked) + c);
    s = s.replace(BANK_RE, (m, a, b, c) => a + fmt(bank) + c);
    s = s.replace(BLURB_RE, (m, a, t, c) => {
      const k = blurbCounts(t);
      if (!k || k.L !== oldL || k.B !== oldB) { why = why || "blurb counts don't match the page (" + t.slice(0, 50) + "...)"; return m; }
      return a + setBlurbCounts(t, newL, newB) + c;
    });
    if (why) { stuck.push({ f: r.f, id: p.id, band: p.band, why, g: r.g }); continue; }
    // masked diff: only the locked line, the bank line and the numbers in the blurbs may change
    const mask = t => t.replace(LOCK_RE, "\nLOCK").replace(BANK_RE, "\nBANK").replace(BLURB_RE, (m, a, x, c) => a + x.replace(/\d+/g, "#") + c);
    if (mask(s) !== mask(p.s)) throw new Error(p.id + ": masked diff failed");
    if (s === p.s) throw new Error(p.id + ": no change written");
    if (!dry) fs.writeFileSync(path.join(REPORTS, r.f), s);
    fixed.push({ f: r.f, id: p.id, band: p.band, before: r.g, after: res.g, note: res.note, locks: oldL + "→" + newL, ms: Date.now() - t0 });
  }
  // re-parse every written file from disk and re-run the engine gate, the broad check and the grade
  let bad = 0;
  if (!dry) for (const x of fixed) {
    const p = parsePage(path.join(REPORTS, x.f)), pz = pzOf(p);
    const g = GATE.validateLexi(pz), alts = broadAlts(pz), gr = grade(pz);
    const counts = blurbs(p.s).map(blurbCounts);
    const blurbOK = counts.length >= 1 && counts.every(k => k && k.L === p.locked.length && k.B === p.bank.length);
    if (!g.pass || alts || !fits(pz, gr, false) || !blurbOK) { bad++; console.error("RECHECK FAILED", x.f, JSON.stringify(g.checks), "alts " + alts, "stalls " + gr.stalls, "t1only " + gr.t1only, "blurbs " + blurbOK); }
  }
  for (const x of fixed) console.log("fixed", x.f.slice(0, 10), x.id, x.band, "locks " + x.locks, x.before.t1only ? "T1-only" : "stalls " + x.before.stalls, "->",
    (x.after.t1only ? "T1-only" : "needs T2/T3") + ", stalls " + x.after.stalls, "(" + x.note + ")");
  for (const x of stuck) console.log("STUCK", x.f.slice(0, 10), x.id, x.band, x.g.t1only ? "T1-only" : "stalls " + x.g.stalls, x.why);
  console.log(JSON.stringify({ from, breaking: rows.filter(r => r.bad).length, fixed: fixed.length, stuck: stuck.length, recheckFailed: bad, dry }));
  process.exit(bad || stuck.length ? 1 : 0);
}

console.error("usage: --check | --fix (see header)"); process.exit(2);

/* ---- repair: re-choose the locked squares ----
   Search outward from the page's own locks: first the same number of locks with
   one, two, then three moved (beam search, guided by how close each try is to
   the rule), then one lock more or fewer (inside the band's own density first,
   then the gate's +0.06 tolerance). If that finds nothing and the grid is small
   enough, every lock set of each allowed size is tried. A medium or hard fix
   must also give a way in (the first move is a deduction, not a stall); only if
   no lock set does is that dropped. Among the tries that meet the rule at the
   first depth that has any, keep the band's feel: an easy one with the fewest
   crossing moves; a medium one with no stall, a hard one with exactly one
   (still a real think, never a guess), then the most crossing moves. The first
   of those that passes the engine gate and the broad second-fill check is used. */
function repair(p) {
  return repairWith(p, true) || repairWith(p, false);
}
function repairWith(p, wayIn) {
  const cells = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (p.grid[r][c] !== "#") cells.push([r, c]);
  const idx = (r, c) => cells.findIndex(([y, x]) => y === r && x === c);
  const O = p.locked.map(([r, c]) => idx(r - 1, c - 1)), n0 = O.length, fill = cells.length;
  const [lo, hi] = GATE.DENSITY[p.band];
  const gateMin = Math.max(1, Math.ceil((lo - 0.001) * fill - 1e-9)), gateMax = Math.min(fill - 1, Math.floor((hi + 0.06) * fill + 1e-9));
  const strictMin = Math.ceil(lo * fill - 1e-9), strictMax = Math.floor(hi * fill + 1e-9);
  const key = S => S.slice().sort((a, b) => a - b).join(",");
  const cache = new Map();
  // build the page's locked list + bank for a set of locked squares, keeping order where it can
  const hash = [...p.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  function build(S) {
    const Sset = new Set(S), Oset = new Set(O);
    const gone = O.filter(i => !Sset.has(i)), added = S.filter(i => !Oset.has(i));
    const locked = p.locked.map(x => x.slice()), bank = p.bank.slice();
    const letter = i => p.grid[cells[i][0]][cells[i][1]];
    const take = ch => { const k = bank.indexOf(ch); if (k < 0) throw new Error(p.id + ": no " + ch + " in bank"); return k; };
    let k = 0;
    for (; k < Math.min(gone.length, added.length); k++) {          // a moved lock: same place in the list, swap in the bank
      const u = gone[k], y = added[k], li = locked.findIndex(([r, c]) => idx(r - 1, c - 1) === u);
      locked[li] = [cells[y][0] + 1, cells[y][1] + 1];
      if (letter(u) !== letter(y)) bank[take(letter(y))] = letter(u);
    }
    for (let j = k; j < added.length; j++) { const y = added[j]; locked.push([cells[y][0] + 1, cells[y][1] + 1]); bank.splice(take(letter(y)), 1); }
    for (let j = k; j < gone.length; j++) {
      const u = gone[j], li = locked.findIndex(([r, c]) => idx(r - 1, c - 1) === u);
      locked.splice(li, 1); bank.splice((hash + j * 7) % (bank.length + 1), 0, letter(u));
    }
    return { grid: p.grid, band: p.band, locked, bank };
  }
  function evalS(S) {
    const k = key(S); if (cache.has(k)) return cache.get(k);
    const pz = build(S), g = grade(pz), ok = fits(pz, g, wayIn) && shapeOK(p.grid, pz.locked);
    // how far from meeting the rule (lower is closer), for the beam
    let h;
    if (p.band === "easy") h = g.stalls > 0 ? 500 + 100 * g.stalls : g.t1only ? 100 * g.t1min + g.moves.t1 : 0;
    else h = 100 * g.stalls + g.firstStall;
    const e = { S, pz, g, ok, h }; cache.set(k, e); return e;
  }
  const work = e => e.g.moves.t2 + e.g.moves.t3;
  const pref = e => p.band === "easy" ? [work(e)]
    : p.band === "medium" ? [e.g.t1only ? 1 : 0, e.g.stalls, -work(e)]
    : [e.g.t1only ? 1 : 0, e.g.stalls === 1 ? 0 : 1, -work(e)];
  const cmp = (a, b) => { const x = pref(a), y = pref(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return key(a.S) < key(b.S) ? -1 : 1; };
  function pick(level) {
    const good = level.map(evalS).filter(e => e.ok).sort(cmp);
    for (const e of good) {
      if (!GATE.validateLexi(e.pz).pass) continue;
      if (broadAlts(e.pz) !== 0) continue;
      return e;
    }
    return null;
  }
  const swaps = S => { const out = [], Sset = new Set(S);
    for (let a = 0; a < S.length; a++) for (let y = 0; y < fill; y++) if (!Sset.has(y)) { const T = S.slice(); T[a] = y; out.push(T); }
    return out; };
  function beam(start, depth, width, seen) {
    let level = start;
    for (let d = 1; d <= depth; d++) {
      const parents = level.map(evalS).sort((a, b) => a.h - b.h || (key(a.S) < key(b.S) ? -1 : 1)).slice(0, width);
      const next = [];
      for (const e of parents) for (const T of swaps(e.S)) { const k = key(T); if (!seen.has(k)) { seen.add(k); next.push(T); } }
      const got = pick(next); if (got) return { e: got, d };
      level = next; if (!level.length) break;
    }
    return null;
  }
  const label = (e, what) => ({ locked: e.pz.locked, bank: e.pz.bank, g: e.g, note: what });
  // every lock set of size n, nearest the page's own first (only for small grids)
  const choose = (n, k) => { let x = 1; for (let i = 0; i < k; i++) x = x * (n - i) / (i + 1); return x; };
  const Oset = new Set(O), moved = S => S.filter(i => !Oset.has(i)).length;
  function full(n) {
    if (choose(fill, n) > 20000) return null;
    const all = [];
    (function rec(s, cur) { if (cur.length === n) { all.push(cur.slice()); return; } for (let i = s; i < fill; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); } })(0, []);
    const good = all.map(evalS).filter(e => e.ok).sort((a, b) => moved(a.S) - moved(b.S) || cmp(a, b));
    for (const e of good) if (GATE.validateLexi(e.pz).pass && broadAlts(e.pz) === 0) return e;
    return null;
  }
  const inGate = n => n >= gateMin && n <= gateMax;
  // 1. same count: up to three locks moved, then (small grids) every set of that size
  if (inGate(n0)) {
    const got = beam([O], 3, 10, new Set([key(O)]));
    if (got) return label(got.e, got.d + " lock" + (got.d > 1 ? "s" : "") + " moved");
    const f = full(n0);
    if (f) return label(f, "full search, " + moved(f.S) + " moved");
  }
  // 2. one lock more or fewer (within the band's own density first), then with up to two moved, then every set
  const want = p.band === "easy" ? [-1, +1] : [+1, -1];
  const deltas = want.map(d => ({ d, n: n0 + d })).filter(x => inGate(x.n))
    .sort((a, b) => ((a.n < strictMin || a.n > strictMax) - (b.n < strictMin || b.n > strictMax)));
  for (const { d, n } of deltas) {
    const start = [], what = d > 0 ? "1 lock added" : "1 lock removed";
    if (d > 0) { for (let y = 0; y < fill; y++) if (!O.includes(y)) start.push([...O, y]); }
    else for (let a = 0; a < O.length; a++) start.push(O.filter((_, j) => j !== a));
    const got0 = pick(start);
    if (got0) return label(got0, what);
    const got = beam(start, 2, 10, new Set(start.map(key)));
    if (got) return label(got.e, what + ", " + got.d + " moved");
    const f = full(n);
    if (f) return label(f, what + ", full search");
  }
  return null;
}
