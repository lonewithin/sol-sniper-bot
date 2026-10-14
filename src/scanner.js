// Free sources: PumpPortal websocket (new pump.fun tokens + migrations to PumpSwap/Raydium), DexScreener latest profiles/boosts poll.
const WS=require('ws');const EventEmitter=require('events');const j=require('./http');
class Scanner extends EventEmitter{
 constructor({newTokens=require('./config').settings.fastNewLaunches}={}){super();this.seen=new Set();this.newTokens=newTokens;}
 push(mint,src,extra={}){if(!mint||this.seen.has(mint))return;this.seen.add(mint);if(this.seen.size>5000)this.seen=new Set([...this.seen].slice(-2000));this.emit('token',{mint,src,...extra});}
 start(){this.ws();this.poll();this.t=setInterval(()=>this.poll(),30000);}
 ws(){const w=this.w=new WS('wss://pumpportal.fun/api/data');
  w.on('open',()=>{w.send(JSON.stringify({method:'subscribeMigration'}));if(this.newTokens)w.send(JSON.stringify({method:'subscribeNewToken'}));this.emit('log','pumpportal connected')});
  w.on('message',m=>{const tDetect=Date.now();try{const x=JSON.parse(m);if(!x.mint)return;if(!this.seen.has(x.mint))this.emit('raw',x,tDetect);this.push(x.mint,x.txType==='create'?'pump.fun new':'pump.fun migration',{name:x.name,symbol:x.symbol})}catch{}});
  w.on('close',()=>{if(!this.stopped)setTimeout(()=>this.ws(),3000)});w.on('error',e=>this.emit('log','ws err '+e.message));}
 async poll(){for(const u of['https://api.dexscreener.com/token-profiles/latest/v1','https://api.dexscreener.com/token-boosts/latest/v1']){
  try{const a=await j(u);for(const t of a)if(t.chainId==='solana')this.push(t.tokenAddress,'dexscreener '+(u.includes('boost')?'boost':'profile'));}catch(e){this.emit('log','dex poll '+e.message)}}}
 stop(){this.stopped=true;clearInterval(this.t);this.w?.close();}}
module.exports=Scanner;
