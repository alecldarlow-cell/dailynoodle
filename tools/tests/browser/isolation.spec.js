'use strict';
// Test browsers must never reach the live database (20 Oct 2026).
// From 19 to 20 Oct every CI run sent page_exit events from played-through test
// puzzles to the real Supabase: the tracker's last keepalive request, made as a
// test closed its page, escaped the routes that answer Supabase calls. Two locks
// now (tools/tests/harness.js): Chromium can't resolve *.supabase.co, and pages
// from newPhone() address Supabase as *.supabase.invalid, which no browser can
// resolve. The morning site check also watches the live data for exit-only bursts.
const { test, expect } = require('../browser/support');

test('ISOLATION-01: pages from the harness address Supabase only by a name that cannot resolve', async ({ phone }) => {
  const seen = [];
  phone.ctx.on('request', r => { const u = new URL(r.url()); if (/supabase/.test(u.hostname)) seen.push(u.hostname); });
  await phone.p.goto('https://dailynoodle.co.uk/puzzles.html');
  await phone.p.waitForTimeout(800);
  // What the tracker and the board do: fetch, a Request object and a beacon.
  await phone.p.evaluate(async () => {
    const u = 'https://gnehttjheoyutrfsvslq.supabase.co/rest/v1/rpc/log_events';
    await fetch(u, { method: 'POST', keepalive: true, body: '{"batch":[]}' }).catch(() => {});
    await fetch(new Request(u, { method: 'POST', body: '{}' })).catch(() => {});
    navigator.sendBeacon && navigator.sendBeacon(u, '{}');
  });
  await phone.p.waitForTimeout(500);
  expect(seen.length, 'Supabase requests made by the page').toBeGreaterThanOrEqual(3);
  expect(seen.filter(h => !h.endsWith('.supabase.invalid')), 'requests to a live Supabase name').toEqual([]);
});

test('ISOLATION-02: every Chromium the tests launch refuses the live database', async () => {
  const cfg = require('../../../playwright.config.js');
  expect(JSON.stringify(cfg.use.launchOptions.args)).toContain('MAP *.supabase.co ~NOTFOUND');
  expect(require('fs').readFileSync(require.resolve('../harness'), 'utf8')).toMatch(/o\.args\.push\(NO_LIVE_DB\)/);
});
