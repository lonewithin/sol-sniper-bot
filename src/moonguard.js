// 🌙 Moon guard: watches held MOON coins on the pumpportal trade stream (every trade, not every few seconds of quotes).
// Exits at once on: hard stop hit on stream price, fast crash (-35% inside 60s), or one huge sell (likely dev/LP pull). Paper and live share the logic.
const WS=require('ws');const {settings:S}=require('./config');const T=require('./trader');
let warned=false;const M=new Map();let w=null,subs=new Set(),fails=0;
function connect(){w=new WS('wss://pumpportal.fun/api/data');subs=new Set();
 w.on('open',()=>{fails=0;sync()});w.on('message',m=>{try{const x=JSON.parse(m);if(x.message&&!x.mint){if(!warned)console.log('[moonguard] stream: '+String(x.message).slice(0,120));warned=true}onTrade(x)}catch{}});
 w.on('close',()=>{w=null;setTimeout(connect,Math.min(60000,3000*2**Math.min(fails++,5)))});w.on('error',()=>{});}
function held(){return T.st.open.filter(p=>p.tier==='MOON'||S.streamGuardAll!==false)} // all modes: rugs gap past 5s quote checks in every tier
function sync(){if(!w||w.readyState!==1)return;const want=new Set(held().map(p=>p.mint));
 const add=[...want].filter(m=>!subs.has(m)),rm=[...subs].filter(m=>!want.has(m));
 if(add.length){w.send(JSON.stringify({method:'subscribeTokenTrade',keys:add}));console.log('[moonguard] watching '+add.length+' held coin(s)')}if(rm.length)w.send(JSON.stringify({method:'unsubscribeTokenTrade',keys:rm}));
 subs=want;for(const m of M.keys())if(!want.has(m))M.delete(m)}
function onTrade(x){if(!x.mint||!(x.marketCapSol>0))return;const p=held().find(q=>q.mint===x.mint);if(!p||p.selling)return;
 const now=Date.now();let g=M.get(x.mint);if(!g){g={ref:x.marketCapSol,ratio:p.last>0?p.last/(p.solIn*(Number(p.tokens)/Number(p.tokens0||p.tokens))):1,hist:[]};M.set(x.mint,g)}
 const prev=g.hist.length?g.hist[g.hist.length-1][1]:0; // one bad DexScreener sample (STONK showed -100% in one poll while its real sell paid +24%) must repeat on the next poll before it counts
 if(x.src==='poll'&&!x.confirmed&&prev>0&&x.marketCapSol<prev*0.1){g.glitch=(g.glitch||0)+1;if(g.glitch<2){console.log(`[moonguard] ${p.symbol}: price sample ${((x.marketCapSol/prev-1)*100).toFixed(0)}% in one poll, waiting for the next poll to confirm`);return}}else g.glitch=0;
 g.hist.push([now,x.marketCapSol]);while(g.hist.length&&now-g.hist[0][0]>60000)g.hist.shift();
 const ch=(x.src==='poll'&&p.entryUsd>0)?(x.marketCapSol/p.entryUsd-1)*100:(g.ratio*x.marketCapSol/g.ref-1)*100, // poll path: measure from the real entry price (first-seen ref hid crashes that happened before the first poll)
 hi=Math.max(...g.hist.map(h=>h[1])),crash=(x.marketCapSol/hi-1)*100;
 const pool=x.vSolInBondingCurve||x.vSolInPool||0,big=x.txType==='sell'&&pool>0&&x.solAmount/pool>=(S.moonGuardBigSellPct||25)/100;
 const sl=p.tier==='MOON'?(S.moonSl||40):(p.rules?.sl||30);let why=null;const cap=Math.max(S.maxLossCapPct||0,sl),liq=x.liq,liq0=p.features?.liq||0;
 const rugCond=x.src==='poll'&&liq!=null&&(liq<(S.rugMinLiqUsd||1500)||(liq0>0&&S.rugLiqDropPct>0&&liq<liq0*(1-S.rugLiqDropPct/100)));
 if(rugCond&&!x.confirmed)confirmRug(p,x); // batch polls can drop a coin's main pool (KNOTS showed $34k vs a real $475k pool), so re-check this one coin before a rug exit
 if(rugCond&&x.confirmed){why=`⛔ Rug exit: pool liquidity $${Math.round(liq)} (was $${Math.round(liq0)} at entry), liquidity pulled`;p.rug=true}
 else if(S.maxLossCapPct>0&&ch<=-cap&&!(p.tier==='MOON'&&p.halfDone))why=`⛔ Hard loss cap: ${ch.toFixed(0)}% from entry (cap -${cap}%)`;
 else if((p.tier!=='MOON'||p.peak<100)&&ch<=-sl)why=`⚡ Guard stop: price ${ch.toFixed(0)}% from entry (limit -${sl}%)`;
 else if(crash<=-(S.moonGuardCrashPct||35))why=`⚡ Crash exit: market cap fell ${crash.toFixed(0)}% inside 60s (rug / LP pull)`;
 else if(big)why=`⚡ Dump exit: one sell took ${(x.solAmount/pool*100).toFixed(0)}% of the pool`;
 if(!why)return;p.selling=true;const rest=Number(p.tokens)/Number(p.tokens0||p.tokens);p.last=Math.max(0,p.solIn*rest*(1+ch/100));if(p.rug&&liq0>0)p.last*=Math.min(1,liq/liq0); // paper honesty: a pulled pool pays out roughly in proportion to the liquidity left
 
 console.log(`[moonguard] ${p.symbol}: ${why}`);T.sell(p,why).catch(e=>console.log('[moonguard] sell err '+e.message)).finally(()=>{p.selling=false})}
// Rug confirm: fetch just this coin and use its deepest pool where it is the base token; exit only if that still shows the pull.
const rugChk=new Map();async function confirmRug(p,x){if(rugChk.get(p.mint))return;rugChk.set(p.mint,1);
 try{const r=await fetch('https://api.dexscreener.com/latest/dex/tokens/'+p.mint,{signal:AbortSignal.timeout(4000)});let liq=null,px=x.marketCapSol;
  if(r.ok){const j=await r.json();for(const pr of j.pairs||[]){if(pr.baseToken?.address!==p.mint)continue;const l=pr.liquidity?.usd;if(l!=null&&(liq==null||l>liq)){liq=l;if(+pr.priceUsd>0)px=+pr.priceUsd}}}
  if(liq==null){p.rugMiss=(p.rugMiss||0)+1;if(p.rugMiss<3)return;liq=x.liq}else p.rugMiss=0; // confirm fetch failed 3x in a row: trust the poll
  const liq0=p.features?.liq||0;if(liq<(S.rugMinLiqUsd||1500)||(liq0>0&&S.rugLiqDropPct>0&&liq<liq0*(1-S.rugLiqDropPct/100)))onTrade({...x,marketCapSol:px,liq,confirmed:true});
  else console.log(`[moonguard] ${p.symbol}: rug alarm cleared, single-coin check shows pool $${Math.round(liq)} (batch poll said $${Math.round(x.liq)})`)}
 catch(e){}finally{rugChk.delete(p.mint)}}
// Fallback: pumpportal per-token trade subscriptions need a paid API key (server replies 'only available with...'), so the stream never delivered
// trades for held coins. Poll DexScreener (batch, <=30 mints/call, limit 300/min) every guardPollSec for all held coins and run the same stop/crash rules.
let polling=false;async function poll(){if(polling)return;const ms=[...new Set(held().map(p=>p.mint))];if(!ms.length)return;polling=true;
 try{for(let i=0;i<ms.length;i+=30){const r=await fetch('https://api.dexscreener.com/latest/dex/tokens/'+ms.slice(i,i+30).join(','),{signal:AbortSignal.timeout(4000)});if(!r.ok)continue;const j=await r.json();const best={};
  for(const pr of j.pairs||[]){const m=pr.baseToken?.address,px=+pr.priceUsd;if(!m||!(px>0))continue;if(!best[m]||(pr.liquidity?.usd||0)>(best[m].liquidity?.usd||0))best[m]=pr}
  for(const m in best)onTrade({mint:m,marketCapSol:+best[m].priceUsd,liq:best[m].liquidity?.usd??null,src:'poll'});
  for(const m of ms.slice(i,i+30))if(!best[m]){const p=held().find(q=>q.mint===m);if(p){p.noPair=(p.noPair||0)+1;if(p.noPair===15)console.log(`[moonguard] ${p.symbol}: no DexScreener pair for 30s+ (possible rug)`)}}else{const p=held().find(q=>q.mint===m);if(p)p.noPair=0}}}catch(e){}finally{polling=false;module.exports.lastPoll=Date.now()}}
function start(){if(!S.moonGuard&&S.moonGuard!==undefined)return;connect();setInterval(sync,5000);setInterval(poll,(S.guardPollSec||2)*1000);console.log('[moonguard] started: stream + DexScreener poll every '+(S.guardPollSec||2)+'s')}
module.exports={onTrade,poll,start,_M:M};
