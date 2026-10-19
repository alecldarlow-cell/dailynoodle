#!/usr/bin/env node
/* Daily Noodle: Doku second-answer check (added 19 Oct 2026).

   Each Doku's ship gate proves "exactly one fill" against the engine's own word
   list, which is small (318 three-letter words; no SAW, RED, ROW, BAY ...). A
   player who finds a second fill made of real words gets a full grid and no win.
   This tool re-proves uniqueness against the engine list PLUS
   tools/doku-check-words.json (common British words), and can fix a failing
   Doku in place by locking one more square (the spec's own remedy), so the
   file, URL, id, date, band and grid all stay the same.

   Usage (run from the repo root):
     node tools/doku-broad-check.js --check [--from YYYY-MM-DD] [--days N]
         list forthcoming Dokus with a second fill; exit 1 if any is dated
         within N days of --from (default: all of them).
     node tools/doku-broad-check.js --fix [--from YYYY-MM-DD] [--dry]
         add up to 3 locks to each failing Doku (choosing the square that kills
         the most alternative fills), within the band's lock density, then
         re-parse every written file from disk and re-run the engine gate and
         the broad check. Prints the ones it couldn't fix (regenerate those with
         tools/pinwheel-regen.js).
   --from defaults to tomorrow (London).
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.resolve(__dirname, ".."), REPORTS = path.join(ROOT, "reports");
const args = process.argv.slice(2), has = f => args.includes(f), val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

function londonDay(offset = 0) {
  const t = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = new Date(t + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}

/* ---- engines: one with the engine list (the ship gate), one broadened ---- */
function loadDoku() {
  const src = fs.readFileSync(path.join(ROOT, "engines", "doku.js"), "utf8");
  let code = src.slice(0, src.indexOf("/* ---- Digi Puzzles: The Digi Doku player"));
  const a = src.indexOf("/* ---- blocklist re-asserted"), b = src.indexOf("/* ---- state ---- */");
  code += "\n" + src.slice(a, b);
  const ctx = { window: {}, document: { write() {} } }; vm.createContext(ctx);   // the engine opens with the finish-sheet stub
  vm.runInContext(code + "\n;globalThis.__E={WORDS,findSlots,countSolutions,validateLexi,DENSITY};", ctx);
  return ctx.__E;
}
const GATE = loadDoku(), BROAD = loadDoku();
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, "doku-check-words.json"), "utf8"));
for (const L of ["3", "4", "5"]) for (const w of extra[L]) if (!(w in BROAD.WORDS[L])) BROAD.WORDS[L][w] = 9;

/* ---- page parsing ---- */
const LOCK_RE = /(\n\s*locked:\s*)(\[[^\n]*\])(,?)/, BANK_RE = /(\n\s*bank:\s*)(\[[^\n]*\])(,?)/;
function grab(s, re) { const m = s.match(re); if (!m) throw new Error("no " + re); return JSON.parse(m[2]); }
function parsePage(file) {
  const s = fs.readFileSync(file, "utf8");
  const i = s.indexOf("window.DN_PUZZLE"); if (i < 0) return null;
  const g = s.slice(i).match(/grid:\s*(\[\[[\s\S]*?\]\])/); if (!g) return null;
  const grid = JSON.parse(g[1]).map(r => r.map(x => String(x).toUpperCase()));
  const band = (s.slice(i).match(/band:\s*"(\w+)"/) || [])[1];
  const id = (s.slice(i).match(/id:\s*"([^"]+)"/) || [])[1];
  return { s, grid, band, id, locked: grab(s, LOCK_RE), bank: grab(s, BANK_RE) };
}
const lower = g => g.map(r => r.map(x => x === "#" ? "#" : x.toLowerCase()));

/* every fill of the empty squares (up to cap) under the broadened list */
function fills(E, grid, locked, bank, cap) {
  const g = lower(grid), slots = E.findSlots(g); if (!slots) return [];
  const lk = new Set(locked.map(([r, c]) => (r - 1) + "," + (c - 1)));
  const cur = g.map(r => r.slice()), empties = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r][c] !== "#" && !lk.has(r + "," + c)) { cur[r][c] = ""; empties.push([r, c]); }
  const pool = {}; for (const ch of bank) { const k = ch.toLowerCase(); pool[k] = (pool[k] || 0) + 1; }
  const at = {}; for (const sl of slots) for (const [r, c] of sl.cells) (at[r + "," + c] || (at[r + "," + c] = [])).push(sl);
  const dict = { 3: Object.keys(E.WORDS["3"]), 4: Object.keys(E.WORDS["4"]), 5: Object.keys(E.WORDS["5"]) };
  const ok = sl => { const p = sl.cells.map(([r, c]) => cur[r][c] || ".");
    if (!p.includes(".")) return E.WORDS[String(sl.L)][p.join("")] !== undefined;
    return dict[sl.L].some(w => { for (let i = 0; i < sl.L; i++) if (p[i] !== "." && p[i] !== w[i]) return false; return true; }); };
  const out = [];
  (function rec() {
    if (out.length >= cap) return;
    let best = -1, bc = null;
    for (let i = 0; i < empties.length; i++) { const [r, c] = empties[i]; if (cur[r][c]) continue;
      const cs = []; for (const ch of Object.keys(pool)) { if (!pool[ch]) continue; cur[r][c] = ch; if (at[r + "," + c].every(ok)) cs.push(ch); cur[r][c] = ""; }
      if (!cs.length) return;
      if (bc === null || cs.length < bc.length) { best = i; bc = cs; if (cs.length === 1) break; } }
    if (best < 0) { if (slots.every(ok)) out.push(cur.map(r => r.slice())); return; }
    const [r, c] = empties[best];
    for (const ch of bc) { cur[r][c] = ch; pool[ch]--; rec(); pool[ch]++; cur[r][c] = ""; if (out.length >= cap) return; }
  })();
  return out;
}
const runsOf = (g, slots) => slots.map(sl => sl.cells.map(([r, c]) => g[r][c]).join("").toUpperCase());

function audit(p) {
  const all = fills(BROAD, p.grid, p.locked, p.bank, 60), sol = lower(p.grid);
  const alts = all.filter(f => f.some((row, r) => row.some((x, c) => x !== sol[r][c])));
  return { alts, n: all.length };
}

/* for other tools (pinwheel-regen.js): how many second fills a Doku has under the broad list */
function broadAlts(pz, cap = 2) {
  const grid = pz.grid.map(r => r.map(x => String(x).toUpperCase()));
  const sol = lower(grid);
  return fills(BROAD, grid, pz.locked, pz.bank, cap + 1).filter(f => f.some((row, r) => row.some((v, c) => v !== sol[r][c]))).length;
}
module.exports = { broadAlts };
if (require.main !== module) return;

/* ---- scan ---- */
const from = val("--from") || londonDay(1);
const files = fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-logic-doku-\d+\.html$/.test(f) && f.slice(0, 10) >= from).sort();
const failing = [];
for (const f of files) {
  const p = parsePage(path.join(REPORTS, f)); if (!p) continue;
  const a = audit(p);
  if (a.alts.length) {
    const slots = GATE.findSlots(lower(p.grid));
    const orig = runsOf(lower(p.grid), slots), alt = runsOf(a.alts[0], slots);
    failing.push({ f, p, a, swap: orig.map((w, i) => w !== alt[i] ? w + "→" + alt[i] : null).filter(Boolean) });
  }
}

if (has("--check")) {
  const days = val("--days"), lim = days ? (() => { const d = new Date(from + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + +days); return d.toISOString().slice(0, 10); })() : "9999";
  for (const x of failing) console.log(x.f.slice(0, 10), x.p.id, x.p.band, x.a.alts.length + "+ alt", x.swap.join(" "));
  const soon = failing.filter(x => x.f.slice(0, 10) < lim);
  console.log(JSON.stringify({ checked: files.length, from, failing: failing.length, within: soon.length }));
  process.exit(soon.length ? 1 : 0);
}

if (has("--fix")) {
  const dry = has("--dry"), fixed = [], stuck = [];
  for (const x of failing) {
    const p = x.p, fill = p.grid.flat().filter(c => c !== "#").length;
    const [lo, hi] = GATE.DENSITY[p.band]; const maxLocks = Math.floor((hi + 0.06) * fill + 1e-9);
    let locked = p.locked.slice(), bank = p.bank.slice(), alts = x.a.alts, added = [];
    while (alts.length && added.length < 3 && locked.length + 1 <= maxLocks) {
      // the empty square that differs from the answer in the most alternative fills
      const lk = new Set(locked.map(([r, c]) => (r - 1) + "," + (c - 1))), sol = lower(p.grid);
      let best = null, bestN = -1;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        if (sol[r][c] === "#" || lk.has(r + "," + c)) continue;
        const n = alts.filter(f => f[r][c] !== sol[r][c]).length;
        if (n > bestN) { bestN = n; best = [r, c]; }
      }
      const ch = p.grid[best[0]][best[1]], bi = bank.indexOf(ch);
      if (bi < 0) throw new Error(p.id + ": letter " + ch + " not in bank");
      bank.splice(bi, 1); locked.push([best[0] + 1, best[1] + 1]); added.push(ch + "(r" + (best[0] + 1) + "c" + (best[1] + 1) + ")");
      alts = fills(BROAD, p.grid, locked, bank, 60).filter(f => f.some((row, r) => row.some((v, c) => v !== sol[r][c])));
    }
    // at the density ceiling: move an existing lock instead (same count), up to 3 moves
    for (let moves = 0; alts.length && moves < 3; moves++) {
      const sol = lower(p.grid); let best = null;
      for (let i = 0; i < locked.length; i++) for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        if (sol[r][c] === "#" || locked.some(([lr, lc]) => lr === r + 1 && lc === c + 1)) continue;
        if (!alts.some(f => f[r][c] !== sol[r][c])) continue;          // must split at least one alternative
        const [or, oc] = locked[i], tryL = locked.slice(); tryL[i] = [r + 1, c + 1];
        const tryB = bank.slice(); tryB[tryB.indexOf(p.grid[r][c])] = p.grid[or - 1][oc - 1];   // swap in place, order otherwise kept
        const left = fills(BROAD, p.grid, tryL, tryB, 60).filter(f => f.some((row, y) => row.some((v, x) => v !== sol[y][x]))).length;
        if (!best || left < best.left) best = { left, tryL, tryB, note: p.grid[r][c] + "(r" + (r + 1) + "c" + (c + 1) + ") for " + p.grid[or - 1][oc - 1] + "(r" + or + "c" + oc + ")" };
        if (best.left === 0) break;
      }
      if (!best || best.left >= alts.length) break;
      locked = best.tryL; bank = best.tryB; added.push("moved " + best.note);
      alts = fills(BROAD, p.grid, locked, bank, 60).filter(f => f.some((row, r) => row.some((v, c) => v !== sol[r][c])));
    }
    const pz = { grid: p.grid, band: p.band, locked, bank };
    const gate = GATE.validateLexi(pz);
    if (alts.length || !gate.pass) { stuck.push({ f: x.f, id: p.id, why: alts.length ? "still " + alts.length + " alt after " + added.length + " locks (max " + maxLocks + ")" : "gate: " + JSON.stringify(gate.checks) }); continue; }
    // stamp: locked + bank lines, and the two counts in the standfirst / og:description
    const oldL = p.locked.length, oldB = p.bank.length, newL = locked.length, newB = bank.length;
    let s = p.s;
    const fmt = a => "[" + a.map(v => Array.isArray(v) ? "[" + v.join(",") + "]" : JSON.stringify(v)).join(",") + "]";
    s = s.replace(LOCK_RE, (m, a, b, c) => a + fmt(locked) + c);
    s = s.replace(BANK_RE, (m, a, b, c) => a + fmt(bank) + c);
    if (oldL === oldB && oldL !== newL) { stuck.push({ f: x.f, id: p.id, why: "standfirst counts equal (" + oldL + "); edit by hand" }); continue; }
    let blurbs = 0;
    s = s.replace(/(<meta (?:name="dn:standfirst"|property="og:description"|name="twitter:description")\s+content=")([^"]*)(")/g, (m, a, t, c) => {
      blurbs++;
      return a + t.replace(/\b\d+\b/g, n => +n === oldL ? String(newL) : +n === oldB ? String(newB) : n) + c;
    });
    // masked diff: only the locked line, bank line and blurbs may change
    const mask = t => t.replace(LOCK_RE, "\nLOCK").replace(BANK_RE, "\nBANK").replace(/(<meta (?:name="dn:standfirst"|property="og:description"|name="twitter:description")\s+content=")[^"]*"/g, "$1\"");
    if (mask(s) !== mask(p.s)) throw new Error(p.id + ": masked diff failed");
    if (s === p.s) throw new Error(p.id + ": no change written");
    if (!dry) fs.writeFileSync(path.join(REPORTS, x.f), s);
    fixed.push({ f: x.f, id: p.id, band: p.band, added, locks: oldL + "→" + newL, blurbs });
  }
  // re-parse from disk and re-run both gates
  let bad = 0;
  if (!dry) for (const x of fixed) {
    const p = parsePage(path.join(REPORTS, x.f));
    const g = GATE.validateLexi({ grid: p.grid, band: p.band, locked: p.locked, bank: p.bank });
    const a = audit(p);
    if (!g.pass || a.alts.length) { bad++; console.error("RECHECK FAILED", x.f, JSON.stringify(g.checks), a.alts.length); }
  }
  for (const x of fixed) console.log("fixed", x.f.slice(0, 10), x.id, x.band, x.locks, x.added.join(" "));
  for (const x of stuck) console.log("STUCK", x.f.slice(0, 10), x.id, x.why);
  console.log(JSON.stringify({ from, failing: failing.length, fixed: fixed.length, stuck: stuck.length, recheckFailed: bad, dry }));
  process.exit(bad || stuck.length ? 1 : 0);
}

if (!has("--check") && !has("--fix")) { console.error("usage: --check | --fix (see header)"); process.exit(2); }
