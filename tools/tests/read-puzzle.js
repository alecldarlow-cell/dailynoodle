'use strict';
const fs = require('node:fs'), vm = require('node:vm');
// Scan only an authored literal; never execute the page's scripts in Node.
function read(file) {
  const s = fs.readFileSync(file, 'utf8');
  const m = /(?:window\.DN_PUZZLE|const\s+(?:SAMPLE|PUZZLE))\s*=\s*\{/.exec(s);
  if (!m) throw new Error('Missing puzzle literal in '+file);
  const start = s.indexOf('{', m.index); let depth = 0, quote = '', line = false, block = false;
  for (let i=start; i<s.length; i++) {
    const ch=s[i], next=s[i+1];
    if (line) { if(ch==='\n')line=false; continue; }
    if (block) { if(ch==='*'&&next==='/'){block=false;i++;}continue; }
    if (quote) { if(ch==='\\')i++; else if(ch===quote)quote='';continue; }
    if(ch==='/'&&next==='/'){line=true;i++;continue;}
    if(ch==='/'&&next==='*'){block=true;i++;continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0) return vm.runInNewContext('('+s.slice(start,i+1)+')', {}, {timeout:1000});
  }
  throw new Error('Unclosed puzzle in '+file);
}
module.exports = { read };
