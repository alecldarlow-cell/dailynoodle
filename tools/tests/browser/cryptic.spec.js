'use strict';
/* Cryptic (engines/cryptic.js; reports/*-word-cryptic-NNNN.html, Lab, built 12 Nov 2026): the house start card, typing on
   the on-screen keyboard, a wrong answer that shakes and costs nothing, hint 1 underlining the definition, hint 2 naming
   the clue type, hint 3 revealing a letter, resume after a reload, the finish sheet with its "How it works", the saved
   record and streak, a reopened clue that logs no second finish, the tracker, and no fail state. */
const {test,expect,H,goto}=require('./support');
const fs=require('fs'),path=require('path'),vm=require('vm');
const C=require('../../cryptic');
const FILE='reports/2026-11-24-word-cryptic-0003.html';
const P=vm.runInNewContext('('+fs.readFileSync(path.join(H.REPO,FILE),'utf8').match(/\nwindow\.DN_PUZZLE=(\{.*\});\n/)[1]+')');
const ANS=C.unwrap(P.sol,P.id).a,ID=P.id;
const key=(p,ch)=>H.tap(p,p.locator('#kb .key[data-k="'+ch+'"]'));
async function typeWord(p,w){for(const ch of w)await key(p,ch);}
const WRONG=(ANS[0]==='Z'?'Y':'Z')+ANS.slice(1);
test('CRYPTIC-E2E-01: start card, typing, a wrong answer shakes, hints 1–3, resume after a reload, finish sheet, saves, reopen',async({phone})=>{
 const p=phone.p;await goto(phone,FILE);
 await expect(p.locator('.dn-start')).toBeVisible();
 await expect(p.locator('.dn-start-title')).toHaveText('Cryptic');
 await expect(p.locator('.dn-start-stats span')).toHaveText(['day streak','played','best time']);
 await expect(p.locator('.dn-start-links a')).toHaveAttribute('href','../how-to-play.html#cryptic');
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('.dn-name #pid')).toHaveText('Cryptic 3');
 await expect(p.locator('#clue')).toContainText(P.clue);
 await expect(p.locator('#grid .sq')).toHaveCount(ANS.length);
 await expect(p.locator('#grid .sq.cur')).toHaveCount(1);
 // a wrong answer: it shakes, nothing goes green, nothing is spent
 await typeWord(p,WRONG);await H.tap(p,p.locator('#kEnter'));
 await expect(p.locator('#grid')).toHaveClass(/shake/);
 await expect(p.locator('#msg')).toContainText('Not quite');
 await expect(p.locator('#grid .sq.won')).toHaveCount(0);
 await expect(p.locator('#hintBtn')).toHaveText('Hint 1 of 3');
 await H.tap(p,p.locator('#clearBtn'));
 expect((await p.locator('#grid .sq').allTextContents()).join('')).toBe('');
 // hint 1: the definition is underlined
 await H.tap(p,p.locator('#hintBtn'));
 const W=C.words(P.clue),def=P.clue.slice(W[P.def[0]].at,W[P.def[1]-1].end);
 await expect(p.locator('#clue .cr-d')).toHaveText(def);
 await expect(p.locator('#hintPanel')).toBeHidden();
 // hint 2: the clue type, inline, with the meter
 await H.tap(p,p.locator('#hintBtn'));
 await expect(p.locator('#hintPanel .cr-chip')).toHaveText(C.TYPES[P.kind]);
 await expect(p.locator('#hintPanel .cr-pip.on')).toHaveCount(2);
 await expect(p.locator('#hintPanel .cr-used')).toHaveText('2 hints used');
 await expect(p.locator('#hintPanel .cr-learn')).toHaveAttribute('href','../how-to-play.html#cryptic');
 await expect(p.locator('#hintBtn')).toHaveText('Reveal a letter');
 // hint 3: the first letter, locked
 await H.tap(p,p.locator('#hintBtn'));
 await expect(p.locator('#grid .sq').first()).toHaveText(ANS[0]);
 await expect(p.locator('#grid .sq').first()).toHaveClass(/lock/);
 await expect(p.locator('#grid .sq.cur')).toHaveAttribute('data-i','1');
 await key(p,ANS[1]);
 await H.wait(p,1100);
 await p.reload();await H.wait(p,1500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await expect(p.locator('#msg')).toContainText('Carrying on');
 await expect(p.locator('#grid .sq').nth(1)).toHaveText(ANS[1]);
 await expect(p.locator('#clue .cr-d')).toHaveText(def);
 await expect(p.locator('#hintPanel .cr-used')).toHaveText('3 hints used');
 await typeWord(p,ANS.slice(2));await H.tap(p,p.locator('#kEnter'));
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:5000});
 await expect(sheet.locator('.fin-kick')).toHaveText('Cryptic 3');await expect(sheet.locator('.fin-title')).toHaveText('Solved');
 const secs=await p.evaluate(()=>document.getElementById('winTime').textContent);
 await expect(sheet.locator('#rHints')).toHaveText('3 hints');
 expect(await sheet.locator('.fin-share-text').textContent()).toBe('🕵️ Cryptic #3 — '+secs+' · 3 hints');
 expect(await sheet.locator('.fin-share-url').textContent()).toBe('dailynoodle.co.uk/'+FILE);
 await expect(sheet.locator('.fin-cryptic .cr-rc-tiles b')).toHaveCount(ANS.length);
 await expect(sheet.locator('.fin-cryptic .cr-d')).toHaveText(def);
 expect((await sheet.locator('.fin-cryptic .cr-m').allTextContents()).join('').toUpperCase().replace(/[^A-Z]/g,'')).toBe(ANS);   // the hidden letters, marked
 await expect(sheet.locator('.fin-cryptic dt')).toHaveText(['Definition','Signpost','Wordplay']);
 await expect(sheet.locator('.fin-cryptic .cr-learn')).toHaveAttribute('href','../how-to-play.html#cryptic');
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-cryptic-v1')));
 expect(save.done[ID].t).toBe(secs);expect(save.done[ID].h).toBe(3);expect(save.cur).toBeUndefined();
 expect((await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-cryptic-streak')))).streak).toBe(1);
 await p.reload();await H.wait(p,1500);
 expect(await p.evaluate(()=>document.documentElement.hasAttribute('data-dn-done'))).toBe(true);
 await expect(p.locator('.fin-box.fin-open')).toBeVisible();
 expect(await p.evaluate(()=>document.getElementById('winModal').classList.contains('on'))).toBe(false);
 expect(phone.errors).toEqual([]);expect(phone.missing).toEqual([]);
});
test('CRYPTIC-E2E-02: the tracker records one start on the first key and one solved finish with the time and hints',async({browser})=>{
 const events=[];const ctx=await H.newPhone(browser,{events});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});
 await p.goto('https://dailynoodle.co.uk/'+FILE);await H.wait(p,1500);
 if(!await p.locator('script[src*="dn-track.js"]').count())await p.addScriptTag({url:'https://dailynoodle.co.uk/dn-track.js'});
 await H.wait(p,500);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await H.tap(p,p.locator('#hintBtn'));
 await typeWord(p,ANS);await H.tap(p,p.locator('#kEnter'));
 await expect(p.locator('.fin-box.fin-open')).toBeVisible({timeout:5000});
 await p.evaluate(()=>window.digi&&window.digi.flush());await H.wait(p,800);
 const puz=events.filter(e=>/^puzzle_/.test(e.ev)).map(e=>[e.ev,e.x.type,e.x.outcome,e.x.late]);
 expect(puz).toEqual([['puzzle_start','word-cryptic',undefined,undefined],['puzzle_end','word-cryptic','solved',undefined]]);
 const end=events.find(e=>e.ev==='puzzle_end').x;expect(end.hints).toBe(1);expect(Number.isFinite(end.secs)).toBe(true);
 expect(errors).toEqual([]);await ctx.close();
});
test('CRYPTIC-E2E-03: no fail state: the physical keyboard types, and revealing every letter finishes the clue',async({phone})=>{
 const p=phone.p;await goto(phone,FILE);
 await H.tap(p,p.locator('#dnPlay'));await H.wait(p,300);
 await p.keyboard.type(WRONG.toLowerCase());await p.keyboard.press('Enter');
 await expect(p.locator('#msg')).toContainText('Not quite');
 await p.keyboard.press('Backspace');
 await expect(p.locator('#grid .sq').last()).toHaveText('');
 for(let k=0;k<ANS.length+2;k++)await H.tap(p,p.locator('#hintBtn'));
 const sheet=p.locator('.fin-box.fin-open');await expect(sheet).toBeVisible({timeout:5000});
 await expect(sheet.locator('#rHints')).toHaveText((ANS.length+2)+' hints');
 expect((await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-cryptic-v1')))).done[ID].h).toBe(ANS.length+2);
 expect(phone.errors).toEqual([]);
});
