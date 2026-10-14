// Missed Pumps: watch skipped coins (last 300, up to 6h), alert at 2x/5x/10x once each, track skip accuracy.
const fs=require('fs'),path=require('path');const {settings:S,DATA}=require('./config');const {pairsFor}=require('./potential');const SW=require('./sweep');
const F=path.join(DATA,'missed.json'),OUT=path.join(DATA,'missed.jsonl');const MAX=300,TTL=6*3600e3;
let hook=null;let M={watch:{},done:{pumped:0,dumped:0,flat:0},today:{}};try{M={...M,...JSON.parse(fs.readFileSync(F))}}catch{}
const save=()=>fs.writeFileSync(F,JSON.stringify(M));
function add(c){if(!c.p0||M.watch[c.mint])return;M.watch[c.mint]={...c,t:Date.now(),peak:0,now:0,hit:[]};
 const k=Object.keys(M.watch);if(k.length>MAX){finish(M.watch[k[0]]);}save();}
function finish(w){delete M.watch[w.mint];const pumped=w.real&&w.peak>=S.missedAlertPct,dumped=w.now<=-50;M.done[pumped?'pumped':dumped?'dumped':'flat']++;
 fs.appendFileSync(OUT,JSON.stringify({mint:w.mint,symbol:w.symbol,safety:w.safety,pot:w.pot,tier:w.tier,why:w.why,peakPct:+w.peak.toFixed(1),finalPct:+w.now.toFixed(1),t:w.t})+'\n');}
const links=m=>`<a href="https://dexscreener.com/solana/${m}">DexScreener</a> · <a href="https://solscan.io/token/${m}">Solscan</a> · <a href="https://pump.fun/coin/${m}">pump.fun</a>`;
const j=require('./http');
async function allPairs(mints){const out={};for(let i=0;i<mints.length;i+=30){try{for(const p of await j('https://api.dexscreener.com/tokens/v1/solana/'+mints.slice(i,i+30).join(','))){const m=p.baseToken?.address;(out[m]??=[]).push(p)}}catch{}}return out;}
// is this pair a real, tradable market right now?
function quality(p){const R=[];if(!p)return ['no pair'];const mc=p.marketCap||p.fdv||0,liq=p.liquidity?.usd||0,v5=p.volume?.m5||0,v1=p.volume?.h1||0;
 if(mc<S.missedMinMcap)R.push(`mcap $${mc.toFixed(0)}`);
 const curve=p.dexId==='pumpfun'&&!liq; // bonding curve: DexScreener reports no liquidity; use mcap+volume
 if(!curve&&liq<S.missedMinLiq)R.push(`liq $${liq.toFixed(0)}`);
 if(v5<S.missedMinVol5m&&v1<S.missedMinVol1h)R.push(`vol 5m $${v5.toFixed(0)} / 1h $${v1.toFixed(0)}`);return R;}
const pick=(ps,addr)=>addr?ps?.find(p=>p.pairAddress===addr):null;
const bestPair=ps=>(ps||[]).slice().sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0)||(b.volume?.h24||0)-(a.volume?.h24||0))[0];
async function poll(notify){const ws=Object.values(M.watch);if(!ws.length)return;
 for(const w of ws)if(Date.now()-w.t>TTL)finish(w);
 const live=Object.values(M.watch);const all=await allPairs(live.map(w=>w.mint));const day=SW.lagos().day;
 for(const w of live){const ps=all[w.mint];let p=pick(ps,w.pair);
  // (re)baseline: need a pair with >= $1k liquidity (or a live bonding curve with real mcap); stick to that pair afterwards
  if(!p||!w.pair){const b=bestPair(ps);if(!b?.priceUsd)continue;const ok=(b.liquidity?.usd||0)>=S.missedBaseLiq||(b.dexId==='pumpfun'&&(b.marketCap||0)>=S.missedMinMcap);
   if(!ok){w.waitBase=true;continue}if(!w.pair||w.waitBase||!p){w.pair=b.pairAddress;w.dex=b.dexId;w.p0=+b.priceUsd;w.t0=Date.now();w.peak=0;w.waitBase=false;w.rebased=true}p=b;}
  if(!p?.priceUsd)continue;
  // migration from curve to PumpSwap: follow to the new main pool but rebaseline price-consistently
  const b=bestPair(ps);if(b&&b.pairAddress!==w.pair&&(b.liquidity?.usd||0)>(p.liquidity?.usd||0)*3&&(b.liquidity?.usd||0)>=S.missedMinLiq){const k=+b.priceUsd/(+p.priceUsd||+b.priceUsd);w.p0=w.p0*k;w.pair=b.pairAddress;w.dex=b.dexId;p=b;}
  const ch=(+p.priceUsd/w.p0-1)*100;w.now=ch;w.priceNow=+p.priceUsd;const q=quality(p);w.q=q;
  if(!q.length)w.peak=Math.max(w.peak,ch); // only count peaks reached while the market was real
  if(hook&&!q.length&&S.secondChance&&S.auto&&S.snipe&&ch>=S.secondChanceGainPct&&!w.sc&&(!w.scT||Date.now()-w.scT>600000)){w.scT=Date.now();hook(w,p,ch).then(r=>{if(r)w.sc=true}).catch(()=>{})}
  if(q.length)continue;
  const ms=[1+S.missedAlertPct/100,5,10].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b);
  for(const x of ms){if(ch>=(x-1)*100&&!w.hit.includes(x)){w.hit.push(x);w.real=true;
   const td=(M.today[day]??=[]);const e=td.find(z=>z.mint===w.mint);const row={mint:w.mint,symbol:w.symbol,peak:w.peak,why:w.why,mcap:p.marketCap,liq:p.liquidity?.usd||0,dex:p.dexId};if(e)Object.assign(e,row);else td.push(row);
   if(S.missedAlerts)notify(`👀 <b>MISSED PUMP ${x}x</b>: ${w.symbol||'?'}\nSkipped because: ${w.why}\n🛡 Safety ${w.safety} · 🚀 Potential ${w.pot} (${w.tier})\n💵 Baseline $${w.p0.toPrecision(4)} → now $${(+p.priceUsd).toPrecision(4)} (+${ch.toFixed(0)}%) on ${p.dexId}\n🏷 MCap $${((p.marketCap||0)/1e3).toFixed(1)}k · 💧 Liq $${((p.liquidity?.usd||0)/1e3).toFixed(1)}k · Vol 1h $${((p.volume?.h1||0)/1e3).toFixed(1)}k\n⏱ Took ${((Date.now()-(w.t0||w.t))/6e4).toFixed(0)} min · peak +${w.peak.toFixed(0)}%\n${links(w.mint)}\n<code>${w.mint}</code>`);}}}
 for(const k of Object.keys(M.today).sort().slice(0,-3))delete M.today[k];save();}
// Retro-clean: re-check today's list + reset watches with the new rules
async function retroClean(){const day=SW.lagos().day;const td=M.today[day]||[];const all=await allPairs(td.map(x=>x.mint));const report=[];
 M.today[day]=td.filter(x=>{const ps=all[x.mint]||[];const b=bestPair(ps);const q=quality(b);const prices=ps.map(p=>+p.priceUsd).filter(Boolean);const spread=prices.length>1?Math.max(...prices)/Math.min(...prices):1;
  const keep=!q.length&&spread<1.5;report.push({symbol:x.symbol,peak:Math.round(x.peak),keep,why:q.join(', ')||(spread>=1.5?`pool price mismatch x${spread.toFixed(1)}`:'ok'),mcap:b?.marketCap,liq:b?.liquidity?.usd,v1:b?.volume?.h1,pools:ps.map(p=>p.dexId).join('+')});return keep;});
 for(const w of Object.values(M.watch)){if(!w.real){w.pair=null;w.peak=0;w.hit=[]}}save();return report;}
function start(notify){setInterval(()=>poll(notify).catch(()=>{}),60000).unref?.();}
function summary(){const d=M.done,n=d.pumped+d.dumped+d.flat;const top=(M.today[SW.lagos().day]||[]).sort((a,b)=>b.peak-a.peak).slice(0,5);
 return {n,...d,acc:n?(1-d.pumped/n)*100:null,watching:Object.keys(M.watch).length,top};}
module.exports={retroClean,quality,onCandidate:f=>hook=f,add,start,summary,poll,OUT,_M:()=>M};
