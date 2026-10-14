const fs=require('fs'),path=require('path');const {Connection,VersionedTransaction,LAMPORTS_PER_SOL}=require('@solana/web3.js');
const {settings:S,DATA,RPC,SOL}=require('./config');const {quote,rpc}=require('./safety');const j=require('./http');const W=require('./wallet');
const {potential,pairsFor,rules}=require('./potential');const L=require('./log');
let notify=()=>{};const dec=async m=>{try{return (await rpc('getTokenSupply',[m])).value.decimals}catch{return 6}};
const fp=x=>x<1e-6?x.toExponential(3):x.toPrecision(4);
const PF=path.join(DATA,'positions.json');let st={open:[],closed:[],daily:{}};try{st=JSON.parse(fs.readFileSync(PF))}catch{}
const save=()=>fs.writeFileSync(PF,JSON.stringify(st,null,1));const conn=new Connection(RPC,'confirmed');
const today=()=>new Date().toISOString().slice(0,10);
const SND=require('./send');const F=require('./fast');
async function swap(q){const kp=W.load();const r=await j('https://lite-api.jup.ag/swap/v1/swap',{method:'POST',body:JSON.stringify({quoteResponse:q,userPublicKey:kp.publicKey.toBase58(),wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,prioritizationFeeLamports:S.priorityLamports})},15000);
 const {sig}=await SND.signAndSend(Buffer.from(r.swapTransaction,'base64'),kp);await SND.confirm(sig);return sig;}
// FAST buy via PumpPortal (bonding curve / PumpSwap). Returns position. Latency logged from detection time tDetect.
async function fastBuy(ev,sol=S.buySol,{tDetect=Date.now(),reasons=[]}={}){
 sol=+Math.min(sol,S.maxPerTrade).toFixed(4);const spent=st.daily[today()]||0;
 if(spent+sol>S.maxDailySol)throw new Error('daily cap');if(st.open.filter(p=>p.tier!=='BIG').length>=S.maxOpen)throw new Error('max open positions');if(st.open.find(p=>p.mint===ev.mint))throw new Error('already holding');
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
 const r=rules('SCALP');const p={mint:ev.mint,symbol:ev.symbol||'?',solIn:sol,tokens:tokens||'0',tokens0:tokens||'0',realized:0,decimals:6,entry:tokens?sol/(Number(tokens)/1e6):0,peak:0,opened:Date.now(),sig,paper:S.paper,fast:true,tier:'FAST',rules:{...r,maxMin:S.fastMaxMin},pot:null,safety:null,lat,pendingPostCheck:true};
 st.open.push(p);save();W.countTrade();
 notify(`⚡ FAST BUY ${p.symbol} (${ev.txType})${p.paper?' [paper]':''}\nSOL in: ${sol} · detect→${tSent?'sent':'signed'} ${tSent?lat.detectToSent:lat.detectToSigned}ms\n${reasons.join(' ')}\n<code>${p.mint}</code>${p.paper?'':'\ntx: '+sig}`);return p;}
async function pumpSell(p,pct){const kp=W.load();const bytes=await F.build(kp.publicKey.toBase58(),'sell',p.mint,pct+'%',{pool:'auto',denomSol:false});const {sig}=await SND.signAndSend(bytes,kp);await SND.confirm(sig).catch(()=>{});return sig;}
async function buy(tok,sol=S.buySol,{manual=false,tier='SWING',pot=null,safety=null,features=null}={}){
 const r=rules(tier)||rules('SWING');
 if(!manual&&(S.sizeByPotential||tier==='SECOND'))sol=sol*r.size;sol=+Math.min(sol,tier==='BIG'?Math.max(S.maxPerTrade,S.bigBuySol):S.maxPerTrade).toFixed(4);const big=tier==='BIG';const dk=(big?'big:':'')+today();const spent=st.daily[dk]||0;const cap=big?S.bigMaxDailySol:S.maxDailySol;
 if(spent+sol>cap)throw new Error(`daily cap ${cap} SOL reached`);
 if(st.open.filter(p=>(p.tier==='BIG')===big).length>=(big?S.bigMaxOpen:S.maxOpen))throw new Error('max open positions');if(st.open.find(p=>p.mint===tok.mint))throw new Error('already holding');
 const lam=Math.round(sol*LAMPORTS_PER_SOL);const q=await quote(SOL,tok.mint,lam,S.slippageBps);
 const sig=S.paper?'PAPER':await swap(q);st.daily[dk]=spent+sol;
 const decimals=await dec(tok.mint);const entry=sol/(Number(q.outAmount)/10**decimals);
 const p={mint:tok.mint,symbol:tok.symbol||'?',solIn:sol,tokens:q.outAmount,tokens0:q.outAmount,realized:0,decimals,entry,peak:0,opened:Date.now(),sig,paper:S.paper,manual,tier,rules:r,pot,safety,features};st.open.push(p);save();W.countTrade();
 notify(`🟢 BUY ${p.symbol} · ${tier==='SECOND'?'🔁 SECOND CHANCE':tier==='BIG'?'🐋 BIG PLAY':tier}${manual?' (manual)':''}${p.paper?' [paper]':''}\nSOL in: ${sol} · potential ${pot??'-'} · safety ${safety??'-'}\nEntry: ${fp(entry)} SOL/token\nPlan: ${r.tp?'TP +'+r.tp+'% ':''}${r.partialAt?'sell 50% at +'+r.partialAt+'% ':''}SL -${r.sl}%${r.trail?' trail '+r.trail+'%':''} max ${r.maxMin}m\n<code>${p.mint}</code>${p.paper?'':'\ntx: '+sig}`);return p;}
async function value(p,amt=p.tokens){const q=await quote(p.mint,SOL,amt,S.slippageBps);return {q,sol:Number(q.outAmount)/LAMPORTS_PER_SOL};}
async function sell(p,why,frac=1){const amt=frac>=1?p.tokens:String(BigInt(p.tokens)*BigInt(Math.round(frac*1000))/1000n);
 let sol=0,sig='PAPER';try{const v=await value(p,amt);sol=v.sol;if(!p.paper)sig=await swap(v.q);}catch(e){if(p.paper){}else if(p.fast){sig=await pumpSell(p,Math.round(frac*100))}else throw e}
 const exit=sol/(Number(amt)/10**(p.decimals??6));
 if(frac<1){p.tokens=String(BigInt(p.tokens)-BigInt(amt));p.realized+=sol;p.partial=true;save();
  notify(`🟡 PARTIAL SELL ${Math.round(frac*100)}% ${p.symbol} (${why})${p.paper?' [paper]':''}\nSOL out: ${sol.toFixed(5)} · Exit ${fp(exit)}`);return null;}
 const out=sol+p.realized;st.open=st.open.filter(x=>x!==p);
 const c={...p,solOut:out,exit,pnl:out-p.solIn,pnlPct:(out/p.solIn-1)*100,why,closed:Date.now(),holdMin:+((Date.now()-p.opened)/6e4).toFixed(1),sellSig:sig};st.closed.push(c);save();
 L.trade({mint:c.mint,symbol:c.symbol,tier:c.tier,pot:c.pot,safety:c.safety,features:c.features,solIn:c.solIn,solOut:out,pnl:c.pnl,pnlPct:+c.pnlPct.toFixed(2),why,holdMin:c.holdMin,paper:c.paper,opened:c.opened,closed:c.closed});
 notify(`${c.pnl>=0?'✅ WIN':'🔻 LOSS'} SELL ${c.symbol} · ${c.tier} (${why})${c.paper?' [paper]':''}\nSOL in: ${c.solIn} → out: ${out.toFixed(5)} · held ${c.holdMin}m\nEntry: ${fp(c.entry||0)} → Exit: ${fp(exit)} SOL/token\nPnL: ${c.pnl>=0?'+':''}${c.pnl.toFixed(5)} SOL (${c.pnlPct>=0?'+':''}${c.pnlPct.toFixed(1)}%)${c.paper?'':'\ntx: '+sig}`);return c;}
async function monitor(){const due=st.open.filter(p=>p.tier!=='BIG'||!p.lastChk||Date.now()-p.lastChk>=S.bigPollSec*1000);if(!due.length)return;const pairs=await pairsFor(due.map(p=>p.mint));
 for(const p of due){p.lastChk=Date.now();try{const r=p.rules||rules('SWING');const rest=Number(p.tokens)/Number(p.tokens0||p.tokens);
  const {sol}=await value(p);p.last=sol;const ch=((sol+p.realized)/(p.solIn)-1)*100;const curCh=(sol/(p.solIn*rest)-1)*100;
  p.peak=Math.max(p.peak||0,curCh);const age=(Date.now()-p.opened)/6e4;
  const m=potential(pairs[p.mint],{safety:p.safety||S.minScore,mint:p.mint});p.potNow=m.potential;let why=null;
  if(curCh<=-r.sl)why=`SL ${ch.toFixed(1)}%`;
  else if(r.partialAt&&!p.partial&&curCh>=r.partialAt){await sell(p,`partial +${curCh.toFixed(1)}%`,0.5);continue;}
  else if(r.tp&&curCh>=r.tp)why=`TP +${ch.toFixed(1)}%`;
  else if((r.trail||S.trailingPct)&&p.peak>=10&&curCh<=p.peak-(r.trail||S.trailingPct))why=`trailing (peak +${p.peak.toFixed(1)}%) ${ch.toFixed(1)}%`;
  else if(age>=r.maxMin)why=`time stop ${r.maxMin}m (${ch.toFixed(1)}%)`;
  else if(p.tier!=='BIG'&&age>=1&&m.potential<S.momentumExit&&pairs[p.mint])why=`momentum died (pot ${m.potential}) ${ch.toFixed(1)}%`;
  if(why)await sell(p,why);}catch(e){}}save();}
const balance=async()=>(await conn.getBalance(W.load().publicKey))/LAMPORTS_PER_SOL;
const stats=()=>{const c=st.closed,w=c.filter(x=>x.pnl>0).length,i=c.reduce((a,x)=>a+x.solIn,0),o=c.reduce((a,x)=>a+x.solOut,0);return {n:c.length,wins:w,losses:c.length-w,winRate:c.length?w/c.length*100:0,solIn:i,solOut:o,pnl:o-i,pnlPct:i?(o/i-1)*100:0}};
async function withdraw(to,amt){const {PublicKey,SystemProgram,Transaction,sendAndConfirmTransaction}=require('@solana/web3.js');const kp=W.load();const dest=new PublicKey(to);
 const bal=await conn.getBalance(kp.publicKey);const RES=10000;let lam=amt==='all'?bal-RES:Math.round(Number(amt)*LAMPORTS_PER_SOL);
 if(!(lam>0))throw new Error('Nothing to withdraw');if(lam>bal-5000)throw new Error('Insufficient balance (keep fee)');
 return sendAndConfirmTransaction(conn,new Transaction().add(SystemProgram.transfer({fromPubkey:kp.publicKey,toPubkey:dest,lamports:lam})),[kp]);}
module.exports={fastBuy,setNotify:f=>notify=f,stats,withdraw,buy,sell,monitor,st,balance,sellAll:async why=>{const out=[];for(const p of [...st.open])out.push(await sell(p,why).catch(e=>({symbol:p.symbol,err:e.message})));return out}};
