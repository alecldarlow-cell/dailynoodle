#!/usr/bin/env node
'use strict';
/* ==========================================================================
   Noodle News — the daily briefing and the deep-piece desk gate (24 Oct 2026)
   --------------------------------------------------------------------------
   Alec's call after the site review: the desk publishes ONE short briefing a
   night (3–5 of the day's real news stories, each in plain English: what
   happened, why it matters, what happens next, with sources) and only 2–3
   full "deep" pieces a week, chosen by importance. Repeats are a hard block.

     node dn-briefing.js plan  [--date YYYY-MM-DD] [--repo DIR]
         This week's deep-piece count against the cap, the stories covered in
         the last 14 days (reuse their story slugs), yesterday's briefing.
     node dn-briefing.js build BRIEFING.json [--repo DIR] [--out FILE]
         Checks the briefing and writes reports/<date>-briefing.html (or FILE).
         Exit 1 and nothing written if any check fails.
     node dn-briefing.js check-deep PIECE.html [--repo DIR]
         The gate for a deep piece: dn:story present, not a repeat of a piece
         in the 14 days before (unless dn:followup names that piece), and the
         Monday-to-Sunday week holds no more than 3 deep pieces with it.
         Exit 1 on any failure. The nightly task may not waive it.

   BRIEFING.json:
     { "date": "2026-10-25",
       "items": [ {
         "story":    "uk-budget-2026",           // a-z0-9-; reuse the slug for the same running story
         "topic":    "Economy",                  // UK politics|Economy|Immigration|AI|Science|Medicine|Society|World
         "headline": "…",                        // ≤ 90 characters, says what happened
         "what":     "…",                        // 1–3 plain sentences, ≤ 60 words: what happened
         "why":      "…",                        // 1–2 sentences, ≤ 40 words: why it matters, to whom
         "next":     "…",                        // optional, ≤ 30 words: what happens next, with a date
         "developing": "…",                      // required only if the same story was in yesterday's briefing: what is new today
         "sources":  [ { "name": "HM Treasury", "url": "https://…" } ],   // 1–3, on the record
         "deep":     "reports/2026-10-25-….html" // optional: our full piece on it, if one exists
       } ] }

   The page reuses the house template's styles, masthead and footer classes,
   so the build workflow's additions (Share, ← News, dark mode, link previews,
   tracker) work on it unchanged. It carries dn:kind "report", dn:topic
   "Briefing" and dn:format "briefing"; build-feed.js lists its items for the
   News front page's lead block.
   ========================================================================== */
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const REPO = path.resolve(opt('--repo', fs.existsSync(path.join(__dirname, '..', 'reports')) ? path.join(__dirname, '..') : process.cwd()));
const REPORTS = path.join(REPO, 'reports');
const TOPICS = ['UK politics', 'Economy', 'Immigration', 'AI', 'Science', 'Medicine', 'Society', 'World'];
const CAP = 3, WINDOW = 14;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const london = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d || new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = iso => { const d = new Date(iso + 'T12:00:00Z'); return addDays(iso, -((d.getUTCDay() + 6) % 7)); };
const longDate = iso => { const d = new Date(iso + 'T12:00:00Z'); return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = s => (String(s || '').match(/[A-Za-z0-9£$€%’'.,-]+/g) || []).filter(w => /[A-Za-z0-9]/.test(w)).length;
const sentences = s => String(s || '').trim().split(/(?<=[.!?])\s+(?=[A-Z“"‘'£0-9])/).filter(Boolean);
const meta = (html, n) => { const m = html.match(new RegExp('<meta\\s+name="' + n.replace(':', '\\:') + '"\\s+content="([^"]*)"', 'i')); return m ? m[1] : ''; };

/* Every news piece in reports/: file, date, story, format, followup. */
function newsPieces() {
  if (!fs.existsSync(REPORTS)) return [];
  return fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-.+\.html$/.test(f)).map(f => {
    const head = fs.readFileSync(path.join(REPORTS, f), 'utf8').slice(0, 8000);
    if (!/name="dn:kind"\s+content="report"/.test(head)) return null;
    return { file: 'reports/' + f, date: meta(head, 'dn:date') || f.slice(0, 10), story: meta(head, 'dn:story'),
             format: meta(head, 'dn:format') || 'deep', followup: meta(head, 'dn:followup'), headline: meta(head, 'dn:headline'),
             topic: meta(head, 'dn:topic') };
  }).filter(Boolean).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
function briefingStories(file) {
  const html = fs.readFileSync(path.join(REPO, file), 'utf8');
  return [...html.matchAll(/data-story="([a-z0-9-]+)"/g)].map(m => m[1]);
}
const SIG = s => new Set(String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/)
  .filter(w => w.length > 3 && !/^(with|from|that|this|than|have|after|into|over|more|less|their|they|what|will|could|would|about|still|been|year|years|october|november|december|january)$/.test(w)));
function overlap(a, b) { const A = SIG(a), B = SIG(b); let n = 0; A.forEach(w => { if (B.has(w)) n++; }); return n / Math.max(1, Math.min(A.size, B.size)); }

/* ---------- plan ---------- */
function plan() {
  const date = opt('--date', london());
  const all = newsPieces(), wk = monday(date);
  const deepWeek = all.filter(p => p.format !== 'briefing' && p.date >= wk && p.date <= addDays(wk, 6));
  const recent = all.filter(p => p.date >= addDays(date, -WINDOW) && p.date <= date);
  console.log(`Desk plan for ${date} (week ${wk} to ${addDays(wk, 6)})`);
  console.log(`  Deep pieces this week: ${deepWeek.length} of ${CAP}${deepWeek.length >= CAP ? ' (cap reached: briefing only)' : ''}`);
  deepWeek.forEach(p => console.log(`    ${p.date}  ${p.story || '(no story slug)'}  ${p.headline}`));
  console.log(`  Covered in the last ${WINDOW} days (a new deep piece on one of these needs dn:followup and a new event):`);
  recent.filter(p => p.format !== 'briefing').forEach(p => console.log(`    ${p.date}  ${(p.story || '—').padEnd(28)} ${p.topic.padEnd(12)} ${p.headline}`));
  const prev = all.filter(p => p.format === 'briefing' && p.date < date).pop();
  if (prev) console.log(`  Last briefing ${prev.date} stories (repeat only with "developing"): ${briefingStories(prev.file).join(', ')}`);
  else console.log('  No earlier briefing.');
}

/* ---------- briefing ---------- */
function checkBriefing(b) {
  const fails = [], warns = [];
  if (!b || typeof b !== 'object') return { fails: ['not a JSON object'], warns };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) fails.push('date must be YYYY-MM-DD');
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length < 3 || items.length > 5) fails.push(`3 to 5 items, not ${items.length}`);
  const all = newsPieces();
  const prev = all.filter(p => p.format === 'briefing' && p.date < b.date && p.date >= addDays(b.date, -2)).pop();
  const yesterday = prev ? new Set(briefingStories(prev.file)) : new Set();
  const seen = new Set();
  items.forEach((it, i) => {
    const n = `item ${i + 1}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+){0,7}$/.test(it.story || '')) fails.push(`${n}: story slug a-z0-9 with hyphens`);
    if (seen.has(it.story)) fails.push(`${n}: story ${it.story} twice`); seen.add(it.story);
    if (!TOPICS.includes(it.topic)) fails.push(`${n}: topic must be one of ${TOPICS.join(', ')}`);
    if (!it.headline || it.headline.length > 90) fails.push(`${n}: headline 1–90 characters (${(it.headline || '').length})`);
    if (/\?$/.test(it.headline || '')) fails.push(`${n}: a headline says what happened; no question`);
    const ws = words(it.what), ss = sentences(it.what);
    if (!ws || ws > 60 || ss.length > 3) fails.push(`${n}: "what" is 1–3 sentences, at most 60 words (${ss.length}, ${ws})`);
    const wy = words(it.why);
    if (!wy || wy > 40 || sentences(it.why).length > 2) fails.push(`${n}: "why" is 1–2 sentences, at most 40 words (${wy})`);
    if (it.next && words(it.next) > 30) fails.push(`${n}: "next" at most 30 words`);
    [it.what, it.why, it.next].filter(Boolean).forEach(t => sentences(t).forEach(s => {
      if (words(s) > 30) fails.push(`${n}: a sentence over 30 words: "${s.slice(0, 50)}…"`);
    }));
    if (/cannot say why|can(?:no|')t tell us why|data (?:do|does) not (?:say|explain) why/i.test([it.what, it.why].join(' ')))
      fails.push(`${n}: find the explanation on the record or leave the item out`);
    const src = Array.isArray(it.sources) ? it.sources : [];
    if (src.length < 1 || src.length > 3) fails.push(`${n}: 1–3 sources`);
    src.forEach((s, k) => { if (!s || !s.name || !/^https:\/\/[^\s"<>]+$/.test(s.url || '')) fails.push(`${n}: source ${k + 1} needs a name and an https URL`); });
    if (it.deep && !fs.existsSync(path.join(REPO, it.deep))) fails.push(`${n}: deep piece ${it.deep} is not in the repo`);
    if (yesterday.has(it.story) && !(it.developing && words(it.developing) >= 4))
      fails.push(`${n}: ${it.story} was in the ${prev.date} briefing: add "developing" (what is new today) or leave it out`);
    // the same story as a deep piece in the last 3 days, without saying what's new, is a repeat
    const deep = all.filter(p => p.format !== 'briefing' && p.story === it.story && p.date < b.date && p.date >= addDays(b.date, -3));
    if (deep.length && !it.deep && !(it.developing && words(it.developing) >= 4))
      fails.push(`${n}: ${it.story} had a deep piece on ${deep[0].date}: link it with "deep" or add "developing"`);
  });
  if (new Set(items.map(i => i.topic)).size < Math.min(2, items.length)) warns.push('every item has the same topic');
  return { fails, warns };
}

function renderBriefing(b) {
  const tpl = fs.readFileSync(path.join(REPO, 'toolchain', 'digi-news-house-template-v3-3-3.html'), 'utf8');
  const css = (tpl.match(/^<style>[\s\S]*?^<\/style>/m) || [''])[0];   // the head's style block (a comment above also says <style>)
  const n = b.items.length, when = longDate(b.date);
  const readMin = Math.max(1, Math.round(b.items.reduce((t, i) => t + words(i.headline) + words(i.what) + words(i.why) + words(i.next) + words(i.developing), 0) / 200));
  const headline = 'The briefing: ' + when;
  const stand = b.items.map(i => i.headline).join(' · ');
  const short = stand.length > 280 ? stand.slice(0, 277).replace(/\s+\S*$/, '') + '…' : stand;
  const d = new Date(b.date + 'T12:00:00Z');
  const kick = (d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCFullYear()).toUpperCase();
  const item = (it, i) => `
  <section class="section bi" id="${esc(it.story)}" data-story="${esc(it.story)}">
    <div class="eyebrow">${i + 1} · ${esc(it.topic)}</div>
    <h2>${esc(it.headline)}</h2>
    ${it.developing ? `<p class="bnew"><b>New today:</b> ${esc(it.developing)}</p>\n    ` : ''}<p>${esc(it.what)}</p>
    <p><b>Why it matters:</b> ${esc(it.why)}</p>${it.next ? `
    <p><b>What next:</b> ${esc(it.next)}</p>` : ''}${it.deep ? `
    <p class="bdeep"><a href="../${esc(it.deep)}">Read our full piece →</a></p>` : ''}
    <p class="bsrc">Sources: ${it.sources.map(s => `<a href="${esc(s.url)}">${esc(s.name)}</a>`).join(' · ')}</p>
  </section>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- ==== DN FEED META (the site front page reads these) ==== -->
<meta name="dn:headline"   content="${esc(headline)}">
<meta name="dn:standfirst" content="${esc(short)}">
<meta name="dn:topic"      content="Briefing">
<meta name="dn:date"       content="${b.date}">
<meta name="dn:kind"       content="report">
<meta name="dn:format"     content="briefing">
<meta name="dn:read"       content="~${readMin} min">

<title>${esc(headline)} — Noodle News</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
${css}
<style>
  /* the briefing (toolchain/dn-briefing.js) */
  .bi{margin-top:30px;padding-top:22px;border-top:1px solid var(--hair)}
  .bi:first-of-type{border-top:0;padding-top:0}
  .bi h2{font-family:var(--display);font-weight:800;font-size:clamp(21px,4.6vw,25px);line-height:1.2;letter-spacing:-.01em;margin:6px 0 10px}
  .bi p{margin-top:10px}
  .bi .bnew{color:var(--accent)}
  .bi .bdeep a{font-weight:700;color:var(--accent);text-decoration:none}
  .bi .bsrc{font-size:13.5px;color:var(--muted)}
  .bi .bsrc a{color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">

  <header class="mast">
    <div class="mono">DN</div>
    <div class="word">Noodle<b>News</b></div>
    <div class="kick">BRIEFING<br>${kick}</div>
  </header>

  <div class="head">
    <div class="topic">Briefing &middot; ${n} stories</div>
    <h1>${esc(headline)}</h1>
    <p class="standfirst">${n === 3 ? 'Three' : n === 4 ? 'Four' : 'Five'} stories worth knowing today, in plain English: what happened, why it matters and what comes next.</p>
    <div class="dateline">Noodle News desk &middot; reading time ~${readMin} min</div>
  </div>
${b.items.map(item).join('\n')}

  <div class="foot">
    <div class="fm"><b>How this is made.</b> Each item is drawn from the sources linked under it, published on the record; nothing here is our own reporting. Our full pieces, where linked, carry the detail and the method.</div>
    <div class="fm">Researched, written and checked by an AI system working to the Noodle News standards; edited and published by the Noodle News editor.</div>
    <div class="fm"><b>Corrections.</b> None. Material corrections will be logged here with date.</div>
  </div>

</div>
</body>
</html>
`;
}

function build() {
  const file = args[1];
  if (!file) { console.error('usage: dn-briefing.js build BRIEFING.json [--out FILE]'); process.exit(2); }
  let b; try { b = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('BRIEFING: cannot read ' + file + ': ' + e.message); process.exit(2); }
  const { fails, warns } = checkBriefing(b);
  warns.forEach(w => console.log('WARN ' + w));
  fails.forEach(f => console.log('FAIL ' + f));
  if (fails.length) { console.log('BRIEFING: FAIL'); process.exit(1); }
  const out = opt('--out', path.join(REPORTS, b.date + '-briefing.html'));
  fs.writeFileSync(out, renderBriefing(b));
  console.log('BRIEFING: PASS → ' + path.relative(process.cwd(), out));
}

/* ---------- deep piece gate ---------- */
function checkDeep() {
  const file = args[1];
  if (!file || !fs.existsSync(file)) { console.error('usage: dn-briefing.js check-deep PIECE.html'); process.exit(2); }
  const html = fs.readFileSync(file, 'utf8'), base = 'reports/' + path.basename(file);
  const date = meta(html, 'dn:date'), story = meta(html, 'dn:story'), follow = meta(html, 'dn:followup'), head = meta(html, 'dn:headline');
  const fails = [], warns = [];
  if (meta(html, 'dn:format') === 'briefing') fails.push('this is a briefing: use build');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fails.push('dn:date missing');
  if (!/^[a-z0-9]+(-[a-z0-9]+){0,7}$/.test(story)) fails.push('dn:story missing: add <meta name="dn:story" content="a-running-story-slug"> (reuse the slug from `plan` for the same story)');
  const others = newsPieces().filter(p => p.file !== base && p.format !== 'briefing');
  const window = others.filter(p => p.date < date ? p.date >= addDays(date, -WINDOW) : p.date === date);
  const same = window.filter(p => p.story && p.story === story);
  if (same.length && !same.some(p => p.file === follow))
    fails.push(`repeat: ${same.map(p => p.date + ' ' + p.file).join(', ')} covered ${story}. Pick another story, or if a new event or decision makes this a follow-up, add <meta name="dn:followup" content="${same[0].file}"> and link back to it in the piece`);
  if (follow && !others.some(p => p.file === follow)) fails.push(`dn:followup names ${follow}, which is not a news piece in the repo`);
  window.filter(p => !same.includes(p) && overlap(head, p.headline) >= 0.5)
    .forEach(p => warns.push(`headline close to ${p.date} "${p.headline}" (no matching dn:story): is this the same story? If so, use its slug`));
  const wk = monday(date);
  const week = others.filter(p => p.date >= wk && p.date <= addDays(wk, 6));
  if (week.length >= CAP) fails.push(`weekly cap: ${week.length} deep pieces already in the week of ${wk} (${week.map(p => p.date).join(', ')}); publish the briefing only`);
  warns.forEach(w => console.log('WARN ' + w));
  fails.forEach(f => console.log('FAIL ' + f));
  console.log('DESK: ' + (fails.length ? 'FAIL' : 'PASS') + ` (${story || 'no story'}; week ${wk}: ${week.length + 1} of ${CAP} with this one)`);
  process.exit(fails.length ? 1 : 0);
}

if (require.main === module) {
  const cmd = args[0];
  if (cmd === 'plan') plan();
  else if (cmd === 'build') build();
  else if (cmd === 'check-deep') checkDeep();
  else { console.error('usage: dn-briefing.js plan | build BRIEFING.json | check-deep PIECE.html  [--repo DIR]'); process.exit(2); }
}
module.exports = { checkBriefing, renderBriefing, sentences, words, monday };
