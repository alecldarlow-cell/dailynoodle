#!/usr/bin/env node
/* tools/tests/link-smoke.js — play every Link in a serial range through in headless Chromium
   (added 19 Oct 2026). Each page must pass its own gate, show 16 tiles, be solvable with no
   mistakes by the harness player, and log no page errors.
   Usage (after `npm ci --ignore-scripts`, which supplies Playwright and the pinned Chromium):
   node tools/tests/link-smoke.js 135 174 */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./harness.js'), play = require('./play.js');
const [lo, hi] = process.argv.slice(2).map(Number);
if (!lo || !hi) { console.error('usage: link-smoke.js FROM TO'); process.exit(2); }
const files = fs.readdirSync(path.join(__dirname, '..', '..', 'reports'))
  .filter(f => /^\d{4}-\d{2}-\d{2}-word-link-\d{4}\.html$/.test(f))
  .filter(f => { const s = parseInt(f.slice(-9, -5), 10); return s >= lo && s <= hi; }).sort();
(async () => {
  const b = await H.launch(); let bad = 0;
  for (const f of files) {
    const { ctx, p } = await H.open(b, f, { time: f.slice(0, 10) + 'T09:00:00+01:00' });
    const r = await p.evaluate(() => ({ fail: !!document.querySelector('.gate-fail'), tiles: document.querySelectorAll('#board .tile').length }));
    await play.link(p, { wrong: 0 });
    const won = await play.boxOn(p);
    if (r.fail || r.tiles !== 16 || !won || p.errs.length) { bad++; console.log('BAD', f, JSON.stringify(r), won, p.errs.join('|')); }
    await ctx.close();
  }
  console.log('played', files.length, 'bad', bad);
  await b.close(); process.exit(bad || !files.length ? 1 : 0);
})();
