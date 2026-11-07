'use strict';
// The site's icons: the noodle n in blue (7 Nov 2026), drawn by tools/make-icons.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const icons = require('../../make-icons');

const ROOT = path.join(__dirname, '../../..');
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const near = (px, hex, tol) => rgb(hex).every((v, i) => Math.abs(v - px[i]) <= tol);

/** An icon's pixels as the script draws them: {w, at(x, y) → [r, g, b, a]}. The first test proves
 * the committed files hold exactly these. */
function pixels(file) {
  const { size, px } = icons.render().find((e) => e.file === file);
  // The script keeps colour in 0–255 and coverage in 0–1.
  return { w: size, at: (x, y) => [0, 1, 2, 3].map((k) => Math.round(px[(y * size + x) * 4 + k] * (k === 3 ? 255 : 1))) };
}

/** The box of bright pixels (the white noodle and the marigold dot; red at full). */
function markBox(p) {
  let x0 = p.w, y0 = p.w, x1 = -1, y1 = -1;
  for (let y = 0; y < p.w; y++)
    for (let x = 0; x < p.w; x++) {
      const [r, , , a] = p.at(x, y);
      if (a > 0 && r > 200) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
  return { x0, y0, x1, y1 };
}

test('icons: the committed files are exactly what tools/make-icons.js draws', () => {
  assert.deepStrictEqual(icons.stale(), []);
});

test('icons: every file the pages, manifest and service worker name is drawn, at its size', () => {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const drawn = new Map(icons.render().map((e) => [e.file, e]));
  for (const i of man.icons) {
    const e = drawn.get(path.basename(i.src));
    assert.ok(e, `${i.src} is drawn`);
    assert.strictEqual(`${e.size}x${e.size}`, i.sizes);
  }
  for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) assert.ok(drawn.has(f), f);
});

test('icons: the blue glow centres on the old tile blue, and the dot is the puzzles marigold', () => {
  const [t, b] = [rgb(icons.TILE_TOP), rgb(icons.TILE_BOTTOM)];
  const mid = t.map((v, i) => Math.round((v + b[i]) / 2));
  assert.ok(near(mid, icons.BLUE, 2), `midpoint ${mid}`);
  assert.strictEqual(icons.MARIGOLD, '#FFD54A');
});

test('icons: the iPhone and maskable icons are opaque; the tab and "any" icons have clear rounded corners', () => {
  for (const f of ['apple-touch-icon.png', 'icon-maskable-192.png', 'icon-maskable-512.png']) {
    const p = pixels(f);
    assert.strictEqual(p.at(0, 0)[3], 255, f);
    assert.ok(near(p.at(0, 0), icons.TILE_TOP, 3), f);
  }
  for (const f of ['favicon-32.png', 'icon-192.png', 'icon-512.png']) {
    const p = pixels(f);
    assert.strictEqual(p.at(0, 0)[3], 0, f);
    assert.strictEqual(p.at(p.w >> 1, 1)[3], 255, f);
  }
});

test('icons: the mark is centred and 70–76% tall on the full icons, inside the safe circle on the maskable ones', () => {
  for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
    const p = pixels(f), b = markBox(p);
    assert.ok(Math.abs((b.x0 + b.x1) / 2 - p.w / 2) < p.w * 0.01, f);
    const h = (b.y1 - b.y0) / p.w;
    assert.ok(h > 0.7 && h < 0.76, `${f}: ${h}`);
  }
  for (const f of ['icon-maskable-192.png', 'icon-maskable-512.png']) {
    const p = pixels(f);
    let far = 0;
    for (let y = 0; y < p.w; y++)
      for (let x = 0; x < p.w; x++) {
        // Anything that isn't the row's glow colour: the noodle, the dot or the shadow.
        const t = (y + 0.5) / p.w;
        const glow = rgb(icons.TILE_TOP).map((v, i) => v + (rgb(icons.TILE_BOTTOM)[i] - v) * t);
        const px = p.at(x, y);
        if (glow.some((v, i) => Math.abs(v - px[i]) > 6)) far = Math.max(far, Math.hypot(x + 0.5 - p.w / 2, y + 0.5 - p.w / 2));
      }
    assert.ok(far < p.w * 0.4, `${f}: ${far / p.w}`);
  }
});

test('icons: favicon.svg is the same art as vector, with the noodle, the dot and no letters', () => {
  const svg = fs.readFileSync(path.join(ROOT, 'icons/favicon.svg'), 'utf8');
  assert.match(svg, /<linearGradient/);
  assert.match(svg, /stroke-linecap="round"/);
  assert.match(svg, new RegExp(`<circle[^>]+fill="${icons.MARIGOLD}"`));
  assert.doesNotMatch(svg, /#1C46C2"\/><path fill="#FFFFFF"/); // the old DN letters
});
