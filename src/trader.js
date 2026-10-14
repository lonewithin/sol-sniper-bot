const fs=require('fs'),path=require('path');const {Connection,VersionedTransaction,LAMPORTS_PER_SOL}=require('@solana/web3.js');
const {settings:S,DATA,RPC,SOL}=require('./config');const {quote,rpc}=require('./safety');let notify=()=>{};
const dec=async m=>{try{return (await rpc('getTokenSupply',[m])).value.decimals}catch{return 6}};
const fp=x=>x<1e-6?x.toExponential(3):x.toPrecision(4);const j=require('./http');const W=require('./wallet');
const PF=path.join(DATA,'positions.json');let st={open:[],closed:[],daily:{}};try{st=JSON.parse(fs.readFileSync(PF))}catch{}
const save=()=>fs.writeFileSync(PF,JSON.stringify(st,null,1));const conn=new Connection(RPC,'confirmed');
const today=()=>new Date().toISOString().slice(0,10);
async function swap(q){ // live only
 const kp=W.load();const r=await j('https://lite-api.jup.ag/swap/v1/swap',{method:'POST',body:JSON.stringify({quoteResponse:q,userPublicKey:kp.publicKey.toBase58(),wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,prioritizationFeeLamports:S.priorityLamports})},15000);
 const tx=VersionedTransaction.deserialize(Buffer.from(r.swapTransaction,'base64'));tx.sign([kp]);
 const sig=await conn.sendRawTransaction(tx.serialize(),{skipPreflight:true,maxRetries:3});
 const c=await conn.confirmTransaction({signature:sig,...(await conn.getLatestBlockhash())},'confirmed');if(c.value.err)throw new Error('tx failed '+sig);return sig;}
async function buy(tok,sol=S.buySol,{manual=false}={}){
 sol=Math.min(sol,S.maxPerTrade);const spent=st.daily[today()]||0;
 if(spent+sol>S.maxDailySol)throw new Error(`daily cap ${S.maxDailySol} SOL reached`);
 if(st.open.length>=S.maxOpen)throw new Error('max open positions');if(st.open.find(p=>p.mint===tok.mint))throw new Error('already holding');
 const lam=Math.round(sol*LAMPORTS_PER_SOL);const q=await quote(SOL,tok.mint,lam,S.slippageBps);
 const sig=S.paper?'PAPER':await swap(q);st.daily[today()]=spent+sol;
 const decimals=await dec(tok.mint);const entry=sol/(Number(q.outAmount)/10**decimals);
 const p={mint:tok.mint,symbol:tok.symbol||'?',solIn:sol,tokens:q.outAmount,decimals,entry,peak:sol,opened:Date.now(),sig,paper:S.paper,manual};st.open.push(p);save();
 notify(`🟢 BUY ${p.symbol}${manual?' (manual)':' (auto)'}${p.paper?' [paper]':''}\nSOL in: ${sol}\nEntry: ${fp(entry)} SOL/token\n<code>${p.mint}</code>${p.paper?'':'\ntx: '+sig}`);return p;}
async function value(p){const q=await quote(p.mint,SOL,p.tokens,S.slippageBps);return {q,sol:Number(q.outAmount)/LAMPORTS_PER_SOL};}
async function sell(p,why){let sol=0,sig='PAPER';try{const v=await value(p);sol=v.sol;if(!p.paper)sig=await swap(v.q);}catch(e){if(!p.paper)throw e}
 st.open=st.open.filter(x=>x!==p);const exit=sol/(Number(p.tokens)/10**(p.decimals??6));const c={...p,solOut:sol,exit,pnl:sol-p.solIn,pnlPct:(sol/p.solIn-1)*100,why,closed:Date.now(),sellSig:sig};st.closed.push(c);save();
 notify(`${c.pnl>=0?'✅ WIN':'🔻 LOSS'} SELL ${c.symbol} (${why})${c.paper?' [paper]':''}\nSOL in: ${c.solIn} → out: ${sol.toFixed(5)}\nEntry: ${fp(c.entry||0)} → Exit: ${fp(exit)} SOL/token\nPnL: ${c.pnl>=0?'+':''}${c.pnl.toFixed(5)} SOL (${c.pnlPct>=0?'+':''}${c.pnlPct.toFixed(1)}%)${c.paper?'':'\ntx: '+sig}`);return c;}
async function monitor(){for(const p of [...st.open]){try{const {sol}=await value(p);p.last=sol;p.peak=Math.max(p.peak,sol);const ch=(sol/p.solIn-1)*100;let why=null;
  if(ch>=S.tpPct)why=`TP +${ch.toFixed(1)}%`;else if(ch<=-S.slPct)why=`SL ${ch.toFixed(1)}%`;
  else if(S.trailingPct>0&&p.peak>p.solIn*1.1&&sol<=p.peak*(1-S.trailingPct/100))why=`Trailing stop ${ch.toFixed(1)}%`;
  if(why)await sell(p,why);}catch(e){}}save();}
const balance=async()=>(await conn.getBalance(W.load().publicKey))/LAMPORTS_PER_SOL;
const stats=()=>{const c=st.closed,w=c.filter(x=>x.pnl>0).length,i=c.reduce((a,x)=>a+x.solIn,0),o=c.reduce((a,x)=>a+x.solOut,0);return {n:c.length,wins:w,losses:c.length-w,winRate:c.length?w/c.length*100:0,solIn:i,solOut:o,pnl:o-i,pnlPct:i?(o/i-1)*100:0}};
async function withdraw(to,amt){const {PublicKey,SystemProgram,Transaction,sendAndConfirmTransaction}=require('@solana/web3.js');const kp=W.load();const dest=new PublicKey(to);
 const bal=await conn.getBalance(kp.publicKey);const RES=10000;let lam=amt==='all'?bal-RES:Math.round(Number(amt)*LAMPORTS_PER_SOL);
 if(!(lam>0))throw new Error('Nothing to withdraw');if(lam>bal-5000)throw new Error('Insufficient balance (keep fee)');
 return sendAndConfirmTransaction(conn,new Transaction().add(SystemProgram.transfer({fromPubkey:kp.publicKey,toPubkey:dest,lamports:lam})),[kp]);}
module.exports={setNotify:f=>notify=f,stats,withdraw,buy,sell,monitor,st,balance,sellAll:async why=>{const out=[];for(const p of [...st.open])out.push(await sell(p,why).catch(e=>({symbol:p.symbol,err:e.message})));return out}};
