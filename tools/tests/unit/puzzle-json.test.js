'use strict';
// Puzzle data for the app (tools/puzzle-json.js, app plan WP2).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { parseDnPuzzle, write } = require('../../puzzle-json');

const REPORTS = path.join(__dirname, '../../../reports');
const FIXTURES = {
  mini: '2026-10-18-crossword-mini-0099.html', doku: '2026-10-18-logic-doku-0097.html',
  sweep: '2026-10-18-logic-sweep.html', path: '2026-10-18-logic-path-0092.html',
  link: '2026-10-18-word-link-0071.html', tangle: '2026-10-18-word-tangle-0012.html',
  borders: '2026-10-18-geo-borders-0014.html', reckon: '2026-10-20-quiz-reckon-0001.html',
};

// An independent reading of the page's script: run it as the browser would, with a window.
function asBrowser(html) {
  const code = html.match(/<script\b[^>]*>([^<]*window\.DN_PUZZLE\s*=[\s\S]*?)<\/script>/)[1];
  const window = {};
  new Function('window', code)(window);
  return window.DN_PUZZLE;
}

test('puzzle json: every type parses to exactly the object the page gives the player', () => {
  for (const [type, file] of Object.entries(FIXTURES)) {
    const html = fs.readFileSync(path.join(REPORTS, file), 'utf8');
    const data = parseDnPuzzle(html, file);
    assert.deepStrictEqual(data, JSON.parse(JSON.stringify(asBrowser(html))), type);
    assert.match(data.id, /^DP·[A-Z]+·/, type);
  }
});

test('puzzle json: a self-contained page has no data object', () => {
  const html = fs.readFileSync(path.join(REPORTS, '2026-07-18-logic-sweep.html'), 'utf8');
  assert.strictEqual(parseDnPuzzle(html), null);
});

test('puzzle json: anything but a plain-data literal is refused', () => {
  const page = js => `<html><script>${js}</script></html>`;
  assert.throws(() => parseDnPuzzle(page('window.DN_PUZZLE=load();'), 'x'), /single object literal/);
  assert.throws(() => parseDnPuzzle(page('window.DN_PUZZLE={a:1};alert(1)'), 'x'), /single object literal/);
  assert.throws(() => parseDnPuzzle(page('window.DN_PUZZLE={f:function(){}}'), 'x'), /plain data/);
  assert.throws(() => parseDnPuzzle(page('window.DN_PUZZLE={d:new Date(0)}'), 'x'), /plain data/);
  assert.throws(() => parseDnPuzzle(page('window.DN_PUZZLE={a:(()=>{while(1);})()}'), 'x'), /timed out/i);
  assert.deepStrictEqual(parseDnPuzzle(page('/* data */\n// comment\nwindow.DN_PUZZLE={a:[1,"b"],/*x*/c:{d:null}};'), 'x'), { a: [1, 'b'], c: { d: null } });
});

test('puzzle json: write() covers released puzzle cards only and lists every card in feed-lite.json', () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'pj-'));
  fs.mkdirSync(path.join(site, 'reports'));
  const thin = FIXTURES.sweep, legacy = '2026-07-18-logic-sweep.html';
  for (const f of [thin, legacy]) fs.copyFileSync(path.join(REPORTS, f), path.join(site, 'reports', f));
  const feed = { built: 'b', today: '2026-10-24', items: [
    { path: 'reports/' + thin, kind: 'puzzle', type: 'sweep', id: 'DP·SWEEP·2026-10-18', date: '2026-10-18', headline: 'Sweep 94', standfirst: 's', read: '~2 min', mask: '' },
    { path: 'reports/' + legacy, kind: 'puzzle', type: 'sweep', id: '', date: '2026-07-18', headline: 'Sweep 1' },
    { path: 'reports/2026-12-01-logic-sweep.html', kind: 'puzzle', type: 'sweep', date: '2026-12-01', headline: 'Held' },
    { path: 'reports/2026-10-18-news.html', kind: 'report', headline: 'News' },
  ] };
  fs.writeFileSync(path.join(site, 'feed.json'), JSON.stringify(feed));
  assert.strictEqual(write(site), 1);
  const out = JSON.parse(fs.readFileSync(path.join(site, 'reports', thin.replace('.html', '.json')), 'utf8'));
  assert.deepStrictEqual(Object.keys(out), ['id', 'type', 'date', 'band', 'n', 'name', 'headline', 'standfirst', 'read', 'path', 'data']);
  assert.strictEqual(out.id, 'DP·SWEEP·2026-10-18');
  assert.strictEqual(out.n, 94, 'Sweep numbers come from the headline');
  assert.deepStrictEqual(out.data, parseDnPuzzle(fs.readFileSync(path.join(REPORTS, thin), 'utf8')));
  assert.ok(!fs.existsSync(path.join(site, 'reports', legacy.replace('.html', '.json'))));
  const lite = JSON.parse(fs.readFileSync(path.join(site, 'feed-lite.json'), 'utf8'));
  assert.strictEqual(lite.today, '2026-10-24');
  assert.deepStrictEqual(lite.items.map(i => [i.path, i.json]), [
    ['reports/' + thin, 'reports/' + thin.replace('.html', '.json')],
    ['reports/' + legacy, null],
  ]);
  assert.strictEqual(lite.count, 2);
});
