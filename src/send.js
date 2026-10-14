// Fast send: cached blockhash, skipPreflight, parallel to all RPCs, optional Jito bundle with tip.
const {Connection,VersionedTransaction,TransactionMessage,SystemProgram,PublicKey}=require('@solana/web3.js');const bs58=require('bs58').default||require('bs58');
const {RPC,settings:S}=require('./config');
const urls=[RPC,...(process.env.RPC_URLS||'').split(',').map(s=>s.trim()).filter(Boolean)];const conns=urls.map(u=>new Connection(u,'confirmed'));
const JITO=process.env.JITO_URL||'';const TIPS=['96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5','HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe','Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY','ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49'];
let bh=null,bhT=0,timer=null;
async function refresh(){try{bh=await conns[0].getLatestBlockhash('confirmed');bhT=Date.now()}catch{}}
function startBlockhashCache(){if(!timer){refresh();timer=setInterval(refresh,2000);timer.unref?.()}}
async function blockhash(){if(!bh||Date.now()-bhT>5000)await refresh();return bh;}
// sign raw tx bytes, swap in cached blockhash, send everywhere
async function signAndSend(bytes,kp,{tipLamports=S.jitoTipLamports||0}={}){
 const tx=VersionedTransaction.deserialize(bytes);const b=await blockhash();if(b)tx.message.recentBlockhash=b.blockhash;tx.sign([kp]);
 const raw=tx.serialize();const sig=bs58.encode(tx.signatures[0]);const tSigned=Date.now();
 const sends=conns.map(c=>c.sendRawTransaction(raw,{skipPreflight:true,maxRetries:2}).catch(e=>e));
 if(JITO&&tipLamports>0){const msg=new TransactionMessage({payerKey:kp.publicKey,recentBlockhash:b.blockhash,instructions:[SystemProgram.transfer({fromPubkey:kp.publicKey,toPubkey:new PublicKey(TIPS[Math.random()*4|0]),lamports:tipLamports})]}).compileToV0Message();
  const tip=new VersionedTransaction(msg);tip.sign([kp]);
  sends.push(fetch(JITO.replace(/\/$/,'')+'/api/v1/bundles',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'sendBundle',params:[[bs58.encode(raw),bs58.encode(tip.serialize())]]})}).catch(e=>e));}
 await Promise.race(sends);return {sig,tSigned,tSent:Date.now()};}
async function confirm(sig,ms=30000){const t=Date.now();while(Date.now()-t<ms){const r=await conns[0].getSignatureStatuses([sig]).catch(()=>null);const s=r?.value?.[0];
 if(s?.err)throw new Error('tx failed '+sig);if(s&&['confirmed','finalized'].includes(s.confirmationStatus))return true;await new Promise(r=>setTimeout(r,500));}throw new Error('confirm timeout '+sig);}
module.exports={signAndSend,confirm,startBlockhashCache,blockhash,conns,urls};
