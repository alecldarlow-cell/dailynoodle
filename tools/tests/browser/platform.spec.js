'use strict';
const fs=require('node:fs');
const {test,expect,H,goto}=require('./support');
for(const page of ['index.html','puzzles.html','games.html'])test('A11Y: named controls, links and images on '+page,async({phone})=>{
 await goto(phone,page);await phone.p.addScriptTag({content:fs.readFileSync(require.resolve('axe-core'),'utf8')});
 const result=await phone.p.evaluate(async()=>{
  const r=await axe.run(document,{runOnly:{type:'rule',values:['button-name','link-name','image-alt','label','aria-valid-attr','aria-valid-attr-value','aria-required-attr','aria-dialog-name']}});
  return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));
 });expect(result).toEqual([]);expect(phone.errors).toEqual([]);
});
test('TRACK-01: automation suppression is exercised separately from reader contracts',async({phone})=>{
 const calls=[];await phone.ctx.route('**/rest/v1/rpc/log_events',r=>{calls.push(r.request().postData());return r.fulfill({status:204,body:''});});
 await phone.ctx.addInitScript(()=>Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>true,configurable:true}));
 await goto(phone,'puzzles.html');await phone.p.evaluate(()=>{window.digi?.track('chip_click',{topic:'Logic'});dispatchEvent(new Event('pagehide'));});await H.wait(phone.p,6000);
 expect(calls).toEqual([]);
});
test('SAVE: malformed progress falls back to a playable Path',async({phone})=>{
 await phone.ctx.addInitScript(()=>{for(const k of ['digi-path-v1','digi-path-streak','dn-today-cache'])localStorage.setItem(k,'{not-json');});
 await goto(phone,'reports/2026-10-19-logic-path-0093.html');await H.tap(phone.p,phone.p.locator('#dnPlay'));await H.wait(phone.p,300);
 expect(await phone.p.locator('#grid .cell').count()).toBe(36);expect(phone.errors).toEqual([]);
});
test('SAVE: unavailable storage still permits local play',async({phone})=>{
 await phone.ctx.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage unavailable','QuotaExceededError');};});
 await goto(phone,'reports/2026-10-19-word-link-0072.html');await H.tap(phone.p,phone.p.locator('#dnPlay'));await H.wait(phone.p,300);
 expect(await phone.p.locator('#board .tile').count()).toBe(16);expect(phone.errors).toEqual([]);
});
