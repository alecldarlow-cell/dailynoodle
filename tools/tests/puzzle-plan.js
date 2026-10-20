'use strict';
// Whole scenarios only: some span two days/tabs/types. The committed estimates
// make assignment reproducible; live runner speed never changes shard identity.
const estimates=require('./fixtures/puzzle-durations.json').seconds;
function partition(names,count){
 if(!Number.isInteger(count)||count<1||count>8||count>names.length)throw Error('Use 1–8 nonempty puzzle shards');
 const bins=Array.from({length:count},()=>({names:new Set(),seconds:0}));
 const weight=name=>estimates[name]||10; // new scenarios are included automatically
 for(const name of names.slice().sort((a,b)=>weight(b)-weight(a)||(a<b?-1:a>b?1:0))){
  const target=bins.reduce((a,b)=>b.seconds<a.seconds?b:a);
  target.names.add(name);target.seconds+=weight(name);
 }
 return bins.map(b=>names.filter(name=>b.names.has(name)));
}
function selection(names,args=[]){
 const flags=args.filter(a=>a.startsWith('--'));
 if(flags.length>1||flags.some(a=>!/^--shard=\d+\/\d+$/.test(a)))throw Error('Use --shard=INDEX/TOTAL');
 const filters=args.filter(a=>!a.startsWith('--'));
 if(filters.length>1)throw Error('Use at most one puzzle-case filter');
 let chosen=names;
 if(flags.length){
  const [index,count]=flags[0].slice(8).split('/').map(Number);
  if(!Number.isInteger(index)||index<1||index>count)throw Error('Shard index must be between 1 and TOTAL');
  chosen=partition(names,count)[index-1];
 }
 const picked=chosen.filter(name=>!filters[0]||name.includes(filters[0]));
 if(!picked.length)throw Error('No puzzle cases selected; check the filter/shard');
 return picked;
}
module.exports={partition,selection};
