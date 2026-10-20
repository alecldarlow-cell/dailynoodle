#!/usr/bin/env node
'use strict';
/* News render check (20 Oct 2026). Renders released news pieces (dn:kind report) with
   toolchain/dn-render.js: a real Chromium at 360px and 680px, light and dark, after the
   site's own additions (Share, back-to-News, dark mode). A piece fails on a chart label
   that lost words or is cut off, sideways scrolling, an exhibit that didn't draw, hero
   figures clipped, unreadable contrast or a script error. Facts are not checked here:
   that stays an editorial job.

     node tools/tests/news.js             # release gate: pieces dated in the last 7 London days
     node tools/tests/news.js --days 14   # a wider window
     node tools/tests/news.js --all       # every released piece (nightly)
     node tools/tests/news.js --jobs 3    # renders at once (default 3)

   Screenshots and each piece's report: test-results/news-render/<slug>/. Exit 1 if any
   piece fails or a render can't run, except old pieces listed with their exact sha256 in
   tools/tests/fixtures/news-render-known.json (found failing on 20 Oct 2026, awaiting a
   fix). A listed piece that changes must pass; one that now passes must come off the list. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), REPORTS = path.join(ROOT, 'reports');
const args = process.argv.slice(2), val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ALL = args.includes('--all'), DAYS = Number(val('--days', 7)), JOBS = Math.max(1, Number(val('--jobs', 3)));
const OUT = path.join(ROOT, 'test-results', process.env.DN_TEST_GROUP || '', 'news-render');
const london = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
const KNOWN = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/news-render-known.json'), 'utf8')).map(k => [k.file, k]));
const sha = f => require('crypto').createHash('sha256').update(fs.readFileSync(path.join(REPORTS, f))).digest('hex');
const today = london(new Date()), from = london(new Date(Date.now() - (DAYS - 1) * 864e5));

const pieces = fs.readdirSync(REPORTS).filter(f => /^\d{4}-\d{2}-\d{2}-.*\.html$/.test(f)).filter(f => {
  const d = f.slice(0, 10); if (d > today || (!ALL && d < from)) return false;
  const head = fs.readFileSync(path.join(REPORTS, f), 'utf8').slice(0, 6000);
  return /name="dn:kind"\s+content="report"/.test(head);
}).sort();

function render(f) {
  let retried = false;
  return new Promise(res => {
    const go = () => { const c = spawn(process.execPath, [path.join(ROOT, 'toolchain/dn-render.js'), path.join(REPORTS, f), '--repo', ROOT, '--out', OUT], { cwd: ROOT });
    let out = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d);
    c.on('close', code => {
      try { fs.mkdirSync(path.join(OUT, f.slice(0, -5)), { recursive: true }); fs.writeFileSync(path.join(OUT, f.slice(0, -5), 'render.txt'), out); } catch (e) {}
      const verdict = (out.match(/RENDER: [A-Z ]+/) || ['RENDER: could not run'])[0];
      if (code === 2 && !retried) { retried = true; return go(); }   // the browser itself failed (e.g. a screenshot under load): one retry, never for a verdict
      res({ f, code, verdict, fails: out.split('\n').filter(l => /\bFAIL\b/.test(l) && !/^RENDER/.test(l)).slice(0, 6) });
    }); };
    go();
  });
}

(async () => {
  console.log(`news render: ${pieces.length} piece(s) ${ALL ? '(all released)' : `dated ${from} to ${today}`}, ${JOBS} at a time`);
  const results = [], queue = pieces.slice(), t0 = Date.now();
  await Promise.all(Array.from({ length: JOBS }, async () => { while (queue.length) { const r = await render(queue.shift()); results.push(r); console.log(`  ${r.code === 0 ? 'ok  ' : 'FAIL'} ${r.f}  ${r.verdict}`); if (r.code) r.fails.forEach(l => console.log('       ' + l.trim())); } }));
  const known = r => KNOWN.has(r.f) && KNOWN.get(r.f).sha256 === sha(r.f);
  const bad = results.filter(r => r.code !== 0 && !known(r)), listed = results.filter(r => r.code !== 0 && known(r));
  const fixed = results.filter(r => r.code === 0 && KNOWN.has(r.f));
  listed.forEach(r => console.log(`  known (listed in news-render-known.json): ${r.f}`));
  fixed.forEach(r => { console.log(`  FAIL ${r.f} now passes: take it off tools/tests/fixtures/news-render-known.json`); bad.push(r); });
  console.log(`\n${results.length - bad.length - listed.length} passed, ${listed.length} known, ${bad.length} failed (${Math.round((Date.now() - t0) / 1000)}s). Sheets: ${path.relative(ROOT, OUT)}/`);
  process.exit(bad.length ? 1 : 0);
})();
