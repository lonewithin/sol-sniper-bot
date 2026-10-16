// Free sources: PumpPortal websocket (new pump.fun tokens + migrations to PumpSwap/Raydium), DexScreener latest profiles/boosts poll, GeckoTerminal new pools (Raydium LaunchLab/CPMM/AMM + PumpSwap).
const WS=require('ws');const EventEmitter=require('events');const j=require('./http');
class Scanner extends EventEmitter{
 constructor({newTokens=require('./config').settings.fastNewLaunches}={}){super();this.seen=new Set();this.newTokens=newTokens;}
 push(mint,src,extra={}){if(!mint||this.seen.has(mint))return;this.seen.add(mint);if(this.seen.size>5000)this.seen=new Set([...this.seen].slice(-2000));this.emit('token',{mint,src,...extra});}
 start(){this.ws();this.poll();this.t=setInterval(()=>this.poll(),30000);setTimeout(()=>this.gecko(),5000);this.tg=setInterval(()=>this.gecko(),60000);}
 // GeckoTerminal new pools (free, ~2 calls/min): Raydium LaunchLab / CPMM / AMM / CLMM + PumpSwap launches
 async gecko(){const OK={'raydium-launchlab':'raydium launchlab','raydium':'raydium new pool','raydium-cpmm':'raydium new pool','raydium-clmm':'raydium new pool','pumpswap':'pumpswap new pool'};const Q=new Set(['So11111111111111111111111111111111111111112','EPjFWvLu5HnkLLmHhhCK1xVh5u6Dpx2SbRZ8dEp5d8Fu8','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB']);
  for(const pg of [1,2]){try{const d=await j(`https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=${pg}`,{headers:{accept:'application/json'}});for(const x of d?.data||[]){const dex=x.relationships?.dex?.data?.id,src=OK[dex];if(!src)continue;let mint=(x.relationships?.base_token?.data?.id||'').replace('solana_','');if(Q.has(mint))mint=(x.relationships?.quote_token?.data?.id||'').replace('solana_','');if(mint&&!Q.has(mint))this.push(mint,src)}}catch(e){this.emit('log','gecko poll '+e.message);break}await new Promise(r=>setTimeout(r,2500))}}
 ws(){clearInterval(this.wd);const w=this.w=new WS('wss://pumpportal.fun/api/data');this.lastMsg=Date.now();
  // phones drop sockets silently: if nothing arrives for 3 min, force a reconnect
  this.wd=setInterval(()=>{if(Date.now()-this.lastMsg>180000){this.emit('log','pumpportal silent 3 min, reconnecting');try{w.terminate()}catch{}}},30000);
  w.on('open',()=>{w.send(JSON.stringify({method:'subscribeMigration'}));if(this.newTokens)w.send(JSON.stringify({method:'subscribeNewToken'}));this.fails=0;this.emit('log','pumpportal connected')});
  w.on('message',m=>{const tDetect=Date.now();this.lastMsg=tDetect;try{const x=JSON.parse(m);if(!x.mint)return;if(!this.seen.has(x.mint))this.emit('raw',x,tDetect);this.push(x.mint,x.txType==='create'?'pump.fun new':'pump.fun migration',{name:x.name,symbol:x.symbol})}catch{}});
  w.on('close',()=>{clearInterval(this.wd);if(this.stopped)return;this.fails=(this.fails||0)+1;const d=Math.min(60000,3000*2**Math.min(this.fails-1,5));setTimeout(()=>this.ws(),d)}); /* backoff 3s to 60s on repeated 502s */w.on('error',e=>this.emit('log','ws err '+e.message));}
 async poll(){for(const u of['https://api.dexscreener.com/token-profiles/latest/v1','https://api.dexscreener.com/token-boosts/latest/v1']){
  try{const a=await j(u);for(const t of a)if(t.chainId==='solana')this.push(t.tokenAddress,'dexscreener '+(u.includes('boost')?'boost':'profile'));}catch(e){this.emit('log','dex poll '+e.message)}}}
 stop(){this.stopped=true;clearInterval(this.t);clearInterval(this.tg);clearInterval(this.wd);this.w?.close();}}
module.exports=Scanner;
