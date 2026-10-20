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

test('short links: published games get one each (Lab games and puzzle names excluded, aliases applied)', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'slg-'));
  fs.mkdirSync(path.join(out, 'reports'));
  const files = ['2026-09-26-arcade-bubble-burst.html', '2026-10-17-arcade-two-dots-landscape.html', '2026-10-16-strategy-campfire-watch.html'];
  for (const f of files) fs.writeFileSync(path.join(out, 'reports', f), 'x');
  fs.writeFileSync(path.join(out, 'feed.json'), JSON.stringify({ items: [
    { path: 'reports/' + files[0], kind: 'game', headline: 'Bubble Burst' },
    { path: 'reports/' + files[1], kind: 'game', headline: 'Two Dots' },
    { path: 'reports/' + files[2], kind: 'game', headline: 'Campfire Watch', badge: 'In development' },
    { path: 'reports/2026-12-01-arcade-held.html', kind: 'game', headline: 'Held' },
  ] }));
  assert.strictEqual(write(out), 10);
  const bb = fs.readFileSync(path.join(out, 'bubble-burst', 'index.html'), 'utf8');
  assert.match(bb, /location\.replace\("\/reports\/2026-09-26-arcade-bubble-burst\.html"\+'\?'\+tag\)/);
  assert.match(bb, /og:url" content="https:\/\/dailynoodle.co.uk\/bubble-burst"/);
  assert.ok(fs.existsSync(path.join(out, 'two-dots', 'index.html')));
  assert.ok(!fs.existsSync(path.join(out, 'campfire-watch')) && !fs.existsSync(path.join(out, 'held')));
});
