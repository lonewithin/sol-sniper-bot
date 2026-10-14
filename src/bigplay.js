// Big Play: established tokens with traction. Hold hours; partial at 2x, trail, SL.
const j=require('./http');const {settings:S}=require('./config');const {score}=require('./safety');const {pairsFor,potential}=require('./potential');const T=require('./trader');
const holders=new Map(),cool=new Map();
async function candidates(){const set=new Set();
 for(const u of['https://api.dexscreener.com/token-boosts/top/v1','https://api.dexscreener.com/token-boosts/latest/v1','https://api.dexscreener.com/token-profiles/latest/v1'])
  try{for(const t of await j(u))if(t.chainId==='solana')set.add(t.tokenAddress)}catch{}
 for(const q of ['solana','pump','raydium','meteora','SOL meme'])try{const r=await j('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(q));for(const p of r.pairs||[])if(p.chainId==='solana'&&p.baseToken?.address&&p.baseToken.address!=='So11111111111111111111111111111111111111112')set.add(p.baseToken.address)}catch{}
 return [...set];}
function filter(p){const R=[];if(!p)return ['no pair'];const mc=p.marketCap||p.fdv||0,liq=p.liquidity?.usd||0,age=p.pairCreatedAt?(Date.now()-p.pairCreatedAt)/36e5:0;
 const v1=p.volume?.h1||0,v6=p.volume?.h6||0,t=p.txns?.h1||{},ratio=((t.buys||0)+1)/((t.sells||0)+1);
 if(mc<S.bigMinMcap||mc>S.bigMaxMcap)R.push(`mcap $${(mc/1e3).toFixed(0)}k`);if(liq<S.bigMinLiq)R.push(`liq $${(liq/1e3).toFixed(0)}k`);
 if(age<S.bigMinAgeH)R.push(`age ${age.toFixed(1)}h`);if(!(v1>v6/6))R.push('1h vol not above 6h avg');if(ratio<S.bigMinRatio)R.push(`buy/sell 1h ${ratio.toFixed(2)}`);
 const t5=p.txns?.m5||{},c=p.priceChange||{};if((t5.buys||0)<(t5.sells||0))R.push('5m sells > buys');if((c.m5||0)<-3||(c.h1||0)<-10)R.push('dumping');if((p.volume?.m5||0)<1000)R.push('5m vol < $1k');
 return R;}
function entry(p){const c=p.priceChange||{};const m5=c.m5||0,h1=c.h1||0,h6=c.h6||0;
 if(m5>0&&h1>0&&h1<80)return 'momentum';if(h6>20&&h1<0&&h1>-20&&m5>=0)return 'pullback';return null;}
async function scan(log=console.log,{dry=false}={}){if(!dry&&!(S.bigplay&&S.auto))return [];const out=[];const mints=(await candidates()).filter(m=>!(cool.get(m)>Date.now()));
 const pairs=await pairsFor(mints);let pass=0;
 for(const m of mints){const p=pairs[m];const f=filter(p);if(f.length)continue;pass++;const e=entry(p);if(!e){continue}
  cool.set(m,Date.now()+30*6e4);const d=await score(m).catch(()=>null);if(!d)continue;
  const ph=holders.get(m);holders.set(m,d.holders);const fail=[];
  if(d.hard?.length)fail.push('hard: '+d.hard.join(', '));if(d.score<S.bigMinScore)fail.push(`safety ${d.score}`);if(ph&&d.holders&&d.holders<ph)fail.push('holders falling');{const hc=await require('./holders').check(m,d);if(!hc.ok)fail.push('holders: '+hc.fails.join(', '))}
  const row={mint:m,symbol:d.symbol,mcap:p.marketCap||p.fdv,liq:p.liquidity?.usd,entry:e,safety:d.score,fail};out.push(row);
  log(`[BIG] ${d.symbol} mc $${((row.mcap||0)/1e6).toFixed(2)}M liq $${((row.liq||0)/1e3).toFixed(0)}k ${e} S${d.score} ${fail.length?'no: '+fail.join('; '):'BUY'}`);
  if(!fail.length&&!dry){try{await T.buy({mint:m,symbol:d.symbol},S.bigBuySol,{tier:'BIG',pot:potential(p,{safety:d.score,mint:m}).potential,safety:d.score,features:{entry:e,mcap:row.mcap,liq:row.liq,pc:p.priceChange}});require('./counters').bought()}catch(err){log('[BIG] buy skip '+err.message)}}}
 log(`[BIG] scan: ${mints.length} coins checked, ${pass} passed traction filters, ${out.length} scored, open ${T.st.open.filter(x=>x.tier==='BIG').length}/${S.bigMaxOpen}`);return out;}
function start(log){const {rules}=require('./potential');for(const p of T.st.open)if(p.tier==='BIG')p.rules=rules('BIG');const run=()=>scan(log).catch(e=>log('[BIG] err '+e.message));setTimeout(run,15000);setInterval(run,S.bigScanMin*6e4);}
module.exports={scan,start,filter,entry};
