'use strict';
// BRIEFING (24 Oct 2026): toolchain/dn-briefing.js, the daily briefing's rules and page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkBriefing, renderBriefing, monday } = require('../../../toolchain/dn-briefing.js');

const item = (story, extra = {}) => Object.assign({ story, topic: 'Economy', headline: 'Something happened today',
  what: 'A thing happened. It was on the record.', why: 'It matters to households.',
  sources: [{ name: 'Example', url: 'https://example.org/x' }] }, extra);
const good = () => ({ date: '2030-01-07', items: [item('alpha-one'), item('beta-two', { topic: 'World' }), item('gamma-three')] });

test('BRIEFING-01: a plain 3-item briefing passes and renders the house page with feed metadata', () => {
  const r = checkBriefing(good());
  assert.deepEqual(r.fails, []);
  const html = renderBriefing(good());
  for (const m of ['name="dn:kind"       content="report"', 'name="dn:format"     content="briefing"', 'name="dn:topic"      content="Briefing"',
                   'class="dateline"', 'class="foot"', '<header class="mast">', 'data-story="beta-two"', 'Why it matters:'])
    assert.ok(html.includes(m), m);
  assert.match(html, /<title>The briefing: Monday 7 January — Noodle News<\/title>/);
  assert.equal((html.match(/<section class="section bi"/g) || []).length, 3);
});

test('BRIEFING-02: the rules: count, length, plain sentences, sources, topics, no question headlines', () => {
  const fails = b => checkBriefing(b).fails.join('\n');
  const b = good(); b.items = b.items.slice(0, 2);
  assert.match(fails(b), /3 to 5 items/);
  const c = good(); c.items[0].what = Array(65).fill('word').join(' ') + '.';
  assert.match(fails(c), /at most 60 words/);
  const d = good(); d.items[1].why = 'This one sentence goes on and on with far more than thirty words in it so that a reader on a phone would lose the thread long before it ever reached its end, which is exactly the point.';
  assert.match(fails(d), /sentence over 30 words/);
  const e = good(); e.items[2].sources = [{ name: 'x', url: 'http://plain' }];
  assert.match(fails(e), /https URL/);
  const f = good(); f.items[0].topic = 'Briefing';
  assert.match(fails(f), /topic must be one of/);
  const g = good(); g.items[0].headline = 'Will rates rise?';
  assert.match(fails(g), /no question/);
  const h = good(); h.items[1].story = 'alpha-one';
  assert.match(fails(h), /twice/);
  const i = good(); i.items[0].what = 'The data cannot say why this happened.';
  assert.match(fails(i), /explanation on the record/);
  const j = good(); j.items[0].deep = 'reports/1999-01-01-not-there.html';
  assert.match(fails(j), /not in the repo/);
});

test('BRIEFING-03: weeks run Monday to Sunday', () => {
  assert.equal(monday('2026-10-25'), '2026-10-19');   // Sunday
  assert.equal(monday('2026-10-26'), '2026-10-26');   // Monday
});
