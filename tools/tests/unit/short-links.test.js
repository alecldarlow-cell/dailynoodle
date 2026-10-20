'use strict';
// Short links (dailynoodle.co.uk/mini …) that every puzzle share ends with; tools/short-links.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { write, TYPES } = require('../../short-links');

test('short links: one page per puzzle type, with link-preview tags and the today lookup', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-'));
  assert.strictEqual(write(out), 8);
  for (const type of Object.keys(TYPES)) {
    const html = fs.readFileSync(path.join(out, type, 'index.html'), 'utf8');
    assert.match(html, new RegExp(`og:url" content="https://dailynoodle.co.uk/${type}"`));
    assert.match(html, /og:image" content="https:\/\/dailynoodle.co.uk\/assets\/share-card.png"/);
    assert.match(html, /\/puzzles-today\.json/);
    assert.match(html, /via=share/);
    assert.match(html, new RegExp(`var TYPE="${type}"`));
  }
  assert.throws(() => write(out), /already exists/);
});

test('short links: every type the finish sheet names has a page', () => {
  const finish = fs.readFileSync(path.join(__dirname, '../../../engines/finish.js'), 'utf8');
  const names = Object.keys(eval('(' + finish.match(/var NAME = (\{[^}]+\})/)[1] + ')'));
  assert.deepStrictEqual(names.sort(), Object.keys(TYPES).sort());
});
