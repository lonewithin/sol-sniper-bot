const {InlineKeyboard}=require('grammy');const {settings:S}=require('./config');const C=require('./counters');const T=require('./trader');const SW=require('./sweep');
const bar=(p,n=10)=>'▓'.repeat(Math.round(p/100*n))+'░'.repeat(n-Math.round(p/100*n));
const dur=ms=>{const m=ms/6e4|0;return m<60?m+'m':m<1440?`${m/60|0}h ${m%60}m`:`${m/1440|0}d ${(m%1440)/60|0}h`};
const sgn=x=>(x>=0?'+':'')+x.toFixed(4);
function tstats(list){const n=list.length,w=list.filter(x=>x.pnl>0).length,i=list.reduce((a,x)=>a+x.solIn,0),o=list.reduce((a,x)=>a+x.solOut,0);
 const hold=n?list.reduce((a,x)=>a+(x.holdMin||(x.closed-x.opened)/6e4),0)/n:0;return {n,w,l:n-w,wr:n?w/n*100:0,pnl:o-i,pct:i?(o/i-1)*100:0,hold,avg:n?list.reduce((a,x)=>a+(x.pnlPct??0),0)/n:0};}
const today=()=>{const d=SW.lagos().day;return T.st.closed.filter(x=>SW.lagos(new Date(x.closed)).day===d)};
function overview(){const c=C.get();const A=tstats(T.st.closed),D=tstats(today());
 const blk=(t,h,x)=>`<b>${t}</b>\n🔎 Scanned ${h.scanned} · 🔔 Alerted ${h.alerted}\n🛒 Bought ${h.bought} · ⏭ Skipped ${h.skipped}\n📊 Trades ${x.n} · ✅ ${x.w} · 🔻 ${x.l}\n🎯 Win rate ${x.wr.toFixed(0)}% ${bar(x.wr)}\n💰 PnL ${sgn(x.pnl)} SOL (${x.pct.toFixed(1)}%)\n⏱ Avg hold ${x.hold.toFixed(1)} min`;
 return `📋 <b>OVERVIEW</b>\n⏳ Uptime ${dur(Date.now()-c.boot)}\n${S.paper?'🧪 PAPER (test)':'🔴 LIVE'} · Auto ${S.auto?'ON ✅':'OFF ⛔'} · ${S.mode==='fast'?'⚡ fast':'🛡 safe'}\n\n${blk('📅 Today',c.today,D)}\n\n${blk('🗂 All-time',c.all,A)}`;}
function hunting(){const {all:a,today:t}=C.get();const src=Object.entries(a.bySrc).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`• ${k}: ${v}`).join('\n')||'• none yet';
 const sk=Object.entries(a.skip).sort((x,y)=>y[1]-x[1]).slice(0,5).map(([k,v])=>`• ${k}: ${v}`).join('\n')||'• none yet';
 return `🎯 <b>HUNTING</b> (all-time)\n\n<b>📡 Scanned by source</b>\n${src}\n\n<b>⏭ Top skip reasons</b>\n${sk}\n\n<b>📏 Averages</b>\n🛡 Safety ${a.scored?(a.safetySum/a.scored).toFixed(0):'-'}/100\n🚀 Potential ${a.scored?(a.potSum/a.scored).toFixed(0):'-'}/100\n\n⚡ Fastest detect→buy: ${a.bestLatMs!=null?a.bestLatMs+' ms':'n/a (no fast buys yet)'}\n📅 Today scanned ${t.scanned}`;}
function trades(){const c=T.st.closed;const tiers=['SCALP','SWING','RUNNER','FAST','SECOND'].map(k=>{const x=tstats(c.filter(t=>t.tier===k));return x.n?`• ${k==='SECOND'?'🔁 2nd chance':k}: ${x.n} · win ${x.wr.toFixed(0)}% · avg ${x.avg.toFixed(1)}%`:null}).filter(Boolean).join('\n')||'• no closed trades yet';
 const sc=tstats(c.filter(t=>t.tier==='SECOND'));const s=[...c].sort((a,b)=>(b.pnlPct??0)-(a.pnlPct??0));const ln=x=>`${x.pnl>0?'✅':'🔻'} ${x.symbol} ${x.tier||''} ${(x.pnlPct??0).toFixed(1)}% (${sgn(x.pnl)})`;
 return `📈 <b>TRADES</b>\n\n<b>By tier</b>\n${tiers}\n\n<b>🔁 Second chance</b>\n${sc.n?`${sc.n} trades · ✅ ${sc.w} · 🔻 ${sc.l} · win ${sc.wr.toFixed(0)}% · PnL ${sgn(sc.pnl)} SOL`:'none yet'} (${S.secondChance?'ON':'OFF'})\n\n🏆 Best: ${s[0]?ln(s[0]):'-'}\n💀 Worst: ${s.length?ln(s.at(-1)):'-'}\n\n<b>🕘 Last 5</b>\n${c.slice(-5).reverse().map(ln).join('\n')||'none yet'}`;}
async function wallet(){const p=await SW.plan().catch(()=>({bal:0,amt:0}));const W=require('./wallet');
 const open=T.st.open.map(x=>`• ${x.symbol} ${x.tier||''} ${x.solIn} SOL${x.last!=null?' → '+x.last.toFixed(4):''}`).join('\n')||'• none';
 return `👛 <b>WALLET</b>\n🔑 <code>${W.pub()}</code>\n💎 Balance ${p.bal.toFixed(4)} SOL\n🏦 Capital ${S.capital} SOL${S.capital>0?'':' (set with /set capital)'}\n💸 Sweepable profit ${p.amt} SOL\n📅 Today PnL ${sgn(SW.todayPnl().pnl)} SOL\n\n<b>📂 Open positions (${T.st.open.length}/${S.maxOpen})</b>\n${open}`;}
function missed(){const m=require('./missed').summary();const top=m.top.map(x=>`• ${x.symbol||'?'} +${x.peak.toFixed(0)}% (${x.why})`).join('\n')||'• none today 🎉';
 return `👀 <b>MISSED PUMPS</b>\n\n<b>🔥 Top missed today</b>\n${top}\n\n<b>🎯 Skip accuracy</b> (finished watches)\n📈 Pumped ≥ +${S.missedAlertPct}%: ${m.pumped}\n📉 Dumped ≤ −50%: ${m.dumped}\n➖ Flat: ${m.flat}\n✅ Accuracy ${m.acc==null?'n/a yet':m.acc.toFixed(0)+'% '+bar(m.acc)}\n👁 Watching now: ${m.watching} (6h, max 300)\nAlerts ${S.missedAlerts?'ON':'OFF'} (/set missedAlerts on|off)`;}
const SECT={ov:['📋 Overview',overview],hu:['🎯 Hunting',hunting],tr:['📈 Trades',trades],wa:['👛 Wallet',wallet],mi:['👀 Missed',missed]};
const kb=cur=>{const k=new InlineKeyboard();Object.entries(SECT).forEach(([id,[t]],i)=>{k.text((id===cur?'• ':'')+t,'st:'+id);if(i%2)k.row()});return k.row().text('🔄 Refresh','st:'+cur);};
function install(bot){
 bot.command('stats',async c=>c.reply(await overview(),{parse_mode:'HTML',reply_markup:kb('ov')}));
 bot.callbackQuery(/^st:(\w+)$/,async c=>{const id=c.match[1];c.answerCallbackQuery();if(SECT[id])c.editMessageText(await SECT[id][1](),{parse_mode:'HTML',reply_markup:kb(id)}).catch(()=>{})});}
module.exports={install};
