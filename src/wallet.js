// Burner vault: all burners encrypted (AES-256-GCM, scrypt key) in data/vault.enc. Optional env import. Never logs secrets.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Keypair}=require('@solana/web3.js');const bs58=require('bs58').default||require('bs58');
const {DATA}=require('./config');
const VF=path.join(DATA,'vault.enc'),LEGACY=path.join(DATA,'wallet.enc'),PF=path.join(DATA,'wallet.pass');
function pass(){if(process.env.WALLET_ENC_KEY)return process.env.WALLET_ENC_KEY;
 if(!fs.existsSync(PF))fs.writeFileSync(PF,crypto.randomBytes(32).toString('hex'),{mode:0o600});return fs.readFileSync(PF,'utf8').trim();}
function enc(buf){const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),k=crypto.scryptSync(pass(),salt,32);
 const c=crypto.createCipheriv('aes-256-gcm',k,iv);const d=Buffer.concat([c.update(buf),c.final()]);
 return JSON.stringify({v:1,salt:salt.toString('hex'),iv:iv.toString('hex'),tag:c.getAuthTag().toString('hex'),d:d.toString('hex')});}
function dec(j){const o=JSON.parse(j),k=crypto.scryptSync(pass(),Buffer.from(o.salt,'hex'),32);
 const c=crypto.createDecipheriv('aes-256-gcm',k,Buffer.from(o.iv,'hex'));c.setAuthTag(Buffer.from(o.tag,'hex'));
 return Buffer.concat([c.update(Buffer.from(o.d,'hex')),c.final()]);}
let V=null; // {active:n, wallets:[{secret:base58, created, trades, label}]}  (decrypted only in memory)
function persist(){fs.writeFileSync(VF,enc(Buffer.from(JSON.stringify(V))),{mode:0o600});}
function vault(){if(V)return V;
 if(fs.existsSync(VF))V=JSON.parse(dec(fs.readFileSync(VF,'utf8')).toString());
 else{V={active:0,wallets:[]};
  if(process.env.BURNER_PRIVATE_KEY)V.wallets.push({secret:process.env.BURNER_PRIVATE_KEY.trim(),created:Date.now(),trades:0,label:'env import'});
  else if(fs.existsSync(LEGACY))V.wallets.push({secret:bs58.encode(dec(fs.readFileSync(LEGACY,'utf8'))),created:Date.now(),trades:0,label:'migrated'});
  else V.wallets.push({secret:bs58.encode(Keypair.generate().secretKey),created:Date.now(),trades:0,label:'generated'});persist();}
 return V;}
const kpOf=w=>Keypair.fromSecretKey(bs58.decode(w.secret));
let cache={};const kp=i=>{const w=vault().wallets[i];return cache[i]??=kpOf(w)};
module.exports={
 load:()=>kp(vault().active),pub:()=>kp(vault().active).publicKey.toBase58(),source:()=>vault().wallets[vault().active].label,
 activeIndex:()=>vault().active,list:()=>vault().wallets.map((w,i)=>({i,pub:kp(i).publicKey.toBase58(),label:w.label,created:w.created,trades:w.trades||0,active:i===vault().active})),
 keypair:i=>kp(i),exportSecret:(i=vault().active)=>vault().wallets[i].secret,
 create(label='rotated'){vault().wallets.push({secret:bs58.encode(Keypair.generate().secretKey),created:Date.now(),trades:0,label});persist();return vault().wallets.length-1;},
 setActive(i){vault().active=i;persist();},countTrade(){const w=vault().wallets[vault().active];w.trades=(w.trades||0)+1;persist();return w.trades;},
 _reset(){V=null;cache={};}};
