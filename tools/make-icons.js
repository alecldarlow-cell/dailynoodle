#!/usr/bin/env node
/**
 * Draws the website's icons: the Daily Noodle "noodle n" (Alec, 7 Nov 2026), the app's mark in
 * the site's blue. One white noodle drawn as an "n" (an arch, a U-turn on the same baseline, a
 * climb back up) ends in a marigold dot whose top is level with the top of the arch, on a gentle
 * vertical glow of blue (midpoint #1C46C2, the colour of the old DN tile) with a soft shadow.
 * Ported from the app's scripts/make-icons.js (Daily-noodle-app), which draws the same mark in
 * the house green; change both together. No dependencies:
 *
 *   node tools/make-icons.js          writes the files into icons/
 *   node tools/make-icons.js --check  fails if any committed icon differs from what it draws
 *
 * What it makes (same names, sizes and shapes as before, so no page or manifest changes):
 * - favicon.svg            the browser tab icon, as vector art on a rounded tile.
 * - favicon-32.png         the same at 32 px, transparent corners.
 * - apple-touch-icon.png   180 opaque square (iOS rounds it itself).
 * - icon-192.png / icon-512.png   the manifest's "any" icons: rounded tile, transparent corners.
 * - icon-maskable-192.png / icon-maskable-512.png   full-bleed; the mark (shadow included) sits
 *   inside the 40% safe circle that Android's masks keep.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

/** The site's icon blue (the old DN tile's colour); the app uses the house green instead. */
const BLUE = '#1C46C2';
/** The tile's glow, top to bottom; its midpoint is the icon blue. */
const TILE_TOP = '#2350D0';
const TILE_BOTTOM = '#163CB4';
/** The shadow under the noodle: deep blue at 45%, 16 px down on a 1024 icon. */
const SHADOW = '#0F2C86';
const SHADOW_ALPHA = 0.45;
const SHADOW_DROP = 16;
const WHITE = '#FFFFFF';
/** The dot: the marigold of the puzzles' active cell (the brand sheet's `active`). */
const MARIGOLD = '#FFD54A';

// ---------- the mark, in 1024-icon units ----------

/**
 * The noodle's centre line and its dot, as drawn on the 1024 icon before scaling: columns at x
 * 352, 512, 672; the arch top at y 280 (a half circle, radius 80); the U-turn's bottom at the
 * baseline, y 760; a 96-wide stroke with round ends; the dot (radius 66) at the top of the third
 * column, its top level with the arch's outer edge (y 232).
 */
const STROKE = 96;
const DOT_R = 66;
const COLS = [352, 512, 672];
const TOP = 280;
const BASE = 760;
const TURN = 80;
const DOT = { x: COLS[2], y: TOP - STROKE / 2 + DOT_R };
/** The mark's design box (its centre is the point scaled about) and the scale on the icon. */
const BOX = {
  x0: COLS[0] - STROKE / 2,
  x1: COLS[2] + 70,
  y0: TOP - STROKE / 2,
  y1: BASE + STROKE / 2,
};
const MARK_SCALE = 1.3;
/** The maskable icons' scale, as the app's adaptive icon: the 72 dp view of 108 dp, then 5% smaller.
 * The mark, shadow included, then sits well inside the 40% safe circle every mask keeps. */
const ADAPTIVE = (72 / 108) * 0.95;

/** Points along the noodle's centre line, from the left foot to the dot. */
function centreLine(steps = 48) {
  const pts = [];
  const line = (x0, y0, x1, y1) => pts.push([x0, y0], [x1, y1]);
  const arc = (cx, cy, r, a0, a1) => {
    for (let k = 1; k <= steps; k++) {
      const a = a0 + ((a1 - a0) * k) / steps;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  line(COLS[0], BASE, COLS[0], TOP + TURN);
  arc(COLS[0] + TURN, TOP + TURN, TURN, Math.PI, 2 * Math.PI); // over the top (y down)
  pts.push([COLS[1], BASE - TURN]);
  arc(COLS[1] + TURN, BASE - TURN, TURN, Math.PI, 0); // round the bottom
  pts.push([COLS[2], DOT.y]);
  // Drop repeated points.
  return pts.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6,
  );
}

/** A polyline stroked `width` wide with round ends, as one closed polygon (the turns are wider than the stroke, so it never folds). */
function stroke(pts, width, capSteps = 32) {
  const h = width / 2;
  const normal = (i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  const left = pts.map((p, i) => [p[0] + normal(i)[0] * h, p[1] + normal(i)[1] * h]);
  const right = pts.map((p, i) => [p[0] - normal(i)[0] * h, p[1] - normal(i)[1] * h]);
  const cap = (p, n, out) => {
    const a0 = Math.atan2(n[1], n[0]);
    for (let k = 1; k < capSteps; k++) {
      const a = a0 + ((Math.PI * k) / capSteps) * out;
      // Sweep from the left side round the end to the right side.
      cap.pts.push([p[0] + h * Math.cos(a), p[1] + h * Math.sin(a)]);
    }
  };
  cap.pts = [];
  const poly = left.slice();
  cap(pts.at(-1), normal(pts.length - 1), -1);
  poly.push(...cap.pts);
  cap.pts = [];
  poly.push(...right.reverse());
  const n0 = normal(0);
  cap([pts[0][0], pts[0][1]], [-n0[0], -n0[1]], -1);
  poly.push(...cap.pts);
  return poly;
}

/** A circle as a polygon. */
function circle(cx, cy, r, steps = 96) {
  const out = [];
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * 2 * Math.PI;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** The same winding for every polygon, so overlapping shapes in one layer fill as a union. */
function clockwise(poly) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    area += ax * by - bx * ay;
  }
  return area < 0 ? poly.slice().reverse() : poly;
}

/** The mark's parts, placed on a `size` canvas: icon units scaled by `scale` about the box's centre, then dropped `dy` px. */
function mark(size, scale, dy = 0) {
  const cx = (BOX.x0 + BOX.x1) / 2;
  const cy = (BOX.y0 + BOX.y1) / 2;
  const k = (size / 1024) * scale;
  const at = ([x, y]) => [size / 2 + (x - cx) * k, size / 2 + (y - cy) * k + dy];
  return {
    line: [clockwise(stroke(centreLine(), STROKE).map(at))],
    dot: [clockwise(circle(DOT.x, DOT.y, DOT_R).map(at))],
  };
}

/** A rounded rectangle as a polygon. */
function roundRect(x, y, w, h, r, steps = 32) {
  const out = [];
  const corner = (cx, cy, a0) => {
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (k / steps) * (Math.PI / 2);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return [out];
}

// ---------- the rasteriser: non-zero fill, 4 × 4 samples a pixel ----------

const SS = 4;

/** Coverage (0..1) of `polys` over a `size` square, one value a pixel. */
function cover(polys, size) {
  const cov = new Float32Array(size * size);
  const edges = [];
  for (const p of polys)
    for (let i = 0; i < p.length; i++) {
      const [ax, ay] = p[i];
      const [bx, by] = p[(i + 1) % p.length];
      if (ay !== by) edges.push({ ax, ay, bx, by, dir: by > ay ? 1 : -1 });
    }
  const w = 1 / (SS * SS);
  for (let sy = 0; sy < size * SS; sy++) {
    const y = (sy + 0.5) / SS;
    const hits = [];
    for (const e of edges) {
      const lo = Math.min(e.ay, e.by);
      const hi = Math.max(e.ay, e.by);
      if (y < lo || y >= hi) continue;
      hits.push({ x: e.ax + ((y - e.ay) * (e.bx - e.ax)) / (e.by - e.ay), dir: e.dir });
    }
    hits.sort((a, b) => a.x - b.x);
    const row = Math.floor(sy / SS) * size;
    let wind = 0;
    for (let i = 0; i < hits.length - 1; i++) {
      wind += hits[i].dir;
      if (wind === 0) continue;
      const first = Math.max(0, Math.ceil(hits[i].x * SS - 0.5));
      const last = Math.min(size * SS - 1, Math.ceil(hits[i + 1].x * SS - 0.5) - 1);
      for (let sx = first; sx <= last; sx++) cov[row + Math.floor(sx / SS)] += w;
    }
  }
  return cov;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * A vertical glow from `top` to `bottom`, running between rows `y0` and `y1` (clamped outside),
 * as a function of the row.
 */
const glow = (top, bottom, y0, y1) => (y) => {
  const t = Math.min(1, Math.max(0, (y + 0.5 - y0) / (y1 - y0)));
  const a = rgb(top);
  const b = rgb(bottom);
  return a.map((v, k) => v + (b[k] - v) * t);
};

/**
 * A `size` square of RGBA pixels: `layers` painted in order over a clear (or `bg`) canvas, each
 * {polys, colour, alpha?}. `bg` is a colour or a function of the row (a glow); `clip` (polygons),
 * if given, then cuts the whole picture to its shape.
 */
function paint(size, layers, bg, clip) {
  const px = new Float32Array(size * size * 4);
  if (bg) {
    for (let y = 0; y < size; y++) {
      const [r, g, b] = typeof bg === 'function' ? bg(y) : rgb(bg);
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        px[i * 4] = r;
        px[i * 4 + 1] = g;
        px[i * 4 + 2] = b;
        px[i * 4 + 3] = 1;
      }
    }
  }
  for (const { polys, colour, alpha = 1 } of layers) {
    const cov = cover(polys, size);
    const c = rgb(colour);
    for (let i = 0; i < size * size; i++) {
      const a = Math.min(1, cov[i]) * alpha;
      if (a <= 0) continue;
      const da = px[i * 4 + 3];
      const oa = a + da * (1 - a);
      for (let k = 0; k < 3; k++) px[i * 4 + k] = (c[k] * a + px[i * 4 + k] * da * (1 - a)) / oa;
      px[i * 4 + 3] = oa;
    }
  }
  if (clip) {
    const cov = cover(clip, size);
    for (let i = 0; i < size * size; i++) px[i * 4 + 3] *= Math.min(1, cov[i]);
  }
  return px;
}

// ---------- PNG ----------

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const x of buf) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 8-bit PNG bytes from float RGBA pixels: RGB (opaque) or RGBA. */
function encodePng(px, size, alpha) {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc((size * ch + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * ch + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      for (let k = 0; k < ch; k++)
        raw[row + 1 + x * ch + k] = Math.round(px[i + k] * (k === 3 ? 255 : 1));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- the set ----------

/** The mark's layers on a `size` canvas at `scale`: shadow (optional), noodle, dot. */
function layers(size, scale, { shadow = true, line = WHITE, dot = MARIGOLD } = {}) {
  const k = ((size / 1024) * scale) / MARK_SCALE;
  const m = mark(size, scale);
  const out = [];
  if (shadow) {
    const s = mark(size, scale, SHADOW_DROP * k);
    out.push({ polys: [...s.line, ...s.dot], colour: SHADOW, alpha: SHADOW_ALPHA });
  }
  out.push({ polys: m.line, colour: line }, { polys: m.dot, colour: dot });
  return out;
}

/** The tile's corner radius as a share of its side, as the old icons had (68.27 of 512). */
const TILE_R = 68.27 / 512;

/** The noodle's centre line as SVG path data, in 1024-icon units (the same shape as centreLine). */
function centrePath() {
  const r = TURN;
  return (
    `M${COLS[0]} ${BASE} L${COLS[0]} ${TOP + r} A${r} ${r} 0 0 1 ${COLS[1]} ${TOP + r} ` +
    `L${COLS[1]} ${BASE - r} A${r} ${r} 0 0 0 ${COLS[2]} ${BASE - r} L${COLS[2]} ${DOT.y}`
  );
}

/** favicon.svg: the full icon as vector art on a rounded tile, 512 units square. */
function faviconSvg() {
  const cx = (BOX.x0 + BOX.x1) / 2;
  const cy = (BOX.y0 + BOX.y1) / 2;
  const k = (512 / 1024) * MARK_SCALE;
  const place = (dy) => `translate(256 ${256 + dy}) scale(${k}) translate(${-cx} ${-cy})`;
  const mark = (line, dot) =>
    `<path d="${centrePath()}" fill="none" stroke="${line}" stroke-width="${STROKE}" stroke-linecap="round"/>` +
    `<circle cx="${DOT.x}" cy="${DOT.y}" r="${DOT_R}" fill="${dot}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">` +
    `<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${TILE_TOP}"/><stop offset="1" stop-color="${TILE_BOTTOM}"/></linearGradient></defs>` +
    `<rect width="512" height="512" rx="${(512 * TILE_R).toFixed(2)}" fill="url(#t)"/>` +
    `<g transform="${place(SHADOW_DROP / 2)}" opacity="${SHADOW_ALPHA}">${mark(SHADOW, SHADOW)}</g>` +
    `<g transform="${place(0)}">${mark(WHITE, MARIGOLD)}</g></svg>\n`
  );
}

/** Every icon, as {file, size, alpha, px} (PNG) or {file, svg} (text). */
function render() {
  const tile = (size) => glow(TILE_TOP, TILE_BOTTOM, 0, size);
  const rounded = (size) =>
    paint(size, layers(size, MARK_SCALE), tile(size), roundRect(0, 0, size, size, size * TILE_R));
  const square = (size) => paint(size, layers(size, MARK_SCALE), tile(size));
  const maskable = (size) => paint(size, layers(size, MARK_SCALE * ADAPTIVE), tile(size));
  return [
    { file: 'favicon.svg', svg: faviconSvg() },
    { file: 'favicon-32.png', size: 32, alpha: true, px: rounded(32) },
    { file: 'apple-touch-icon.png', size: 180, alpha: false, px: square(180) },
    { file: 'icon-192.png', size: 192, alpha: true, px: rounded(192) },
    { file: 'icon-512.png', size: 512, alpha: true, px: rounded(512) },
    { file: 'icon-maskable-192.png', size: 192, alpha: false, px: maskable(192) },
    { file: 'icon-maskable-512.png', size: 512, alpha: false, px: maskable(512) },
  ];
}

module.exports = {
  render,
  encodePng,
  cover,
  BLUE,
  TILE_TOP,
  TILE_BOTTOM,
  MARIGOLD,
  MARK_SCALE,
  ADAPTIVE,
};

/** The pixels of a PNG this script wrote (8-bit RGB or RGBA, unfiltered rows), as RGBA bytes. */
function decodePng(buf) {
  const w = buf.readUInt32BE(16);
  const ch = buf[25] === 6 ? 4 : 3;
  const parts = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    if (buf.toString('latin1', at + 4, at + 8) === 'IDAT')
      parts.push(buf.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const out = Buffer.alloc(w * w * 4, 255);
  for (let y = 0; y < w; y++) {
    const row = y * (w * ch + 1);
    if (raw[row] !== 0) return null;
    for (let x = 0; x < w; x++)
      for (let k = 0; k < ch; k++) out[(y * w + x) * 4 + k] = raw[row + 1 + x * ch + k];
  }
  return { w, out };
}

/** The icons in icons/ that differ from what render() draws (PNGs by pixel, the SVG by text). */
function stale() {
  const bad = [];
  for (const { file, size, alpha, px, svg } of render()) {
    const f = path.join(ROOT, 'icons', file);
    if (svg) {
      if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== svg) bad.push(file);
      continue;
    }
    const got = fs.existsSync(f) ? decodePng(fs.readFileSync(f)) : null;
    const want = decodePng(encodePng(px, size, alpha));
    if (!got || got.w !== size || !got.out.equals(want.out)) bad.push(file);
  }
  return bad;
}

module.exports.stale = stale;

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const bad = stale();
    if (bad.length) {
      console.error(`Out of date (run node tools/make-icons.js): ${bad.join(', ')}`);
      process.exit(1);
    }
    console.log('icons up to date');
  } else {
    for (const { file, size, alpha, px, svg } of render()) {
      const out = path.join(ROOT, 'icons', file);
      fs.writeFileSync(out, svg || encodePng(px, size, alpha));
      console.log(`wrote ${path.relative(ROOT, out)}`);
    }
  }
}
