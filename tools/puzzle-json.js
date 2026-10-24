#!/usr/bin/env node
'use strict';
/* The Daily Noodle — puzzle data for the app (24 Oct 2026, app plan WP2).

   Called from tools/build-site.js on the published artifact, after the copy and the
   hold-back filter, so it only ever sees released files. For every puzzle card in
   feed.json whose page carries `window.DN_PUZZLE = {…}` (all but one July page), it
   writes reports/<same name>.json next to the page:

     { id, type, date, band, n, name, headline, standfirst, read, path, data }

   `data` is the page's DN_PUZZLE object exactly. It is a JavaScript literal in the
   page (unquoted keys, comments), so it is evaluated in an empty sandbox with a time
   limit, and refused unless the result survives a JSON round trip unchanged (plain
   data only). It also writes feed-lite.json: the puzzle cards only, with a `json`
   field naming each card's data file (null when the page has none), for the app's
   archive. Nothing in reports/ or feed.json changes; the app never parses HTML.

   A new daily type needs only its line in build-feed.js's TYPE_OF_ID. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// The page's data script: optional comments, then the one assignment.
const SCRIPT = /<script\b[^>]*>((?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*)(window\.DN_PUZZLE\s*=[\s\S]*?)<\/script>/;

/** The DN_PUZZLE object of a puzzle page, or null when the page has none. Throws if the
    assignment is anything but a plain-data literal. */
function parseDnPuzzle(html, label = 'page') {
  const m = SCRIPT.exec(html);
  if (!m) return null;
  const code = m[2].trim();
  if (!/^window\.DN_PUZZLE\s*=\s*\{[\s\S]*\}\s*;?$/.test(code)) {
    throw new Error(`${label}: DN_PUZZLE is not a single object literal`);
  }
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { timeout: 200, filename: label });
  const data = sandbox.window.DN_PUZZLE;
  const plain = JSON.parse(JSON.stringify(data));
  if (!sameData(data, plain)) throw new Error(`${label}: DN_PUZZLE holds something other than plain data`);
  return plain;
}

/** Deep equality across the sandbox boundary (its objects have another realm's prototypes). */
function sameData(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && sameData(a[k], b[k]));
}

const jsonPath = rel => rel.replace(/\.html$/, '.json');

/** Write the data files and feed-lite.json into a built site. Returns the count written. */
function write(site) {
  const feed = JSON.parse(fs.readFileSync(path.join(site, 'feed.json'), 'utf8'));
  const items = [];
  let written = 0;
  for (const it of feed.items || []) {
    if (it.kind !== 'puzzle' || !it.type || !/^reports\/[^/]+\.html$/.test(it.path || '')) continue;
    const file = path.join(site, it.path);
    if (!fs.existsSync(file)) continue;
    const data = parseDnPuzzle(fs.readFileSync(file, 'utf8'), it.path);
    let json = null;
    if (data) {
      const num = parseInt(String(data.id || it.id || '').split('·').pop(), 10);
      const fromHeadline = parseInt(String(it.headline || '').replace(/^\D+/, ''), 10);
      const n = it.type === 'sweep' ? fromHeadline : num;
      json = jsonPath(it.path);
      fs.writeFileSync(path.join(site, json), JSON.stringify({
        id: data.id || it.id || '', type: it.type, date: it.date, band: data.band || '',
        n: Number.isNaN(n) ? null : n, name: it.headline, headline: it.headline,
        standfirst: it.standfirst || '', read: it.read || '', path: it.path, data,
      }) + '\n');
      written++;
    }
    items.push({ path: it.path, type: it.type, id: it.id || '', date: it.date, headline: it.headline,
      standfirst: it.standfirst || '', read: it.read || '', mask: it.mask || '', json });
  }
  fs.writeFileSync(path.join(site, 'feed-lite.json'),
    JSON.stringify({ built: feed.built, today: feed.today, count: items.length, items }) + '\n');
  return written;
}

module.exports = { parseDnPuzzle, write, jsonPath };

if (require.main === module) {
  const site = path.resolve(process.argv[2] || '_site');
  console.log(`puzzle-json: ${write(site)} puzzle data file(s) and feed-lite.json written to ${site}`);
}
