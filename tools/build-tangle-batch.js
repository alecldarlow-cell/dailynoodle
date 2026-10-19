#!/usr/bin/env node
/* tools/build-tangle-batch.js — stamp and gate Tangle boards made by the kit's gen.py.

   The generator, dictionary and blocklists live in tangle-kit (not in this repo,
   typespec 15). gen.py writes a days JSON; this stamps each day into a thin page
   cloned from the newest live Tangle (so today's shell, count-in, share line and
   engine are what new days get) and gates every new page, re-parsed from disk:
     - the engine's own GATE(), read out of engines/tangle.js;
     - an independent per-word backtracking solver: each page's main and bonus
       lists must equal exactly the traceable words of the kit dictionary;
     - no blocklisted word (kit hand list, LDNOOBW minus its allow-list, SCOWL
       flagged list, word-part list, the house list), star never on `nostar`;
     - masked diff against the template (only headline, standfirst, date and
       the DN_PUZZLE line may differ; the og block is tools/og-tags.js's);
     - standfirst states the board's common-word count and star length;
     - contiguous dates and serials from the live run; no star word repeated
       across every live and new day; no board repeated under D4.

   Usage:
     node tools/build-tangle-batch.js --verify                       # re-stamp live thin pages from their data, compare bytes
     node tools/build-tangle-batch.js --kit DIR --days days.json [--check]
   Then run `node tools/og-tags.js`. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), REPORTS = path.join(ROOT, 'reports');
const args = process.argv.slice(2), has = k => args.includes(k);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

const HOUSE = ["anal","anus","arse","bastard","bitch","boob","boobs","cunt","cunts","dick","dicks","dildo","fuck","fucks","heroin","homo","jihad","meth","nazi","nazis","negro","nude","nudes","opium","orgy","penis","pimp","porn","porno","pussy","rape","raped","rapes","semen","sex","sexy","sperm","twat","whore",
  // 19 Oct 2026 (Alec's call): stripped from every Tangle from 21 Oct 2026; also in the kit's blocklist
  "barf","bum","cig","cigs","pee","peed","pees","pleb","plebs","poo","poop","poos","ricin","sod","sods","tart","tarts","wees"];
const NUM = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen'];
const live = () => fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-word-tangle-\d{4}\.html$/.test(f)).sort();
const PZ_RE = /window\.DN_PUZZLE=(\{.*\});/;
const OG_RE = /<!-- og:start[^>]*-->[\s\S]*?<!-- og:end -->\n?/;
const parse = s => { const m = s.match(PZ_RE) || s.match(/\nconst PUZZLE=(\{.*\});\n/); return m ? vm.runInNewContext('(' + m[1] + ')') : null; };

const j = v => JSON.stringify(v);
const pzLine = d => `window.DN_PUZZLE={id:${j(d.id)},date:${j(d.date)},n:${d.n},band:"standard",grid:${j([['.', '.', '.', '.'], ['.', '.', '.', '.'], ['.', '.', '.', '.'], ['.', '.', '.', '.']])},tiles:${j(d.tiles)},star:${j(d.star)},starPath:${j(d.starPath)},main:${j(d.main)},bonus:${j(d.bonus)}};`;
const standfirst = d => `Ninety seconds, sixteen tiles, ${d.main.length} common words to find. Longer words score more, and the ${NUM[d.star.length]}-letter longest word scores double.`;
const fileOf = d => `${d.date}-word-tangle-${String(d.n).padStart(4, '0')}.html`;
function stamp(tpl, d) {
  let s = tpl;
  s = s.replace(/(name="dn:headline"\s+content=")[^"]*(")/, `$1Tangle ${String(d.n).padStart(4, '0')}$2`);
  s = s.replace(/(name="dn:standfirst"\s+content=")[^"]*(")/, `$1${standfirst(d)}$2`);
  s = s.replace(/(name="dn:date"\s+content=")[^"]*(")/, `$1${d.date}$2`);
  if (!PZ_RE.test(s)) throw new Error('DN_PUZZLE line not found in template');
  return s.replace(PZ_RE, () => pzLine(d));
}

/* the engine's own load-time gate */
function engineGate() {
  const src = fs.readFileSync(path.join(ROOT, 'engines/tangle.js'), 'utf8');
  const nb = src.match(/const NB=\(\(\)=>\{[\s\S]*?\}\)\(\);/)[0], g = src.match(/\/\*@GATE\*\/([\s\S]*?)\/\*@GATE_END\*\//)[1];
  const ctx = {}; vm.createContext(ctx); vm.runInContext('const N=4;' + nb + g + ';this.GATE=GATE;', ctx);
  return ctx.GATE;
}
/* independent solver: per-word backtracking, 'qu' tile spells two letters (no shared code with gen.py or the engine) */
function traceable(tiles, w) {
  const t = tiles.map(x => x.toLowerCase()), used = new Array(16).fill(false);
  const adj = (a, b) => a !== b && Math.abs((a >> 2) - (b >> 2)) <= 1 && Math.abs((a & 3) - (b & 3)) <= 1;
  function at(i, pos) {
    const s = t[i]; if (w.substr(pos, s.length) !== s) return false;
    const np = pos + s.length; if (np === w.length) return true;
    used[i] = true;
    for (let k = 0; k < 16; k++) if (!used[k] && adj(i, k) && at(k, np)) { used[i] = false; return true; }
    used[i] = false; return false;
  }
  for (let i = 0; i < 16; i++) if (at(i, 0)) return true;
  return false;
}
function d4(tiles) {
  const g = [0, 1, 2, 3].map(r => tiles.slice(r * 4, r * 4 + 4));
  const rot = m => m[0].map((_, c) => m.map(r => r[c]).reverse()), mir = m => m.map(r => r.slice().reverse());
  let best = null, m = g;
  for (let k = 0; k < 4; k++) { for (const c of [m, mir(m)]) { const s = c.map(r => r.join(',')).join('|'); if (best === null || s < best) best = s; } m = rot(m); }
  return best;
}
const addDay = (d, k) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };

module.exports = { stamp, pzLine, standfirst, traceable, d4, engineGate };
if (require.main === module) main();

function main() {
  const files = live(), lastF = files.at(-1);
  const read = f => fs.readFileSync(path.join(REPORTS, f), 'utf8');
  const tpl = read(lastF);
  if (has('--verify')) {
    let same = 0, thin = 0; const diff = [];
    for (const f of files) { const s = read(f); if (!PZ_RE.test(s)) continue; thin++; const out = stamp(tpl, parse(s)); if (out.replace(OG_RE, '') === s.replace(OG_RE, '')) same++; else diff.push(f); }
    console.log(JSON.stringify({ live: files.length, thinPages: thin, byteIdentical: same, differ: diff.slice(0, 5) }));
    process.exit(diff.length ? 1 : 0);
  }
  const kit = arg('--kit'), daysF = arg('--days');
  if (!kit || !daysF) { console.error('need --kit DIR --days days.json (or --verify)'); process.exit(1); }
  const days = JSON.parse(fs.readFileSync(daysF, 'utf8'));
  const DICT = JSON.parse(fs.readFileSync(path.join(kit, 'tangle-dict.json'), 'utf8'));
  const MAINSET = new Set(DICT.main), BONUSSET = new Set(DICT.bonus), ALL = DICT.main.concat(DICT.bonus);
  const BL = JSON.parse(fs.readFileSync(path.join(kit, 'blocklist.json'), 'utf8'));
  const lines = f => fs.readFileSync(path.join(kit, f), 'utf8').split(/\s*\r?\n\s*/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const EXT = new Set(lines(BL.external.file).filter(s => /^[a-z]+$/.test(s) && !BL.external.allow.includes(s)));
  const FRAG = new Set(lines(BL.fragments.file).filter(s => !BL.fragments.keep.includes(s)));
  const FLAG = new Set(lines('wl/flagged70.txt'));
  const WORDS = new Set(BL.words.concat(HOUSE)), NOSTAR = new Set(BL.nostar);
  const blocked = w => FRAG.has(w) || EXT.has(w) || FLAG.has(w) || WORDS.has(w) || BL.stems.some(s => w.startsWith(s));
  const GATE = engineGate();
  const mask = s => s.replace(OG_RE, '').replace(/(name="dn:(headline|standfirst|date)"\s+content=")[^"]*/g, '$1@').replace(PZ_RE, '@PZ@');
  const tplMasked = mask(tpl);

  const errs = []; const err = (f, m) => errs.push(f + ': ' + m);
  const liveP = files.map(f => ({ f, P: parse(read(f)) }));
  const stars = new Map(liveP.map(x => [x.P.star, x.f])), boards = new Map(liveP.map(x => [d4(x.P.tiles), x.f]));
  let prev = liveP.at(-1).P;
  const out = [];
  for (const d of days) {
    const f = fileOf(d), html = stamp(tpl, d);
    if (d.n !== prev.n + 1 || d.date !== addDay(prev.date, 1)) err(f, `does not follow ${prev.date} #${prev.n}`);
    if (d.id !== 'DP·TANG·' + String(d.n).padStart(4, '0')) err(f, 'id ' + d.id);
    out.push({ f, html, d }); prev = d;
  }
  const write = !has('--check');
  for (const { f, html } of out) if (write) fs.writeFileSync(path.join(REPORTS, f), html);
  // re-parse from disk (or from the stamped text on --check) and gate
  for (const { f, html } of out) {
    const s = write ? fs.readFileSync(path.join(REPORTS, f), 'utf8') : html;
    const P = parse(s);
    if (mask(s) !== tplMasked) err(f, 'masked diff against the template');
    const md = (s.match(/name="dn:date"\s+content="([^"]*)"/) || [])[1];
    const g = GATE(P, md); if (g.length) err(f, 'engine GATE: ' + g.join('; '));
    if (!s.includes(`content="Tangle ${String(P.n).padStart(4, '0')}"`)) err(f, 'headline');
    if (!s.includes(`${P.main.length} common words`) || !s.includes(`${NUM[P.star.length]}-letter longest word`)) err(f, 'standfirst disagrees with the board');
    const traced = ALL.filter(w => !blocked(w) && traceable(P.tiles, w));   // blocked words are left out of the lists, not required in them
    const wm = traced.filter(w => MAINSET.has(w)).sort(), wb = traced.filter(w => BONUSSET.has(w)).sort();
    if (j(wm) !== j(P.main.slice().sort())) err(f, 'main list != independent solver');
    if (j(wb) !== j(P.bonus.slice().sort())) err(f, 'bonus list != independent solver');
    for (const w of P.main.concat(P.bonus)) if (blocked(w)) err(f, 'blocklisted word ' + w);
    if (NOSTAR.has(P.star)) err(f, 'star on the nostar list: ' + P.star);
    if (stars.has(P.star)) err(f, `star ${P.star} repeats ${stars.get(P.star)}`); else stars.set(P.star, f);
    const k = d4(P.tiles); if (boards.has(k)) err(f, 'board repeats ' + boards.get(k) + ' under D4'); else boards.set(k, f);
  }
  const mc = out.map(x => x.d.main.length);
  console.log(JSON.stringify({ days: out.length, first: out[0] && out[0].f, last: out.at(-1) && out.at(-1).f, mainWords: [Math.min(...mc), Math.max(...mc)], errors: errs.length, written: write }));
  errs.slice(0, 30).forEach(e => console.log('ERROR ' + e));
  process.exit(errs.length ? 1 : 0);
}
