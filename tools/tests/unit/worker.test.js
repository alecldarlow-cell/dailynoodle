'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function worker(){
 const handlers={},calls=[];
 const self={location:{origin:'https://example.test'},addEventListener:(n,f)=>handlers[n]=f,
  registration:{showNotification:async(t,o)=>calls.push({t,o})},clients:{matchAll:async()=>[],openWindow:async u=>calls.push({url:u})}};
 const ctx=vm.createContext({self,URL,Date,Intl,Response,Set});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../../sw.js'),'utf8'),ctx);
 return {handlers,calls};
}
async function fire(fn,event){let work;fn({...event,waitUntil:p=>work=p});await work;}
test('PUSH-01: actual worker validates notification payload and same-origin click target',async()=>{
 const w=worker();await fire(w.handlers.push,{data:{json:()=>({title:'x'.repeat(100),body:'b'.repeat(300),url:'/board.html',tag:'z'.repeat(80)})}});
 assert.equal(w.calls[0].t.length,80);assert.equal(w.calls[0].o.body.length,200);assert.equal(w.calls[0].o.tag.length,64);
 let closed=false;await fire(w.handlers.notificationclick,{notification:{close(){closed=true;},data:{url:'https://evil.example/phish'}}});
 assert.equal(closed,true);assert.equal(w.calls[1].url,'/');
 await fire(w.handlers.notificationclick,{notification:{close(){},data:{url:'/board.html'}}});assert.equal(w.calls[2].url,'https://example.test/board.html');
});
test('PUSH-01: non-JSON payload falls back to text',async()=>{
 const w=worker();await fire(w.handlers.push,{data:{json(){throw Error('bad JSON');},text:()=> 'A test'}});assert.equal(w.calls[0].t,'The Daily Noodle');assert.equal(w.calls[0].o.body,'A test');
});

test('PUBLISH: health checks and admin metadata bypass the offline worker cache',()=>{
 const w=worker();
 for(const url of ['/admin-health.js','/publishing-health.json','/puzzles-today.json?publishing-check=1','/reports/today.html?publishing-check=1']){
  let intercepted=false;
  w.handlers.fetch({request:{method:'GET',headers:{has:()=>false},url:'https://example.test'+url},respondWith(){intercepted=true;}});
  assert.equal(intercepted,false,url);
 }
});
