// Burner rotation: create new wallet, sweep SOL (+ optional SPL tokens) from current, activate new.
const {PublicKey,SystemProgram,TransactionMessage,VersionedTransaction}=require('@solana/web3.js');
const W=require('./wallet');const {settings:S}=require('./config');const {conns,blockhash,confirm}=require('./send');
async function sweepTokens(from,to){const spl=require('@solana/spl-token');const c=conns[0];const out=[];
 for(const prog of [spl.TOKEN_PROGRAM_ID,spl.TOKEN_2022_PROGRAM_ID]){const r=await c.getParsedTokenAccountsByOwner(from.publicKey,{programId:prog});
  for(const a of r.value){const i=a.account.data.parsed.info;const amt=BigInt(i.tokenAmount.amount);if(amt===0n)continue;const mint=new PublicKey(i.mint);
   const dst=spl.getAssociatedTokenAddressSync(mint,to,false,prog);
   const ix=[spl.createAssociatedTokenAccountIdempotentInstruction(from.publicKey,dst,to,mint,prog),spl.createTransferCheckedInstruction(a.pubkey,mint,dst,from.publicKey,amt,i.tokenAmount.decimals,[],prog),spl.createCloseAccountInstruction(a.pubkey,from.publicKey,from.publicKey,[],prog)];
   const b=await blockhash();const tx=new VersionedTransaction(new TransactionMessage({payerKey:from.publicKey,recentBlockhash:b.blockhash,instructions:ix}).compileToV0Message());tx.sign([from]);
   const sig=await c.sendRawTransaction(tx.serialize());await confirm(sig);out.push(sig);}}return out;}
async function sweepSol(from,to){const c=conns[0];const bal=await c.getBalance(from.publicKey);const lam=bal-5000;if(lam<=0)return null;
 const b=await blockhash();const tx=new VersionedTransaction(new TransactionMessage({payerKey:from.publicKey,recentBlockhash:b.blockhash,instructions:[SystemProgram.transfer({fromPubkey:from.publicKey,toPubkey:to,lamports:lam})]}).compileToV0Message());tx.sign([from]);
 const sig=await c.sendRawTransaction(tx.serialize());await confirm(sig);return sig;}
async function rotate({tokens=S.sweepTokens,paper=S.paper}={}){const old=W.load(),oi=W.activeIndex();const ni=W.create('rotated');const nk=W.keypair(ni);const res={from:old.publicKey.toBase58(),to:nk.publicKey.toBase58(),index:ni,tokenSigs:[],solSig:null,paper};
 if(!paper){if(tokens)res.tokenSigs=await sweepTokens(old,nk.publicKey);res.solSig=await sweepSol(old,nk.publicKey);}
 W.setActive(ni);return res;}
module.exports={rotate,sweepSol,sweepTokens};
