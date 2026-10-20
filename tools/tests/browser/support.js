'use strict';
const {test:base,expect}=require('@playwright/test');
const H=require('../harness');
const test=base.extend({
 phone:async({browser},use,testInfo)=>{
  // The harness reads the engine from the browser itself: an Android phone in
  // Chromium, an iPhone in WebKit, no mobile emulation in Firefox; it routes all traffic.
  const ctx=await H.newPhone(browser);
  const p=await ctx.newPage(),errors=[],missing=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().startsWith('https://dailynoodle.co.uk/')&&r.status()>=400)missing.push(r.status()+' '+r.url());});
  p.errs=errors;
  await p.clock.install({time:new Date('2026-10-19T12:00:00+01:00')});
  await use({ctx,p,errors,missing});
  if(testInfo.status!==testInfo.expectedStatus){
   await testInfo.attach('console-and-assets',{body:JSON.stringify({errors,missing},null,2),contentType:'application/json'});
   await testInfo.attach('page',{body:await p.screenshot().catch(()=>Buffer.from('')),contentType:'image/png'});
  }
  await ctx.close();
 }
});
async function goto(phone,file){await phone.p.goto('https://dailynoodle.co.uk/'+file);await H.wait(phone.p,1500);}
/* Tangle, Borders and Reckon offer a Full screen switch only where the page can go
   full screen. Chromium must show it (the tests turn it off so a viewport resize is a
   rotation, not a full-screen exit). An iPhone's Safari has no page full screen, so
   in WebKit the switch is rightly absent: note it, and carry on. */
async function fullScreenOff(p,testInfo){
 const sw=p.getByRole('switch',{name:'Full screen',exact:true});
 if(H.engineOf(p)!=='chromium'&&!(await sw.count())){testInfo.annotations.push({type:'skip-check',description:H.engineOf(p)+': no Full screen switch (no page full screen on an iPhone), nothing to turn off'});return false;}
 await sw.click();return true;
}
module.exports={test,expect,H,goto,fullScreenOff};
