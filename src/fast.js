// Fast path: PumpPortal trade-local builds a pump.fun bonding-curve / PumpSwap tx; we sign locally (key never leaves box).
const fs=require('fs'),path=require('path');const {settings:S,DATA}=require('./config');const {rpc}=require('./safety');
const LF=path.join(DATA,'latency.jsonl');const creators=new Map();
async function build(pub,action,mint,amount,{pool='auto',denomSol=true}={}){
 const r=await fetch('https://pumpportal.fun/api/trade-local',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(4000),
  body:JSON.stringify({publicKey:pub,action,mint,amount,denominatedInSol:String(denomSol),slippage:Math.round(S.slippageBps/100),priorityFee:S.priorityLamports/1e9,pool})});
 if(r.status!==200)throw new Error('pumpportal '+r.status+' '+(await r.text()).slice(0,120));return new Uint8Array(await r.arrayBuffer());}
// instant checks from the websocket event + 1 RPC call
async function instant(ev){const R=[];let ok=true;const no=w=>{ok=false;R.push('❌ '+w)};
 const c=ev.traderPublicKey;if(c){const n=(creators.get(c)||0)+1;creators.set(c,n);if(n>S.maxCreatorLaunches)no(`creator launched ${n} tokens this session`)}
 if(ev.initialBuy&&ev.txType==='create'){const pct=ev.initialBuy/1e9*100;if(pct>S.fastMaxDevPct)no(`dev bought ${pct.toFixed(1)}%`);else R.push(`✅ dev ${pct.toFixed(1)}%`)}
 if(!ev.mint.endsWith('pump')||S.fastCheckMint){try{const a=await rpc('getAccountInfo',[ev.mint,{encoding:'jsonParsed'}]);const i=a?.value?.data?.parsed?.info;
  if(!i)no('mint unreadable');else{if(i.mintAuthority)no('mint authority');if(i.freezeAuthority)no('freeze authority')}}catch{no('rpc fail')}}
 else R.push('✅ pump.fun mint (authorities held by program)');
 return {ok,reasons:R};}
const logLatency=o=>fs.appendFileSync(LF,JSON.stringify(o)+'\n');
module.exports={build,instant,logLatency,LF};
