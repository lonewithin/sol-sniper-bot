// 🧠 Skills: extra trading checks that passed the candle backtest (train + holdout). Each has its own /set switch.
//  skillNoChase  – skip a buy if the coin already rose more than skillNoChasePct% in the last 60 min
//  skillMomentum – buy only if at least 2 of the last 3 five-minute candles were green and the latest candle's volume is rising
//  skillVolExit  – sell when 5m volume falls below skillVolExitPct% of the volume at entry while the trade is under +5% (after 10 min)
// Not used for Moonbag or manual buys. If candle data can't be fetched the buy goes ahead (fail-open) and that's logged.
const fs=require('fs'),path=require('path');const {settings:S,DATA}=require('./config');const j=require('./http');const {px}=require('./fmt');
const LF=path.join(DATA,'skills.jsonl');const cache=new Map();
async function candles(mint){const c=cache.get(mint);if(c&&Date.now()-c.t<60000)return c.b;
 const pools=await j(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`,{headers:{accept:'application/json'}});const pool=pools?.data?.[0]?.attributes?.address;if(!pool)throw new Error('no pool');
 const o=await j(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/minute?aggregate=5&limit=14&currency=usd`,{headers:{accept:'application/json'}});
 const b=(o?.data?.attributes?.ohlcv_list||[]).sort((a,b)=>a[0]-b[0]).filter(x=>x[0]*1000<Date.now()-300000); // complete candles only
 cache.set(mint,{t:Date.now(),b});if(cache.size>500)cache.delete(cache.keys().next().value);return b}
function log(o){try{fs.appendFileSync(LF,JSON.stringify({t:Date.now(),...o})+'\n')}catch{}}
async function priceNow(mint){try{const a=await j('https://api.dexscreener.com/tokens/v1/solana/'+mint);const p=a.sort((x,y)=>(y.liquidity?.usd||0)-(x.liquidity?.usd||0))[0];return p?+p.priceUsd:null}catch{return null}}
// after 30 min, record what the coin did after a skill acted (block → move we avoided; exit → move after we sold)
function follow(o){if(!o.px0)return;setTimeout(async()=>{const p=await priceNow(o.mint);if(p)log({...o,kind:'after',after30:+((p/o.px0-1)*100).toFixed(1)})},30*6e4).unref?.()}
async function entryOk(mint,symbol,pair){const on=S.skillNoChase||S.skillMomentum;if(!on)return {ok:true};let b=null;
 try{b=await candles(mint)}catch(e){console.log(`[skills] ${symbol} candles unavailable (${e.message}), skills skipped for this buy`);
  const h1=pair?.priceChange?.h1;if(S.skillNoChase&&h1!=null&&h1>S.skillNoChasePct)return block('skillNoChase',mint,symbol,`already up ${px(h1)} in 1h (DexScreener)`,pair);return {ok:true}}
 if(!b||b.length<4)return {ok:true};const c=b.at(-1)[4];
 if(S.skillNoChase){const ref=b.length>=12?b.at(-12)[4]:b[0][4];const run=(c/ref-1)*100;if(run>S.skillNoChasePct)return block('skillNoChase',mint,symbol,`already up ${px(run)} in the last hour (limit +${S.skillNoChasePct}%)`,pair)}
 if(S.skillMomentum){const l3=b.slice(-3),g=l3.filter(x=>x[4]>x[1]).length,vu=b.at(-1)[5]>b.at(-2)[5];if(g<2||!vu)return block('skillMomentum',mint,symbol,`momentum not confirmed (${g}/3 green candles, volume ${vu?'rising':'falling'})`,pair)}
 return {ok:true}}
function block(skill,mint,symbol,why,pair){console.log(`[skills] ${symbol} blocked by ${skill}: ${why}`);const o={skill,kind:'block',mint,symbol,why,px0:+pair?.priceUsd||null};log(o);follow(o);return {ok:false,skill,why}}
// exit check called from the monitor for SNIPE/BIG positions
function volExit(p,pair,curCh,age){if(!S.skillVolExit||p.tier==='MOON'||!pair)return null;const v=pair.volume?.m5;if(v==null)return null;if(p.v0==null){p.v0=p.features?.v5||v;return null}
 if(age>=10&&curCh<5&&p.v0>0&&v<p.v0*S.skillVolExitPct/100){const o={skill:'skillVolExit',kind:'exit',mint:p.mint,symbol:p.symbol,at:+curCh.toFixed(1),px0:+pair.priceUsd||null};log(o);follow(o);
  return `🧠 Volume dried up: 5m volume fell to ${Math.round(v/p.v0*100)}% of entry (limit ${S.skillVolExitPct}%) while under +5%, closed at ${px(curCh)}`}return null}
function report(){let L=[];try{L=fs.readFileSync(LF,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x))}catch{}
 const since=Date.now()-7*864e5;const rows=[['skillNoChase','🚫 No chasing pumps',`skip coins already up more than +${S.skillNoChasePct}% in 1h`],['skillMomentum','📈 Momentum check','2 of last 3 candles green + volume rising'],['skillVolExit','💧 Volume-dry exit',`sell if 5m volume < ${S.skillVolExitPct}% of entry while under +5%`]];
 const out=rows.map(([k,n,d])=>{const acts=L.filter(x=>x.skill===k&&x.t>=since&&x.kind!=='after'),aft=L.filter(x=>x.skill===k&&x.t>=since&&x.kind==='after');
  const avg=aft.length?aft.reduce((a,x)=>a+x.after30,0)/aft.length:null;const lab=k==='skillVolExit'?'exits':'blocks';
  return `${S[k]?'✅ ON ':'⛔ OFF'} <b>${n}</b>\n   ${d}\n   7d: ${acts.length} ${lab}${avg==null?'':` · coins moved ${px(avg)} in the 30 min after (${avg<0?'loss avoided':'missed gain'})`}`});
 return `🧠 <b>SKILLS</b> (Snipe + Big Play; not Moonbag)\n\n${out.join('\n\n')}\n\nTurn each on/off in /set → Skills. Details: /help → Skills.`}
function install(bot){bot.command('skills',c=>c.reply(report(),{parse_mode:'HTML'}))}
module.exports={entryOk,volExit,report,install,candles};
