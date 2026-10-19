#!/usr/bin/env node
/* tools/link-order.js — put a pool of finished Link puzzles into date order (added 19 Oct 2026).

   Input: one or more batch JSON files (same items as tools/link-reedit.js takes, plus optional
   "themes": ["rivers","fish",...] short tags for what the puzzle's groups are about, and optional
   "pin": [lo, hi] serial range). Picks `--count` of them (default: all) and assigns serials
   --from, --from+1, ... so that:
     hard  R6: the same rank-4 kind at most twice in any 7 consecutive serials, checked across the
           seam with the already re-edited Links before --from and after the range (read from
           toolchain/link-batches/*.json);
     hard  pins respected;
     soft  shared theme tags at least 10 days apart (penalty grows as they get closer),
           no two neighbours with the same rank-4 kind, no three in a row with the same shape.
   Simulated annealing with restarts; exits 1 if a hard rule is still broken.

   Usage: node tools/link-order.js --pool a.json[,b.json] --from 135 [--count 40] --out ordered.json
   Then gate the result: node tools/link-reedit.js --batch ordered.json --check */
'use strict';
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const files = (arg('--pool') || '').split(',').filter(Boolean), S0 = +arg('--from'), out = arg('--out');
if (!files.length || !S0 || !out) { console.error('usage: --pool a.json[,b.json] --from N [--count K] --out F'); process.exit(2); }
let pool = files.flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const N = Math.min(+arg('--count') || pool.length, pool.length);
const BATCHES = path.join(__dirname, '..', 'toolchain', 'link-batches');
const done = fs.readdirSync(BATCHES).filter(f => /^link-\d+-\d+\.json$/.test(f)).flatMap(f => JSON.parse(fs.readFileSync(path.join(BATCHES, f), 'utf8')));
const before = done.filter(p => p.serial < S0 && p.serial >= S0 - 6).sort((a, b) => a.serial - b.serial);
const after = done.filter(p => p.serial >= S0 + N && p.serial < S0 + N + 6).sort((a, b) => a.serial - b.serial);
const shared = (a, b) => (a.themes || []).some(t => (b.themes || []).includes(t));
function cost(o) {
  let c = 0, hard = 0;
  const seq = [...before.map(p => ({ s: p.serial, k: p.r4kind })), ...o.slice(0, N).map((p, i) => ({ s: S0 + i, k: p.r4kind })), ...after.map(p => ({ s: p.serial, k: p.r4kind }))];
  for (let i = 0; i < seq.length; i++) {
    const n = {}; for (const q of seq) if (q.s >= seq[i].s && q.s < seq[i].s + 7) n[q.k] = (n[q.k] || 0) + 1;
    for (const k in n) if (n[k] > 2) { c += 1000 * (n[k] - 2); hard++; }
  }
  for (let i = 0; i < N; i++) {
    const p = o[i], s = S0 + i;
    if (p.pin && (s < p.pin[0] || s > p.pin[1])) { c += 1000; hard++; }
    if (i && o[i - 1].r4kind === p.r4kind) c += 50;
    if (i > 1 && p.shape && o[i - 1].shape === p.shape && o[i - 2].shape === p.shape) c += 30;
    for (let j = i + 1; j < Math.min(N, i + 10); j++) if (shared(p, o[j])) c += (10 - (j - i)) ** 2 * 3;
  }
  return { c, hard };
}
let best = null, bc = { c: Infinity };
for (let run = 0; run < 40; run++) {
  const o = pool.slice().sort(() => Math.random() - 0.5); let oc = cost(o).c, T = 300;
  for (let it = 0; it < 30000; it++) {
    const i = Math.floor(Math.random() * N), j = Math.floor(Math.random() * o.length);   // j may swap in an unused spare
    [o[i], o[j]] = [o[j], o[i]]; const nc = cost(o).c;
    if (nc <= oc || Math.random() < Math.exp((oc - nc) / T)) oc = nc; else [o[i], o[j]] = [o[j], o[i]];
    T *= 0.9997;
  }
  const r = cost(o); if (r.c < bc.c) { bc = r; best = o.slice(); }
}
const res = best.slice(0, N).map((p, i) => ({ ...p, serial: S0 + i }));
fs.writeFileSync(out, JSON.stringify(res, null, 1));
res.forEach(p => console.log(p.serial, p.r4kind, p.shape || '-', (p.groups.find(g => g.rank === 4) || {}).name));
console.log(JSON.stringify({ placed: N, spares: pool.length - N, cost: bc.c, hardBreaks: bc.hard }));
process.exit(bc.hard ? 1 : 0);
