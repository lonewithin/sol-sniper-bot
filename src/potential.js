// Momentum "potential" score 0-100 + tier selection. Uses DexScreener pair data (+ previous snapshot for deltas).
const j=require('./http');const {settings:S}=require('./config');
const prev=new Map(); // mint -> {t,liq,holders}
async function pairsFor(mints){const out={};for(let i=0;i<mints.length;i+=30){try{const a=await j('https://api.dexscreener.com/tokens/v1/solana/'+mints.slice(i,i+30).join(','));
 for(const p of a){const m=p.baseToken?.address;if(!out[m]||(p.liquidity?.usd||0)>(out[m].liquidity?.usd||0))out[m]=p}}catch{}}return out;}
function potential(pair,{safety=0,holders=null,mint}={}){
 const R=[];let pts=0;const add=(n,w)=>{pts+=n;R.push(`${n>=0?'+':''}${n} ${w}`)};
 if(!pair)return {potential:0,tier:'SKIP',reasons:['no pair data'],f:{}};
 const t=pair.txns?.m5||{},b=t.buys||0,s=t.sells||0,ratio=(b+1)/(s+1);
 const v5=pair.volume?.m5||0,v1=pair.volume?.h1||0,accel=v1>0?v5/(v1/12):(v5>0?3:0);
 const pc5=pair.priceChange?.m5||0,liq=pair.liquidity?.usd||0;
 const pv=prev.get(mint),liqCh=pv&&pv.liq?(liq/pv.liq-1)*100:0,hGrow=pv&&holders&&pv.holders?(holders/pv.holders-1)*100:0;
 prev.set(mint,{t:Date.now(),liq,holders});if(prev.size>3000)prev.delete(prev.keys().next().value);
 add(Math.max(-15,Math.min(25,Math.round((ratio-1)*20))),`buy/sell m5 ${b}/${s}`);
 add(Math.max(-10,Math.min(20,Math.round((accel-1)*8))),`vol accel x${accel.toFixed(2)} ($${v5.toFixed(0)} m5)`);
 add(pc5>60?-5:Math.max(-15,Math.min(15,Math.round(pc5/2))),`price m5 ${pc5}%${pc5>60?' (overextended)':''}`);
 if(pv)add(Math.max(-15,Math.min(10,Math.round(liqCh))),`liq Δ ${liqCh.toFixed(1)}%`);
 if(hGrow)add(Math.max(-5,Math.min(10,Math.round(hGrow))),`holders Δ ${hGrow.toFixed(1)}%`);
 add(b+s>=40?10:b+s>=10?5:-5,`activity ${b+s} txns m5`);
 add(Math.round((safety-50)/5),`safety ${safety}`);
 const pot=Math.max(0,Math.min(100,pts+20));
 const tier=safety<S.minScore?'SKIP':pot>=S.potRunner?'RUNNER':pot>=S.potSwing?'SWING':pot>=S.potScalp?'SCALP':'SKIP';
 return {potential:pot,tier,reasons:R,f:{buys:b,sells:s,ratio:+ratio.toFixed(2),accel:+accel.toFixed(2),pc5,liq,liqCh:+liqCh.toFixed(1),hGrow:+hGrow.toFixed(1),v5,safety}};}
function rules(tier){return {
 SCALP:{tp:S.scalpTp,sl:S.scalpSl,trail:0,maxMin:S.scalpMaxMin,partialAt:0,size:0.6},
 SWING:{tp:S.swingTp,sl:S.swingSl,trail:S.swingTrail,maxMin:S.swingMaxMin,partialAt:0,size:1},
 SECOND:{tp:0,sl:S.secondChanceSl,trail:S.runnerTrail,maxMin:S.runnerMaxMin,partialAt:S.runnerPartialAt,size:S.secondChanceSize},
 RUNNER:{tp:0,sl:S.runnerSl,trail:S.runnerTrail,maxMin:S.runnerMaxMin,partialAt:S.runnerPartialAt,size:1.5}}[tier];}
module.exports={potential,pairsFor,rules};
