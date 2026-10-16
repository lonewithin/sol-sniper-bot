// USD-based trade size (paper): every mode trades $buyUsdMin..$buyUsdMax, converted to SOL at the live SOL price.
const {settings:S}=require('./config');const j=require('./http');
let px=null,pxT=0;
async function solUsd(){if(px&&Date.now()-pxT<60000)return px;try{const a=await j('https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112');const v=+a.sort((x,y)=>(y.liquidity?.usd||0)-(x.liquidity?.usd||0))[0].priceUsd;if(v>1){px=v;pxT=Date.now()}}catch{}return px}
// grade -> where in the $min..$max range it sits
const W={FAST:0,SCALP:0,SECOND:0,SWING:0.25,RUNNER:0.6,BIG:1,MOON:1};
const on=()=>S.usdSizing&&S.paper&&S.buyUsdMax>0;
const usdFor=tier=>{const lo=Math.min(S.buyUsdMin,S.buyUsdMax),hi=Math.max(S.buyUsdMin,S.buyUsdMax);return +(lo+(hi-lo)*(W[tier]??0.25)).toFixed(2)};
async function solFor(tier,factor=1){const p=await solUsd();if(!p)return null;const lo=Math.min(S.buyUsdMin,S.buyUsdMax),hi=Math.max(S.buyUsdMin,S.buyUsdMax);const u=Math.max(lo,Math.min(hi,usdFor(tier)*factor));return {sol:+(u/p).toFixed(4),usd:+u.toFixed(2),px:p}}
const table=()=>`$${usdFor('SCALP')} Scalp/Second/Fast · $${usdFor('SWING')} Swing · $${usdFor('RUNNER')} Runner · $${usdFor('BIG')} Big Play · $${usdFor('MOON')} Moonbag`;
module.exports={on,solFor,usdFor,solUsd,table};
