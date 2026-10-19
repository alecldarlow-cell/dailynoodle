/* ---------------------------------------------------------------------------
   Browser test harness for the puzzle players (tools/tests/).

   Serves this repo as https://dailynoodle.co.uk inside a headless Chromium
   (Playwright), so pages, engines, dn-track.js and dn-board.js run exactly
   as on the site, with nothing leaving the machine: tracker and league calls
   are captured, not sent. Phone emulation (touch, 390 x 844) by default.

   Needs Playwright (npm i playwright, or set PLAYWRIGHT_DIR to an install)
   and a Chromium (PW_CHROMIUM=/path/to/chrome, or Playwright's own).
   Fonts: Google Fonts are not fetched. Set DN_FONTS to a folder holding
   fonts.css plus the files it points at (served under /__fonts/) to get the
   real faces in screenshots; without it the suite serves its pinned Fontsource packages.
--------------------------------------------------------------------------- */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(process.env.DN_TEST_ROOT || path.join(__dirname, '..', '..'));
const PW = process.env.PLAYWRIGHT_DIR ? require(path.join(process.env.PLAYWRIGHT_DIR, 'playwright')) : require('playwright');
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', webmanifest: 'application/manifest+json', woff2: 'font/woff2' };
const FONTS = process.env.DN_FONTS || null;
// Keep the daily list consistent with each page's fake London date. Reading
// the live generated list made fixture tests treat yesterday as "today".
const DAILY = new Map();
function dailyList(day) {
  if (DAILY.has(day)) return DAILY.get(day);
  const types = { 'crossword-mini': 'mini', 'logic-doku': 'doku', 'logic-sweep': 'sweep', 'logic-path': 'path', 'word-link': 'link', 'word-tangle': 'tangle', 'geo-borders': 'borders' };
  const items = [];
  for (const file of fs.readdirSync(path.join(REPO, 'reports')).filter(f => f.startsWith(day + '-'))) {
    const slug = (file.match(/^\d{4}-\d{2}-\d{2}-([a-z]+-[a-z]+)(?:-\d+)?\.html$/) || [])[1], type = types[slug];
    if (!type) continue;
    const src = fs.readFileSync(path.join(REPO, 'reports', file), 'utf8');
    const id = (src.match(/\bid\s*:\s*"(DP·[A-Z]+·[0-9-]+)"/) || [])[1];
    const name = ((src.match(/name="dn:headline"\s+content="([^"]+)"/) || [])[1] || type).replace(/ 0+(\d+)$/, ' $1');
    if (id) items.push({ type, id, name, path: 'reports/' + file });
  }
  const out = JSON.stringify({ today: day, items }); DAILY.set(day, out); return out;
}

async function launch() {
  const o = { args: ['--no-sandbox'] };
  if (!process.env.DN_BROWSER || process.env.DN_BROWSER === 'chromium') o.executablePath = process.env.PW_CHROMIUM || await require('./chromium').executable();
  return (PW[process.env.DN_BROWSER || 'chromium']).launch(o);
}

/* opts: width, height, scheme ('light'|'dark'), engines (folder overriding engines/*.js), events (array to collect tracker events) */
async function newPhone(browser, { width = 390, height = 844, scheme = 'light', reduced = false, engines = null, events = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2, isMobile: process.env.DN_BROWSER !== 'firefox', hasTouch: true,
    colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'en-GB', timezoneId: 'Europe/London',
    serviceWorkers: 'block',   // sw.js has its own test (tools/tests/sw.js); here every request must go through the routes below
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  });
  // dn-track.js sends nothing from a browser flagged as automated (19 Oct 2026);
  // clear the flag so the tests see the tracker as a reader's phone would.
  await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (e) {} });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    // fonts: honour ?display= as Google does, so font swaps show up in tests
    if (u.host === 'fonts.googleapis.com' && !u.pathname.startsWith('/__fonts/')) {
      const css = FONTS ? fs.readFileSync(path.join(FONTS, 'fonts.css'), 'utf8') : require('./fonts').css();
      return route.fulfill({ status: 200, contentType: 'text/css', body: css.replace(/font-display:[^;}]*/g, 'font-display:' + (u.searchParams.get('display') || 'auto')) });
    }
    if (u.pathname.startsWith('/__fonts/') && !FONTS) return route.fulfill({ status: 200, contentType: u.pathname.endsWith('.woff2') ? 'font/woff2' : 'font/woff', body: require('./fonts').file(u.pathname.slice(9)) });
    if (u.pathname.startsWith('/__fonts/') && FONTS) {
      const rel = decodeURIComponent(u.pathname.slice(9));
      let f = path.join(FONTS, rel); if (!fs.existsSync(f)) f = path.join(FONTS, 'node_modules', rel);   // an npm install of @fontsource puts them here
      return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) }) : route.fulfill({ status: 404 });
    }
    if (u.host.endsWith('supabase.co')) {
      if (events) { try { for (const e of JSON.parse(route.request().postData() || '{}').batch || []) events.push(e); } catch (e) {} }
      return route.fulfill({ status: 204, body: '' });
    }
    if (u.host === 'dailynoodle.co.uk') {
      let p = decodeURIComponent(u.pathname);
      if (p === '/puzzles-today.json') {
        const day = await route.request().frame().evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
        return route.fulfill({ status: 200, contentType: MIME.json, body: dailyList(day) });
      }
      if (engines && p.startsWith('/engines/') && fs.existsSync(path.join(engines, p.slice(9)))) {
        const f = path.join(engines, p.slice(9));
        return route.fulfill({ status: 200, contentType: MIME[path.extname(f).slice(1)], body: fs.readFileSync(f) });
      }
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(REPO, p);
      if (!f.startsWith(REPO) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'not found' });
      return route.fulfill({ status: 200, contentType: MIME[path.extname(f).slice(1)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  return ctx;
}

/* a tap with the sensor jitter a real touchscreen produces: down, two small moves, up */
async function tap(p, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox(); if (!b) throw new Error('tap: element not visible');
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 1.5, y - 1); await p.mouse.move(x + 2, y + 1); await p.mouse.up();
}
/* advance the page's fake clock (installed by open()) and let it paint */
const wait = (p, ms) => p.clock.runFor(ms).then(() => p.waitForTimeout(30));

async function open(browser, file, { time = '2026-10-18T14:30:00+01:00', ctx = null, events = null, engines = null, scheme, width, height } = {}) {
  ctx = ctx || await newPhone(browser, { events, engines, scheme, width, height });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date(time) });
  await p.goto('https://dailynoodle.co.uk/reports/' + file); await wait(p, 1200);
  return { ctx, p };
}

module.exports = { REPO, launch, newPhone, open, tap, wait };
