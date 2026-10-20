#!/usr/bin/env node
/* Digi Puzzles — one-line emoji share text (digi-share-v2, 15 Oct 2026).

   The group compares results line by line in WhatsApp, so every type now
   shares one line in the same "emoji Name #N — result" shape Tangle already
   uses. No link, no "made with Digi Puzzles", no separate streak line (the
   finish sheet adds the short link as a second line from 20 Oct 2026); a
   streak of 2 or more is added as "· 🔥n".

     Mini     ✏️ Mini #100 — 1:27 · 🔥5
     Doku     🔢 Doku #98 — 0:58 · 🔥5
     Path     〰️ Path #93 — 0:48 · 🔥5
     Sweep    💣 Sweep 13 Oct — swept in 0:35 · 🔥5   |  💥 Sweep 13 Oct — boom
     Link     🔗 Link #72 — 🟨❌🟩🟦❌⬛ · 2:14 · 🔥5   (one square per guess:
              the group's colour when right, ❌ when wrong; no time on a loss)
     Borders  🌍 Borders #15 — 7/10 · 640 pts · 🔥3
     Tangle   unchanged (🧶 Tangle #9 — 30 points, 20 words)

   Both share paths are changed: the result box's "Share result" (live) and
   the saved-result share after a revisit (doneText, from add-done-state.js).
   The live button now uses the same share-sheet-on-phones / copy-elsewhere
   helper as the saved one.

   Usage:  node tools/share-v2.js            patch reports/ in place
           node tools/share-v2.js --check    exit 1 if any puzzle lacks it
           node tools/share-v2.js --dry      report only
           node tools/share-v2.js file.html  patch named files only
   Idempotent: a patched file carries the digi-share-v2 marker and is skipped.
   A file whose anchors don't match exactly is refused and left untouched.
*/
const fs = require('fs');
const path = require('path');

const MARK = 'digi-share-v2';

/* Archive-only July prototypes with none of the shared shell's anchors
   (same set add-done-state.js leaves alone). */
const LEGACY = new Set([
  '2026-07-13-logic-doku-0001.html',
  '2026-07-14-logic-doku-0002.html',
  '2026-07-16-logic-doku-0003.html',
  // The first two Borders (5–6 Oct) predate its Share button; nothing to change.
  '2026-10-05-geo-borders-0001.html',
  '2026-10-06-geo-borders-0002.html',
]);

// Shared helpers, injected once per file, just before the doneText it rewrites.
const HELPERS = `/* ---- ${MARK}: one-line emoji share text ---- */
function dnNum(id){const n=parseInt(String(id).split("·").pop(),10);return isNaN(n)?"":"#"+n;}
function dnTime(t){return String(t||"").trim().replace(/^0+(\\d)/,"$1");}
function dnStreak(n){n=parseInt(String(n||"").replace(/\\D/g,""),10)||0;return n>=2?" · 🔥"+n:"";}
`;

const TYPES = {
  mini: {
    match: /-crossword-mini-\d+\.html$/,
    edits: [
      // live: result box button
      ['  const txt=`The Digi Mini · ${P.id}\\nSolved in ${$("#timer").textContent} — streak ${$("#streak").textContent} (best ${$("#best").textContent})\\nmade with Digi Puzzles`;\n'
       + '  try{await navigator.clipboard.writeText(txt);const b=$("#winShare");b.textContent="Copied ✓";setTimeout(()=>b.textContent="Share result",1500);}\n'
       + '  catch(_){const b=$("#winShare");b.textContent="Copy unavailable";setTimeout(()=>b.textContent="Share result",1500);}\n',
       '  const txt="✏️ Mini "+dnNum(P.id)+" — "+dnTime($("#timer").textContent)+dnStreak($("#streak").textContent);\n'
       + '  doneCopy(txt,$("#winShare"));\n'],
      // saved result
      ['function doneText(rec){return `The Digi Mini · ${doneId()}\\nSolved in ${doneMMSS(rec.s)} — streak ${doneUI("streak")} (best ${doneUI("best")})\\nmade with Digi Puzzles`;}',
       HELPERS + 'function doneText(rec){return "✏️ Mini "+dnNum(doneId())+" — "+dnTime(doneMMSS(rec.s))+dnStreak(doneUI("streak"));}'],
    ],
  },
  doku: {
    match: /-logic-doku-\d+\.html$/,
    edits: [
      ['  const txt=`The Digi Doku · ${P.id}\\nSolved in ${$("#timer").textContent} — streak ${$("#streak").textContent} (best ${$("#best").textContent})\\nmade with Digi Puzzles`;\n'
       + '  try{await navigator.clipboard.writeText(txt);const b=$("#winShare");b.textContent="Copied ✓";setTimeout(()=>b.textContent="Share result",1500);}\n'
       + '  catch(_){const b=$("#winShare");b.textContent="Copy unavailable";setTimeout(()=>b.textContent="Share result",1500);}\n',
       '  const txt="🔢 Doku "+dnNum(P.id)+" — "+dnTime($("#timer").textContent)+dnStreak($("#streak").textContent);\n'
       + '  doneCopy(txt,$("#winShare"));\n'],
      ['function doneText(rec){return `The Digi Doku · ${doneId()}\\nSolved in ${doneMMSS(rec.s)} — streak ${doneUI("streak")} (best ${doneUI("best")})\\nmade with Digi Puzzles`;}',
       HELPERS + 'function doneText(rec){return "🔢 Doku "+dnNum(doneId())+" — "+dnTime(doneMMSS(rec.s))+dnStreak(doneUI("streak"));}'],
    ],
  },
  sweep: {
    match: /-logic-sweep\.html$/,
    edits: [
      ['  const txt=`The Digi Sweep · ${P.id}\\n${won?`Swept in ${$("#timer").textContent}`:"Hit a mine"} · streak ${$("#streak").textContent}\\nmade with Digi Puzzles`;\n'
       + '  try{await navigator.clipboard.writeText(txt);const b=$("#winShare");b.textContent="Copied ✓";setTimeout(()=>b.textContent="Share result",1500);}\n'
       + '  catch(_){const b=$("#winShare");b.textContent="Copy unavailable";setTimeout(()=>b.textContent="Share result",1500);}\n',
       '  const txt=dnSweep(won?"win":"loss",$("#timer").textContent,$("#streak").textContent,P.id);\n'
       + '  doneCopy(txt,$("#winShare"));\n'],
      ['function doneText(rec){const how=rec.o==="win"?"Swept in "+doneMMSS(rec.s):rec.o==="loss"?"Hit a mine":"Revealed the board";return `The Digi Sweep · ${doneId()}\\n${how} · streak ${doneUI("streak")}\\nmade with Digi Puzzles`;}',
       HELPERS
       + 'function dnSweepDay(id){const m=String(id).match(/(\\d{4})-(\\d{2})-(\\d{2})/);return m?(+m[3])+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m[2]-1]:dnNum(id);}\n'
       + 'function dnSweep(o,t,streak,id){const d=dnSweepDay(id);return o==="win"?"💣 Sweep "+d+" — swept in "+dnTime(t)+dnStreak(streak):o==="loss"?"💥 Sweep "+d+" — boom":"💣 Sweep "+d+" — revealed";}\n'
       + 'function doneText(rec){return dnSweep(rec.o==="win"?"win":rec.o==="loss"?"loss":"gave",doneMMSS(rec.s),doneUI("streak"),doneId());}'],
    ],
  },
  path: {
    match: /-logic-path-\d+\.html$/,
    edits: [
      ['  const text = PUZZLE.id+" — solved in "+timerEl.textContent+" \\ud83e\\uddf5";\n',
       '  const text = "〰️ Path "+dnNum(PUZZLE.id)+" — "+dnTime(timerEl.textContent)+dnStreak(document.getElementById("statStreak").textContent);\n'],
      ['function doneText(rec){const t=(/^\\d{1,4}:\\d{2}$/.test(String(rec.t))?String(rec.t):null)||"0:00";return doneId()+" — solved in "+t+" \\ud83e\\uddf5";}',
       HELPERS + 'function doneText(rec){const t=(/^\\d{1,4}:\\d{2}$/.test(String(rec.t))?String(rec.t):null)||"0:00";return "〰️ Path "+dnNum(doneId())+" — "+dnTime(t)+dnStreak(doneUI("streakn"));}'],
    ],
  },
  link: {
    match: /-word-link-\d+\.html$/,
    edits: [
      ['function shareText(){\n'
       + '  const grid=guesses.map(g=>g.map(r=>GLYPH[r]).join("")).join("\\n");\n'
       + '  const line=won\n'
       + '    ? "Linked in "+$("#timer").textContent+(mistakes?" · "+mistakes+" mistake"+(mistakes>1?"s":""):" · perfect")\n'
       + '    : "Ran out of mistakes";\n'
       + '  return ["The Digi Link · "+P.id, grid, line+" · streak "+$("#streak").textContent, "made with Digi Puzzles"]\n'
       + '    .filter(Boolean).join("\\n");\n'
       + '}',
       'function shareText(){\n'
       + '  return dnLink(guesses,won,$("#timer").textContent,$("#streak").textContent,P.id);\n'
       + '}'],
      ['  const b=$("#winShare"), txt=shareText();\n'
       + '  try{await navigator.clipboard.writeText(txt);',
       '  const b=$("#winShare"), txt=shareText();\n'
       + '  if(typeof doneCopy==="function"){doneCopy(txt,b);return;}\n'
       + '  try{await navigator.clipboard.writeText(txt);'],
      ['function doneText(rec){const g=(Array.isArray(rec.g)?rec.g:[]).filter(x=>Array.isArray(x)&&x.length===4&&x.every(v=>GLYPH[v]));const m=Math.max(0,Math.min(MAX_MISTAKES,Math.floor(+rec.m)||0));const t=(/^\\d{1,4}:\\d{2}$/.test(String(rec.t))?String(rec.t):null)||"00:00";const line=rec.o==="win"?"Linked in "+t+(m?" · "+m+" mistake"+(m>1?"s":""):" · perfect"):"Ran out of mistakes";return ["The Digi Link · "+doneId(),g.map(x=>x.map(r=>GLYPH[r]).join("")).join("\\n"),line+" · streak "+doneUI("streak"),"made with Digi Puzzles"].filter(Boolean).join("\\n");}',
       HELPERS
       + 'function dnLinkRow(g){return (Array.isArray(g)?g:[]).filter(x=>Array.isArray(x)&&x.length===4).map(x=>x.every(v=>v===x[0])&&GLYPH[x[0]]?GLYPH[x[0]]:"❌").join("");}\n'
       + 'function dnLink(g,won,t,streak,id){return "🔗 Link "+dnNum(id)+" — "+dnLinkRow(g)+(won?" · "+dnTime(t):"")+(won?dnStreak(streak):"");}\n'
       + 'function doneText(rec){const t=(/^\\d{1,4}:\\d{2}$/.test(String(rec.t))?String(rec.t):null)||"00:00";return dnLink(rec.g,rec.o==="win",t,doneUI("streak"),doneId());}'],
    ],
  },
  borders: {
    match: /-geo-borders-\d+\.html$/,
    edits: [
      ["function shareText(rec){\n"
       + "  const sq=rec.ans.map(a=>a.ok?(a.h?GLYPH.hint:GLYPH.right):GLYPH.wrong);\n"
       + "  const groups=[];let at=0;for(const t of [1,2,3]){const n=PLAN.filter(x=>x===t).length;groups.push(sq.slice(at,at+n).join(''));at+=n;}\n"
       + "  const s=save.streak||{n:0},live=s.last===today()||s.last===dayBefore(today());\n"
       + "  return ['Digi Borders · '+P.id, groups.join(' '),\n"
       + "    rec.c+'/'+NQ+' in '+mmss(rec.secs)+' · streak '+(live?s.n:0),\n"
       + "    'made with Digi Puzzles'].join('\\n');\n"
       + "}",
       `/* ---- ${MARK}: one-line emoji share text ---- */\n`
       + "function shareText(rec){\n"
       + "  const s=save.streak||{n:0},live=s.last===today()||s.last===dayBefore(today()),n=live?(s.n||0):0;\n"
       + "  const num=parseInt(String(P.id).slice(-4),10);\n"
       + "  return '🌍 Borders '+(isNaN(num)?'':'#'+num+' ')+'— '+rec.c+'/'+NQ+' · '+rec.p+' pts'+(n>=2?' · 🔥'+n:'');\n"
       + "}"],
    ],
  },
};

function typeOf(file) {
  const base = path.basename(file);
  for (const [k, t] of Object.entries(TYPES)) if (t.match.test(base)) return k;
  return null;
}

function patch(src, type) {
  let out = src;
  for (const [from, to] of TYPES[type].edits) {
    const n = out.split(from).length - 1;
    if (n !== 1) return { error: `anchor found ${n} times: ${JSON.stringify(from.slice(0, 70))}…` };
    out = out.replace(from, () => to);
  }
  return { out };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const CHECK = args.includes('--check'), DRY = args.includes('--dry');
  const named = args.filter(a => !a.startsWith('--'));
  const dir = path.join(__dirname, '..', 'reports');
  const files = named.length ? named : fs.readdirSync(dir).map(f => path.join(dir, f));
  let done = 0, patched = 0, missing = 0;
  const refused = [];
  for (const f of files) {
    const type = typeOf(f);
    if (!type || LEGACY.has(path.basename(f))) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (src.includes(MARK)) { done++; continue; }
    // A thin page on a shared engine (tools/engine-shells.js): the share code
    // lives in engines/<type>.js, so that is where the marker must be.
    const eng = src.match(/<script src="\.\.\/engines\/([a-z]+)\.js"><\/script>/);
    if (eng) {
      const ep = path.join(__dirname, '..', 'engines', eng[1] + '.js');
      if (fs.existsSync(ep) && fs.readFileSync(ep, 'utf8').includes(MARK)) { done++; continue; }
      if (CHECK) { missing++; console.log('missing ' + MARK + ' in engines/' + eng[1] + '.js: ' + path.basename(f)); }
      else refused.push(path.basename(f) + ' — engines/' + eng[1] + '.js lacks ' + MARK);
      continue;
    }
    if (CHECK) { missing++; console.log('missing ' + MARK + ': ' + path.basename(f)); continue; }
    const r = patch(src, type);
    if (r.error) { refused.push(path.basename(f) + ' — ' + r.error); continue; }
    if (!DRY) fs.writeFileSync(f, r.out);
    patched++;
  }
  console.log(`${MARK}: ${patched} ${DRY ? 'would be ' : ''}patched, ${done} already done` +
              (CHECK ? `, ${missing} missing` : '') + (refused.length ? `, ${refused.length} refused` : ''));
  refused.slice(0, 40).forEach(r => console.log('  refused: ' + r));
  if (CHECK && missing) process.exit(1);
  if (refused.length && !CHECK) process.exit(2);
}

module.exports = { patch, typeOf, MARK };
