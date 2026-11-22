'use strict';
// LANDING: dailynoodle.co.uk is puzzles only from 22 Nov 2026 (Alec's call). The bare address "/" IS the
// Puzzles front page (index.html, a generated copy of puzzles.html, tools/sync-home.js), with no redirect,
// so a first visit, a search engine and the installed app all land on it. puzzles.html keeps working
// (installed apps start there). News and Games moved to news. and games.dailynoodle.co.uk, and their old
// addresses forward (tools/moved-pages.js). See SITE.md, Sections.
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
  test('LANDING-01: the bare address is the Puzzles front page, for a first visit, with the query and fragment kept', async ({ browser }) => {
    const r = await open(browser, '/');
    expect([r.url, r.section]).toEqual([SITE + '/', 'puzzles']);
    const q = await open(browser, '/?via=reddit#top');
    expect([q.url, q.section]).toEqual([SITE + '/?via=reddit#top', 'puzzles']);
    const n = await open(browser, '/index.html');
    expect([n.url, n.section]).toEqual([SITE + '/index.html', 'puzzles']);   // News moved to news.dailynoodle.co.uk
    expect([...r.errs, ...q.errs, ...n.errs]).toEqual([]);
  });
  test('LANDING-02: a browser that has played lands on Puzzles too', async ({ browser }) => {
    const r = await open(browser, '/?via=share#x', { saves: { 'digi-mini-v1': JSON.stringify({ v: 1, done: {} }) } });
    expect([r.url, r.section]).toEqual([SITE + '/?via=share#x', 'puzzles']);
    const p = await open(browser, '/puzzles.html', { saves: { 'noodle-board-v1': '{"pid":"x"}' } });
    expect([p.url, p.section]).toEqual([SITE + '/puzzles.html', 'puzzles']);
    expect([...r.errs, ...p.errs]).toEqual([]);
  });
  test('LANDING-03: the installed app opens Puzzles; the front pages link to no News or Games', async ({ browser }) => {
    const a = await open(browser, '/', { app: true });
    expect([a.url, a.section]).toEqual([SITE + '/', 'puzzles']);
    expect(a.errs).toEqual([]);
    const ctx = await H.newPhone(browser), p = await ctx.newPage();
    for (const f of ['/', '/puzzles.html', '/lab.html', '/about.html', '/how-to-play.html', '/privacy.html']) {
      await p.goto(SITE + f); await H.wait(p, 300);
      expect(await p.locator('a[href$="games.html"], a.sec.news, a.sec.games, a[href*="news.dailynoodle"], a[href*="games.dailynoodle"]').count(), f).toBe(0);
    }
    await ctx.close();
  });
});
