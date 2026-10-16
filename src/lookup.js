// $TICKER / $mint / plain mint lookup → coin card.
const {InlineKeyboard}=require('grammy');const j=require('./http');const {score}=require('./safety');const {potential,pairsFor}=require('./potential');const T=require('./trader');
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const usd=n=>n==null?'-':n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}k`:`$${(+n).toFixed(0)}`;
const pc=x=>x==null?'-':`${x>=0?'🟢 +':'🔴 '}${x}%`;
const price=p=>{p=+p;return !p?'-':p<0.0001?'$'+p.toExponential(3):'$'+p.toPrecision(4)};
const age=t=>{if(!t)return '-';const h=(Date.now()-t)/36e5;return h<1?`${(h*60)|0}m`:h<48?`${h.toFixed(1)}h`:`${(h/24)|0}d`};
async function resolve(q){const r=await j('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(q));
 const ps=(r.pairs||[]).filter(p=>p.chainId==='solana'&&p.baseToken?.symbol?.toUpperCase()===q.toUpperCase());
 const best={};for(const p of ps){const m=p.baseToken.address;if(!best[m]||(p.liquidity?.usd||0)>(best[m].liquidity?.usd||0))best[m]=p}
 // rank by liquidity but discount pools with no real trading (fake-liquidity copycats)
 const rank=p=>Math.min(p.liquidity?.usd||0,(p.volume?.h24||0)*5+1);
 return Object.values(best).sort((a,b)=>rank(b)-rank(a));}
async function card(mint){const pr=(await pairsFor([mint]))[mint];const d=await score(mint).catch(()=>null);
 const m=potential(pr,{safety:d?.score||0,holders:d?.holders,mint});const s=d||{reasons:[],hard:[]};
 const tx=k=>pr?.txns?.[k]?`${pr.txns[k].buys}/${pr.txns[k].sells}`:'-';
 const pos=T.st.open.find(p=>p.mint===mint);let held='❌ Not holding';
 if(pos){const v=pos.last??pos.solIn;const ch=((v+(pos.realized||0))/pos.solIn-1)*100;held=`✅ Holding · ${T.label(pos)}\n${pos.solIn} SOL → ${v.toFixed(4)} (${require("./fmt").px(ch)})${pos.paper?' [paper]':''}`}
 const hard=s.reasons.filter(r=>r.startsWith('⛔')),soft=s.reasons.filter(r=>r.startsWith('⚠️')),good=s.reasons.filter(r=>r.startsWith('✅'));
 const name=pr?.baseToken?.name||d?.name||'?',sym=pr?.baseToken?.symbol||d?.symbol||'?';
 const t=`🪙 <b>${name}</b> ($${sym})
<code>${mint}</code>

💵 Price ${price(pr?.priceUsd)}
🏷 MCap ${usd(pr?.marketCap)} · FDV ${usd(pr?.fdv)}
💧 Liquidity ${usd(pr?.liquidity?.usd)}
🏛 ${pr?.dexId||'-'} · ⏳ Age ${age(pr?.pairCreatedAt)} · 👥 Holders ${d?.holders??'-'}

📊 <b>Volume</b> 24h ${usd(pr?.volume?.h24)} · 1h ${usd(pr?.volume?.h1)} · 5m ${usd(pr?.volume?.m5)}
📈 <b>Change</b> 24h ${pc(pr?.priceChange?.h24)} · 1h ${pc(pr?.priceChange?.h1)} · 5m ${pc(pr?.priceChange?.m5)}
🔄 <b>Buys/Sells</b> 24h ${tx('h24')} · 1h ${tx('h1')} · 5m ${tx('m5')}

🛡 <b>Safety ${d?d.score:'n/a'}/100</b>${hard.length?'\n'+hard.join('\n'):'\n⛔ No hard blockers'}${soft.length?'\n'+soft.slice(0,5).join('\n'):''}${good.length?'\n'+good.slice(0,4).join(' · '):''}
🚀 <b>Potential ${m.potential}/100 · ${m.tier}</b>

👛 ${held}`;
 const kb=new InlineKeyboard().url('DexScreener','https://dexscreener.com/solana/'+mint).url('Solscan','https://solscan.io/token/'+mint).url('pump.fun','https://pump.fun/coin/'+mint).row()
  .text(`Buy 0.02${require('./config').settings.paper?' (paper)':''}`,'buy:'+mint+':0.02').text(`Buy 0.05${require('./config').settings.paper?' (paper)':''}`,'buy:'+mint+':0.05').row().text('🔄 Refresh','lk:'+mint);
 return [t,{parse_mode:'HTML',reply_markup:kb,link_preview_options:{is_disabled:true}}];}
function install(bot){
 bot.on('message:text',async(c,next)=>{const raw=c.message.text.trim();let q=null,isMint=false;
  if(raw.startsWith('$')){q=raw.slice(1).trim();isMint=MINT.test(q)}else if(MINT.test(raw)){q=raw;isMint=true}
  if(!q||/\s/.test(q))return next();
  try{if(isMint){const w=await c.reply('🔎 Looking up…');const [t,o]=await card(q);return c.api.editMessageText(c.chat.id,w.message_id,t,o)}
   const list=await resolve(q);if(!list.length)return c.reply(`No Solana coin found for $${q}`);
   const top=list.slice(0,3);if(top.length>1&&Math.min(top[1].liquidity?.usd||0,(top[1].volume?.h24||0)*5)>Math.min(top[0].liquidity?.usd||0,(top[0].volume?.h24||0)*5)*0.2){
    const kb=new InlineKeyboard();top.forEach(p=>kb.text(`${p.baseToken.symbol} · liq ${usd(p.liquidity?.usd)} · mc ${usd(p.marketCap)}`,'lk:'+p.baseToken.address).row());
    return c.reply(`Several coins called $${q}. Pick one:`,{reply_markup:kb});}
   const w=await c.reply('🔎 Looking up…');const [t,o]=await card(top[0].baseToken.address);c.api.editMessageText(c.chat.id,w.message_id,t,o);
  }catch(e){c.reply('❌ Lookup failed: '+e.message)}});
 bot.callbackQuery(/^lk:(.+)$/,async c=>{c.answerCallbackQuery('Loading…');try{const [t,o]=await card(c.match[1]);await c.editMessageText(t,o).catch(async e=>{if(!/not modified/.test(e.message))await c.reply(t,o)})}catch(e){c.reply('❌ '+e.message)}});}
module.exports={install,card,resolve};
