process.on('unhandledRejection',e=>console.log('[unhandled]',e?.message||e));process.on('uncaughtException',e=>console.log('[uncaught]',e?.message||e));
// single-instance guard: a second copy would cause Telegram 409 conflicts
{const fs=require('fs'),LK=require('path').join(__dirname,'..','data','bot.pid');try{const o=+fs.readFileSync(LK,'utf8');if(o&&o!==process.pid){try{process.kill(o,0);console.error('[lock] another instance is running (pid '+o+'), exiting');process.exit(0)}catch{}}}catch{}
 fs.mkdirSync(require('path').dirname(LK),{recursive:true});fs.writeFileSync(LK,String(process.pid));process.on('exit',()=>{try{if(+fs.readFileSync(LK,'utf8')===process.pid)fs.unlinkSync(LK)}catch{}})}
const {settings:S,OWNER}=require('./config');const Scanner=require('./scanner');const {score}=require('./safety');const T=require('./trader');const W=require('./wallet');const {make,fmt,kb}=require('./bot');const {potential,pairsFor}=require('./potential');const L=require('./log');const {tune}=require('./tune');const {save}=require('./config');const CT=require('./counters');const MP=require('./missed');const HC=require('./holders');
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
  require('./bigplay').watch(t.mint);require('./charts').recordScan({mint:t.mint,symbol:d.symbol,src:t.src,p0:d.priceUsd||null,mc0:d.mcap||null});L.observe({mint:t.mint,symbol:d.symbol,src:t.src,safety:d.score,pot:m.potential,tier:m.tier,f:m.f,p0:d.priceUsd||null});
  CT.scanned(t.src,d.score,m.potential);
  const why=d.score<S.minScore?'safety below '+S.minScore:(d.liqUsd||0)<S.minLiqUsd?'liquidity below $'+S.minLiqUsd:m.tier==='SKIP'?'low potential':(m.tier!=='RUNNER'&&(m.f?.pc5??0)<S.minEntryPc5&&!((m.f?.pc5??0)>=S.dipMaxPc5&&(m.f?.ratio??0)>=S.dipMinRatio&&(m.f?.accel??0)>=S.dipMinAccel))?'dumping (m5 < '+S.minEntryPc5+'%'+((m.f?.pc5??0)>=S.dipMaxPc5?', buy pressure too weak for dip pass':'')+')':(m.tier!=='RUNNER'&&(m.f?.pc5??0)>S.maxEntryPc5)?'chasing spike (m5 > '+S.maxEntryPc5+'%)':(m.tier==='RUNNER'&&S.runnerMaxEntryPc5>0&&(m.f?.pc5??0)>S.runnerMaxEntryPc5)?'RUNNER chasing spike (m5 > '+S.runnerMaxEntryPc5+'%)':(m.f?.v5??0)<S.minEntryVol5m?'low 5m volume':(m.tier==='SCALP'&&(m.f?.ratio??0)<S.scalpMinRatio)?'weak scalp (buy/sell < '+S.scalpMinRatio+')':!S.auto?'auto off':!S.snipe?'snipe off':null;
  const card=()=>{CT.alerted();return bot.api.sendMessage(OWNER,`🆕 ${t.src} · <b>${m.tier}</b> potential ${m.potential}/100\n`+fmt(d)+'\n<i>'+m.reasons.join(' · ')+'</i>',{parse_mode:'HTML',reply_markup:kb(d.mint),link_preview_options:{is_disabled:true}}).catch(()=>{})};
  if(S.alerts==='all'&&!((d.liqUsd||0)<S.minLiqUsd&&d.score<S.minScore))card();
  else if(S.alerts==='score'&&m.tier!=='SKIP'&&d.score>=S.minScore)card();
  if(why){CT.skip(why);if(why!=='auto off'||true)MP.add({mint:t.mint,symbol:d.symbol,p0:d.priceUsd||null,safety:d.score,pot:m.potential,tier:m.tier,why});return}
  const hc=await HC.check(t.mint,d);console.log(`[holders] ${d.symbol} top10 ${hc.top10??'?'}% dev ${hc.dev??'?'}% (${hc.src}) ${hc.ok?'OK':'SKIP: '+hc.fails.join(', ')}`);
  if(!hc.ok){CT.skip('holders concentrated');MP.add({mint:t.mint,symbol:d.symbol,p0:d.priceUsd||null,safety:d.score,pot:m.potential,tier:m.tier,why:'holders concentrated'});return}
  if(T.paused()){CT.skip('loss-streak pause');console.log('[pause] skip',d.symbol);return}
  const doBuy=async(f=m.f)=>{try{await T.buy({...t,symbol:d.symbol},S.buySol,{tier:m.tier,pot:m.potential,safety:d.score,features:{...f,top10:hc.top10,dev:hc.dev}});CT.bought();maybeRotate().catch(()=>{})}
  catch(e){CT.skip('buy blocked: '+e.message.replace(/[\d.]+/g,'').trim());console.log('buy skip',e.message)}};
  if(!(S.confirmSec>0))return doBuy();
  console.log(`[confirm] ${d.symbol} waiting ${S.confirmSec}s (buys h1 ${pr?.txns?.h1?.buys??0}, price ${pr?.priceUsd})`);
  const b0=pr?.txns?.h1?.buys||0,p0=+(pr?.priceUsd||0);
  setTimeout(async()=>{try{const p2=(await pairsFor([t.mint]))[t.mint];const b1=p2?.txns?.h1?.buys||0,p1=+(p2?.priceUsd||0);const drop=p0&&p1?(1-p1/p0)*100:100;const m5=p2?.txns?.m5||{};
   const fails=[];if(!p2)fails.push('no pair');if(b1-b0<S.confirmMinBuys)fails.push(`only ${b1-b0} new buys`);if(drop>S.confirmMaxDropPct)fails.push(`price -${drop.toFixed(1)}%`);if((m5.buys||0)<(m5.sells||0))fails.push('5m sells > buys');
   console.log(`[confirm] ${d.symbol} +${b1-b0} buys, price ${drop>0?'-':'+'}${Math.abs(drop).toFixed(1)}% → ${fails.length?'SKIP: '+fails.join(', '):'BUY'}`);
   if(fails.length){CT.skip('confirm: '+fails[0].replace(/[\d.-]+%?/g,'').trim());MP.add({mint:t.mint,symbol:d.symbol,p0:d.priceUsd||null,safety:d.score,pot:m.potential,tier:m.tier,why:'failed confirmation'});return}
   if(T.paused())return console.log('[pause] skip',d.symbol);await doBuy({...m.f,confirmBuys:b1-b0,confirmDrop:+drop.toFixed(1)})}catch(e){console.log('confirm err',e.message)}},S.confirmSec*1000);
 })().catch(e=>console.log('score err',e.message)).finally(()=>{busy--;pump()});}}
let monBusy=false;setInterval(async()=>{if(monBusy)return;monBusy=true;try{await T.monitor()}catch(e){console.log('monitor err',e.message)}finally{monBusy=false}},(S.monitorSec||5)*1000);require('./sweep').schedule(say);MP.start(say);require('./bigplay').start(m=>console.log(m));require('./signals').start(m=>console.log(m),say);
MP.onCandidate(async(w,pair,gain)=>{if(T.st.open.find(p=>p.mint===w.mint))return false;
 const d=await score(w.mint,w);const m=potential(pair,{safety:d.score,holders:d.holders,mint:w.mint});const f=m.f;
 const fails=[];if(d.hard.length)fails.push('hard: '+d.hard.join(', '));if(d.score<S.secondChanceMinScore)fails.push(`safety ${d.score}<${S.secondChanceMinScore}`);
 if((f.ratio||0)<S.secondChanceMinRatio)fails.push(`buy/sell ${f.ratio}`);if((f.accel||0)<1)fails.push(`volume not rising x${f.accel}`);
 if((d.liqUsd||0)<S.minLiqUsd)fails.push('liq $'+(d.liqUsd||0).toFixed(0));{const q=MP.quality(pair);if(q.length)fails.push('market not real: '+q.join(', '))}if(f.hGrow<0)fails.push(`holders falling ${f.hGrow}%`);{const hc=await HC.check(w.mint,d);if(!hc.ok)fails.push('holders: '+hc.fails.join(', '))}if(T.paused())fails.push('loss-streak pause');if(S.secondNoConfirmFail&&/confirm/i.test(w.why||''))fails.push('earlier failed confirmation');if(S.secondNoSpike&&/chasing spike/i.test(w.why||''))fails.push('skipped as a spike earlier (pump-and-dump risk)');if(gain>S.secondMaxGainPct)fails.push(`already ran +${gain.toFixed(0)}%`);if((f.liqCh||0)>S.secondMaxLiqCh)fails.push(`liq jumped ${f.liqCh}%`);
 console.log(`[2nd] ${w.symbol} +${gain.toFixed(0)}% S${d.score} ${fails.length?'no: '+fails.join('; '):'BUY'}`);
 if(fails.length){CT.skip('2nd chance: '+fails[0].split(/[ :]/)[0]);return false}
 try{await T.buy({mint:w.mint,symbol:d.symbol},S.buySol,{tier:'SECOND',pot:m.potential,safety:d.score,features:{...f,gainSinceSkip:+gain.toFixed(1),skipWhy:w.why}});CT.bought();return true}catch(e){console.log('2nd buy skip',e.message);return false}});
setInterval(()=>{try{if(!S.autotune)return;const r=tune(50);if(r.nObs>=100&&r.best.avg>r.current.avg){Object.assign(S,{minScore:r.best.minScore,potScalp:r.best.potScalp,potSwing:r.best.potSwing,potRunner:r.best.potRunner});save();say(`🧠 Autotune applied: ${JSON.stringify(r.best)}`)}}catch(e){console.log('autotune err',e.message)}},3600000);sc.start();const CLEAN=require('path').join(__dirname,'..','data','.clean_restart');let quiet=false;try{quiet=Date.now()-require('fs').statSync(CLEAN).mtimeMs<120000;require('fs').unlinkSync(CLEAN)}catch{} // planned restarts (SIGTERM) stay silent; crashes still announce
bot.start({onStart:()=>quiet?console.log('[start] planned restart, online message skipped'):say('🤖 Sniper online ('+(S.paper?'paper':'LIVE')+', auto '+(S.auto?'ON':'OFF')+')')});
for(const sg of ['SIGINT','SIGTERM'])process.on(sg,async()=>{try{require('fs').writeFileSync(CLEAN,String(Date.now()))}catch{}try{sc.stop();await bot.stop()}catch{}process.exit()});
