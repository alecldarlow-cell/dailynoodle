'use strict';
// Keep each scenario intact: some intentionally span two days/tabs/types.
// Link's real animation waits are expensive, so group it with Mini/Doku;
// the other four players and cross-player UI checks form the second shard.
function shardFor(name){return /(?:^|[:-])(link|mini|doku)(?:$|[:-])/.test(name)?1:2;}
function selection(names,args=[]){
 const flags=args.filter(a=>a.startsWith('--'));
 if(flags.length>1||flags.some(a=>!/^--shard=[12]\/2$/.test(a)))throw Error('Use --shard=1/2 or --shard=2/2');
 const filters=args.filter(a=>!a.startsWith('--'));
 if(filters.length>1)throw Error('Use at most one puzzle-case filter');
 const shard=flags.length?Number(flags[0][8]):null;
 const picked=names.filter(name=>(!filters[0]||name.includes(filters[0]))&&(!shard||shardFor(name)===shard));
 if(!picked.length)throw Error('No puzzle cases selected; check the filter/shard');
 return picked;
}
module.exports={shardFor,selection};
