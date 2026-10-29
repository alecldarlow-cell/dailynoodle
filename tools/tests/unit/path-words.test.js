'use strict';
// AF-026 (29 Oct 2026): Path calls its line a path; "thread" is left to Tangle.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');

test('GIVEN the how-to-play page WHEN its Path section is read THEN it says path, never thread', () => {
  const html = fs.readFileSync(path.join(ROOT, 'how-to-play.html'), 'utf8');
  const m = html.match(/<section[^>]*id="path"[\s\S]*?<\/section>/);
  assert.ok(m, 'the Path section exists');
  assert.ok(/continuous path/.test(m[0]), 'the intro says path');
  assert.ok(!/\bthread\b/i.test(m[0]), 'no "thread" in the Path section');
});

test('GIVEN the house start card WHEN Path\'s rule and How to play are read THEN they say path, never thread', () => {
  const src = fs.readFileSync(path.join(ROOT, 'engines', 'house.js'), 'utf8');
  const lines = src.split('\n').filter(l => /^\s*path: /.test(l));
  assert.strictEqual(lines.length, 2, 'Path has a rule and a How to play');
  for (const l of lines) assert.ok(!/\bthread\b/i.test(l.replace(/\/\/.*$/, '')), 'no "thread": ' + l.trim().slice(0, 60));
});
