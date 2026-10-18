/* Drivers that play each puzzle type to the end through its real controls (jittered taps, typing). */
'use strict';
const { tap, wait } = require('./harness');

const puzzle = p => p.evaluate(() => window.DN_PUZZLE);
/* the house start card (Mini, Doku, Sweep, Path, Link): tap Play if it is up */
async function start(p) { const b = p.locator('#dnPlay'); if (await b.count() && await b.isVisible()) { await tap(p, b); await wait(p, 500); } }
const boxOn = p => p.evaluate(() => { const b = document.getElementById('winModal') || document.getElementById('modal'); return !!b && b.classList.contains('on'); });

/* Link: group 1, then `wrong` distinct wrong guesses, then the rest (wrong = 4 loses) */
async function link(p, { wrong = 1 } = {}) {
  await start(p);
  const P = await puzzle(p), G = P.groups.map(g => g.members);
  const pick = async ws => {
    if (await p.locator('#board .tile.sel').count()) { await tap(p, p.locator('#clear')); await wait(p, 300); }
    for (const w of ws) { await tap(p, p.locator(`#board .tile[data-w="${w}"]`)); await wait(p, 300); }
    await tap(p, p.locator('#submit')); await wait(p, 1500); await p.waitForTimeout(1500); await wait(p, 400);   // the settle runs on real time
  };
  const wrongs = [[G[1][0], G[1][1], G[1][2], G[2][0]], [G[1][0], G[1][1], G[2][0], G[2][1]], [G[1][0], G[2][0], G[3][0], G[3][1]], [G[2][1], G[2][2], G[3][0], G[1][3]]];
  await pick(G[0]);
  for (let i = 0; i < wrong; i++) await pick(wrongs[i]);
  if (wrong < 4) { await pick(G[1]); await pick(G[2]); await pick(G[3]); }
  await wait(p, 4000); await p.waitForTimeout(1500); await wait(p, 2000);
}
/* Sweep: open the start cell, then dig every safe cell (or hit a mine) */
async function sweep(p, { boom = false } = {}) {
  await start(p);
  const P = await puzzle(p), mines = new Set(P.mines.map(([r, c]) => (r - 1) * 6 + (c - 1)));
  const cells = p.locator('#grid .cell');
  await tap(p, cells.nth((P.start[0] - 1) * 6 + (P.start[1] - 1))); await wait(p, 1500);
  if (boom) { await tap(p, cells.nth([...mines][0])); await wait(p, 3000); return; }
  for (let i = 0; i < 36; i++) {
    if (mines.has(i) || await boxOn(p)) continue;
    const open = await cells.nth(i).evaluate(e => e.textContent.trim() !== '' || /\b(open|rev|revealed|dug|shown|safe)\b/.test(e.className));
    if (!open) { await tap(p, cells.nth(i)); await wait(p, 900); }
  }
  await wait(p, 4000);
}
/* Path: tap 1 to 35 in order (36 closes the thread) */
async function path(p) {
  await start(p);
  const P = await puzzle(p), at = {};
  P.solution.forEach((row, r) => row.forEach((v, c) => at[v] = [r, c]));
  for (let k = 1; k <= 35 && !(await boxOn(p)); k++) { const [r, c] = at[k]; await tap(p, p.locator('#grid .cell').nth(r * 6 + c)); await wait(p, 700); }
  await wait(p, 3000);
}
/* Mini and Doku: tap each open cell and type its letter */
async function grid(p) {
  await start(p);
  const P = await puzzle(p), locked = new Set((P.locked || []).map(([r, c]) => `${r - 1},${c - 1}`));
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if (P.grid[r][c] === '#' || locked.has(`${r},${c}`)) continue;
    await tap(p, p.locator('#grid .cell').nth(r * 5 + c)); await wait(p, 200);
    await p.keyboard.press(P.grid[r][c].toLowerCase()); await wait(p, 500);
  }
  await wait(p, 4000);
}
/* Tangle: Play, type `n` of the shortest common words, let the clock run out */
async function tangle(p, { n = 26 } = {}) {
  const P = await puzzle(p);
  await tap(p, p.locator('#playCard')); await wait(p, 4500);
  const words = P.main.filter(w => w !== P.star).sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, n);
  for (const w of words) { for (const ch of w) await p.keyboard.press(ch); await p.keyboard.press('Enter'); await wait(p, 1200); }
  await wait(p, 95000); await wait(p, 1500);
  return words;
}
/* Borders: Play, then answer the ten; `wrong` lists the questions to miss, `hint` the ones to use the map on */
async function borders(p, { wrong = [3, 6, 8], hint = [5] } = {}) {
  const P = await puzzle(p);
  await tap(p, p.locator('#playCard')); await wait(p, 1500);
  for (let i = 0; i < P.qs.length; i++) {
    const q = P.qs[i];
    if (hint.includes(i)) { await tap(p, p.locator('#hintBtn')); await wait(p, 800); }
    const names = await p.locator('#opts .opt').allTextContents();
    const k = wrong.includes(i) ? names.findIndex(n => n !== q.n) : names.indexOf(q.n);
    await tap(p, p.locator('#opts .opt').nth(k)); await wait(p, 1200);
    if (await p.locator('#nextBtn').isVisible()) { await tap(p, p.locator('#nextBtn')); await wait(p, 1000); }
  }
  await wait(p, 3000);
}

module.exports = { start, puzzle, boxOn, link, sweep, path, grid, tangle, borders };
