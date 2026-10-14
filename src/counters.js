// Persistent hunting counters in data/stats.json (all-time + per Lagos day).
const fs=require('fs'),path=require('path');const {DATA}=require('./config');
const F=path.join(DATA,'stats.json');const blank=()=>({scanned:0,alerted:0,bought:0,skipped:0,bySrc:{},skip:{},safetySum:0,potSum:0,scored:0,bestLatMs:null});
let D={start:Date.now(),all:blank(),days:{}};try{D={...D,...JSON.parse(fs.readFileSync(F))}}catch{}
const boot=Date.now();const day=()=>require('./sweep').lagos().day;
let dirty=false;setInterval(()=>{if(dirty){fs.writeFileSync(F,JSON.stringify(D));dirty=false}},10000).unref();
function each(fn){fn(D.all);const k=day();fn(D.days[k]??=blank());const ks=Object.keys(D.days).sort();while(ks.length>14)delete D.days[ks.shift()];dirty=true;}
module.exports={
 scanned:(src,safety,pot)=>each(s=>{s.scanned++;s.bySrc[src]=(s.bySrc[src]||0)+1;if(safety!=null){s.safetySum+=safety;s.potSum+=pot||0;s.scored++}}),
 skip:why=>each(s=>{s.skipped++;s.skip[why]=(s.skip[why]||0)+1}),
 alerted:()=>each(s=>s.alerted++),bought:()=>each(s=>s.bought++),
 latency:ms=>each(s=>{if(ms!=null&&(s.bestLatMs==null||ms<s.bestLatMs))s.bestLatMs=ms}),
 get:()=>({all:D.all,today:D.days[day()]||blank(),start:D.start,boot})};
