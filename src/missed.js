// Missed Pumps: watch skipped coins (last 300, up to 6h), alert at 2x/5x/10x once each, track skip accuracy.
const fs=require('fs'),path=require('path');const {settings:S,DATA}=require('./config');const {pairsFor}=require('./potential');const SW=require('./sweep');
const F=path.join(DATA,'missed.json'),OUT=path.join(DATA,'missed.jsonl');const MAX=300,TTL=6*3600e3;
let hook=null;let M={watch:{},done:{pumped:0,dumped:0,flat:0},today:{}};try{M={...M,...JSON.parse(fs.readFileSync(F))}}catch{}
const save=()=>fs.writeFileSync(F,JSON.stringify(M));
function add(c){if(!c.p0||M.watch[c.mint])return;M.watch[c.mint]={...c,t:Date.now(),peak:0,now:0,hit:[]};
 const k=Object.keys(M.watch);if(k.length>MAX){finish(M.watch[k[0]]);}save();}
function finish(w){delete M.watch[w.mint];const pumped=w.peak>=S.missedAlertPct,dumped=w.now<=-50;M.done[pumped?'pumped':dumped?'dumped':'flat']++;
 fs.appendFileSync(OUT,JSON.stringify({mint:w.mint,symbol:w.symbol,safety:w.safety,pot:w.pot,tier:w.tier,why:w.why,peakPct:+w.peak.toFixed(1),finalPct:+w.now.toFixed(1),t:w.t})+'\n');}
const links=m=>`<a href="https://dexscreener.com/solana/${m}">DexScreener</a> · <a href="https://solscan.io/token/${m}">Solscan</a> · <a href="https://pump.fun/coin/${m}">pump.fun</a>`;
async function poll(notify){const ws=Object.values(M.watch);if(!ws.length)return;
 for(const w of ws)if(Date.now()-w.t>TTL)finish(w);
 const live=Object.values(M.watch);const pairs=await pairsFor(live.map(w=>w.mint));const day=SW.lagos().day;
 for(const w of live){const p=pairs[w.mint];if(!p?.priceUsd)continue;const ch=(+p.priceUsd/w.p0-1)*100;w.now=ch;w.peak=Math.max(w.peak,ch);w.priceNow=+p.priceUsd;
  if(hook&&S.secondChance&&S.auto&&ch>=S.secondChanceGainPct&&!w.sc&&(!w.scT||Date.now()-w.scT>600000)){w.scT=Date.now();hook(w,p,ch).then(b=>{if(b)w.sc=true}).catch(()=>{})}
  const ms=[1+S.missedAlertPct/100,5,10].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b);
  for(const x of ms){if(ch>=(x-1)*100&&!w.hit.includes(x)){w.hit.push(x);
   const td=(M.today[day]??=[]);const e=td.find(z=>z.mint===w.mint);if(e)e.peak=w.peak;else td.push({mint:w.mint,symbol:w.symbol,peak:w.peak,why:w.why});
   if(S.missedAlerts)notify(`👀 <b>MISSED PUMP ${x}x</b>: ${w.symbol||'?'}\nSkipped because: ${w.why}\n🛡 Safety ${w.safety} · 🚀 Potential ${w.pot} (${w.tier})\n💵 At skip $${w.p0.toPrecision(4)} → now $${(+p.priceUsd).toPrecision(4)} (+${ch.toFixed(0)}%)\n⏱ Took ${((Date.now()-w.t)/6e4).toFixed(0)} min · peak +${w.peak.toFixed(0)}%\n${links(w.mint)}\n<code>${w.mint}</code>`);}}}
 for(const k of Object.keys(M.today).sort().slice(0,-3))delete M.today[k];save();}
function start(notify){setInterval(()=>poll(notify).catch(()=>{}),60000).unref?.();}
function summary(){const d=M.done,n=d.pumped+d.dumped+d.flat;const top=(M.today[SW.lagos().day]||[]).sort((a,b)=>b.peak-a.peak).slice(0,5);
 return {n,...d,acc:n?(1-d.pumped/n)*100:null,watching:Object.keys(M.watch).length,top};}
module.exports={onCandidate:f=>hook=f,add,start,summary,poll,OUT,_M:()=>M};
