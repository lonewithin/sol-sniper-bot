// Holder concentration check (top10 excl. pool/curve, dev %). Uses safety score data first, then RPC fallback. Cached; fails open.
const {settings:S}=require('./config');const {rpc}=require('./safety');
const cache=new Map();const TTL=10*6e4;
async function check(mint,d={}){const c=cache.get(mint);if(c&&Date.now()-c.t<TTL)return c.r;
 let top10=d.top10??null,dev=d.devPct??null,src='rugcheck';
 if(top10==null){try{const [l,sup]=await Promise.all([rpc('getTokenLargestAccounts',[mint]),rpc('getTokenSupply',[mint])]);const tot=Number(sup.value.uiAmount);
  const v=(l.value||[]).slice(1,11);if(tot>0){top10=v.reduce((a,x)=>a+Number(x.uiAmount||0),0)/tot*100;src='rpc'}}catch{src='unknown'}}
 if(top10!=null&&!(top10>=0))top10=null;else if(top10!=null)top10=Math.min(100,top10);const fails=[];if(top10!=null&&top10>S.maxTop10Pct)fails.push(`top10 ${top10.toFixed(1)}% > ${S.maxTop10Pct}%`);if(dev!=null&&dev>S.maxDevHoldPct)fails.push(`dev ${dev}% > ${S.maxDevHoldPct}%`);
 const r={ok:!S.holderCheck||!fails.length,fails,top10:top10==null?null:+top10.toFixed(1),dev,src};
 cache.set(mint,{t:Date.now(),r});if(cache.size>2000)cache.delete(cache.keys().next().value);return r;}
module.exports={check};
