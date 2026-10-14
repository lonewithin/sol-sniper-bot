// Burner wallet: env import OR self-generated, encrypted at rest (AES-256-GCM). Never logs the secret.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Keypair}=require('@solana/web3.js');const bs58=require('bs58').default||require('bs58');
const {DATA}=require('./config');
const WF=path.join(DATA,'wallet.enc'),PF=path.join(DATA,'wallet.pass');
function pass(){if(process.env.WALLET_ENC_KEY)return process.env.WALLET_ENC_KEY;
 if(!fs.existsSync(PF))fs.writeFileSync(PF,crypto.randomBytes(32).toString('hex'),{mode:0o600});return fs.readFileSync(PF,'utf8').trim();}
function enc(buf){const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),k=crypto.scryptSync(pass(),salt,32);
 const c=crypto.createCipheriv('aes-256-gcm',k,iv);const d=Buffer.concat([c.update(buf),c.final()]);
 return JSON.stringify({v:1,salt:salt.toString('hex'),iv:iv.toString('hex'),tag:c.getAuthTag().toString('hex'),d:d.toString('hex')});}
function dec(j){const o=JSON.parse(j),k=crypto.scryptSync(pass(),Buffer.from(o.salt,'hex'),32);
 const c=crypto.createDecipheriv('aes-256-gcm',k,Buffer.from(o.iv,'hex'));c.setAuthTag(Buffer.from(o.tag,'hex'));
 return Buffer.concat([c.update(Buffer.from(o.d,'hex')),c.final()]);}
let kp=null,source='';
function load(){if(kp)return kp;
 if(process.env.BURNER_PRIVATE_KEY){kp=Keypair.fromSecretKey(bs58.decode(process.env.BURNER_PRIVATE_KEY.trim()));source='env';return kp;}
 if(fs.existsSync(WF)){kp=Keypair.fromSecretKey(dec(fs.readFileSync(WF,'utf8')));source='encrypted file';return kp;}
 kp=Keypair.generate();fs.writeFileSync(WF,enc(Buffer.from(kp.secretKey)),{mode:0o600});source='generated';return kp;}
module.exports={load,pub:()=>load().publicKey.toBase58(),source:()=>(load(),source),exportSecret:()=>bs58.encode(load().secretKey)};
