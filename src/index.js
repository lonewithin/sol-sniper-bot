const {settings:S,OWNER}=require('./config');const Scanner=require('./scanner');const {score}=require('./safety');const T=require('./trader');const W=require('./wallet');const {make,fmt,kb}=require('./bot');const {potential,pairsFor}=require('./potential');const L=require('./log');const {tune}=require('./tune');const {save}=require('./config');const CT=require('./counters');const MP=require('./missed');
if(!process.env.BOT_TOKEN||!OWNER){console.error('Set BOT_TOKEN and OWNER_ID in .env (see .env.example)');process.exit(1)}
console.log('Burner wallet:',W.pub(),'('+W.source()+')','| mode:',S.paper?'PAPER':'LIVE','| auto:',S.auto);
const {bot,say}=make();const sc=new Scanner();const q=[];let busy=0;
require('./send').startBlockhashCache();const F=require('./fast');const {rotate}=require('./rotate');
async function maybeRotate(){const n=W.list()[W.activeIndex()].trades;const day=W.list()[W.activeIndex()].created<Date.now()-864e5;
 if(T.st.open.some(p=>!p.paper))return;if((S.rotateEveryTrades>0&&n>=S.rotateEveryTrades)||(S.rotateDaily&&day)){const r=await rotate();bot.sendNewBurner?.(r)}}
sc.on('raw',async(ev,tDetect)=>{if(S.mode!=='fast'||!S.auto||!S.snipe)return;const mig=ev.txType==='migrate';if(mig?!S.fastMigrations:!(S.fastNewLaunches&&ev.txType==='create'))return;
 try{const ic=await F.instant(ev);CT.scanned('pumpportal '+ev.txType);if(!ic.ok){CT.skip('fast: '+ic.reasons[0].replace(/[❌✅] /,'').replace(/[\d.]+%?/g,'').trim());console.log('fast skip',ev.mint,ic.reasons.join(' '));return}
  const p=await T.fastBuy(ev,S.buySol,{tDetect,reasons:ic.reasons});CT.bought();CT.latency(p.lat.detectToSent??p.lat.detectToSigned);console.log('fast buy',ev.mint,JSON.stringify(p.lat));
  setTimeout(async()=>{const d=await score(ev.mint,ev).catch(()=>null);p.safety=d?.score??0;p.pendingPostCheck=false;
   if(!d||d.score<S.fastPostMinScore){const o=T.st.open.find(x=>x.mint===ev.mint);if(o)await T.sell(o,`post-check fail (safety ${d?.score??'n/a'})`).catch(e=>say('⚠️ post-check sell failed: '+e.message))}
   else say(`✅ Post-check OK ${d.symbol} safety ${d.score}`);maybeRotate().catch(()=>{})},S.fastPostCheckSec*1000);
 }catch(e){console.log('fast err',e.message)}});
sc.on('log',m=>console.log('[scan]',m));sc.on('token',t=>{q.push(t);pump()});
async function pump(){while(busy<3&&q.length){busy++;const t=q.shift();if(S.mode==='fast'&&S.auto&&T.st.open.find(p=>p.mint===t.mint)){busy--;continue}
 (async()=>{await new Promise(r=>setTimeout(r,t.src.includes('migration')?20000:0)); // let pool index on DexScreener/Jupiter
  const d=await score(t.mint,t);const pr=(await pairsFor([t.mint]))[t.mint];const m=potential(pr,{safety:d.score,holders:d.holders,mint:t.mint});
  console.log(`[S${d.score} P${m.potential} ${m.tier}] ${d.symbol} ${t.mint} ${t.src}`);
  L.observe({mint:t.mint,symbol:d.symbol,src:t.src,safety:d.score,pot:m.potential,tier:m.tier,f:m.f,p0:d.priceUsd||null});
  CT.scanned(t.src,d.score,m.potential);
  const why=d.score<S.minScore?'safety below '+S.minScore:(d.liqUsd||0)<S.minLiqUsd?'liquidity below $'+S.minLiqUsd:m.tier==='SKIP'?'low potential':!S.auto?'auto off':!S.snipe?'snipe off':null;
  const card=()=>{CT.alerted();return bot.api.sendMessage(OWNER,`🆕 ${t.src} · <b>${m.tier}</b> potential ${m.potential}/100\n`+fmt(d)+'\n<i>'+m.reasons.join(' · ')+'</i>',{parse_mode:'HTML',reply_markup:kb(d.mint),link_preview_options:{is_disabled:true}}).catch(()=>{})};
  if(S.alerts==='all'&&!((d.liqUsd||0)<S.minLiqUsd&&d.score<S.minScore))card();
  else if(S.alerts==='score'&&m.tier!=='SKIP'&&d.score>=S.minScore)card();
  if(why){CT.skip(why);if(why!=='auto off'||true)MP.add({mint:t.mint,symbol:d.symbol,p0:d.priceUsd||null,safety:d.score,pot:m.potential,tier:m.tier,why});return}
  try{await T.buy({...t,symbol:d.symbol},S.buySol,{tier:m.tier,pot:m.potential,safety:d.score,features:m.f});CT.bought();maybeRotate().catch(()=>{})}
  catch(e){CT.skip('buy blocked: '+e.message.replace(/[\d.]+/g,'').trim());console.log('buy skip',e.message)}
 })().catch(e=>console.log('score err',e.message)).finally(()=>{busy--;pump()});}}
setInterval(()=>T.monitor(),10000);require('./sweep').schedule(say);MP.start(say);require('./bigplay').start(m=>console.log(m));
MP.onCandidate(async(w,pair,gain)=>{if(T.st.open.find(p=>p.mint===w.mint))return false;
 const d=await score(w.mint,w);const m=potential(pair,{safety:d.score,holders:d.holders,mint:w.mint});const f=m.f;
 const fails=[];if(d.hard.length)fails.push('hard: '+d.hard.join(', '));if(d.score<S.secondChanceMinScore)fails.push(`safety ${d.score}<${S.secondChanceMinScore}`);
 if((f.ratio||0)<S.secondChanceMinRatio)fails.push(`buy/sell ${f.ratio}`);if((f.accel||0)<1)fails.push(`volume not rising x${f.accel}`);
 if((d.liqUsd||0)<S.minLiqUsd)fails.push('liq $'+(d.liqUsd||0).toFixed(0));{const q=MP.quality(pair);if(q.length)fails.push('market not real: '+q.join(', '))}if(f.hGrow<0)fails.push(`holders falling ${f.hGrow}%`);
 console.log(`[2nd] ${w.symbol} +${gain.toFixed(0)}% S${d.score} ${fails.length?'no: '+fails.join('; '):'BUY'}`);
 if(fails.length){CT.skip('2nd chance: '+fails[0].split(/[ :]/)[0]);return false}
 try{await T.buy({mint:w.mint,symbol:d.symbol},S.buySol,{tier:'SECOND',pot:m.potential,safety:d.score,features:{...f,gainSinceSkip:+gain.toFixed(1),skipWhy:w.why}});CT.bought();return true}catch(e){console.log('2nd buy skip',e.message);return false}});
setInterval(()=>{if(!S.autotune)return;const r=tune(50);if(r.nObs>=100&&r.best.avg>r.current.avg){Object.assign(S,{minScore:r.best.minScore,potScalp:r.best.potScalp,potSwing:r.best.potSwing,potRunner:r.best.potRunner});save();say(`🧠 Autotune applied: ${JSON.stringify(r.best)}`)}},3600000);sc.start();bot.start({onStart:()=>say('🤖 Sniper online ('+(S.paper?'paper':'LIVE')+', auto '+(S.auto?'ON':'OFF')+')')});
process.on('SIGINT',()=>{sc.stop();bot.stop();process.exit()});
