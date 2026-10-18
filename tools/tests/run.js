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
  ok(/^Next: \w+ \d+$/.test(s.next) && /^\d of 7 played today$/.test(s.nextSub) && /^\.\.\/reports\/2026-10-18-/.test(s.nextHref), `${type}: next row "${s.next}" (${s.nextSub}) → ${s.nextHref}`);
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

const TESTS = {
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
