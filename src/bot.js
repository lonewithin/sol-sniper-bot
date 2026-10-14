const {Bot,InlineKeyboard}=require('grammy');const {settings:S,save,OWNER}=require('./config');const T=require('./trader');const W=require('./wallet');const {score}=require('./safety');
function make(){const bot=new Bot(process.env.BOT_TOKEN);
 bot.use((ctx,next)=>ctx.from?.id===OWNER?next():undefined); // owner-only, silently ignore others
 const say=t=>bot.api.sendMessage(OWNER,t,{parse_mode:'HTML',link_preview_options:{is_disabled:true}}).catch(()=>{});
 bot.command('start',c=>c.reply('Sol Sniper ready. /settings /auto on|off /paper on|off /set key value /wallet /positions /pnl /check MINT /sellall /panic /export'));
 bot.command('auto',c=>{S.auto=/on/i.test(c.match);save();c.reply(`Auto-snipe ${S.auto?'ON':'OFF'} (${S.paper?'PAPER':'LIVE'})`)});
 bot.command('paper',c=>{S.paper=!/off/i.test(c.match);save();c.reply(`Mode: ${S.paper?'PAPER (no real trades)':'⚠️ LIVE — real SOL'}`)});
 bot.command('settings',c=>c.reply('<pre>'+JSON.stringify(S,null,1)+'</pre>\nChange: /set buySol 0.02',{parse_mode:'HTML'}));
 bot.command('set',c=>{const [k,v]=c.match.split(/\s+/);if(!(k in S)||typeof S[k]==='boolean')return c.reply('Unknown/boolean key');const n=Number(v);if(!isFinite(n)||n<0)return c.reply('Bad number');
  if(k==='buySol'&&n>S.maxPerTrade)return c.reply(`buySol > maxPerTrade (${S.maxPerTrade})`);S[k]=n;save();c.reply(`${k} = ${n}`)});
 bot.command('wallet',async c=>c.reply(`Burner (${W.source()}): <code>${W.pub()}</code>\nBalance: ${await T.balance().catch(()=>'?')} SOL\nFund with SMALL amounts only.`,{parse_mode:'HTML'}));
 bot.command('export',async c=>{if(c.chat.type!=='private')return c.reply('DM only');
  if(c.match.trim()!=='CONFIRM')return c.reply('This reveals the burner private key. Send: /export CONFIRM — message self-deletes in 60s.');
  const m=await c.reply(`🔐 Burner key (save offline, then this deletes in 60s):\n<tg-spoiler>${W.exportSecret()}</tg-spoiler>`,{parse_mode:'HTML'});
  setTimeout(()=>{c.api.deleteMessage(c.chat.id,m.message_id).catch(()=>{});c.deleteMessage().catch(()=>{})},60000);});
 bot.command('positions',c=>c.reply(T.st.open.length?T.st.open.map(p=>`${p.symbol} ${p.solIn} SOL → ${(p.last??p.solIn).toFixed(4)} ${p.paper?'[paper]':''}\n<code>${p.mint}</code>`).join('\n\n'):'No open positions',{parse_mode:'HTML'}));
 bot.command('pnl',c=>{const t=T.st.closed.reduce((a,x)=>a+x.pnl,0);c.reply(`Closed: ${T.st.closed.length}, PnL ${t.toFixed(4)} SOL (incl. paper)`)});
 bot.command('sellall',async c=>{const r=await T.sellAll('manual sellall');c.reply(`Sold ${r.length}`)});
 bot.command('panic',async c=>{S.auto=false;save();const r=await T.sellAll('PANIC');c.reply(`🛑 Auto OFF, sold ${r.length} positions`)});
 bot.command('check',async c=>{const d=await score(c.match.trim()).catch(e=>null);c.reply(d?fmt(d):'Failed',{parse_mode:'HTML',reply_markup:kb(d?.mint)})});
 bot.callbackQuery(/^buy:(.+):(.+)$/,async c=>{try{const p=await T.buy({mint:c.match[1]},Number(c.match[2]),{manual:true});c.answerCallbackQuery('Bought');say(`🟢 Bought ${p.solIn} SOL ${p.paper?'[paper]':p.sig}`)}catch(e){c.answerCallbackQuery(e.message.slice(0,190))}});
 return {bot,say};}
const kb=m=>m&&new InlineKeyboard().text('Buy 0.02','buy:'+m+':0.02').text('Buy 0.05','buy:'+m+':0.05').row().url('DexScreener','https://dexscreener.com/solana/'+m).url('Solscan','https://solscan.io/token/'+m).url('pump.fun','https://pump.fun/coin/'+m);
const fmt=d=>`<b>${d.symbol||'?'}</b> ${d.name||''} — score <b>${d.score}/100</b>\n<code>${d.mint}</code>\nLiq $${(d.liqUsd||0).toFixed(0)} · MC $${(d.mcap||0).toFixed(0)} · ${d.dex||''}\n`+d.reasons.join('\n');
module.exports={make,fmt,kb};
