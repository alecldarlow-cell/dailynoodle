'use strict';
/* Turn test failures into GitHub annotations, so a failed nightly run shows what
   failed on its summary page (and through the checks API) without opening logs.
     node tools/tests/ci-annotate.js <title> <puzzle-log | playwright.json>...
   Puzzle logs: FAIL, KNOWN and skip lines from tools/tests/run.js. Playwright
   JSON: each failed test with the first line of its error. Never fails itself. */
const fs = require('node:fs');
const [title, ...files] = process.argv.slice(2);
const lines = [];
for (const f of files) {
  let src; try { src = fs.readFileSync(f, 'utf8'); } catch (e) { lines.push(`(no ${f})`); continue; }
  if (f.endsWith('.json')) {
    let r; try { r = JSON.parse(src); } catch (e) { lines.push(`(unreadable ${f})`); continue; }
    const walk = s => { for (const spec of s.specs || []) for (const t of spec.tests || []) for (const res of t.results || [])
      if (res.status !== 'passed' && res.status !== 'skipped' && res.retry === (t.results.length - 1)) {
        const err = ((res.error && res.error.message) || res.status).replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').replace(/ ?\+ ?/g, '+').replace(/Object \{/g, '{').replace(/Array \[/g, '[');
        lines.push(`FAIL ${spec.file}: ${spec.title} — ${err.slice(0, 3600)}`);
      }
      for (const c of s.suites || []) walk(c); };
    for (const s of r.suites || []) walk(s);
    if (r.stats) lines.push(`playwright: ${r.stats.expected} passed, ${r.stats.unexpected} failed, ${r.stats.flaky} flaky, ${r.stats.skipped} skipped`);
  } else {
    let cur = '';
    for (const l of src.split('\n')) {
      if (/^[a-z]+:[\w-]+$/.test(l.trim())) cur = l.trim();
      else if (/^\s+(FAIL|KNOWN|skip)\b/.test(l)) lines.push(`${cur} ${l.trim()}`.slice(0, 400));
      else if (/ passed, \d+ failed/.test(l)) lines.push(l.trim());
      // other groups' logs (node --test, Playwright's list output, scripts): their failure lines
      else if (/^\s*(not ok \d|✘|Error:|AssertionError|■ .*: FAIL)/.test(l)) lines.push(`${f.replace(/^.*\//, '')}: ${l.trim()}`.slice(0, 400));
    }
  }
}
const esc = s => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
// GitHub keeps at most 10 annotations of a level per step and ~4 KB each: each
// Playwright failure gets its own; the short puzzle-log lines are packed together.
const groups = []; let cur = [];
for (const l of lines) { if (l.length > 400) { groups.push([l]); continue; } if (cur.join('\n').length + l.length > 3800) { groups.push(cur); cur = []; } cur.push(l); }
if (cur.length) groups.push(cur);
groups.slice(0, 18).forEach((g, n) =>
  console.log(`::${g.some(l => l.startsWith('FAIL') || / FAIL /.test(l)) ? 'error' : 'notice'} title=${title} (${n + 1})::${esc(g.join('\n'))}`));
if (!lines.length) console.log(`::notice title=${title}::nothing to report`);
