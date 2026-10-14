const {settings:S,OWNER}=require('./config');const Scanner=require('./scanner');const {score}=require('./safety');const T=require('./trader');const W=require('./wallet');const {make,fmt,kb}=require('./bot');
if(!process.env.BOT_TOKEN||!OWNER){console.error('Set BOT_TOKEN and OWNER_ID in .env (see .env.example)');process.exit(1)}
console.log('Burner wallet:',W.pub(),'('+W.source()+')','| mode:',S.paper?'PAPER':'LIVE','| auto:',S.auto);
const {bot,say}=make();const sc=new Scanner();const q=[];let busy=0;
sc.on('log',m=>console.log('[scan]',m));sc.on('token',t=>{q.push(t);pump()});
async function pump(){while(busy<3&&q.length){busy++;const t=q.shift();
 (async()=>{await new Promise(r=>setTimeout(r,t.src.includes('migration')?20000:0)); // let pool index on DexScreener/Jupiter
  const d=await score(t.mint,t);console.log(`[${d.score}] ${d.symbol} ${t.mint} ${t.src}`);
  if((d.liqUsd||0)<S.minLiqUsd&&d.score<S.minScore)return;
  if(S.alerts)bot.api.sendMessage(OWNER,`🆕 ${t.src}\n`+fmt(d),{parse_mode:'HTML',reply_markup:kb(d.mint),link_preview_options:{is_disabled:true}}).catch(()=>{});
  if(S.auto&&d.score>=S.minScore&&(d.liqUsd||0)>=S.minLiqUsd){try{const p=await T.buy({...t,symbol:d.symbol});say(`🎯 Auto-bought ${d.symbol} ${p.solIn} SOL ${p.paper?'[paper]':p.sig}`)}catch(e){console.log('buy skip',e.message)}}
 })().catch(e=>console.log('score err',e.message)).finally(()=>{busy--;pump()});}}
setInterval(()=>T.monitor(say),15000);sc.start();bot.start({onStart:()=>say('🤖 Sniper online ('+(S.paper?'paper':'LIVE')+', auto '+(S.auto?'ON':'OFF')+')')});
process.on('SIGINT',()=>{sc.stop();bot.stop();process.exit()});
