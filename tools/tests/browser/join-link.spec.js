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
  ]) {
    test(`WHEN it opens in a browser with ${given} THEN it lands on ${want}`, async ({ phone }) => {
      const { p } = phone;
      await p.goto(SITE + 'join.html' + (c === null ? '' : '?c=' + encodeURIComponent(c)));
      await p.waitForURL(u => u.pathname === '/board.html');
      expect(p.url()).toBe(SITE + want);
    });
  }
});
