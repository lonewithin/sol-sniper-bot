const {settings:S,OWNER}=require('./config');const Scanner=require('./scanner');const {score}=require('./safety');const T=require('./trader');const W=require('./wallet');const {make,fmt,kb}=require('./bot');const {potential,pairsFor}=require('./potential');const L=require('./log');const {tune}=require('./tune');const {save}=require('./config');
if(!process.env.BOT_TOKEN||!OWNER){console.error('Set BOT_TOKEN and OWNER_ID in .env (see .env.example)');process.exit(1)}
console.log('Burner wallet:',W.pub(),'('+W.source()+')','| mode:',S.paper?'PAPER':'LIVE','| auto:',S.auto);
const {bot,say}=make();const sc=new Scanner();const q=[];let busy=0;
sc.on('log',m=>console.log('[scan]',m));sc.on('token',t=>{q.push(t);pump()});
async function pump(){while(busy<3&&q.length){busy++;const t=q.shift();
 (async()=>{await new Promise(r=>setTimeout(r,t.src.includes('migration')?20000:0)); // let pool index on DexScreener/Jupiter
  const d=await score(t.mint,t);const pr=(await pairsFor([t.mint]))[t.mint];const m=potential(pr,{safety:d.score,holders:d.holders,mint:t.mint});
  console.log(`[S${d.score} P${m.potential} ${m.tier}] ${d.symbol} ${t.mint} ${t.src}`);
  L.observe({mint:t.mint,symbol:d.symbol,src:t.src,safety:d.score,pot:m.potential,tier:m.tier,f:m.f,p0:d.priceUsd||null});
  if((d.liqUsd||0)<S.minLiqUsd&&d.score<S.minScore)return;
  if(S.alerts)bot.api.sendMessage(OWNER,`🆕 ${t.src} · <b>${m.tier}</b> potential ${m.potential}/100\n`+fmt(d)+'\n<i>'+m.reasons.join(' · ')+'</i>',{parse_mode:'HTML',reply_markup:kb(d.mint),link_preview_options:{is_disabled:true}}).catch(()=>{});
  if(S.auto&&m.tier!=='SKIP'&&(d.liqUsd||0)>=S.minLiqUsd){try{await T.buy({...t,symbol:d.symbol},S.buySol,{tier:m.tier,pot:m.potential,safety:d.score,features:m.f})}catch(e){console.log('buy skip',e.message)}}
 })().catch(e=>console.log('score err',e.message)).finally(()=>{busy--;pump()});}}
setInterval(()=>T.monitor(),10000);
setInterval(()=>{if(!S.autotune)return;const r=tune(50);if(r.nObs>=100&&r.best.avg>r.current.avg){Object.assign(S,{minScore:r.best.minScore,potScalp:r.best.potScalp,potSwing:r.best.potSwing,potRunner:r.best.potRunner});save();say(`🧠 Autotune applied: ${JSON.stringify(r.best)}`)}},3600000);sc.start();bot.start({onStart:()=>say('🤖 Sniper online ('+(S.paper?'paper':'LIVE')+', auto '+(S.auto?'ON':'OFF')+')')});
process.on('SIGINT',()=>{sc.stop();bot.stop();process.exit()});
