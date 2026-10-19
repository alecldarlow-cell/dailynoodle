/* ---------------------------------------------------------------------------
   Browser tests for the puzzle players. Plays real puzzles through their real
   controls with jittered taps, then checks what players and the tracker see.

     node tools/tests/run.js                 # everything
     node tools/tests/run.js finish:tangle   # tests whose name contains the text

   Fixtures are the 18-19 Oct 2026 puzzles, played on a fake clock set to
   those days, so the tests mean the same thing whenever they run.
--------------------------------------------------------------------------- */
'use strict';
const { launch, newPhone, open, tap, wait } = require('./harness');
const play = require('./play');
const F = {
  mini: '2026-10-18-crossword-mini-0099.html', mini2: '2026-10-19-crossword-mini-0100.html', doku: '2026-10-18-logic-doku-0097.html',
  sweep: '2026-10-18-logic-sweep.html', path: '2026-10-18-logic-path-0092.html', path2: '2026-10-19-logic-path-0093.html',
  link: '2026-10-18-word-link-0071.html', tangle: '2026-10-18-word-tangle-0012.html', borders: '2026-10-18-geo-borders-0014.html',
};
const ONLY = process.argv[2] || '';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const text = (p, sel) => p.locator(sel).first().textContent().then(t => (t || '').trim()).catch(() => '');
const ends = ev => ev.filter(e => e.ev === 'puzzle_end');
const ls = (p, k) => p.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, k);

/* ---- what every finish sheet must do, whatever the type ---- */
async function sheetChecks(p, ev, { type, boxId = 'winModal', ids, shareRe, endCheck }) {
  const s = await p.evaluate(({ boxId, ids }) => {
    const box = document.getElementById(boxId), fin = document.getElementById('dnFin');
    const legacyShown = box ? [...box.children].filter(c => c !== fin && getComputedStyle(c).display !== 'none').length : -1;
    return {
      open: !!box && box.classList.contains('fin-open'), on: !!box && box.classList.contains('on'),
      inBox: !!fin && box.contains(fin), legacyShown,
      ids: ids.map(id => [id, document.querySelectorAll('#' + id).length, box && box.contains(document.getElementById(id))]),
      share: (document.querySelector('.fin-share-text') || {}).textContent || '',
      next: (document.querySelector('.fin-next-main') || {}).textContent || '', nextSub: (document.querySelector('.fin-next-sub') || {}).textContent || '',
      nextHref: (document.querySelector('.fin-next') || {}).getAttribute && document.querySelector('.fin-next').getAttribute('href'),
      clock: (document.querySelector('.fin-clock') || {}).textContent || '',
      board: !!document.querySelector('.fin-board-slot .nn-board-link'),
      scrollW: document.documentElement.scrollWidth, vw: innerWidth,
    };
  }, { boxId, ids });
  ok(s.open && s.inBox, `${type}: finish sheet is open inside the tracker's box`);
  ok(s.legacyShown === 0, `${type}: the old result layout is hidden (${s.legacyShown} visible)`);
  for (const [id, n, inBox] of s.ids) ok(n === 1 && inBox, `${type}: #${id} exists once, inside the box`);
  ok(shareRe.test(s.share), `${type}: share line "${s.share}"`);
  // The harness serves the list for the page's fake London date, just as a
  // successful daily build would. Yesterday's real file is not today's list.
  const day = await p.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  ok(/^Next: \w+ \d+$/.test(s.next) && /^\d of 7 played today$/.test(s.nextSub) && (s.nextHref || '').startsWith('../reports/' + day + '-'), `${type}: next row "${s.next}" (${s.nextSub}) → ${s.nextHref}`);
  ok(/^A new \w+ in (\d+h )?\d+m\./.test(s.clock), `${type}: countdown "${s.clock}"`);
  ok(s.board, `${type}: "See today's board" sits in the sheet`);
  ok(s.scrollW <= s.vw, `${type}: no sideways scroll (${s.scrollW} > ${s.vw})`);
  ok(ends(ev).length === 1, `${type}: tracker logged exactly one puzzle_end`);
  if (endCheck) endCheck(ends(ev)[0] && ends(ev)[0].x, s);
  return s;
}
async function shareClipboard(p, ctx, type) {
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://dailynoodle.co.uk' });
  const want = await text(p, '.fin-share-text');
  await tap(p, p.locator('.fin-share-btn')); await p.waitForTimeout(200);
  const got = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(got === want, `${type}: Share copies the line when there is no share sheet`);
  ok(await text(p, '.fin-share-label') === 'Copied' && await text(p, '.fin-live') === 'Copied', `${type}: button says Copied, and so does the screen-reader line`);
  await wait(p, 2500);
  ok(await text(p, '.fin-share-label') === 'Share', `${type}: button goes back to Share`);
}
async function shareNative(browser, file, driver, type) {
  const ctx = await newPhone(browser);
  await ctx.addInitScript(() => { window.__shared = []; navigator.share = d => { window.__shared.push(d.text); return Promise.resolve(); }; });
  const { p } = await open(browser, file, { ctx });
  await driver(p);
  const want = await text(p, '.fin-share-text');
  await tap(p, p.locator('.fin-share-btn')); await p.waitForTimeout(200);
  const got = await p.evaluate(() => window.__shared);
  ok(got.length === 1 && got[0] === want, `${type}: on a phone, Share opens the share sheet with the line`);
  await ctx.close();
}
async function reopen(p, ev, type, boxId = 'winModal') {
  await p.reload(); await wait(p, 1500);
  const s = await p.evaluate(boxId => { const b = document.getElementById(boxId); return { open: b.classList.contains('fin-open'), on: b.classList.contains('on') }; }, boxId);
  ok(s.open && !s.on, `${type}: reopening shows the sheet without the tracker's "on"`);
  ok(ends(ev).length === 1, `${type}: reopening logs no second puzzle_end`);
  ok(!!(await p.locator('.fin-board-slot .nn-board-link').count()), `${type}: board link on reopen too`);
}

/* ---- the house chrome: slim bar, start card, dark mode (Mini, Doku, Sweep, Path, Link) ---- */
async function houseChecks(b, type, file, firstTap, driver) {
  const ev = []; const { ctx, p } = await open(b, file, { events: ev });
  const s = await p.evaluate(() => {
    const bar = document.querySelector('.dn-bar'), card = document.querySelector('.dn-start'), hdr = document.querySelector('.app>header');
    return { bar: !!bar, timer: !!bar && bar.contains(document.getElementById('timer')), pid: !!bar && bar.contains(document.getElementById('pid')),
      hdrHidden: !hdr || getComputedStyle(hdr).display === 'none', card: !!card && !card.hidden && getComputedStyle(card).display !== 'none',
      title: (document.querySelector('.dn-start-title') || {}).textContent, date: (document.querySelector('.dn-start-date') || {}).textContent,
      font: getComputedStyle(document.body).fontFamily, scrollW: document.documentElement.scrollWidth, vw: innerWidth,
      flame: getComputedStyle(document.querySelector('.dn-streak')).display };
  });
  ok(s.bar && s.timer && s.pid && s.hdrHidden, `${type}: slim bar holds the number and the clock; old masthead hidden`);
  ok(s.card && /^No\. \d+, Sunday 18 October$/.test(s.date || ''), `${type}: start card up before play ("${s.title}", "${s.date}")`);
  ok(/^Archivo/.test(s.font), `${type}: Archivo for the interface`);
  ok(s.flame === 'none', `${type}: no flame while the streak is 0`);
  ok(s.scrollW <= s.vw, `${type}: no sideways scroll on the start card`);
  await tap(p, p.locator('#dnPlay')); await wait(p, 600);
  const starts = () => ev.filter(e => e.ev === 'puzzle_start').length;
  const flush = async () => { await p.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); }); await wait(p, 600); };
  ok(!(await p.locator('.dn-start').isVisible()), `${type}: Play takes you to the board`);
  const small = await p.evaluate(() => [...document.querySelectorAll('.app button')].filter(e => { if (e.closest('.fin-box') || e.matches('.cell,.key')) return false;
    const r = e.getBoundingClientRect(); return r.width && r.height && getComputedStyle(e).visibility !== 'hidden' && r.height < 44; }).map(e => (e.id || e.className) + ' ' + Math.round(e.getBoundingClientRect().height)));
  ok(!small.length, `${type}: every control on the board is at least 44px tall ${small.join(', ')}`);
  await flush(); const afterPlay = starts();
  await firstTap(p); await wait(p, 600); await flush();
  ok(afterPlay === 0 && starts() === 1, `${type}: the first tap on the board starts the puzzle, Play does not (${afterPlay}, then ${starts()})`);
  await driver(p);
  await p.reload(); await wait(p, 1500);
  ok(!(await p.locator('.dn-start').count()), `${type}: no start card once finished`);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.dn-streak')).display) !== 'none', `${type}: flame shows once there is a streak`);
  ok(!p.errs.length, `${type}: no page errors ` + p.errs.join(' | '));
  await ctx.close();
  /* dark */
  const d = await open(b, file, { scheme: 'dark' });
  const k = await d.p.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector('.dn-start')).backgroundColor }));
  ok(k.bg === 'rgb(17, 19, 26)' && k.card === 'rgb(17, 19, 26)', `${type}: dark mode follows the phone (${k.bg})`);
  await d.ctx.close();
}

const TESTS = {
  /* ---------- house chrome, per type ---------- */
  async 'house:link'(b) { await houseChecks(b, 'link', F.link, p => tap(p, p.locator('#board .tile').first()), play.link); },
  async 'house:mini'(b) { await houseChecks(b, 'mini', F.mini, p => tap(p, p.locator('#grid .cell:not(.block)').first()), play.grid); },
  async 'house:doku'(b) { await houseChecks(b, 'doku', F.doku, p => tap(p, p.locator('#grid .cell:not(.block):not(.locked)').first()), play.grid); },
  async 'house:sweep'(b) { await houseChecks(b, 'sweep', F.sweep, async p => { const P = await play.puzzle(p); await tap(p, p.locator('#grid .cell').nth((P.start[0] - 1) * 6 + P.start[1] - 1)); }, play.sweep); },
  async 'house:path'(b) { await houseChecks(b, 'path', F.path, async p => { const P = await play.puzzle(p); const i = P.solution.flat().indexOf(1); await tap(p, p.locator('#grid .cell').nth(i)); }, play.path); },

  async 'house:tangle-borders-home'(b) {
    for (const [type, file, bg] of [['tangle', F.tangle, 'rgb(17, 19, 26)'], ['borders', F.borders, 'rgb(15, 24, 29)']]) {
      const { ctx, p } = await open(b, file);
      const s = await p.evaluate(() => ({ date: document.getElementById('dateLine').textContent, back: document.querySelector('#home a.back').textContent,
        stats: document.querySelectorAll('#home .stats div, #home .hstats div').length, how: !!document.querySelector('#home details.how'),
        sw: document.documentElement.scrollWidth, vw: innerWidth }));
      ok(/^No\. \d+, Sunday 18 October$/.test(s.date) && s.back === '← Puzzles', `${type}: home date line "${s.date}", back "${s.back}"`);
      ok(s.stats === 3 && s.how && s.sw <= s.vw, `${type}: three stats, How to play, no sideways scroll`);
      ok(!p.errs.length, `${type}: no page errors ` + p.errs.join(' | '));
      await ctx.close();
      const d = await open(b, file, { scheme: 'dark' });
      const k = await d.p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      ok(k === bg, `${type}: dark mode follows the phone (${k})`);
      await d.ctx.close();
    }
  },

  async 'front:dark'(b) {
    for (const pg of ['index', 'puzzles', 'games', 'lab', 'board', 'privacy']) for (const sc of ['light', 'dark']) {
      const { ctx, p } = await open(b, `../${pg}.html`, { scheme: sc }); await wait(p, 1200);
      const k = await p.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, sw: document.documentElement.scrollWidth, vw: innerWidth,
        tc: [...document.querySelectorAll('meta[name="theme-color"]')].filter(m => matchMedia(m.media || 'all').matches).map(m => m.content)[0] }));
      const want = sc === 'dark' ? ['rgb(17, 19, 26)', '#11131A'] : ['rgb(252, 252, 251)', '#FCFCFB'];
      ok(k.bg === want[0] && k.tc === want[1] && k.sw <= k.vw && !p.errs.length, `${pg} ${sc}: canvas ${k.bg}, bar ${k.tc}` + (p.errs.length ? ' ' + p.errs.join(' | ') : ''));
      await ctx.close();
    }
  },

  async 'news:dark'(b) {
    for (const f of ['2026-10-18-student-visa-grants-peak-fall.html', '2026-07-28-uk-two-party-vote-share.html']) for (const sc of ['light', 'dark']) {
      const { ctx, p } = await open(b, f, { scheme: sc }); await wait(p, 2500);
      const k = await p.evaluate(() => { const fills = [...document.querySelectorAll('.dn-fig svg [fill],.dn-fig svg [stroke]')].map(e => (e.getAttribute('fill') || '') + ' ' + (e.getAttribute('stroke') || '')).join(' ').toUpperCase();
        return { bg: getComputedStyle(document.body).backgroundColor, subj: DN.colors.subject, figs: document.querySelectorAll('.dn-fig svg').length,
          oldBlue: fills.includes('#1C46C2'), newBlue: fills.includes('#9DB2FF'), sw: document.documentElement.scrollWidth, vw: innerWidth }; });
      const dark = sc === 'dark';
      ok(k.bg === (dark ? 'rgb(17, 19, 26)' : 'rgb(252, 252, 251)') && k.subj === (dark ? '#9DB2FF' : '#1C46C2') && k.figs > 0 && k.sw <= k.vw && !p.errs.length,
        `${f.slice(11, 40)} ${sc}: canvas ${k.bg}, chart subject ${k.subj}, ${k.figs} charts` + (p.errs.length ? ' ' + p.errs.join(' | ') : ''));
      ok(dark ? (!k.oldBlue && k.newBlue) : !k.newBlue, `${f.slice(11, 40)} ${sc}: chart colours ${dark ? 'swapped for dark' : 'untouched'}`);
      await ctx.close();
    }
  },

  /* every painted frame while opening puzzles in dark mode: none light, none showing the old result layout */
  async 'flash:dark'(b) {
    const ctx = await newPhone(b, { scheme: 'dark' });
    const { p } = await open(b, F.path, { ctx }); await play.path(p);
    await p.goto('https://dailynoodle.co.uk/reports/' + F.tangle); await wait(p, 1200); await play.tangle(p, { n: 2 });
    await p.goto('https://dailynoodle.co.uk/puzzles.html'); await wait(p, 1500);
    const cdp = await ctx.newCDPSession(p), frames = [];
    cdp.on('Page.screencastFrame', async f => { frames.push(f.data); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {} });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 40, everyNthFrame: 1, maxWidth: 195, maxHeight: 422 });
    for (const f of ['reports/' + F.path, 'puzzles.html', 'reports/' + F.tangle, 'reports/' + F.mini]) {
      await p.goto('https://dailynoodle.co.uk/' + f, { waitUntil: 'commit' });
      for (let i = 0; i < 25; i++) { await p.clock.runFor(50); await p.waitForTimeout(40); }
    }
    await cdp.send('Page.stopScreencast');
    // mean brightness of each frame, measured in the page itself
    const lum = await p.evaluate(async fs => { const out = []; for (const d of fs) { const im = new Image(); im.src = 'data:image/jpeg;base64,' + d; await im.decode();
      const c = document.createElement('canvas'); c.width = 20; c.height = 40; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 20, 40);
      const px = x.getImageData(0, 0, 20, 40).data; let t = 0; for (let i = 0; i < px.length; i += 4) t += (px[i] + px[i + 1] + px[i + 2]) / 3; out.push(Math.round(t / 800)); } return out; }, frames);
    ok(frames.length > 5 && Math.max(...lum) < 90, `opening Path, Tangle and Mini in dark: ${frames.length} frames, brightest ${Math.max(...lum)} of 255 (a light frame is 200+)`);
    await ctx.close();
  },

  /* a reopened finish sheet on a slow connection: shown once, already in its own fonts, nothing re-flowing after */
  async 'flash:fonts'(b) {
    for (const [type, file, drive] of [['path', F.path, p => play.path(p)], ['tangle', F.tangle, p => play.tangle(p, { n: 2 })]]) {
      const c1 = await newPhone(b, { scheme: 'dark' }); const { p } = await open(b, file, { ctx: c1 }); await drive(p);
      const ls = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage))); await c1.close();
      const c2 = await newPhone(b, { scheme: 'dark' });
      await c2.addInitScript(ls => { if (!localStorage.length) { const o = JSON.parse(ls); for (const k in o) localStorage.setItem(k, o[k]); } }, ls);
      await c2.route(/__fonts\//, async r => { await new Promise(z => setTimeout(z, 700)); await r.fallback(); });   // font files 700 ms late
      await c2.addInitScript(() => { window.__seen = []; const t0 = performance.now(); (function tick() {
        const el = document.querySelector('.fin-title'), n = document.querySelector('.fin-next');
        if (el && getComputedStyle(document.body).visibility !== 'hidden' && getComputedStyle(el).visibility !== 'hidden') {
          const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect();
          const k = Math.round(r.width) + ',' + Math.round(r.height) + ',' + (n ? Math.round(n.getBoundingClientRect().top) : -1);
          if (window.__seen[window.__seen.length - 1] !== k) window.__seen.push(k); }
        if (performance.now() - t0 < 2500) requestAnimationFrame(tick); })(); });
      const p2 = await c2.newPage(); await p2.goto('https://dailynoodle.co.uk/reports/' + file); await p2.waitForTimeout(2600);
      const seen = await p2.evaluate(() => window.__seen);
      ok(seen.length === 1, `${type}: reopened with slow fonts, the sheet appears once and doesn't move (${seen.join(' -> ')})`);
      await c2.close();
    }
  },

  /* full-screen app: Android brings its bars back for a moment on each page load; the page must not move */
  async 'flash:flick'(b) {
    for (const [name, file, sel] of [['puzzles page', '../puzzles.html', '.mast'], ['mini start', F.mini, '.dn-start-title'], ['link board', F.link, '#board']]) {
      const ctx = await newPhone(b, { scheme: 'dark' }); await ctx.addInitScript(() => { window.__dnPinTest = 1; });   // as display-mode: fullscreen
      const p = await ctx.newPage(); const c = await ctx.newCDPSession(p);
      await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 28, bottom: 16 } });
      await p.goto('https://dailynoodle.co.uk/reports/' + file); await p.waitForTimeout(1200);
      if (sel === '#board') { await tap(p, p.locator('#dnPlay')); await p.waitForTimeout(800); }
      await p.evaluate(sel => { window.__pos = []; const go = () => { const e = document.querySelector(sel); if (e) { const r = e.getBoundingClientRect(); const k = Math.round(r.top) + ',' + Math.round(r.height);
        if (window.__pos[window.__pos.length - 1] !== k) window.__pos.push(k); } if (!window.__stop) requestAnimationFrame(go); }; go(); }, sel);
      await p.setViewportSize({ width: 390, height: 800 }); await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 44, bottom: 0 } });
      await p.waitForTimeout(220);
      await p.setViewportSize({ width: 390, height: 844 }); await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 28, bottom: 16 } });
      await p.waitForTimeout(1500);
      const flick = await p.evaluate(() => window.__pos.slice());
      await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 48, bottom: 16 } }); await p.waitForTimeout(2600);
      const all = await p.evaluate(() => { window.__stop = 1; return window.__pos; });
      ok(flick.length === 1, `${name}: a 0.2 s flick of the system bars moves nothing (${flick.join(' -> ')})`);
      ok(all.length === 2, `${name}: a lasting inset change is taken up once (${all.join(' -> ')})`);
      await ctx.close();
    }
  },

  /* ---------- finish sheet, per type ---------- */
  async 'finish:tangle'(b) {
    const ev = []; const { ctx, p } = await open(b, F.tangle, { events: ev });
    const words = await play.tangle(p);
    const score = words.reduce((n, w) => n + w.length - 2, 0);
    await sheetChecks(p, ev, { type: 'tangle', ids: ['winTitle', 'winTime', 'rBig', 'rWords'],
      shareRe: new RegExp(`^🧶 Tangle #12 — ${score} points, ${words.length} words$`),
      endCheck: x => ok(x && x.outcome === 'scored' && x.score === score && x.words === words.length, `tangle: tracker read score ${x && x.score}, words ${x && x.words}`) });
    ok(await text(p, '#winTitle') === 'Time’s up', 'tangle: title Time’s up');
    const bank = await p.evaluate(() => ({ got: document.querySelectorAll('.fin-w.got').length, miss: document.querySelectorAll('.fin-w.miss').length,
      over: [...document.querySelectorAll('.fin-w.over')].filter(e => getComputedStyle(e).display !== 'none').length, more: document.querySelectorAll('.fin-more').length }));
    ok(bank.got === words.length && bank.over === 0 && bank.more >= 1, `tangle: word bank shows ${bank.got} found, ${bank.miss} missed, long groups collapsed`);
    await tap(p, p.locator('.fin-more').first()); await wait(p, 200);
    ok(await p.locator('.fin-wl.open').count() === 1, 'tangle: Show more opens its group');
    await shareClipboard(p, ctx, 'tangle');
    await reopen(p, ev, 'tangle');
    ok(await text(p, '#winTitle') === 'Your score', 'tangle: reopened later, the title says Your score, not Time’s up');
    ok(!p.errs.length, 'tangle: no page errors ' + p.errs.join(' | '));
    await ctx.close();
    await shareNative(b, F.tangle, p2 => play.tangle(p2, { n: 3 }), 'tangle');
  },

  async 'finish:link'(b) {
    const ev = []; const { ctx, p } = await open(b, F.link, { events: ev });
    await play.link(p, { wrong: 1 });
    await sheetChecks(p, ev, { type: 'link', ids: ['winTitle', 'winTime', 'winStreak', 'winBest'],
      shareRe: /^🔗 Link #71 — 🟩❌🟦🟨⬛ · \d:\d\d$/,
      endCheck: x => ok(x && x.outcome === 'solved' && x.mistakes === 1, `link: tracker read solved, ${x && x.mistakes} mistake`) });
    ok(await text(p, '#winTitle') === 'Linked', 'link: title Linked');
    ok(await p.locator('.fin-guess i').count() === 5 && await p.locator('.fin-guess .fin-gx').count() === 1, 'link: five guess squares, one miss');
    ok(/one mistake\. Hedgerow fruit caught you out\./.test(await text(p, '.fin-note')), 'link: note names the group that caught you out');
    ok(await p.locator('.fin-band').count() === 4, 'link: four groups in the recap');
    await shareClipboard(p, ctx, 'link');
    await reopen(p, ev, 'link');
    ok(/^🔗 Link #71 — 🟩❌🟦🟨⬛ · \d:\d\d$/.test(await text(p, '.fin-share-text')), 'link: reopened sheet shares the same line');
    ok(!p.errs.length, 'link: no page errors ' + p.errs.join(' | '));
    await ctx.close();
    await shareNative(b, F.link, p2 => play.link(p2, { wrong: 0 }), 'link');
  },
  async 'finish:link-loss'(b) {
    const ev = []; const { ctx, p } = await open(b, F.link, { events: ev });
    await play.link(p, { wrong: 4 });
    ok(await text(p, '#winTitle') === 'So close.' && ends(ev)[0] && ends(ev)[0].x.outcome === 'failed', 'link: loss keeps the exact title and logs failed');
    ok(/^You found one group of four\./.test(await text(p, '.fin-note')), `link: loss note "${await text(p, '.fin-note')}"`);
    await tap(p, p.locator('.fin-recap ~ .fin-link, .fin > .fin-link').first()); await wait(p, 800);
    ok(!(await p.evaluate(() => document.getElementById('winModal').classList.contains('fin-open'))) && await text(p, '#rank') === '· replay', 'link: Play again closes the sheet and marks the replay');
    await ctx.close();
  },
  async 'finish:borders'(b) {
    const ev = []; const { ctx, p } = await open(b, F.borders, { events: ev });
    await play.borders(p);
    await sheetChecks(p, ev, { type: 'borders', ids: ['winTitle', 'winTime', 'rBig', 'rPts', 'rStreak'],
      shareRe: /^🌍 Borders #14 — 7\/10 · \d+ pts$/,
      endCheck: x => ok(x && x.outcome === 'scored' && x.got === 7 && x.of === 10 && x.score > 0, `borders: tracker read ${x && x.got} of ${x && x.of}, ${x && x.score} pts`) });
    ok(await text(p, '#winTitle') === 'Spotted' && await text(p, '#rBig') === '7 of 10', 'borders: Spotted, 7 of 10');
    ok(/^You missed \w[\w ]*, [\w ]+ and [\w ]+\./.test(await text(p, '.fin-note')), `borders: note "${await text(p, '.fin-note')}"`);
    ok(await p.locator('.fin-outl figure').count() === 10 && await p.locator('.fin-outl figure.x').count() === 3, 'borders: ten outlines, three missed');
    ok(await p.locator('.fin a.fin-link[href*="borderline"]').count() === 1, 'borders: Borderline link in the recap');
    await shareClipboard(p, ctx, 'borders');
    await reopen(p, ev, 'borders');
    ok(!p.errs.length, 'borders: no page errors ' + p.errs.join(' | '));
    await ctx.close();
    await shareNative(b, F.borders, p2 => play.borders(p2), 'borders');
  },
  async 'finish:mini'(b) {
    const ev = []; const { ctx, p } = await open(b, F.mini, { events: ev });
    await play.grid(p);
    await sheetChecks(p, ev, { type: 'mini', ids: ['winTitle', 'winTime', 'winStreak', 'winBest'],
      shareRe: /^✏️ Mini #99 — \d:\d\d$/,
      endCheck: x => ok(x && x.outcome === 'solved' && x.secs > 0, `mini: tracker read solved in ${x && x.secs}s`) });
    ok(await text(p, '#winTitle') === 'Solved' && /^\d:\d\d$/.test(await text(p, '#winTime')), 'mini: Solved, time as 0:00');
    ok(await text(p, '.fin-note') === 'No checks, no reveals.', 'mini: note');
    ok(await p.locator('.fin-grid.g5 i').count() === 25, 'mini: solved grid in the recap');
    await shareClipboard(p, ctx, 'mini');
    await reopen(p, ev, 'mini');
    ok(await text(p, '.fin-stats > div:first-child b') === '1', 'mini: reopened sheet shows the streak');
    ok(!p.errs.length, 'mini: no page errors ' + p.errs.join(' | '));
    await ctx.close();
    await shareNative(b, F.mini, p2 => play.grid(p2), 'mini');
  },
  async 'doku:full-wrong'(b) {
    /* a full grid that isn't today's answer says so (19 Oct 2026); sending a letter back clears it */
    const { ctx, p } = await open(b, F.doku);
    await play.start(p);
    const P = await play.puzzle(p), locked = new Set((P.locked || []).map(([r, c]) => `${r - 1},${c - 1}`));
    const cells = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (P.grid[r][c] !== '#' && !locked.has(`${r},${c}`)) cells.push([r, c]);
    const L = ([r, c]) => P.grid[r][c], j = cells.findIndex(x => L(x) !== L(cells[0]));
    const want = cells.map(L); [want[0], want[j]] = [want[j], want[0]];   // swap two different letters: full, but wrong
    for (let k = 0; k < cells.length; k++) { const [r, c] = cells[k]; await tap(p, p.locator('#grid .cell').nth(r * 5 + c)); await wait(p, 200); await p.keyboard.press(want[k].toLowerCase()); await wait(p, 400); }
    await wait(p, 800);
    const m = await text(p, '#msg');
    ok(/full, but 2 squares aren.t today.s answer/.test(m), `doku: a full wrong grid says so (${m})`);
    ok(!(await play.boxOn(p)), 'doku: no win on a full wrong grid');
    await tap(p, p.locator('#grid .cell').nth(cells[0][0] * 5 + cells[0][1])); await wait(p, 600);
    ok((await text(p, '#msg')) === '', `doku: the note clears once a letter goes back (${await text(p, '#msg')})`);
    ok(!p.errs.length, 'doku: no page errors ' + p.errs.join(' | '));
    await ctx.close();
  },
  async 'finish:doku'(b) {
    const ev = []; const { ctx, p } = await open(b, F.doku, { events: ev });
    await play.grid(p);
    await sheetChecks(p, ev, { type: 'doku', ids: ['winTitle', 'winTime', 'winStreak', 'winBest'],
      shareRe: /^🔢 Doku #97 — \d:\d\d$/,
      endCheck: x => ok(x && x.outcome === 'solved', `doku: tracker read ${x && x.outcome}`) });
    ok(await text(p, '.fin-note') === 'All twelve tiles placed.', 'doku: note');
    ok(await p.locator('.fin-grid i.giv').count() === 5, 'doku: five given letters shaded');
    await shareClipboard(p, ctx, 'doku');
    await reopen(p, ev, 'doku');
    ok(!p.errs.length, 'doku: no page errors ' + p.errs.join(' | '));
    await ctx.close();
    await shareNative(b, F.doku, p2 => play.grid(p2), 'doku');
  },
  async 'finish:sweep'(b) {
    const ev = []; const { ctx, p } = await open(b, F.sweep, { events: ev });
    await play.sweep(p);
    await sheetChecks(p, ev, { type: 'sweep', ids: ['winTitle', 'winTime', 'winStreak', 'winBest'],
      shareRe: /^💣 Sweep 18 Oct — swept in \d:\d\d$/,
      endCheck: x => ok(x && x.outcome === 'solved', `sweep: tracker read ${x && x.outcome}`) });
    ok(await text(p, '#winTitle') === 'Swept' && await text(p, '.fin-note') === 'All seven mines found, no hints.', 'sweep: Swept, note');
    ok(await p.locator('.fin-grid.sw i.flag').count() === 7, 'sweep: board with seven flags');
    await shareClipboard(p, ctx, 'sweep');
    await reopen(p, ev, 'sweep');
    ok(!p.errs.length, 'sweep: no page errors ' + p.errs.join(' | '));
    await ctx.close();
    await shareNative(b, F.sweep, p2 => play.sweep(p2), 'sweep');
  },
  async 'finish:sweep-boom'(b) {
    const ev = []; const { ctx, p } = await open(b, F.sweep, { events: ev });
    await play.sweep(p, { boom: true });
    ok(await text(p, '#winTitle') === 'Boom.' && ends(ev)[0] && ends(ev)[0].x.outcome === 'failed', 'sweep: loss keeps the exact title and logs failed');
    ok(/^💥 Sweep 18 Oct — boom$/.test(await text(p, '.fin-share-text')) && await p.locator('.fin-grid.sw i.boom').count() === 1, 'sweep: boom share line and the mine marked');
    await tap(p, p.locator('.fin > .fin-link').first()); await wait(p, 800);
    ok(!(await p.evaluate(() => document.getElementById('winModal').classList.contains('fin-open'))) && await text(p, '#rank') === '· replay', 'sweep: Play again closes the sheet and marks the replay');
    await ctx.close();
  },
  async 'finish:path'(b) {
    const ev = []; const { ctx, p } = await open(b, F.path, { events: ev });
    await play.path(p);
    await sheetChecks(p, ev, { type: 'path', boxId: 'modal', ids: ['winTitle', 'statTime', 'statStreak'],
      shareRe: /^〰️ Path #92 — \d:\d\d$/,
      endCheck: x => ok(x && x.outcome === 'solved' && x.secs > 0, `path: tracker read solved in ${x && x.secs}s`) });
    ok(await text(p, '#winTitle') === 'Thread complete' && await text(p, '.fin-note') === 'One to 36 without a hint.', 'path: title and note');
    ok(await p.locator('.fin-path .fin-grid i').count() === 36 && await p.locator('.fin-path polyline').count() === 1, 'path: the thread in the recap');
    await shareClipboard(p, ctx, 'path');
    await reopen(p, ev, 'path', 'modal');
    ok(await text(p, '.fin-stats > div:first-child b') === '1', 'path: reopened sheet keeps the streak');
    ok(!p.errs.length, 'path: no page errors ' + p.errs.join(' | '));
    await ctx.close();
    await shareNative(b, F.path, p2 => play.path(p2), 'path');
  },
  /* ---------- streaks ---------- */
  async 'streak:doku-own'(b) {
    const ctx = await newPhone(b);
    await ctx.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      localStorage.setItem('digi-mini-streak', JSON.stringify({ last: '2026-10-17', streak: 5, best: 5, dates: ['2026-10-17'], tz: 'L' }));
      localStorage.setItem('digi-doku-v1', JSON.stringify({ v: 1, done: { 'DP·LEXI·0095': { s: 40, d: '2026-10-16' }, 'DP·LEXI·0096': { s: 50, d: '2026-10-17' } } })); });
    const { p } = await open(b, F.doku, { ctx });
    ok(await text(p, '#streak') === '2', `doku: streak rebuilt from its own results (${await text(p, '#streak')})`);
    await play.grid(p);
    const d = await ls(p, 'digi-doku-streak'), m = await ls(p, 'digi-mini-streak');
    ok(d && d.streak === 3 && d.best === 3 && d.last === '2026-10-18', 'doku: solving today takes its own streak to 3');
    ok(m && m.streak === 5 && m.last === '2026-10-17', 'doku: the Mini streak is left alone');
    await ctx.close();
  },
  async 'streak:overall-run'(b) {
    const ctx = await newPhone(b);
    await ctx.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      localStorage.setItem('digi-mini-v1', JSON.stringify({ v: 1, done: { 'DP·MINI·0097': { s: 30, d: '2026-10-16' } } }));
      localStorage.setItem('digi-borders-v1', JSON.stringify({ v: 1, done: { 'DP·BORD·0013': { c: 6, p: 500, on: '2026-10-17' } } })); });
    const { p } = await open(b, F.link, { ctx });
    await play.link(p, { wrong: 0 });
    ok(/every day for 3 days\./.test(await text(p, '.fin-clock')), `run: finish sheet "${await text(p, '.fin-clock')}"`);
    await p.goto('https://dailynoodle.co.uk/puzzles.html'); await wait(p, 1500);
    ok(/3-day streak/.test(await text(p, '#run')), `run: Puzzles page "${await text(p, '#run')}"`);
    await ctx.close();
  },
  /* ---------- the five fixes of 18 Oct ---------- */
  async 'fix:link-replay'(b) {
    const ev = []; const { ctx, p } = await open(b, F.link, { events: ev });
    await play.link(p, { wrong: 1 });
    ok(!/replay/i.test(await text(p, '#winSub')), 'link: first win is not labelled replay');
    await p.reload(); await wait(p, 1500);
    ok(await text(p, '#rank') === '', 'link: reopened shows no replay label');
    await ctx.close();
  },
  async 'fix:sweep-replay'(b) {
    const { ctx, p } = await open(b, F.sweep);
    await play.sweep(p);
    ok(!/replay/i.test(await text(p, '#winSub')), 'sweep: first win is not labelled replay');
    await ctx.close();
  },
  async 'fix:tangle-yesterday'(b) {
    const { ctx, p } = await open(b, F.tangle);
    await tap(p, p.locator('#yBtn')); await p.waitForTimeout(600); await wait(p, 500);
    ok(/Longest word/.test(await text(p, '#yList')), "tangle: Yesterday's answers load");
    await ctx.close();
  },
  async 'fix:path-streak'(b) {
    const { ctx, p } = await open(b, F.path);
    await play.path(p);
    await p.reload(); await wait(p, 1200);
    ok(await text(p, '#streakn') === '1', 'path: streak survives reload');
    await p.close();
    const d2 = await open(b, F.path2, { ctx, time: '2026-10-19T09:00:00+01:00' });
    await play.path(d2.p);
    const s = await ls(d2.p, 'digi-path-streak');
    ok(s && s.streak === 2 && s.last === '2026-10-19', 'path: next day takes the streak to 2');
    await ctx.close();
  },
  async 'fix:london-day'(b) {
    const { ctx, p } = await open(b, F.mini, { time: '2026-10-18T12:00:00+01:00' });
    await play.grid(p); await p.close();
    const d2 = await open(b, F.mini2, { ctx, time: '2026-10-19T00:30:00+01:00' });
    await play.grid(d2.p);
    const s = await ls(d2.p, 'digi-mini-streak');
    ok(s && s.streak === 2 && s.last === '2026-10-19', 'mini: a 00:30 BST play counts for the London day');
    await ctx.close();
  },
};

(async () => {
  const b = await launch();
  for (const [name, fn] of Object.entries(TESTS)) {
    if (ONLY && !name.includes(ONLY)) continue;
    console.log(name);
    try { await fn(b); } catch (e) { fail++; console.log('  FAIL threw:', e.message.split('\n')[0]); }
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
