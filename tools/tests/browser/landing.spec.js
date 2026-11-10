'use strict';
// LANDING: the bare address "/" opens Puzzles for everyone (10 Nov 2026, Alec's call in the distribution
// review), keeping the query and fragment. Before that only the installed app and browsers that had played
// were sent on (24 Oct 2026) and a first visit stayed on News. /index.html (the News tab and the pieces'
// "← News") never moves. See SITE.md, Sections.
const { test, expect, H } = require('./support');
const SITE = 'https://dailynoodle.co.uk';

async function open(browser, url, { saves = {}, app = false } = {}) {
  const ctx = await H.newPhone(browser);
  await ctx.addInitScript(([s, a]) => {
    try { if (!sessionStorage.getItem('__seeded')) { for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('__seeded', '1'); } } catch (e) {}
    if (a) { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q); }
  }, [saves, app]);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(SITE + url); await H.wait(p, 700);
  const out = { url: p.url(), section: await p.evaluate(() => document.documentElement.getAttribute('data-section')), errs: p.errs };
  await ctx.close();
  return out;
}

test.describe('LANDING', () => {
  test('LANDING-01: a first visit to the bare address opens Puzzles, keeping the query and fragment', async ({ browser }) => {
    const r = await open(browser, '/');
    expect([r.url, r.section]).toEqual([SITE + '/puzzles.html', 'puzzles']);
    const q = await open(browser, '/?via=reddit#top');
    expect(q.url).toBe(SITE + '/puzzles.html?via=reddit#top');
    const n = await open(browser, '/index.html');
    expect([n.url, n.section]).toEqual([SITE + '/index.html', 'news']);   // the News tab's own address never moves
    expect([...r.errs, ...q.errs, ...n.errs]).toEqual([]);
  });
  test('LANDING-02: a browser that has played opens Puzzles, keeping the query and fragment', async ({ browser }) => {
    const r = await open(browser, '/?via=share#x', { saves: { 'digi-mini-v1': JSON.stringify({ v: 1, done: {} }) } });
    expect([r.url, r.section]).toEqual([SITE + '/puzzles.html?via=share#x', 'puzzles']);
    const g = await open(browser, '/', { saves: { 'noodle-board-v1': '{"pid":"x"}' } });
    expect(g.url).toBe(SITE + '/puzzles.html');
    expect([...r.errs, ...g.errs]).toEqual([]);
  });
  test('LANDING-03: the installed app opens Puzzles; /index.html always stays on News', async ({ browser }) => {
    const a = await open(browser, '/', { app: true });
    expect(a.url).toBe(SITE + '/puzzles.html');
    const n = await open(browser, '/index.html', { app: true, saves: { 'digi-doku-v1': '{"v":1}' } });
    expect([n.url, n.section]).toEqual([SITE + '/index.html', 'news']);
    expect([...a.errs, ...n.errs]).toEqual([]);
  });
});
