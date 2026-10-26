'use strict';
// PLAYED-MARKS: a finished Borders card shows the round's points, then the right
// answers, in place of its duration (SITE.md, Played marks on puzzle cards). Borders
// scores in points since 26 Oct 2026; the card said "Scored 7/10" before that.
const {test,expect,goto}=require('./support');
const feed=require('../../../feed.json');

const borders=(feed.items||feed).filter(it=>it&&it.type==='borders'&&it.id);

for(const [name,rec,want] of [
 ['a round with points shows them, then the right answers',{c:7,p:650},'650 points · 7/10'],
 ['a save with no points keeps the right answers',{c:7},'Scored 7/10'],
])
test('PLAYED-MARKS: Borders, '+name,async({phone})=>{
 // GIVEN a Borders save that has finished every Borders day in the feed
 expect(borders.length,'Borders days in feed.json').toBeGreaterThan(0);
 const done=Object.fromEntries(borders.map(it=>[it.id,Object.assign({secs:90,ans:[]},rec)]));
 await phone.ctx.addInitScript(s=>{try{localStorage.setItem('digi-borders-v1',s);}catch(e){}},JSON.stringify({v:1,done}));
 // WHEN the Puzzles front page draws its cards
 await goto(phone,'puzzles.html');
 // THEN each Borders card's result reads in points
 const results=phone.p.locator('li.puzzle-card.is-played a.card[href*="-geo-borders-"] .card-result.done');
 await expect(results.first()).toHaveText(want);
 expect(new Set(await results.allTextContents())).toEqual(new Set([want]));
});
