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
/* Sweep Hint (19 Oct 2026): read the board as a player sees it, then check Hint's line against it.
   hintState runs in the page; hintCheck is plain Node, so the same check also runs on simulated boards. */
const sweepHintState = p => p.evaluate(() => {
  const cells = [...document.querySelectorAll('#grid .cell')];
  return { line: (document.getElementById('msg').textContent || '').trim(), left: +document.getElementById('mleft').textContent,
    num: cells.map(c => c.classList.contains('open') ? +(c.querySelector('.val').textContent || 0) : null),
    flag: cells.map(c => c.classList.contains('flag')), why: cells.flatMap((c, i) => c.classList.contains('why') ? [i] : []),
    pick: cells.findIndex(c => c.classList.contains('hint')), marked: cells.filter(c => c.classList.contains('hint')).length };
});
/* st: {line, left (mines not yet flagged), num[36] (number on an open square, else null), flag[36], why[] (ringed squares), pick}.
   Returns {ok, verdict:'safe'|'mine', kind, err}. Every claim in the line is re-derived from st, not taken on trust. */
function sweepHintCheck(st) {
  const W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'], w = x => W.indexOf(String(x).toLowerCase());
  const nb = i => { const r = Math.floor(i / 6), c = i % 6, o = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (!a && !b) continue; const y = r + a, x = c + b; if (y >= 0 && y < 6 && x >= 0 && x < 6) o.push(y * 6 + x); } return o; };
  const hidden = i => st.num[i] === null && !st.flag[i];
  const hidOf = i => nb(i).filter(hidden), flOf = i => nb(i).filter(j => st.flag[j]).length, need = i => st.num[i] - flOf(i);
  const allHid = [...Array(36).keys()].filter(hidden);
  const L = st.line, P = st.pick, fail = err => ({ ok: false, err, line: L });
  if (P < 0 || !hidden(P)) return fail('no hidden square is marked');
  let m;
  const one = () => { if (st.why.length !== 1) return null; const a = st.why[0]; return st.num[a] ? a : null; };
  if ((m = L.match(/^This (\d) already touches (?:its flagged mine|its (\w+) flagged mines), so its other hidden (square is|squares are) safe\.$/))) {
    const a = one(); if (a === null || st.num[a] !== +m[1]) return fail('ringed number');
    const H = hidOf(a).length, ok = flOf(a) === +m[1] && (m[2] ? w(m[2]) === +m[1] : +m[1] === 1) && (m[3] === 'square is' ? H === 1 : H > 1) && hidOf(a).includes(P);
    return ok ? { ok, verdict: 'safe', kind: 'single' } : fail('claim');
  }
  if ((m = L.match(/^This (\d) has only one hidden square next to it, so that square is a mine\.$/))) {
    const a = one(); return a !== null && st.num[a] === 1 && +m[1] === 1 && flOf(a) === 0 && hidOf(a).length === 1 && hidOf(a)[0] === P ? { ok: true, verdict: 'mine', kind: 'single' } : fail('claim');
  }
  if ((m = L.match(/^This (\d) has exactly (\w+) hidden squares left, so (both|all (\w+)) are mines\.$/))) {
    const a = one(), H = w(m[2]); return a !== null && st.num[a] === +m[1] && flOf(a) === 0 && hidOf(a).length === H && H === +m[1] && (m[3] === 'both' ? H === 2 : w(m[4]) === H) && hidOf(a).includes(P) ? { ok: true, verdict: 'mine', kind: 'single' } : fail('claim');
  }
  if ((m = L.match(/^This (\d) already has (\w+) flagged mines? and only (\w+) hidden squares? left, so (that square is a mine|both are mines|all (\w+) are mines)\.$/))) {
    const a = one(), F = w(m[2]), H = w(m[3]);
    return a !== null && st.num[a] === +m[1] && flOf(a) === F && F > 0 && hidOf(a).length === H && +m[1] - F === H && hidOf(a).includes(P) ? { ok: true, verdict: 'mine', kind: 'single' } : fail('claim');
  }
  if ((m = L.match(/^All (\w+) mines are flagged, so every other square is safe\.$/))) {
    return st.why.length === 0 && st.left === 0 ? { ok: true, verdict: 'safe', kind: 'count' } : fail('claim');
  }
  if ((m = L.match(/^Only (\w+) mines? (?:is|are) left and only (\w+) squares? (?:is|are) still hidden, so (it's a mine|both are mines|they're all mines)\.$/))) {
    return st.why.length === 0 && w(m[1]) === st.left && w(m[2]) === allHid.length && st.left === allHid.length ? { ok: true, verdict: 'mine', kind: 'count' } : fail('claim');
  }
  if ((m = L.match(/^Only (\w+) mines? (?:is|are) left, and this (\d) (?:still )?needs (?:it|both|all \w+), so every hidden square not touching it is safe\.$/))) {
    const a = one(); return a !== null && st.num[a] === +m[2] && w(m[1]) === st.left && need(a) === st.left && !nb(a).includes(P) ? { ok: true, verdict: 'safe', kind: 'count-pair' } : fail('claim');
  }
  if ((m = L.match(/^(\w+) mines? (?:is|are) left and this (\d) (?:still )?needs (\w+), so (?:the one hidden square not touching it is a mine|the (\w+) hidden squares not touching it are (?:both|all) mines)\.$/))) {
    const a = one(), D = allHid.filter(j => !nb(a === null ? 0 : a).includes(j)), d = m[4] ? w(m[4]) : 1;
    return a !== null && st.num[a] === +m[2] && w(m[1]) === st.left && w(m[3]) === need(a) && D.length === d && st.left - need(a) === d && D.includes(P) ? { ok: true, verdict: 'mine', kind: 'count-pair' } : fail('claim');
  }
  /* two numbers: A's hidden squares all touch B; D = B's other hidden squares */
  const pair = (aDigit, bDigit) => {
    if (st.why.length !== 2) return null;
    const [x, y] = st.why, sub = (u, v) => hidOf(u).every(j => hidOf(v).includes(j)) && hidOf(u).length < hidOf(v).length;
    const A = sub(x, y) ? x : sub(y, x) ? y : null; if (A === null) return null;
    const B = A === x ? y : x; if ((aDigit && st.num[A] !== aDigit) || (bDigit && st.num[B] !== bDigit)) return null;
    return { A, B, s: hidOf(A).length, D: hidOf(B).filter(j => !hidOf(A).includes(j)) };
  };
  if ((m = L.match(/^This (\d) and this (\d) share (\w+) hidden squares, and the (\d) touches no others, so its (?:last )?(?:mine is|(\w+) mines are) there\. That's all the (\d) (?:still )?needs, so its other hidden (square is|squares are) safe\.$/))) {
    const q = pair(+m[2], +m[1]); if (!q) return fail('ringed pair');
    return +m[4] === +m[2] && +m[6] === +m[1] && q.s === w(m[3]) && need(q.A) === (m[5] ? w(m[5]) : 1) && need(q.A) === need(q.B) && (m[7] === 'square is' ? q.D.length === 1 : q.D.length > 1) && q.D.includes(P) ? { ok: true, verdict: 'safe', kind: 'pair' } : fail('claim');
  }
  if ((m = L.match(/^This (\d) and this (\d) share (\w+) hidden squares\. The (\d) (?:still )?needs (?:one more mine|(\w+) more mines) than the (\d), and (?:it can only be in its other square|they can only be in its other (\w+) squares)\.$/))) {
    const q = pair(+m[2], +m[1]); if (!q) return fail('ringed pair');
    const k = m[5] ? w(m[5]) : 1, d = m[7] ? w(m[7]) : 1;
    return +m[4] === +m[1] && +m[6] === +m[2] && q.s === w(m[3]) && need(q.B) - need(q.A) === k && q.D.length === d && k === d && q.D.includes(P) ? { ok: true, verdict: 'mine', kind: 'pair' } : fail('claim');
  }
  if ((m = L.match(/^These two (\d)s share (\w+) hidden squares(?:, and one of them touches no others, so its (?:last )?(?:mine is|(\w+) mines are) there\. That's all the other \d (?:still )?needs, so its other hidden squares? (?:is|are) safe|\. One of them (?:still )?needs (?:one more mine|(\w+) more mines) than the other, and (?:it can only be in its other square|they can only be in its other (\w+) squares))\.$/))) {
    const q = pair(+m[1], +m[1]); if (!q || q.s !== w(m[2])) return fail('ringed pair');
    if (/safe\.$/.test(L)) return need(q.A) === need(q.B) && need(q.A) === (m[3] ? w(m[3]) : 1) && q.D.includes(P) ? { ok: true, verdict: 'safe', kind: 'pair' } : fail('claim');
    const k = m[4] ? w(m[4]) : 1, d = m[5] ? w(m[5]) : 1;
    return need(q.B) - need(q.A) === k && q.D.length === d && k === d && q.D.includes(P) ? { ok: true, verdict: 'mine', kind: 'pair' } : fail('claim');
  }
  return fail('line matches no known deduction');
}
/* Solve a Sweep by Hint alone: press Hint, check its line, dig or flag the square it marks; returns every check */
async function sweepByHint(p, { onHint, afterMove } = {}) {
  await start(p);
  const P = await puzzle(p), mines = new Set(P.mines.map(([r, c]) => (r - 1) * 6 + (c - 1))), cells = p.locator('#grid .cell');
  await tap(p, cells.nth((P.start[0] - 1) * 6 + (P.start[1] - 1))); await wait(p, 1200);
  const seen = [];
  for (let k = 0; k < 40 && !(await boxOn(p)); k++) {
    if (await p.evaluate(() => document.querySelectorAll('#grid .cell.hid').length === 0)) break;
    await tap(p, p.locator('#hint')); await wait(p, 300);
    const st = await sweepHintState(p), r = sweepHintCheck(st);
    seen.push({ ...r, line: st.line, pick: st.pick, marked: st.marked, truth: mines.has(st.pick) ? 'mine' : 'safe' });
    if (onHint) await onHint(st, r);
    if (!r.ok || st.pick < 0) break;
    if (mines.has(st.pick)) { await tap(p, p.locator('#modeFlag')); await tap(p, cells.nth(st.pick)); await tap(p, p.locator('#modeDig')); }
    else await tap(p, cells.nth(st.pick));
    await wait(p, 600);
    if (afterMove) await afterMove(st, r);
  }
  await wait(p, 4000);
  return seen;
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

module.exports = { start, puzzle, boxOn, link, sweep, sweepHintState, sweepHintCheck, sweepByHint, path, grid, tangle, borders };
