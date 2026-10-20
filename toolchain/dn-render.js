#!/usr/bin/env node
'use strict';
/* dn-render.js — real-browser render check for a Noodle News piece (added 20 Oct 2026).

   The other gates run in jsdom, which has no fonts, layout or paint. This one opens the
   assembled piece in a real Chromium (the build the site's test suite pins), with the
   piece's own web fonts (Archivo, Inter) served from pinned npm copies because the
   sandbox can't reach Google Fonts, after the same additions the site's build workflow
   makes (Share buttons, back-to-News link, dark mode). It renders at 360px and 680px,
   light and dark, as a phone would (touch, mobile viewport, reduced motion), then:

   - checks rendered geometry: page wider than the screen, chart labels cut off at the
     chart's edge or the screen's, labels overlapping, hero figures clipped or wrapping,
     exhibits that didn't draw, chart text too small, text too faint for its background
     in either theme, script errors;
   - writes screenshots to look at: one sheet per exhibit (360 light and dark side by
     side, 680 light below) and one of the top of the piece, plus the whole page.

   It is a real render, not a phone: Linux font rendering, no browser bars. Looking at the
   sheets is the visual check; the measurements tell you where to look first.

   Needs (from the bootstrap): playwright-core, @sparticuz/chromium, @fontsource/archivo,
   @fontsource/inter. Keep playwright-core and @sparticuz/chromium at the versions in the
   repo's package.json, so this renders with the same browser the site's tests use.

     node dn-render.js <file>.html             # render, check, write render/<slug>/
     node dn-render.js <file>.html --repo DIR  # clone with tools/ for the site additions (default ./repo)
     node dn-render.js <file>.html --no-site   # skip the site additions
     node dn-render.js <file>.html --out DIR   # screenshots under DIR/<slug>/ (default ./render)

   Exit 0 = RENDER: PASS or PASS WITH WARNINGS; 1 = RENDER: FAIL; 2 = could not run.
*/
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const file = args.find(a => a.endsWith('.html'));
if (!file || !fs.existsSync(file)) { console.error('usage: node dn-render.js <file>.html [--repo DIR] [--no-site] [--out DIR]'); process.exit(2); }
const REPO = path.resolve(opt('--repo', 'repo')), OUT = path.resolve(opt('--out', 'render'));
const slug = path.basename(file, '.html'), outDir = path.join(OUT, slug);
const WIDTHS = [360, 680], SCHEMES = ['light', 'dark'];

// Find an installed package folder from the working directory or this script's.
function resolvePkg(mod) {
  for (const start of [process.cwd(), __dirname]) {
    for (let d = start; ; d = path.dirname(d)) {
      const p = path.join(d, 'node_modules', mod);
      if (fs.existsSync(path.join(p, 'package.json'))) return p;
      if (path.dirname(d) === d) break;
    }
  }
  throw Error('missing ' + mod);
}
function need(mod) {
  let dir;
  try { dir = resolvePkg(mod); }
  catch (e) { console.error(`dn-render: missing ${mod}. Install it with the bootstrap's npm line (toolchain/README.md).`); process.exit(2); }
  return require(dir);
}

// The site's pinned Chromium, unpacked once to a versioned temp folder.
// Same logic and cache folder as tools/tests/chromium.js in the repo.
function chromiumPath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  let root;
  try { root = resolvePkg('@sparticuz/chromium'); }
  catch (e) { console.error("dn-render: missing @sparticuz/chromium. Install it with the bootstrap's npm line (toolchain/README.md)."); process.exit(2); }
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
  const dir = path.join(os.tmpdir(), 'daily-noodle-chromium-' + version); fs.mkdirSync(dir, { recursive: true });
  const binary = path.join(dir, 'chromium');
  if (!fs.existsSync(path.join(dir, 'ready'))) {
    const tmp = binary + '.' + process.pid;
    fs.writeFileSync(tmp, zlib.brotliDecompressSync(fs.readFileSync(path.join(root, 'bin/chromium.br'))), { mode: 0o755 });
    fs.renameSync(tmp, binary);
    for (const [archive, out] of [['fonts.tar.br', path.join(dir, 'fonts')], ['swiftshader.tar.br', dir]]) {
      fs.mkdirSync(out, { recursive: true });
      const r = spawnSync('tar', ['--extract', '--no-same-owner', '--file', '-', '--directory', out], { input: zlib.brotliDecompressSync(fs.readFileSync(path.join(root, 'bin', archive))) });
      if (r.status !== 0) throw Error('Browser assets failed to unpack: ' + r.stderr);
    }
    fs.writeFileSync(path.join(dir, 'fonts/fonts.conf'), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${path.join(dir, 'fonts/fonts')}</dir><cachedir>${path.join(dir, 'font-cache')}</cachedir><config></config></fontconfig>`);
    fs.writeFileSync(path.join(dir, 'ready'), version);
  }
  process.env.FONTCONFIG_PATH = path.join(dir, 'fonts');
  process.env.LD_LIBRARY_PATH = [dir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  return binary;
}

// The piece asks Google for Archivo 500–800 and Inter 400–700; serve the same faces.
const FONT_HOST = 'https://dn-fonts.invalid/';
function fontCss() {
  let css = '';
  for (const [pkg, weights] of [['archivo', [500, 600, 700, 800]], ['inter', [400, 500, 600, 700]]]) {
    const dir = resolvePkg('@fontsource/' + pkg);
    for (const w of weights) css += fs.readFileSync(path.join(dir, w + '.css'), 'utf8').replace(/url\(\.\/files\//g, `url(${FONT_HOST}${pkg}/files/`);
  }
  return css;
}

// Apply the build workflow's visible additions to a temporary copy.
function sitePage() {
  const tools = path.join(REPO, 'tools');
  const steps = ['news-share.js', 'news-nav.js', 'news-dark.js'];
  if (args.includes('--no-site')) return { page: path.resolve(file), note: 'site additions skipped (--no-site)' };
  if (!steps.every(s => fs.existsSync(path.join(tools, s))))
    return { page: path.resolve(file), note: `site additions NOT applied: no ${tools}/news-*.js (add tools to the sparse checkout)` };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-render-')); fs.mkdirSync(path.join(tmp, 'reports'));
  const page = path.join(tmp, 'reports', path.basename(file)); fs.copyFileSync(file, page);
  for (const s of steps) {
    const r = spawnSync(process.execPath, [path.join(tools, s)], { cwd: tmp, encoding: 'utf8' });
    if (r.status !== 0) return { page: path.resolve(file), note: `site additions NOT applied: ${s} failed: ${(r.stderr || r.stdout).trim().split('\n').pop()}`, warn: true };
  }
  return { page, note: 'site additions applied: Share buttons, back-to-News link, dark mode', tmp };
}

// Runs inside the page. Returns findings for one width and theme.
function measure(o) {
  const W = innerWidth, fails = [], warns = [], stat = { minText: Infinity, exhibits: 0, drew: 0, texts: 0 };
  const figs = [...document.querySelectorAll('figure.exhibit')];
  const exName = el => { const f = el.closest && el.closest('figure.exhibit'); return f ? 'ex' + String(figs.indexOf(f) + 1).padStart(2, '0') : 'page'; };
  // Visible text only: an SVG <title> (the full text of a shortened label) is not drawn.
  const textOf = el => { let s = ''; const walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3) s += c.textContent; else if (c.nodeName !== 'title') { if (c.nodeName === 'tspan' && s) s += ' '; walk(c); } } }; walk(el); return s.replace(/\s+/g, ' ').trim(); };
  const say = el => '"' + textOf(el).slice(0, 40) + '"';
  const hidden = el => { for (let p = el; p && p.nodeType === 1; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return true; if (p.classList && p.classList.contains('dn-sr-only')) return true; } return false; };
  const rgb = s => { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v[3] === undefined ? 1 : v[3] }; };
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = el => { for (let p = el; p && p.nodeType === 1; p = p.parentElement) { const c = rgb(getComputedStyle(p).backgroundColor); if (c && c.a > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }; };
  const opacityChain = el => { let a = 1; for (let p = el; p && p.nodeType === 1; p = p.parentElement) a *= +getComputedStyle(p).opacity; return a; };
  const blend = (fg, bg, a) => ({ r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 });
  // The house --faint grey (axis ticks, dateline) is a known 2.6:1 on the light canvas:
  // a template choice, not a per-piece defect, so it is not reported here.
  const probe = document.createElement('span'); probe.style.color = 'var(--faint)'; document.body.appendChild(probe);
  const houseFaint = rgb(getComputedStyle(probe).color); probe.remove();
  const same = (a, b) => a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 6;
  const faint = {};
  const noteFaint = (where, el, cr, colour) => { if (same(colour, houseFaint)) return; if (!faint[where] || cr < faint[where].cr) faint[where] = { cr, text: say(el) }; };

  // Page wider than the screen.
  const sw = document.documentElement.scrollWidth;
  if (sw > W + 1) {
    const wide = [...document.body.querySelectorAll('*')].filter(e => !hidden(e) && e.getBoundingClientRect().right > W + 1);
    const top = wide.filter(e => !wide.includes(e.parentElement)).slice(0, 3)
      .map(e => `${exName(e)} <${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? ' .' + e.className.split(' ')[0] : ''}> ${say(e)}`);
    fails.push(`page is ${sw}px wide on a ${W}px screen, so it scrolls sideways; widest: ${top.join('; ')}`);
  }

  // Exhibits drew.
  figs.forEach((f, i) => {
    stat.exhibits++;
    const c = f.querySelector('.ex-chart') || f, r = c.getBoundingClientRect();
    const svg = c.querySelector('svg'), sr = svg && svg.getBoundingClientRect();
    if (r.height < 40 || (svg && (sr.height < 20 || sr.width < 20))) fails.push(`ex${String(i + 1).padStart(2, '0')}: exhibit did not draw (${Math.round(r.width)}×${Math.round(r.height)}px)`);
    else stat.drew++;
  });

  // Chart text: cut off, off screen, overlapping, too small, too faint.
  for (const svg of document.querySelectorAll('svg')) {
    if (hidden(svg)) continue;
    const S = svg.getBoundingClientRect(); if (S.width < 2 || S.height < 2) continue;
    const clips = getComputedStyle(svg).overflow !== 'visible', where = exName(svg), boxes = [];
    for (const t of svg.querySelectorAll('text')) {
      if (hidden(t) || !(t.textContent || '').trim()) continue;
      const R = t.getBoundingClientRect(); if (R.width === 0 || R.height === 0) continue;
      stat.texts++;
      const ink = { l: R.left, r: R.right, top: R.top + 0.18 * R.height, bot: R.bottom - 0.18 * R.height };
      const cut = Math.max(S.left - ink.l, ink.r - S.right, S.top - ink.top, ink.bot - S.bottom);
      if (ink.r > W + 0.5 || ink.l < -0.5) fails.push(`${where}: label runs off the screen by ${Math.ceil(Math.max(ink.r - W, -ink.l))}px: ${say(t)}`);
      else if (clips ? cut > 0.5 : cut > o.spillPx) (clips ? fails : warns).push(`${where}: label ${clips ? 'cut off' : 'sits outside the chart'} at its edge by ${Math.ceil(cut)}px: ${say(t)}`);
      const ctm = t.getScreenCTM(), px = parseFloat(getComputedStyle(t).fontSize) * (ctm ? Math.hypot(ctm.a, ctm.b) : 1);
      if (px < stat.minText) stat.minText = px;
      if (px < o.minPx) warns.push(`${where}: chart text ${px.toFixed(1)}px (under ${o.minPx}px): ${say(t)}`);
      const fill = rgb(getComputedStyle(t).fill);
      if (fill) {
        // Background: the last filled rect drawn before this label under its centre (a band
        // or bar), blended over the page; otherwise the page itself.
        let bg = bgOf(svg); const cx = (R.left + R.right) / 2, cy = (R.top + R.bottom) / 2;
        for (const rc of svg.querySelectorAll('rect')) {
          if (!(rc.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) || hidden(rc)) continue;
          const q = rc.getBoundingClientRect(); if (cx < q.left || cx > q.right || cy < q.top || cy > q.bottom) continue;
          const cs = getComputedStyle(rc), rf = rgb(cs.fill); if (!rf) continue;
          const ra = rf.a * +cs.fillOpacity * opacityChain(rc); if (ra > 0.05) bg = blend(rf, bg, ra);
        }
        const a = fill.a * +getComputedStyle(t).fillOpacity * opacityChain(t), cr = ratio(blend(fill, bg, a), bg);
        if (cr < o.minContrast) noteFaint(where, t, cr, fill);
      }
      boxes.push({ el: t, ...ink });
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j], ix = Math.min(A.r, B.r) - Math.max(A.l, B.l), iy = Math.min(A.bot, B.bot) - Math.max(A.top, B.top);
      if (ix > 1.5 && iy > 1.5) warns.push(`${where}: labels overlap (${Math.round(ix)}×${Math.round(iy)}px): ${say(A.el)} / ${say(B.el)}`);
    }
  }

  // Page text: clipped, hero figures wrapping, too faint.
  for (const el of document.querySelectorAll('.wrap *, body > *')) {
    if (el.closest('svg') || hidden(el)) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const c = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) continue;
    if (own && /hidden|clip/.test(c.overflowX) && el.scrollWidth > el.clientWidth + 1) fails.push(`${exName(el)}: text cut off by ${el.scrollWidth - el.clientWidth}px: ${say(el)}`);
    if (/auto|scroll/.test(c.overflowX) && el.scrollWidth > el.clientWidth + 1) warns.push(`${exName(el)}: a box scrolls sideways (${el.scrollWidth}px in ${el.clientWidth}px): ${say(el)}`);
    if (own) { const fg = rgb(c.color), bg = bgOf(el); if (fg) { const cr = ratio(blend(fg, bg, fg.a * opacityChain(el)), bg); if (cr < o.minContrast) noteFaint(exName(el) === 'page' ? 'text' : exName(el), el, cr, fg); } }
  }

  // Shortened labels (data-dn-fit="trunc"): what is drawn must be the start of the full
  // label plus an ellipsis. Anything else reads as a complete label and says something else.
  for (const el of document.querySelectorAll('[data-dn-fit="trunc"]')) {
    if (hidden(el)) continue;
    const t = el.querySelector('title'); if (!t) continue;
    const full = t.textContent.replace(/\s+/g, ' ').trim(), vis = textOf(el);
    const pre = vis.endsWith('…') ? vis.slice(0, -1).trim() : null;
    if (pre === null || !full.startsWith(pre)) fails.push(`${exName(el)}: label lost words: shows "${vis}" for "${full}"`);
    else if ((pre.match(/[\p{L}\p{N}]/gu) || []).length < 2) fails.push(`${exName(el)}: label shortened to nothing readable: shows "${vis}" for "${full}" (widen the space or shorten the labels in the spec)`);
    else warns.push(`${exName(el)}: label shortened to "${vis}" (full text "${full.slice(0, 60)}" is in the data table; shorten it in the spec if the stub reads badly)`);
  }
  for (const n of document.querySelectorAll('.herostats .hs .n')) {
    const fsz = parseFloat(getComputedStyle(n).fontSize);
    if (n.getBoundingClientRect().height > 1.6 * fsz) warns.push(`hero figure wraps onto two lines: ${say(n)}`);
  }
  for (const [where, f] of Object.entries(faint)) warns.push(`${where}: text too faint for its background (contrast ${f.cr.toFixed(1)}:1, under ${o.minContrast}:1): ${f.text}`);

  const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, ''));
  stat.fonts = ['Archivo', 'Inter'].filter(f => loaded.includes(f));
  return { fails, warns, stat };
}

async function sheet(browser, cells, out) {
  const imgs = cells.map(c => fs.existsSync(c.file) ? `<div class="c" style="width:${c.w}px"><div class="k">${c.label}</div><img style="width:${c.w}px" src="data:image/png;base64,${fs.readFileSync(c.file).toString('base64')}"></div>` : '').join('');
  const ctx = await browser.newContext({ viewport: { width: 760, height: 400 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(`<style>body{margin:0;padding:6px;background:#6b6f78;width:748px}.c{display:inline-block;vertical-align:top;margin:6px}.k{font:600 12px monospace;color:#fff;margin:0 0 4px}img{display:block}</style>${imgs}`);
  await p.waitForLoadState('load');
  await p.screenshot({ path: out, fullPage: true });
  await ctx.close();
}

(async () => {
  const { chromium } = need('playwright-core');
  for (const f of ['@fontsource/archivo', '@fontsource/inter']) {
    try { resolvePkg(f); } catch (e) { console.error(`dn-render: missing ${f}. Install it with the bootstrap's npm line (toolchain/README.md).`); process.exit(2); }
  }
  const site = sitePage(), css = fontCss();
  fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--no-sandbox'] });
  const version = browser.version().split('.')[0];
  const fails = new Set(), warns = new Set(), lines = [], blocked = new Set();
  if (site.warn) warns.add(site.note);
  let exhibits = 0, fonts = [];
  for (const w of WIDTHS) for (const scheme of SCHEMES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: 'reduce' });
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('file:') || u.startsWith('data:')) return route.continue();
      if (u.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ status: 200, contentType: 'text/css', body: css });
      if (u.startsWith(FONT_HOST)) {
        const [pkg, , name] = u.slice(FONT_HOST.length).split('/');
        if (/^(archivo|inter)$/.test(pkg) && /^[\w.-]+\.woff2?$/.test(name || ''))
          return route.fulfill({ status: 200, contentType: name.endsWith('2') ? 'font/woff2' : 'font/woff', body: fs.readFileSync(path.join(resolvePkg('@fontsource/' + pkg), 'files', name)) });
      }
      blocked.add(new URL(u).host); return route.abort();
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED|ERR_FILE_NOT_FOUND/.test(m.text())) warns.add(`console error: ${m.text().slice(0, 120)}`); });
    await page.goto('file://' + site.page, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const m = await page.evaluate(measure, { minPx: 10.5, minContrast: 3, spillPx: 4 });
    exhibits = m.stat.exhibits; fonts = m.stat.fonts;
    errors.forEach(e => fails.add(`script error: ${e.slice(0, 160)}`));
    const tag = `${w} ${scheme}`;
    // Geometry is the same in both themes; report it once (light) and contrast for both.
    for (const f of m.fails) fails.add(`${w}: ${f}`);
    for (const x of m.warns) if (scheme === 'light' || /faint/.test(x)) warns.add(`${scheme === 'dark' ? tag : w}: ${x}`);
    lines.push(`  ${tag.padEnd(9)} ${m.stat.drew}/${m.stat.exhibits} exhibits drew · ${m.stat.texts} chart labels · smallest ${isFinite(m.stat.minText) ? m.stat.minText.toFixed(1) + 'px' : 'n/a'} · ${m.fails.length} fail, ${m.warns.length} warn`);
    // Screenshots: the top of the piece, each exhibit, and (360 light) the whole page.
    const hero = await page.evaluate(() => { const h = document.querySelector('.herostats'); return h ? Math.ceil(h.getBoundingClientRect().bottom + scrollY + 16) : 900; });
    if (w === 360) await page.screenshot({ path: path.join(outDir, `top-${w}-${scheme}.png`), fullPage: true, clip: { x: 0, y: 0, width: w, height: Math.min(hero, 1600) } });
    if (w === 360 && scheme === 'light') await page.screenshot({ path: path.join(outDir, 'page-360-light.png'), fullPage: true, scale: 'css' });
    const figs = await page.$$('figure.exhibit');
    for (let i = 0; i < figs.length; i++) await figs[i].screenshot({ path: path.join(outDir, `ex${String(i + 1).padStart(2, '0')}-${w}-${scheme}.png`) });
    await ctx.close();
  }
  // Sheets to look at: one per exhibit, one for the top of the piece.
  const look = [];
  const top = path.join(outDir, 'sheet-top.png');
  await sheet(browser, SCHEMES.map(s => ({ label: `360 ${s}`, w: 360, file: path.join(outDir, `top-360-${s}.png`) })), top); look.push(top);
  for (let i = 1; i <= exhibits; i++) {
    const n = 'ex' + String(i).padStart(2, '0'), out = path.join(outDir, `sheet-${n}.png`);
    await sheet(browser, [{ label: `${n} · 360 light`, w: 360, file: path.join(outDir, `${n}-360-light.png`) }, { label: '360 dark', w: 360, file: path.join(outDir, `${n}-360-dark.png`) }, { label: `${n} · 680 light`, w: 680, file: path.join(outDir, `${n}-680-light.png`) }], out);
    look.push(out);
  }
  await browser.close();
  if (site.tmp) fs.rmSync(site.tmp, { recursive: true, force: true });
  if (fonts.length < 2) warns.add(`web fonts not loaded (${fonts.join(', ') || 'none'} of Archivo, Inter): measurements use fallback fonts`);

  console.log(`dn-render: ${path.basename(file)} in Chromium ${version}; ${site.note}`);
  console.log(`  fonts ${fonts.join(' + ') || 'NOT loaded'} · ${exhibits} exhibits${blocked.size ? ' · blocked outside requests: ' + [...blocked].join(', ') : ''}`);
  lines.forEach(l => console.log(l));
  for (const f of fails) console.log('FAIL ' + f);
  for (const w of warns) console.log('WARN ' + w);
  console.log('Look at these sheets (Read each image) before calling the visual check done:');
  look.forEach(f => console.log('  ' + path.relative(process.cwd(), f)));
  console.log(`  (whole page: ${path.relative(process.cwd(), path.join(outDir, 'page-360-light.png'))})`);
  console.log('RENDER: ' + (fails.size ? 'FAIL' : warns.size ? 'PASS WITH WARNINGS' : 'PASS'));
  process.exit(fails.size ? 1 : 0);
})().catch(e => { console.error('dn-render could not run: ' + (e && e.stack || e)); process.exit(2); });
