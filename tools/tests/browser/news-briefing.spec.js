'use strict';
// NEWS-BRIEF (24 Oct 2026): the daily briefing leads the News page. The newest briefing dated today or
// yesterday (London) shows its stories as links into it; older briefings sit in the list at their own date
// like any piece, and the Briefing chip lists briefings only. feed.json is served from this spec.
const { test, expect, H } = require('./support');
const SITE = 'https://dailynoodle.co.uk';
const brief = (date, n) => ({ path: `reports/${date}-briefing.html`, kind: 'report', topic: 'Briefing', format: 'briefing',
  headline: 'The briefing: ' + date, standfirst: 'x', date, read: '~2 min',
  stories: Array.from({ length: n }, (_, i) => ({ id: 'story-' + i, h: 'Story ' + i + ' happened', t: i ? 'World' : 'Economy' })) });
const piece = (date, slug) => ({ path: `reports/${date}-${slug}.html`, kind: 'report', topic: 'Economy', headline: 'Piece ' + slug, standfirst: 's', date, read: '~5 min', stat: '4', statUnit: '%', statLabel: 'rise' });

async function news(browser, items, time) {
  const ctx = await H.newPhone(browser);
  await ctx.route(SITE + '/feed.json*', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ built: '2026-10-25T03:00:00Z', today: time.slice(0, 10), count: items.length, items }) }));
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date(time) });
  await p.goto(SITE + '/index.html'); await H.wait(p, 800);
  return { ctx, p };
}

test.describe('NEWS-BRIEF', () => {
  test('NEWS-BRIEF-01: today\'s briefing leads News; the list holds pieces and older briefings; the Briefing chip lists briefings', async ({ browser }) => {
    const { ctx, p } = await news(browser, [brief('2026-10-25', 4), piece('2026-10-24', 'a'), brief('2026-10-24', 3), piece('2026-10-23', 'b')], '2026-10-25T08:00:00+01:00');
    try {
      await expect(p.locator('#feed > li.brief')).toHaveCount(1);
      await expect(p.locator('.brief-k')).toHaveText('Today’s briefing');
      const links = await p.locator('.brief-list a').evaluateAll(as => as.map(a => a.getAttribute('href')));
      expect(links).toEqual([0, 1, 2, 3].map(i => 'reports/2026-10-25-briefing.html#story-' + i));
      await expect(p.locator('#feed a.card')).toHaveCount(3);   // two pieces and yesterday's briefing; today's is the lead block
      await expect(p.locator('#feed a.card .glyph', { hasText: 'Brief' })).toHaveCount(1);
      await H.tap(p, p.locator('.chip[data-topic="Briefing"]'));
      await expect(p.locator('#feed > li.brief')).toHaveCount(0);
      await expect(p.locator('#feed a.card')).toHaveCount(2);   // both briefings, none leading
      await expect(p.locator('#feed a.card .glyph').first()).toHaveText('Brief');
      expect(p.errs).toEqual([]);
    } finally { await ctx.close(); }
  });
  test('NEWS-BRIEF-02: yesterday\'s briefing is labelled so; an older one does not lead', async ({ browser }) => {
    let { ctx, p } = await news(browser, [piece('2026-10-25', 'a'), brief('2026-10-24', 3)], '2026-10-25T08:00:00+01:00');
    try {
      await expect(p.locator('.brief-k')).toHaveText('Yesterday’s briefing');
      await expect(p.locator('#feed a.card')).toHaveCount(1);   // the piece; the briefing is the lead block
    } finally { await ctx.close(); }
    ({ ctx, p } = await news(browser, [piece('2026-10-25', 'a'), brief('2026-10-23', 3)], '2026-10-25T08:00:00+01:00'));
    try {
      await expect(p.locator('#feed > li.brief')).toHaveCount(0);
      await expect(p.locator('#feed a.card')).toHaveCount(2);   // the piece and the older briefing, as a card
      expect(p.errs).toEqual([]);
    } finally { await ctx.close(); }
  });
});
