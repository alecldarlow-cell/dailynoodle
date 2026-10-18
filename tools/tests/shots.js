/* ---------------------------------------------------------------------------
   Screenshots of every type at a phone size: start, finish (screen and full
   length) and reopened. For before/after reviews of player changes.

     DN_FONTS=/path/to/fonts node tools/tests/shots.js <outdir> [390|360] [light|dark] [types,...]
--------------------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const { launch, open, wait } = require('./harness');
const play = require('./play');
const [OUT = 'shots', Wa = '390', SCHEME = 'light', ONLY = ''] = process.argv.slice(2);
const W = +Wa, H = W === 360 ? 780 : 844;
const FILES = { mini: '2026-10-18-crossword-mini-0099.html', doku: '2026-10-18-logic-doku-0097.html', sweep: '2026-10-18-logic-sweep.html',
  path: '2026-10-18-logic-path-0092.html', link: '2026-10-18-word-link-0071.html', tangle: '2026-10-18-word-tangle-0012.html', borders: '2026-10-18-geo-borders-0014.html' };
const dir = `${OUT}/${W}-${SCHEME}`; fs.mkdirSync(dir, { recursive: true });

async function snap(p, name, full) {
  await p.waitForTimeout(150);
  if (!full) return p.screenshot({ path: `${dir}/${name}.png`, animations: 'disabled' });
  const h = await p.evaluate(() => Math.max(document.documentElement.scrollHeight,
    ...[...document.querySelectorAll('.screen, .modal, .modalcard, .fin-box')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.scrollHeight + Math.max(0, e.getBoundingClientRect().top))));
  await p.setViewportSize({ width: W, height: Math.min(Math.ceil(h), 6000) }); await p.waitForTimeout(250);
  await p.screenshot({ path: `${dir}/${name}.png`, animations: 'disabled' });
  await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(150);
}
(async () => {
  const b = await launch();
  for (const t of Object.keys(FILES)) {
    if (ONLY && !ONLY.split(',').includes(t)) continue;
    const { ctx, p } = await open(b, FILES[t], { scheme: SCHEME, width: W, height: H });
    await snap(p, `${t}-1-start`);
    await (t === 'mini' || t === 'doku' ? play.grid(p) : play[t](p));
    await snap(p, `${t}-2-finish`); await snap(p, `${t}-2-finish-full`, true);
    await p.reload(); await wait(p, 1500); await snap(p, `${t}-3-reopened`);
    console.log(t, p.errs.length ? 'page errors: ' + p.errs.join(' | ') : 'ok');
    await ctx.close();
  }
  await b.close();
})();
