const j=require('./http');const {RPC,SOL}=require('./config');
const rpc=(method,params)=>j(RPC,{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}).then(r=>{if(r.error)throw new Error(r.error.message);return r.result});
const JUP='https://lite-api.jup.ag/swap/v1';
const quote=(i,o,a,bps=1500)=>j(`${JUP}/quote?inputMint=${i}&outputMint=${o}&amount=${a}&slippageBps=${bps}`);
const rugRetry=async m=>{for(let i=0;i<3;i++){try{return await j(`https://api.rugcheck.xyz/v1/tokens/${m}/report`,{},10000)}catch(e){await new Promise(r=>setTimeout(r,1500*(i+1)))}}throw new Error('rugcheck')};
async function score(mint,hint={}){
 const R=[];let pts=100;const pen=(n,why)=>{pts-=n;R.push(`❌ ${why} (-${n})`)},ok=w=>R.push(`✅ ${w}`);const d={mint};
 const [acc,large,dex,rug]=await Promise.allSettled([
  rpc('getAccountInfo',[mint,{encoding:'jsonParsed'}]),rpc('getTokenLargestAccounts',[mint]),
  j(`https://api.dexscreener.com/tokens/v1/solana/${mint}`),rugRetry(mint)]);
 const info=acc.value?.value?.data?.parsed?.info;
 if(info){d.supply=Number(info.supply)/10**info.decimals;d.decimals=info.decimals;
  info.mintAuthority?pen(30,'Mint authority NOT revoked'):ok('Mint authority revoked');
  info.freezeAuthority?pen(30,'Freeze authority NOT revoked'):ok('Freeze authority revoked');}
 else pen(20,'Could not read mint account');
 const pairs=Array.isArray(dex.value)?dex.value:[];const p=pairs.sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
 if(p){d.name=p.baseToken?.name;d.symbol=p.baseToken?.symbol;d.liqUsd=p.liquidity?.usd||0;d.mcap=p.marketCap||p.fdv;d.dex=p.dexId;d.priceUsd=+p.priceUsd;d.ageMin=p.pairCreatedAt?((Date.now()-p.pairCreatedAt)/6e4)|0:null;}
 else if(hint.name){d.name=hint.name;d.symbol=hint.symbol}
 const liq=d.liqUsd||0;
 if(liq<2000)pen(25,`Liquidity tiny ($${liq.toFixed(0)})`);else if(liq<10000)pen(10,`Liquidity low ($${liq.toFixed(0)})`);else ok(`Liquidity $${liq.toFixed(0)}`);
 const r=rug.value;const pools=new Set((r?.markets||[]).flatMap(m=>[m.liquidityA,m.liquidityB,m.pubkey].filter(Boolean)));
 // top holders: exclude AMM pool vaults known from rugcheck markets
 let top10=null;
 if(r?.topHolders?.length){const h=r.topHolders.filter(x=>!x.insider||true).filter(x=>!pools.has(x.address)&&!pools.has(x.owner));top10=h.slice(0,10).reduce((a,x)=>a+(x.pct||0),0);}
 else if(large.value?.value&&d.supply){const v=large.value.value.slice(1,11);top10=v.reduce((a,x)=>a+Number(x.uiAmount||0),0)/d.supply*100;R.push('ℹ️ top10 excludes largest acct (assumed pool)');}
 if(top10!=null){d.top10=+top10.toFixed(1);top10>50?pen(25,`Top10 hold ${d.top10}%`):top10>30?pen(10,`Top10 hold ${d.top10}%`):ok(`Top10 hold ${d.top10}%`);}
 if(r){d.rugScore=r.score_normalised;d.holders=r.totalHolders||null;const lp=Math.max(0,...(r.markets||[]).map(m=>m.lp?.lpLockedPct||0));d.lpLocked=+lp.toFixed(1);
  const pump=/pump/i.test(d.dex||'')||(r.markets||[]).some(m=>/pump/i.test(m.marketType||''));
  if(lp>=90)ok(`LP locked/burned ${d.lpLocked}%`);else if(pump)ok('PumpSwap/pump.fun pool (LP held by program)');else pen(20,`LP only ${d.lpLocked}% locked`);
  if(r.creatorBalance&&d.supply){d.devPct=+(r.creatorBalance/10**(d.decimals||6)/d.supply*100).toFixed(2);d.devPct>10?pen(15,`Dev holds ${d.devPct}%`):ok(`Dev holds ${d.devPct}%`);}
  if(r.rugged)pen(100,'RugCheck: RUGGED');
  for(const k of (r.risks||[]).filter(x=>x.level==='danger').slice(0,3))pen(5,`RugCheck: ${k.name}`);
 }else pen(15,'RugCheck unavailable (LP/dev unverified)');
 if(top10==null)pen(10,'Holder distribution unknown');
 // honeypot: buy 0.01 SOL then quote selling result back
 try{const b=await quote(SOL,mint,1e7);const s=await quote(mint,SOL,b.outAmount);const rt=(1-Number(s.outAmount)/1e7)*100;d.roundTripLossPct=+rt.toFixed(1);
  rt>30?pen(30,`Sell sim loses ${d.roundTripLossPct}% (honeypot/tax?)`):rt>12?pen(10,`Round-trip cost ${d.roundTripLossPct}%`):ok(`Sellable, round-trip ${d.roundTripLossPct}%`);}
 catch(e){pen(25,'No Jupiter route buy/sell (not tradable yet?)');}
 d.score=Math.max(0,pts);d.reasons=R;return d;}
module.exports={score,quote,rpc};
