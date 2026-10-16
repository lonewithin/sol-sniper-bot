// 🌙 MOONBAG: separate strategy aimed at 10-100x runners. Own entry filter (from the backtest of past peaks: busy, buyer-led, accelerating
// coins with real liquidity), sells moonSellPct% at moonLockAt% gain, rest rides a wide trailing stop. Paper only unless the owner changes it.
const {settings:S}=require('./config');const T=require('./trader');
function filter(d,f){const R=[];f=f||{};if((d.score||0)<S.moonMinScore)R.push('safety '+d.score);if((d.liqUsd||f.liq||0)<S.moonMinLiq)R.push('liq');
 if((f.buys||0)<S.moonMinBuys)R.push('buys '+(f.buys||0));if((f.ratio||0)<S.moonMinRatio)R.push('buy/sell '+(f.ratio||0));if((f.accel||0)<S.moonMinAccel)R.push('accel '+(f.accel||0));
 const pc=f.pc5||0;if(pc<S.moonMinPc5)R.push('5m dump '+pc+'%');if(pc>S.moonMaxPc5)R.push('5m spike '+pc+'%');if((f.v5||0)<S.moonMinVol5)R.push('5m vol $'+Math.round(f.v5||0));
 if(d.hard?.length)R.push('hard: '+d.hard.join(','));return R}
function rules(){return {tp:0,sl:S.moonSl,trail:S.moonTrail,maxMin:S.moonMaxHoldH*60,partialAt:0,size:1}}
async function check(t,d,m,log=console.log){if(!S.moon||!S.auto)return;const fail=filter(d,m.f);if(fail.length)return;
 if(T.st.open.find(p=>p.mint===t.mint))return;
 if(S.holderCheck){const hc=await require('./holders').check(t.mint,d).catch(()=>({ok:true}));if(!hc.ok){log(`[MOON] ${d.symbol} skip holders: ${hc.fails.join(', ')}`);return}}
 log(`[MOON] ${d.symbol} passes moon filter (buys ${m.f.buys} ratio ${m.f.ratio} accel ${m.f.accel} 5m ${m.f.pc5}%) BUY`);
 try{await T.buy({mint:t.mint,symbol:d.symbol},S.moonBuySol,{tier:'MOON',pot:m.potential,safety:d.score,features:{entry:'moon',...m.f,px:+d.priceUsd||null}});require('./counters').bought()}catch(e){log('[MOON] buy skip '+e.message)}}
module.exports={check,filter,rules};
