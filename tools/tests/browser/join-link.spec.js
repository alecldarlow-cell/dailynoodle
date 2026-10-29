'use strict';
// JOIN-LINK: join.html?c=CODE, the invite link the Daily Noodle app opens itself on
// Android (SITE.md › App links). In a browser it must go straight on to the league's
// invite on board.html, exactly as the old board.html?join= link, and never break.
// Only the address is checked: the board page itself is board.spec.js's job.
const { test, expect } = require('./support');

const SITE = 'https://dailynoodle.co.uk/';

test.describe('JOIN-LINK-01: GIVEN an invite link to join.html', () => {
  for (const [given, c, want] of [
    ['a league code', 'ABCD2345', 'board.html?join=ABCD2345&v=2'],
    ['a code typed in lower case with a dash', 'abcd-2345', 'board.html?join=ABCD2345&v=2'],
    ['no code', null, 'board.html'],
    ['a code too short to be one', 'AB', 'board.html'],
    // leaderboard shares from the app carry the puzzle and day (29 Oct 2026, AF-010)
    ['a code, a puzzle and a day', 'ABCD2345&p=mini&d=2026-10-28', 'board.html?join=ABCD2345&v=2&p=mini&d=2026-10-28'],
    ['a code and All puzzles', 'ABCD2345&p=all&d=2026-10-28', 'board.html?join=ABCD2345&v=2&p=all&d=2026-10-28'],
    ['a code with a bad puzzle and day', 'ABCD2345&p=x<y&d=tomorrow', 'board.html?join=ABCD2345&v=2'],
  ]) {
    test(`WHEN it opens in a browser with ${given} THEN it lands on ${want}`, async ({ phone }) => {
      const { p } = phone;
      const [code, ...rest] = (c || '').split('&');
      await p.goto(SITE + 'join.html' + (c === null ? '' : '?c=' + encodeURIComponent(code) + rest.map(x => '&' + x).join('')));
      await p.waitForURL(u => u.pathname === '/board.html');
      expect(p.url()).toBe(SITE + want);
    });
  }
});
