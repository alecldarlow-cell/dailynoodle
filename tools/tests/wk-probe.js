'use strict';
// TEMPORARY diagnostic (removed before merge): what WebKit reports around a viewport resize.
const H = require('./harness');
(async () => {
  const b = await H.launch();
  for (const [type, file, board] of [['link', '2026-10-19-word-link-0072.html', '#board'], ['doku', '2026-10-19-logic-doku-0098.html', '#grid']]) for (let rep = 0; rep < 3; rep++) {
    const ctx = await H.newPhone(b, { width: 320, height: 568 }); const p = await ctx.newPage();
    await p.clock.install({ time: new Date('2026-10-19T12:00:00+01:00') });
    await p.goto('https://dailynoodle.co.uk/reports/' + file); await H.wait(p, 1500);
    await p.locator('#dnPlay').click(); await H.wait(p, 500);
    await p.evaluate(board => {
      const pr = document.createElement('div'); pr.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100svh;visibility:hidden'; document.body.appendChild(pr);
      const pd = document.createElement('div'); pd.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100dvh;visibility:hidden'; document.body.appendChild(pd);
      window.__log = []; const snap = tag => { const bd = document.querySelector(board), t = bd.querySelector('.tile,.cell'), app = document.querySelector('.app');
        window.__log.push(tag + ' iw' + innerWidth + ' ih' + innerHeight + ' vv' + (visualViewport ? Math.round(visualViewport.height) : '-') + ' svh' + pr.offsetHeight + ' dvh' + pd.offsetHeight + ' app' + (app && app.clientHeight) + ' board' + bd.clientHeight + ' tileH' + (t && Math.round(t.getBoundingClientRect().height)) + ' bottom' + Math.round(Math.max(...[...bd.querySelectorAll('.tile,.cell,#bank .tile,.key')].map(e => e.getBoundingClientRect().bottom)))); };
      window.__snap = snap; addEventListener('resize', () => snap('resize-event'));
      if (window.visualViewport) visualViewport.addEventListener('resize', () => snap('vv-event'));
    }, board);
    for (const [w, h] of [[780, 360], [568, 320], [320, 568]]) {
      await p.setViewportSize({ width: w, height: h });
      await p.evaluate(t => window.__snap('after-set ' + t), w + 'x' + h);
      await H.wait(p, 400); await p.evaluate(t => window.__snap('after-400 ' + t), w + 'x' + h);
    }
    const log = await p.evaluate(() => window.__log);
    console.log(`::notice title=probe ${type} ${rep}::` + log.join('%0A'));
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.log('::error title=probe::' + e.message.split('\n')[0]); });
