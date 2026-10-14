const {Bot,InlineKeyboard}=require('grammy');const {settings:S,save,OWNER}=require('./config');const T=require('./trader');const W=require('./wallet');const {score}=require('./safety');
function make(){const bot=new Bot(process.env.BOT_TOKEN);
 bot.use((ctx,next)=>ctx.from?.id===OWNER?next():undefined); // owner-only, silently ignore others
 const say=t=>bot.api.sendMessage(OWNER,t,{parse_mode:'HTML',link_preview_options:{is_disabled:true}}).catch(()=>{});
 require('./help').install(bot);
 bot.command('start',c=>c.reply('Sol Sniper ready. Tap /help for the beginner guide.\n /strategy /stats /settings /auto on|off /paper on|off /set key value /wallet /positions /pnl /check MINT /sellall /panic /withdraw ADDR AMOUNT|all /burners /newburner /profit /sweep /set capital SOL /export'));
 bot.command('auto',c=>{S.auto=/on/i.test(c.match);save();c.reply(`Auto-snipe ${S.auto?'ON':'OFF'} (${S.paper?'PAPER':'LIVE'})`)});
 bot.command('paper',c=>{S.paper=!/off/i.test(c.match);save();c.reply(`Mode: ${S.paper?'PAPER (no real trades)':'⚠️ LIVE — real SOL'}`)});
 bot.command('settings',c=>c.reply('<pre>'+JSON.stringify(S,null,1)+'</pre>\nChange: /set buySol 0.02',{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('💰 Profit / sweep menu','pf:menu')}));
 bot.callbackQuery('pf:menu',async c=>{c.answerCallbackQuery();c.reply(...await profitMenu())});
 bot.command('set',c=>{const [k,v]=c.match.split(/\s+/);if(!(k in S))return c.reply('Unknown key');
  if(k==='profitAddress'){const {PublicKey}=require('@solana/web3.js');if(!require('./sweep').validAddr(v))return c.reply('Invalid wallet address');S.profitAddress=v;save();return c.reply('profitAddress = '+v)}
  if(k==='secondChance'){S.secondChance=/^(on|true|1)$/i.test(v);save();return c.reply('secondChance = '+S.secondChance)}
  if(k==='missedAlerts'){S.missedAlerts=/^(on|true|1)$/i.test(v);save();return c.reply('missedAlerts = '+S.missedAlerts)}
  if(k==='alerts'){if(!['all','trades','score','off'].includes(v))return c.reply('alerts all|trades|score|off');S.alerts=v;save();return c.reply('alerts = '+v)}
  if(k==='mode'){if(!['fast','safe'].includes(v))return c.reply('mode fast|safe');S.mode=v;save();return c.reply('mode = '+v+(v==='fast'?' ⚡ (instant checks only before buy, full checks after)':''))}
  if(typeof S[k]==='boolean'){if(['auto','paper'].includes(k))return c.reply('Use /'+k);S[k]=/^(on|true|1)$/i.test(v);save();return c.reply(`${k} = ${S[k]}`)}const n=Number(v);if(!isFinite(n)||n<0)return c.reply('Bad number');
  if(k==='buySol'&&n>S.maxPerTrade)return c.reply(`buySol > maxPerTrade (${S.maxPerTrade})`);S[k]=n;save();c.reply(`${k} = ${n}`)});
 bot.command('wallet',async c=>c.reply(`Burner (${W.source()}): <code>${W.pub()}</code>\nBalance: ${await T.balance().catch(()=>'?')} SOL\nFund with SMALL amounts only.`,{parse_mode:'HTML'}));
 const {rotate}=require('./rotate');
 const sendKey=async(chat,i,note='')=>{const w=W.list()[i];const m=await bot.api.sendMessage(chat,`🔐 Burner #${i} ${w.pub}${note}\nPrivate key (base58 · Phantom/Solflare → Import Private Key). SAVE IT OFFLINE NOW — this message deletes in 60s:\n<tg-spoiler>${W.exportSecret(i)}</tg-spoiler>`,{parse_mode:'HTML'});setTimeout(()=>bot.api.deleteMessage(chat,m.message_id).catch(()=>{}),60000);};
 bot.sendNewBurner=async r=>{await say(`🔄 Rotated burner → #${r.index} <code>${r.to}</code>${r.paper?'\n[paper] nothing swept — move any funds manually':`\nSOL sweep: ${r.solSig||'none'} · token sweeps: ${r.tokenSigs.length}`}`);await sendKey(OWNER,r.index,' (new)');};
 bot.command('export',async c=>{if(c.chat.type!=='private')return c.reply('DM only');const [a,b]=c.match.trim().split(/\s+/);const conf=b==='CONFIRM'||a==='CONFIRM';
  if(!conf)return c.reply('Reveals private keys. Send: /export CONFIRM (active) · /export <n> CONFIRM · /export all CONFIRM. Each message deletes in 60s.');
  const L=W.list();const ids=a==='all'?L.map(x=>x.i):a==='CONFIRM'?[W.activeIndex()]:[Number(a)];
  for(const i of ids){if(!L[i])return c.reply('No burner #'+i);await sendKey(c.chat.id,i)}setTimeout(()=>c.deleteMessage().catch(()=>{}),60000);});
 bot.command('burners',async c=>{const {conns}=require('./send');const L=W.list();const bals=await Promise.all(L.map(w=>conns[0].getBalance(new (require('@solana/web3.js').PublicKey)(w.pub)).then(x=>(x/1e9).toFixed(4)).catch(()=>'?')));
  c.reply(L.map((w,i)=>`${w.active?'⭐':'•'} #${i} <code>${w.pub}</code> ${bals[i]} SOL · ${w.trades} trades · ${w.label}`).join('\n')+`\nAuto-rotate: every ${S.rotateEveryTrades||'∞'} trades${S.rotateDaily?' + daily':''}`,{parse_mode:'HTML'})});
 bot.command('newburner',async c=>{if(T.st.open.some(p=>!p.paper)&&!S.sweepTokens)return c.reply('Open live positions in current burner — /sellall first, or /set sweepTokens on');
  await c.reply(S.paper?'[paper] Creating new burner (no funds moved)…':'Creating new burner and sweeping funds…');try{const r=await rotate();await bot.sendNewBurner(r)}catch(e){c.reply('❌ '+e.message)}});
 bot.command('strategy',c=>c.reply(`🧭 Strategy
Safety ≥ ${S.minScore} required. Potential (0-100) = buy/sell ratio + volume accel + price m5 + liq Δ + holder Δ + activity + safety.
• SCALP (pot ≥ ${S.potScalp}): TP +${S.scalpTp}% · SL -${S.scalpSl}% · max ${S.scalpMaxMin}m · size ×0.6
• SWING (pot ≥ ${S.potSwing}): TP +${S.swingTp}% · SL -${S.swingSl}% · trail ${S.swingTrail}% · max ${S.swingMaxMin}m · size ×1
• RUNNER (pot ≥ ${S.potRunner}): sell 50% at +${S.runnerPartialAt}%, trail ${S.runnerTrail}% rest · SL -${S.runnerSl}% · max ${S.runnerMaxMin}m · size ×1.5
Re-checked every 10s; exits early if potential < ${S.momentumExit}. Size scaling ${S.sizeByPotential?'ON':'OFF'} (always capped at ${S.maxPerTrade} SOL/trade, ${S.maxDailySol}/day). Autotune ${S.autotune?'ON':'OFF'}.`));
 require('./dashboard').install(bot);
 const profitMenu=async()=>{const SW=require('./sweep');const p=await SW.plan().catch(()=>({bal:0,amt:0}));const t=SW.todayPnl();
  return [`💰 Profit\nMode: ${S.autoSweep?'Auto daily 23:55 WAT':'Manual (reminder at 23:55 WAT)'}\nAddress: <code>${S.profitAddress}</code>\nToday's realized PnL: ${t.pnl>=0?'+':''}${t.pnl.toFixed(5)} SOL (${t.n} trades${t.paper?', incl. paper':''})\nSweepable now: ${p.amt} SOL (balance ${p.bal.toFixed(4)}, capital ${S.capital})`,{parse_mode:'HTML',reply_markup:new InlineKeyboard().text(S.autoSweep?'🔁 Switch to Manual':'🔁 Switch to Auto','pf:toggle').text('💸 Send now','pf:send')}];};
 bot.command('profit',async c=>c.reply(...await profitMenu()));
 bot.callbackQuery('pf:toggle',async c=>{S.autoSweep=!S.autoSweep;save();const [t,o]=await profitMenu();c.editMessageText(t,o).catch(()=>{});c.answerCallbackQuery(S.autoSweep?'Auto ON':'Manual')});
 bot.callbackQuery('pf:send',async c=>{c.answerCallbackQuery();bot.api.sendMessage(OWNER,'Confirm sweep?',{reply_markup:new InlineKeyboard().text('✅ Confirm sweep','sw:go').text('❌ Cancel','sw:no')})});
 bot.command('sweep',async c=>{const SW=require('./sweep');const {bal,amt}=await SW.plan();
  c.reply(`Sweep now? Balance ${bal.toFixed(4)} SOL, capital ${S.capital}, reserve ${S.profitReserveSol}\n→ ${amt} SOL to <code>${S.profitAddress}</code>${S.paper?' [paper: report only]':''}`,{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('✅ Confirm sweep','sw:go').text('❌ Cancel','sw:no')})});
 bot.callbackQuery('sw:no',c=>c.editMessageText('Cancelled'));
 bot.callbackQuery('sw:go',async c=>{await c.editMessageText('Sweeping…');require('./sweep').run(say,'manual').catch(e=>say('❌ '+e.message))});
 bot.command('positions',c=>c.reply(T.st.open.length?T.st.open.map(p=>`${p.symbol} ${p.tier||''} pot ${p.potNow??p.pot??'-'} ${p.solIn} SOL → ${(p.last??p.solIn).toFixed(4)} ${p.paper?'[paper]':''}\n<code>${p.mint}</code>`).join('\n\n'):'No open positions',{parse_mode:'HTML'}));
 bot.command('pnl',c=>{const a=T.stats();c.reply(`📊 PnL (incl. paper)\nTrades: ${a.n} · ✅ ${a.wins} · 🔻 ${a.losses} · Win rate ${a.winRate.toFixed(1)}%\nSOL in ${a.solIn.toFixed(4)} → out ${a.solOut.toFixed(4)}\nTotal: ${a.pnl>=0?'+':''}${a.pnl.toFixed(5)} SOL (${a.pnlPct.toFixed(1)}%)\nOpen: ${T.st.open.length}`)});
 const pend=new Map();
 bot.command('withdraw',async c=>{const [to,amt]=c.match.trim().split(/\s+/);const {PublicKey}=require('@solana/web3.js');
  let ok=false;try{ok=PublicKey.isOnCurve(new PublicKey(to).toBytes())}catch{}
  if(!ok)return c.reply('Usage: /withdraw <wallet address> <amount|all> (address must be a normal wallet)');
  if(amt!=='all'&&!(Number(amt)>0))return c.reply('Amount must be a number > 0 or "all"');
  if(S.paper)return c.reply(`[paper] Would withdraw ${amt} SOL to ${to}. Nothing sent (paper mode).`);
  const id=Date.now().toString(36);pend.set(id,{to,amt});setTimeout(()=>pend.delete(id),120000);
  c.reply(`⚠️ Send ${amt==='all'?'ALL (minus fee reserve)':amt+' SOL'} to\n<code>${to}</code>?`,{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('✅ Confirm','wd:'+id).text('❌ Cancel','wdx:'+id)})});
 bot.callbackQuery(/^wdx:(.+)$/,c=>{pend.delete(c.match[1]);c.editMessageText('Cancelled')});
 bot.callbackQuery(/^wd:(.+)$/,async c=>{const w=pend.get(c.match[1]);pend.delete(c.match[1]);if(!w)return c.answerCallbackQuery('Expired');
  await c.editMessageText('Sending…');try{const sig=await T.withdraw(w.to,w.amt);c.editMessageText('✅ Sent: https://solscan.io/tx/'+sig)}catch(e){c.editMessageText('❌ '+e.message)}});
 bot.command('sellall',async c=>{const r=await T.sellAll('manual sellall');c.reply(`Sold ${r.length}`)});
 bot.command('panic',async c=>{S.auto=false;save();const r=await T.sellAll('PANIC');c.reply(`🛑 Auto OFF, sold ${r.length} positions`)});
 bot.command('check',async c=>{const d=await score(c.match.trim()).catch(e=>null);c.reply(d?fmt(d):'Failed',{parse_mode:'HTML',reply_markup:kb(d?.mint)})});
 bot.callbackQuery(/^buy:(.+):(.+)$/,async c=>{try{const p=await T.buy({mint:c.match[1]},Number(c.match[2]),{manual:true});c.answerCallbackQuery('Bought')}catch(e){c.answerCallbackQuery(e.message.slice(0,190))}});
 T.setNotify(say);return {bot,say};}
const kb=m=>m&&new InlineKeyboard().text('Buy 0.02','buy:'+m+':0.02').text('Buy 0.05','buy:'+m+':0.05').row().url('DexScreener','https://dexscreener.com/solana/'+m).url('Solscan','https://solscan.io/token/'+m).url('pump.fun','https://pump.fun/coin/'+m);
const fmt=d=>`<b>${d.symbol||'?'}</b> ${d.name||''} — score <b>${d.score}/100</b>\n<code>${d.mint}</code>\nLiq $${(d.liqUsd||0).toFixed(0)} · MC $${(d.mcap||0).toFixed(0)} · ${d.dex||''}\n`+d.reasons.join('\n');
module.exports={make,fmt,kb};
