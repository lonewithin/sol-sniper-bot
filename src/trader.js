const fs=require('fs'),path=require('path');const {Connection,VersionedTransaction,LAMPORTS_PER_SOL}=require('@solana/web3.js');
const {settings:S,DATA,RPC,SOL}=require('./config');const {quote,rpc}=require('./safety');const j=require('./http');const W=require('./wallet');
const {potential,pairsFor,rules}=require('./potential');const L=require('./log');
let notify=()=>{};
const label=p=>p.tier==='BIG'?'💎 BIG PLAY':p.tier==='SECOND'?'🔁 SECOND CHANCE':`🎯 SNIPER · ${p.tier==='FAST'?'SCALP':(p.tier||'?')} · ${p.fast?'⚡ fast':'🛡 safe'}`;const dec=async m=>{try{return (await rpc('getTokenSupply',[m])).value.decimals}catch{return 6}};
const fp=x=>x<1e-6?x.toExponential(3):x.toPrecision(4);
const PF=path.join(DATA,'positions.json');let st={open:[],closed:[],daily:{}};try{st=JSON.parse(fs.readFileSync(PF))}catch{}for(const p of st.open)if(p.partial&&p.halfDone==null)p.halfDone=true;
const save=()=>fs.writeFileSync(PF,JSON.stringify(st,null,1));const conn=new Connection(RPC,'confirmed');
const today=()=>new Date().toISOString().slice(0,10);
const SND=require('./send');const F=require('./fast');
async function swap(q){const kp=W.load();const r=await j('https://lite-api.jup.ag/swap/v1/swap',{method:'POST',body:JSON.stringify({quoteResponse:q,userPublicKey:kp.publicKey.toBase58(),wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,prioritizationFeeLamports:S.priorityLamports})},15000);
 const {sig}=await SND.signAndSend(Buffer.from(r.swapTransaction,'base64'),kp);await SND.confirm(sig);return sig;}
// FAST buy via PumpPortal (bonding curve / PumpSwap). Returns position. Latency logged from detection time tDetect.
// Paper-only unlimited test mode: never applies when paper is off.
const UNL=()=>S.paper===true&&S.paperUnlimited===true;
async function fastBuy(ev,sol=S.buySol,{tDetect=Date.now(),reasons=[]}={}){
 sol=+Math.min(sol,S.maxPerTrade).toFixed(4);const spent=st.daily[today()]||0;
 if(!UNL()&&spent+sol>S.maxDailySol+1e-9)throw new Error('daily cap');if(!UNL()&&st.open.filter(p=>p.tier!=='BIG').length>=S.maxOpen)throw new Error('max open positions');if(st.open.find(p=>p.mint===ev.mint))throw new Error('already holding');
 const kp=W.load();const pool=ev.txType==='migrate'||ev.pool==='pump-amm'?'pump-amm':'auto';
 const tB=Date.now();const bytes=await F.build(kp.publicKey.toBase58(),'buy',ev.mint,sol,{pool});const tBuilt=Date.now();
 let sig='PAPER',tSigned=tBuilt,tSent=null;
 if(!S.paper){const r=await SND.signAndSend(bytes,kp);sig=r.sig;tSigned=r.tSigned;tSent=r.tSent;}
 else{const {VersionedTransaction}=require('@solana/web3.js');const tx=VersionedTransaction.deserialize(bytes);const b=await SND.blockhash();if(b)tx.message.recentBlockhash=b.blockhash;tx.sign([kp]);tSigned=Date.now();}
 const lat={mint:ev.mint,src:ev.txType,paper:S.paper,detectToBuild:tB-tDetect,buildMs:tBuilt-tB,detectToSigned:tSigned-tDetect,detectToSent:tSent?tSent-tDetect:null,t:Date.now()};F.logLatency(lat);
 st.daily[today()]=spent+sol;
 // token amount: estimate via Jupiter quote (may fail for brand-new curves); refreshed by monitor
 let tokens=null;try{tokens=(await quote(SOL,ev.mint,Math.round(sol*LAMPORTS_PER_SOL),S.slippageBps)).outAmount}catch{}
 if(!tokens&&ev.vSolInBondingCurve&&ev.vTokensInBondingCurve)tokens=String(Math.floor(ev.vTokensInBondingCurve*1e6*(sol/(ev.vSolInBondingCurve+sol))));
 const r=rules('SCALP');const p={mint:ev.mint,symbol:ev.symbol||'?',solIn:sol,tokens:tokens||'0',tokens0:tokens||'0',realized:0,decimals:6,entry:tokens?sol/(Number(tokens)/1e6):0,peak:0,opened:Date.now(),sig,paper:S.paper,fast:true,tier:'FAST',rules:{...r,maxMin:S.fastMaxMin},pot:null,safety:null,lat,pendingPostCheck:true,ver:S.ver};
 st.open.push(p);save();W.countTrade();
 notify(`<b>${label(p)}</b>\n⚡ FAST BUY ${p.symbol} (${ev.txType})${p.paper?' [paper]':''}\nSOL in: ${sol} · detect→${tSent?'sent':'signed'} ${tSent?lat.detectToSent:lat.detectToSigned}ms\n${reasons.join(' ')}\n<code>${p.mint}</code>${p.paper?'':'\ntx: '+sig}`);return p;}
async function pumpSell(p,pct){const kp=W.load();const bytes=await F.build(kp.publicKey.toBase58(),'sell',p.mint,pct+'%',{pool:'auto',denomSol:false});const {sig}=await SND.signAndSend(bytes,kp);await SND.confirm(sig).catch(()=>{});return sig;}
async function buy(tok,sol=S.buySol,{manual=false,tier='SWING',pot=null,safety=null,features=null}={}){
 let r=rules(tier)||rules('SWING');if(tier==='BIG'&&features?.entry==='runner')r={...r,trail:S.runTrail};
 if(!manual){const tf=require('./signals').todFactor();if(tf.f<1){console.log(`[tod] ${tok.symbol||tok.mint} ${tier} size ×${tf.f}: ${tf.why}`);if(tf.f<=0)throw new Error('time-of-day skip');sol*=tf.f}}
 if(!manual&&(S.sizeByPotential||tier==='SECOND'))sol=sol*r.size;sol=+Math.min(sol,tier==='BIG'?S.bigBuySol:S.maxPerTrade).toFixed(4);const big=tier==='BIG';const dk=(big?'big:':'')+today();const spent=st.daily[dk]||0;const cap=big?S.bigMaxDailySol:S.maxDailySol;
 if(!UNL()&&spent+sol>cap+1e-9)throw new Error(`daily cap ${cap} SOL reached`);
 if(!UNL()&&st.open.filter(p=>(p.tier==='BIG')===big).length>=(big?S.bigMaxOpen:S.maxOpen))throw new Error('max open positions');if(st.open.find(p=>p.mint===tok.mint))throw new Error('already holding');
 const lam=Math.round(sol*LAMPORTS_PER_SOL);const q=await quote(SOL,tok.mint,lam,S.slippageBps);
 const sig=S.paper?'PAPER':await swap(q);st.daily[dk]=+(spent+sol).toFixed(6);
 const decimals=await dec(tok.mint);const entry=sol/(Number(q.outAmount)/10**decimals);
 const p={mint:tok.mint,symbol:tok.symbol||'?',solIn:sol,tokens:q.outAmount,tokens0:q.outAmount,realized:0,decimals,entry,peak:0,opened:Date.now(),sig,paper:S.paper,manual,tier,rules:r,pot,safety,features,ver:S.ver};st.open.push(p);save();W.countTrade();
 notify(`<b>${label(p)}</b>\n🟢 BUY ${p.symbol}${manual?' (manual)':''}${p.paper?' [paper]':''}\nSOL in: ${sol} · potential ${pot??'-'} · safety ${safety??'-'}\nEntry: ${fp(entry)} SOL/token\nPlan: ${r.earlyAt&&(!r.tp||r.tp>r.earlyAt)?'sell '+Math.round(r.earlyFrac*100)+'% at +'+r.earlyAt+'% ':''}${r.tp?'TP +'+r.tp+'% ':''}${r.partialAt?'sell 50% at +'+r.partialAt+'% ':''}SL -${r.sl}%${r.trail?' trail '+r.trail+'%':''} max ${r.maxMin}m\n<code>${p.mint}</code>${p.paper?'':'\ntx: '+sig}`);return p;}
async function value(p,amt=p.tokens){const q=await quote(p.mint,SOL,amt,S.slippageBps);return {q,sol:Number(q.outAmount)/LAMPORTS_PER_SOL};}
async function sell(p,why,frac=1){const amt=frac>=1?p.tokens:String(BigInt(p.tokens)*BigInt(Math.round(frac*1000))/1000n);
 let sol=0,sig='PAPER';try{const v=await value(p,amt);sol=v.sol;if(!p.paper)sig=await swap(v.q);}catch(e){if(p.paper){ // paper: a failed/rate-limited sell quote must not book a fake -100%; use the value the monitor just quoted
  if(p.last>0){sol=p.last*Number(amt)/Number(p.tokens);p.quoteFallback=true;console.log(`[paper] ${p.symbol} sell quote failed (${e.message}), using last quoted value ${sol.toFixed(5)} SOL`)}}else if(p.fast){sig=await pumpSell(p,Math.round(frac*100))}else throw e}
 if(p.paper&&sol>0)sol=Math.max(0,sol*(1-S.paperCostPct/100/(frac>=1?1:1))-S.priorityLamports/LAMPORTS_PER_SOL);
 const exit=sol/(Number(amt)/10**(p.decimals??6));
 if(frac<1){p.tokens=String(BigInt(p.tokens)-BigInt(amt));p.realized+=sol;p.partial=true;save();
  notify(`<b>${label(p)}</b>\n🟡 PARTIAL SELL ${Math.round(frac*100)}% ${p.symbol}${p.paper?' [paper]':''}\n📝 ${why}\nSOL out: ${sol.toFixed(5)} · Exit ${fp(exit)}`);return null;}
 const out=sol+p.realized;st.open=st.open.filter(x=>x!==p);
 const c={...p,solOut:out,exit,pnl:out-p.solIn,pnlPct:(out/p.solIn-1)*100,why,closed:Date.now(),holdMin:+((Date.now()-p.opened)/6e4).toFixed(1),sellSig:sig};st.closed.push(c);save();streak(c);try{require('./bigab').record(c)}catch(e){console.log('bigab',e.message)}
 L.trade({mint:c.mint,symbol:c.symbol,tier:c.tier,pot:c.pot,safety:c.safety,features:c.features,ver:c.ver||'v3',solIn:c.solIn,solOut:out,pnl:c.pnl,pnlPct:+c.pnlPct.toFixed(2),why,holdMin:c.holdMin,paper:c.paper,opened:c.opened,closed:c.closed});
 notify(`<b>${label(c)}</b>\n${c.pnl>=0?'✅ WIN':'🔻 LOSS'} SELL ${c.symbol}${c.paper?' [paper]':''}\n📝 ${why}\nSOL in: ${c.solIn} → out: ${out.toFixed(5)} · held ${c.holdMin}m\nEntry: ${fp(c.entry||0)} → Exit: ${fp(exit)} SOL/token\nPnL: ${c.pnl>=0?'+':''}${c.pnl.toFixed(5)} SOL (${c.pnlPct>=0?'+':''}${c.pnlPct.toFixed(1)}%)${c.paper?'':'\ntx: '+sig}`);return c;}
let pauseUntil=0,losses=0;function streak(c){if(c.tier==='BIG')return;if(c.pnl>0){losses=0;return}if(++losses>=S.lossStreakN&&S.lossStreakN>0&&!UNL()){losses=0;pauseUntil=Date.now()+S.lossPauseMin*6e4;notify(`⏸ ${S.lossStreakN} losses in a row: snipe + second chance buys paused ${S.lossPauseMin} min [${S.paper?'paper':'LIVE'}]`)}}
const paused=()=>Date.now()<pauseUntil;
async function monitor(){const due=st.open.filter(p=>p.tier!=='BIG'||!p.lastChk||Date.now()-p.lastChk>=S.bigPollSec*1000);if(!due.length)return;const pairs=await pairsFor(due.map(p=>p.mint));
 for(const p of due){p.lastChk=Date.now();try{const r=p.rules||rules('SWING');const rest=Number(p.tokens)/Number(p.tokens0||p.tokens);
  const {sol}=await value(p);p.last=sol;const ch=((sol+p.realized)/(p.solIn)-1)*100;const curCh=(sol/(p.solIn*rest)-1)*100;
  p.peak=Math.max(p.peak||0,curCh);const age=(Date.now()-p.opened)/6e4;
  const m=potential(pairs[p.mint],{safety:p.safety||S.minScore,mint:p.mint});p.potNow=m.potential;let why=null;
  const f1=x=>(x>=0?'+':'')+x.toFixed(1)+'%';const armRule=['SECOND','RUNNER','BIG'].includes(p.tier);const trail=r.trail||S.trailingPct;
  const armed=!armRule||p.peak>=S.trailArmPct||age>=S.trailGraceMin;
  if(curCh<=-r.sl)why=`Stop loss: fell ${(-curCh).toFixed(1)}% below entry (limit −${r.sl}%). Total ${f1(ch)}`;
  else if(p.partial&&curCh<=0)why=`Breakeven stop: after taking some profit, price fell back to entry. Total ${f1(ch)}`;
  else if(p.tier==='RUNNER'&&S.runnerLockAt>0&&p.peak>=S.runnerLockAt&&curCh<=S.runnerLockPct)why=`Profit lock: peaked +${p.peak.toFixed(0)}% then fell back to ${f1(curCh)}, selling before it turns into a loss. Total ${f1(ch)}`;
  else if(p.tier==='BIG'&&S.bigLockAt>0&&p.peak>=S.bigLockAt&&p.peak<(S.bigPartialAt||50)&&!p.halfDone&&curCh<=S.bigLockPct)why=`Profit lock: peaked +${p.peak.toFixed(0)}% (under half-sell) then fell back to ${f1(curCh)}, selling before it turns into a loss. Total ${f1(ch)}`;
  else if(r.earlyAt&&!p.early&&!p.halfDone&&(!r.tp||r.tp>r.earlyAt)&&curCh>=r.earlyAt){p.early=true;await sell(p,`Early take-profit: sold ${Math.round(r.earlyFrac*100)}% at ${f1(curCh)} (target +${r.earlyAt}%). Stop on the rest moved to breakeven`,r.earlyFrac);continue;}
  else if(r.partialAt&&!p.halfDone&&curCh>=r.partialAt){p.halfDone=true;await sell(p,`Partial take-profit: sold half at ${f1(curCh)} (target +${r.partialAt}%). Stop moved to breakeven; the rest rides with a ${trail}% trailing stop`,0.5);continue;}
  else if(r.tp&&curCh>=r.tp)why=`Take profit: hit ${f1(curCh)} (target +${r.tp}%)`;
  else if(trail&&armed&&p.peak>=10&&curCh<=p.peak-trail)why=`Trailing stop: fell ${(p.peak-curCh).toFixed(0)}% from its +${p.peak.toFixed(0)}% peak, locked ${f1(ch)}`;
  else if(p.tier==='BIG'&&S.bigFlatMin>0&&!p.halfDone&&age>=S.bigFlatMin&&p.peak<S.bigFlatPct)why=`Time stop: flat for ${age.toFixed(0)} min (never reached +${S.bigFlatPct}%), freeing the budget. Total ${f1(ch)}`;
  else if(p.tier==='BIG'&&S.bigFlatMin>0&&!p.halfDone&&age>=S.bigFlatMin&&p.peak>=S.bigFlatPct&&p.peak<(S.bigPartialAt||50)&&curCh<S.bigGaveBackPct)why=`Gave back early gain: peaked +${p.peak.toFixed(0)}% then sat at ${f1(curCh)} after ${age.toFixed(0)} min. Freeing the budget.`;
  else if(p.tier==='BIG'&&age>=(p.holdLim||r.maxMin)){const lim=p.holdLim||r.maxMin,next=lim+S.bigExtendH*60,pc=pairs[p.mint]?.priceChange||{};const mom=(pc.h1??0)>0&&(pc.m5??0)>=0;
   if(curCh>p.peak-trail&&mom&&S.bigExtendH>0&&next<=S.bigMaxHoldH*60){p.holdLim=next;notify(`<b>${label(p)}</b>\n⏳ Still running ${p.symbol} (${f1(ch)}, 1h ${(pc.h1??0).toFixed(1)}%): hold extended to ${(next/60).toFixed(0)}h (max ${S.bigMaxHoldH}h)`);}
   else why=`Time limit: held ${(lim/60).toFixed(0)}h${mom?'':', momentum faded'}, closed at ${f1(ch)}`;}
  else if(age>=r.maxMin)why=`Time limit: held ${r.maxMin>=120?(r.maxMin/60)+'h':r.maxMin+' min'}, closed at ${f1(ch)}`;
  else if(p.tier!=='BIG'&&age>=1&&m.potential<S.momentumExit&&pairs[p.mint])why=`Momentum faded: potential dropped to ${m.potential} (exit below ${S.momentumExit}), closed at ${f1(ch)}`;
  if(why)await sell(p,why);p.fails=0;}catch(e){p.fails=(p.fails||0)+1;const age=(Date.now()-p.opened)/6e4,r=p.rules||rules('SWING');if(p.paper&&p.tier!=='BIG'&&age>=r.maxMin+5&&p.fails>=6){st.open=st.open.filter(x=>x!==p);const out=(p.last||0)+p.realized;const c={...p,solOut:out,exit:0,pnl:out-p.solIn,pnlPct:(out/p.solIn-1)*100,why:'No sell quote (no route): closed at last known value',closed:Date.now(),holdMin:+age.toFixed(1),sellSig:'PAPER'};st.closed.push(c);L.trade({mint:c.mint,symbol:c.symbol,tier:c.tier,pot:c.pot,safety:c.safety,features:c.features,solIn:c.solIn,solOut:out,pnl:c.pnl,pnlPct:+c.pnlPct.toFixed(2),why:c.why,holdMin:c.holdMin,paper:true,opened:c.opened,closed:c.closed});notify(`<b>${label(c)}</b>\n${c.pnl>=0?'✅ WIN':'🔻 LOSS'} SELL ${c.symbol} [paper]\n📝 ${c.why}\nPnL: ${c.pnl>=0?'+':''}${c.pnl.toFixed(5)} SOL (${c.pnlPct.toFixed(1)}%) · held ${c.holdMin}m`)}}}save();}
const balance=async()=>UNL()?1e9:(await conn.getBalance(W.load().publicKey))/LAMPORTS_PER_SOL;
const stats=()=>{const c=st.closed,w=c.filter(x=>x.pnl>0).length,i=c.reduce((a,x)=>a+x.solIn,0),o=c.reduce((a,x)=>a+x.solOut,0);return {n:c.length,wins:w,losses:c.length-w,winRate:c.length?w/c.length*100:0,solIn:i,solOut:o,pnl:o-i,pnlPct:i?(o/i-1)*100:0}};
async function withdraw(to,amt){const {PublicKey,SystemProgram,Transaction,sendAndConfirmTransaction}=require('@solana/web3.js');const kp=W.load();const dest=new PublicKey(to);
 const bal=await conn.getBalance(kp.publicKey);const RES=10000;let lam=amt==='all'?bal-RES:Math.round(Number(amt)*LAMPORTS_PER_SOL);
 if(!(lam>0))throw new Error('Nothing to withdraw');if(lam>bal-5000)throw new Error('Insufficient balance (keep fee)');
 return sendAndConfirmTransaction(conn,new Transaction().add(SystemProgram.transfer({fromPubkey:kp.publicKey,toPubkey:dest,lamports:lam})),[kp]);}
module.exports={paused,label,fastBuy,setNotify:f=>notify=f,stats,withdraw,buy,sell,monitor,st,balance,sellAll:async why=>{const out=[];for(const p of [...st.open])out.push(await sell(p,why).catch(e=>({symbol:p.symbol,err:e.message})));return out}};
