'use strict';
const {test,expect,H,goto,fullScreenOff}=require('./support');
const play=require('../play');
async function block(phone,mode='all'){
 await phone.ctx.addInitScript(mode=>{
  const set=Storage.prototype.setItem;
  window.saveBlock=mode;window.saveChanges=0;window.saveDialogs=0;
  Storage.prototype.setItem=function(k,v){
   if(window.saveBlock==='all'||(window.saveBlock==='streak'&&k.endsWith('-streak'))||(window.saveBlock==='cache'&&k==='dn-today-cache'))throw new DOMException('Full','QuotaExceededError');
   return set.call(this,k,v);
  };
  window.alert=window.confirm=()=>{window.saveDialogs++;};
 },mode);
}
const notice=p=>p.locator('.fin-save');

test('SAVE-NOTICE: a real result failure is quiet, retryable and clears only after every save succeeds',async({phone})=>{
 const {p}=phone;await block(phone);
 await goto(phone,'reports/2026-10-19-logic-sweep.html');
 expect(await p.evaluate(()=>dnCore.saveIssues())).toBe(0);await expect(notice(p)).toHaveCount(0);
 await p.evaluate(()=>dnCore.onSaveChange(()=>window.saveChanges++));
 await play.sweep(p,{boom:true});
 await expect(notice(p)).toBeVisible();await expect(notice(p)).toContainText('couldn’t be saved on this device');
 expect(await p.evaluate(()=>dnCore.saveIssues())).toBe(2);
 expect(await p.evaluate(()=>window.saveDialogs)).toBe(0);
 expect(await notice(p).getAttribute('aria-live')).toBeNull();
 const first=await p.evaluate(()=>dnCore.getDone('digi-sweep-v1',DN_PUZZLE.id));
 expect(first.o).toBe('loss');
 await notice(p).getByRole('button').click();await expect(notice(p)).toContainText('couldn’t be saved');
 expect(await p.evaluate(()=>window.saveChanges)).toBe(2);
 // Saving just the result must not hide a still-unsaved streak.
 await p.evaluate(()=>window.saveBlock='streak');await notice(p).getByRole('button').click();
 expect(await p.evaluate(()=>dnCore.saveIssues())).toBe(1);await expect(notice(p)).toContainText('couldn’t be saved');
 // Retrying after London midnight retains the result’s original completion day.
 await p.clock.setSystemTime(new Date('2026-10-20T12:00:00Z'));
 await p.evaluate(()=>window.saveBlock='');await notice(p).getByRole('button').click();
 await expect(notice(p)).toHaveText('Saved on this device.Try saving again');
 await expect(notice(p).getByRole('button')).toBeHidden();
 expect(await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-sweep-v1')).done[DN_PUZZLE.id])).toEqual(first);
 expect(await p.evaluate(()=>dnCore.saveIssues())).toBe(0);expect(phone.errors).toEqual([]);
});

test('SAVE-NOTICE: timed play keeps running without notices; recovery before the end stays quiet',async({phone},testInfo)=>{
 const {p}=phone;await block(phone);await goto(phone,'reports/2026-10-19-word-tangle-0013.html');
 // A failed settings write alone is not a failed game save. (WebKit has no Full screen switch: Sound is the settings write there.)
 if(!(await fullScreenOff(p,testInfo)))await p.getByRole('switch',{name:'Sound',exact:true}).click();
 expect(await p.evaluate(()=>dnCore.saveIssues())).toBe(0);
 await p.evaluate(()=>dnCore.onSaveChange(()=>window.saveChanges++));
 await p.locator('#playCard').click();await H.wait(p,4500);
 const board=await p.locator('#board').boundingBox();
 const word=await p.evaluate(()=>DN_PUZZLE.main.filter(w=>w!==DN_PUZZLE.star).sort((a,b)=>a.length-b.length)[0]);
 await p.keyboard.type(word);await p.keyboard.press('Enter');await H.wait(p,1200);
 const before=await p.locator('#board').boundingBox();await H.wait(p,10000);
 expect(await p.locator('#board').boundingBox()).toEqual(before);expect(before).toEqual(board);
 await expect(notice(p)).toHaveCount(0);
 expect(await p.evaluate(()=>({issues:dnCore.saveIssues(),changes:saveChanges,dialogs:saveDialogs}))).toEqual({issues:1,changes:1,dialogs:0});
 // A later genuine progress write recovers without asking the player to do anything.
 await p.evaluate(()=>window.saveBlock='');await H.wait(p,10000);
 expect(await p.evaluate(()=>dnCore.saveIssues())).toBe(0);
 await H.wait(p,95000);await H.wait(p,1500);
 await expect(p.locator('.fin-open')).toBeVisible();await expect(notice(p)).toBeHidden();
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-tangle-v1')));
 expect(save.done).toBeTruthy();expect(Object.values(save.days)[0].found).toContain(word);expect(phone.errors).toEqual([]);
});

test('SAVE-NOTICE: Reckon answers continue through failed saves; one result notice retries the latest state',async({phone},testInfo)=>{
 const {p}=phone;await block(phone);await p.clock.setSystemTime(new Date('2026-10-20T12:00:00Z'));
 await goto(phone,'reports/2026-10-20-quiz-reckon-0001.html');
 await fullScreenOff(p,testInfo);
 await p.getByRole('switch',{name:'Sound',exact:true}).click();
 expect(await p.evaluate(()=>dnCore.saveIssues())).toBe(0);
 await p.evaluate(()=>dnCore.onSaveChange(()=>window.saveChanges++));
 await play.reckon(p,{stop:2,wrong:[]});
 await expect(notice(p)).toHaveCount(0);await expect(p.locator('#qn')).toHaveText('3/10');
 expect(await p.evaluate(()=>({issues:dnCore.saveIssues(),changes:saveChanges,dialogs:saveDialogs}))).toEqual({issues:1,changes:1,dialogs:0});
 await play.reckon(p,{wrong:[]});await expect(notice(p)).toBeVisible();
 expect(await notice(p).count()).toBe(1);
 await p.evaluate(()=>window.saveBlock='');await notice(p).getByRole('button').click();
 await expect(notice(p)).toContainText('Saved on this device.');
 const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('digi-reckon-v1')));
 expect(save.cur).toBeNull();expect(Object.keys(save.done)).toHaveLength(1);
 expect(phone.errors).toEqual([]);
});

test('SAVE-NOTICE: failed cache writes and healthy game saves never show a warning',async({phone})=>{
 await block(phone,'cache');await goto(phone,'reports/2026-10-19-logic-sweep.html');
 await play.sweep(phone.p,{boom:true});await expect(phone.p.locator('.fin-open')).toBeVisible();
 await expect(notice(phone.p)).toBeHidden();expect(await phone.p.evaluate(()=>dnCore.saveIssues())).toBe(0);
 expect(phone.errors).toEqual([]);
});
