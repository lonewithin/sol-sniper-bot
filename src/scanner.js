// Free sources: PumpPortal websocket (new pump.fun tokens + migrations to PumpSwap/Raydium), DexScreener latest profiles/boosts poll.
const WS=require('ws');const EventEmitter=require('events');const j=require('./http');
class Scanner extends EventEmitter{
 constructor({newTokens=require('./config').settings.fastNewLaunches}={}){super();this.seen=new Set();this.newTokens=newTokens;}
 push(mint,src,extra={}){if(!mint||this.seen.has(mint))return;this.seen.add(mint);if(this.seen.size>5000)this.seen=new Set([...this.seen].slice(-2000));this.emit('token',{mint,src,...extra});}
 start(){this.ws();this.poll();this.t=setInterval(()=>this.poll(),30000);}
 ws(){clearInterval(this.wd);const w=this.w=new WS('wss://pumpportal.fun/api/data');this.lastMsg=Date.now();
  // phones drop sockets silently: if nothing arrives for 3 min, force a reconnect
  this.wd=setInterval(()=>{if(Date.now()-this.lastMsg>180000){this.emit('log','pumpportal silent 3 min, reconnecting');try{w.terminate()}catch{}}},30000);
  w.on('open',()=>{w.send(JSON.stringify({method:'subscribeMigration'}));if(this.newTokens)w.send(JSON.stringify({method:'subscribeNewToken'}));this.fails=0;this.emit('log','pumpportal connected')});
  w.on('message',m=>{const tDetect=Date.now();this.lastMsg=tDetect;try{const x=JSON.parse(m);if(!x.mint)return;if(!this.seen.has(x.mint))this.emit('raw',x,tDetect);this.push(x.mint,x.txType==='create'?'pump.fun new':'pump.fun migration',{name:x.name,symbol:x.symbol})}catch{}});
  w.on('close',()=>{clearInterval(this.wd);if(this.stopped)return;this.fails=(this.fails||0)+1;const d=Math.min(60000,3000*2**Math.min(this.fails-1,5));setTimeout(()=>this.ws(),d)}); /* backoff 3s to 60s on repeated 502s */w.on('error',e=>this.emit('log','ws err '+e.message));}
 async poll(){for(const u of['https://api.dexscreener.com/token-profiles/latest/v1','https://api.dexscreener.com/token-boosts/latest/v1']){
  try{const a=await j(u);for(const t of a)if(t.chainId==='solana')this.push(t.tokenAddress,'dexscreener '+(u.includes('boost')?'boost':'profile'));}catch(e){this.emit('log','dex poll '+e.message)}}}
 stop(){this.stopped=true;clearInterval(this.t);clearInterval(this.wd);this.w?.close();}}
module.exports=Scanner;
