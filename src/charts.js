// /c chart, /pnl summary, /pnl $TICKER per-coin PROM card. Paper-safe: read-only, never trades.
const fs=require('fs'),path=require('path');const {InlineKeyboard,InputFile}=require('grammy');const {createCanvas}=require('canvas');
const j=require('./http');const T=require('./trader');const {DATA,settings:S}=require('./config');const {resolve}=require('./lookup');const L=require('./log');
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;const SCANF=path.join(DATA,'scans.json');let scans={};try{scans=JSON.parse(fs.readFileSync(SCANF))}catch{}
// first-detection record (kept forever, capped)
function recordScan(o){if(!o.mint||scans[o.mint])return;scans[o.mint]={t:Date.now(),p0:o.p0||null,mc0:o.mc0||null,symbol:o.symbol,src:o.src};
 const k=Object.keys(scans);if(k.length>20000)for(const x of k.slice(0,5000))delete scans[x];try{fs.writeFileSync(SCANF,JSON.stringify(scans))}catch{}}
const usd=n=>n==null||isNaN(n)?'-':n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}k`:`$${(+n).toFixed(0)}`;
const price=p=>{p=+p;return !p?'-':p<0.0001?'$'+p.toExponential(3):'$'+p.toPrecision(4)};
const pct=x=>x==null||isNaN(x)?'-':`${x>=0?'+':''}${(+x).toFixed(1)}%`;const sol=x=>`${x>=0?'+':''}${x.toFixed(4)} SOL`;
const dur=ms=>{const m=ms/6e4;return m<60?`${m|0}m`:m<2880?`${(m/60).toFixed(1)}h`:`${(m/1440)|0}d`};
const lagos=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Africa/Lagos',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' WAT';
const TF={'5m':['minute',5],'15m':['minute',15],'1h':['hour',1],'4h':['hour',4]};
async function parseCoin(q){q=(q||'').trim();const u=q.match(/dexscreener\.com\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})/i);if(u)q=u[1];q=q.replace(/^\$/,'');if(!q)throw new Error('usage');
 if(MINT.test(q)){const a=await j('https://api.dexscreener.com/latest/dex/pairs/solana/'+q).catch(()=>null);const pp=a?.pairs?.[0]||a?.pair;if(pp&&pp.pairAddress===q)return pp.baseToken.address;return q}
 const l=await resolve(q);if(!l.length)throw new Error(`No Solana coin found for $${q}`);return l[0].baseToken.address;}
const rank=p=>Math.min(p.liquidity?.usd||0,(p.volume?.h24||0)*5+1);
async function bestPair(mint){const a=await j('https://api.dexscreener.com/tokens/v1/solana/'+mint);if(!a?.length)throw new Error('No trading pool found for this coin');return a.sort((x,y)=>rank(y)-rank(x))[0]}
async function candles(pool,tf){const [u,ag]=TF[tf];const r=await j(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/${u}?aggregate=${ag}&limit=100&currency=usd`);
 return (r?.data?.attributes?.ohlcv_list||[]).map(([t,o,h,l,c,v])=>({t:t*1000,o,h,l,c,v})).sort((a,b)=>a.t-b.t)}
const BG='#0b0614',GRID='#2a1f3d',UP='#39ff88',DN='#ff3b6b',PUR='#b84dff',TXT='#e8e0ff',DIM='#8f84a8';
function frame(W,H){const cv=createCanvas(W,H),x=cv.getContext('2d');const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#120824');g.addColorStop(1,BG);x.fillStyle=g;x.fillRect(0,0,W,H);
 x.strokeStyle=PUR;x.lineWidth=3;x.shadowColor=PUR;x.shadowBlur=14;x.strokeRect(6,6,W-12,H-12);x.shadowBlur=0;return [cv,x]}
const fp=v=>v<0.0001?v.toExponential(2):v<1?v.toPrecision(3):v.toFixed(2);
function renderCandles(cs,{symbol,tf,entry}){const W=1000,H=560,[cv,x]=frame(W,H);const L0=70,R=W-90,T0=70,B=H-110,VB=H-40;
 x.fillStyle=TXT;x.font='bold 30px sans-serif';x.fillText(`$${symbol}`,L0,48);x.fillStyle=DIM;x.font='18px sans-serif';x.fillText(`${tf} candles · GeckoTerminal`,L0+20+x.measureText(`$${symbol}`).width*1.7,46);
 x.fillStyle=PUR;x.font='bold 22px sans-serif';x.textAlign='right';x.fillText('PROM',W-24,46);x.textAlign='left';
 if(!cs.length){x.fillStyle=DIM;x.fillText('No candle data yet',L0,H/2);return cv.toBuffer('image/png')}
 let lo=Math.min(...cs.map(c=>c.l)),hi=Math.max(...cs.map(c=>c.h));if(entry){lo=Math.min(lo,entry);hi=Math.max(hi,entry)}if(hi===lo){hi*=1.01;lo*=0.99}
 const y=v=>B-(v-lo)/(hi-lo)*(B-T0),n=cs.length,cw=(R-L0)/n,vmax=Math.max(...cs.map(c=>c.v))||1;
 x.strokeStyle=GRID;x.lineWidth=1;x.fillStyle=DIM;x.font='13px sans-serif';for(let i=0;i<=5;i++){const v=lo+(hi-lo)*i/5,yy=y(v);x.beginPath();x.moveTo(L0,yy);x.lineTo(R,yy);x.stroke();x.fillText(fp(v),R+6,yy+4)}
 cs.forEach((c,i)=>{const cx=L0+i*cw+cw/2,col=c.c>=c.o?UP:DN;x.strokeStyle=col;x.fillStyle=col;x.beginPath();x.moveTo(cx,y(c.h));x.lineTo(cx,y(c.l));x.stroke();
  const t=Math.min(y(c.o),y(c.c)),h=Math.max(1,Math.abs(y(c.o)-y(c.c)));x.fillRect(cx-cw*0.35,t,cw*0.7,h);x.globalAlpha=0.35;const vh=c.v/vmax*(VB-B-25);x.fillRect(cx-cw*0.35,VB-vh,cw*0.7,vh);x.globalAlpha=1});
 if(entry){x.setLineDash([6,5]);x.strokeStyle='#ffd166';x.beginPath();x.moveTo(L0,y(entry));x.lineTo(R,y(entry));x.stroke();x.setLineDash([]);x.fillStyle='#ffd166';x.fillText('our entry',L0+4,y(entry)-5)}
 const last=cs[n-1].c;x.fillStyle=last>=cs[n-1].o?UP:DN;x.fillRect(R+2,y(last)-10,86,20);x.fillStyle=BG;x.font='bold 13px sans-serif';x.fillText(fp(last),R+6,y(last)+4);
 x.fillStyle=DIM;x.font='12px sans-serif';[0,Math.floor(n/2),n-1].forEach(i=>{x.textAlign=i===0?'left':i===n-1?'right':'center';x.fillText(lagos(cs[i].t),L0+i*cw+cw/2,VB+16)});x.textAlign='left';
 return cv.toBuffer('image/png')}
// entry price in USD for a position: SOL in / tokens * SOL price (best effort)
async function solUsd(){try{const a=await j('https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112');return +a.sort((x,y)=>(y.liquidity?.usd||0)-(x.liquidity?.usd||0))[0].priceUsd}catch{return null}}
function entryUsd(p,su){if(p.entryUsd)return p.entryUsd;const tk=Number(p.tokens0||p.tokens)/10**(p.decimals??6);return su&&tk?p.solIn*su/tk:null}
async function chartMsg(q,tf='15m'){const mint=await parseCoin(q),pr=await bestPair(mint);const su=await solUsd();
 const pos=T.st.open.find(p=>p.mint===mint);const ent=pos?entryUsd(pos,su):null;const cs=await candles(pr.pairAddress,tf).catch(()=>[]);
 const png=renderCandles(cs,{symbol:pr.baseToken.symbol,tf,entry:ent&&ent>0?ent:null});const ch=pr.priceChange||{};
 let held='❌ Not holding';if(pos){const v=pos.last??pos.solIn,pn=v+(pos.realized||0)-pos.solIn;held=`✅ Holding · ${T.label(pos)}${pos.paper?' [PAPER]':' [LIVE]'}\nEntry ${price(ent)} · ${pos.solIn} SOL → ${v.toFixed(4)} · ${sol(pn)} (${pct(pn/pos.solIn*100)})`}
 const cap=`📈 <b>$${pr.baseToken.symbol}</b> · ${tf}${cs.length?'':' (no candles yet)'}\n💵 ${price(pr.priceUsd)} · 🏷 MCap ${usd(pr.marketCap||pr.fdv)} · 💧 Liq ${usd(pr.liquidity?.usd)}\n5m ${pct(ch.m5)} · 1h ${pct(ch.h1)} · 24h ${pct(ch.h24)}\n👛 ${held}\n<code>${mint}</code>`;
 const kb=new InlineKeyboard();for(const k of Object.keys(TF))kb.text(k===tf?`• ${k} •`:k,`ch:${k}:${mint}`);kb.row().url('DexScreener','https://dexscreener.com/solana/'+mint).text('🧾 PnL card','pc:'+mint);
 return {png,cap,kb,mint}}
// ---- /pnl summary ----
const STRAT=p=>p.tier==='MOON'?'🌙 Moonbag':p.tier==='BIG'?'💎 Big Play':p.tier==='SECOND'?'🔁 Second chance':`🎯 Sniper ${p.tier==='FAST'?'SCALP':p.tier||'?'}`;
function agg(a){const n=a.length,w=a.filter(x=>x.pnl>0).length,pnl=a.reduce((s,x)=>s+x.pnl,0),inn=a.reduce((s,x)=>s+x.solIn,0);return {n,w,pnl,wr:n?w/n*100:0,roi:inn?pnl/inn*100:0}}
const line=(k,a)=>`${k}: <b>${sol(a.pnl)}</b> · ${a.n} trades · WR ${a.wr.toFixed(0)}%${a.n?` · ROI ${pct(a.roi)}`:''}`;
function summary(){const C=T.st.closed,now=Date.now(),day=new Date(new Date().toLocaleString('en-US',{timeZone:'Africa/Lagos'}));day.setHours(0,0,0,0);
 const off=new Date().getTime()-new Date(new Date().toLocaleString('en-US',{timeZone:'Africa/Lagos'})).getTime(),d0=day.getTime()+off;
 const paper=C.filter(x=>x.paper),live=C.filter(x=>!x.paper);const out=[`📊 <b>PnL</b> · mode now: ${S.paper?'🧪 PAPER (test, no real SOL)':'⚠️ LIVE'}`];
 for(const [nm,set] of [['🧪 PAPER',paper],['💰 LIVE',live]]){if(!set.length&&nm.includes('LIVE')){out.push('\n💰 LIVE: no live trades');continue}
  out.push(`\n<b>${nm}</b>`,line('Today',agg(set.filter(x=>x.closed>=d0))),line('7 days',agg(set.filter(x=>x.closed>=now-7*864e5))),line('All time',agg(set)));}
 const by={};for(const x of C){(by[STRAT(x)]??=[]).push(x)}out.push('\n<b>By strategy (all time)</b>');for(const [k,v] of Object.entries(by).sort((a,b)=>agg(b[1]).pnl-agg(a[1]).pnl))out.push(line(k,agg(v))+(v.some(x=>!x.paper)?'':' [paper]'));
 const O=T.st.open;const u=O.reduce((s,p)=>s+(p.last??p.solIn)+(p.realized||0)-p.solIn,0);out.push(`\n<b>Open (unrealised)</b>: ${O.length} · ${sol(u)}`);for(const p of O.slice(0,6)){const v=(p.last??p.solIn)+(p.realized||0)-p.solIn;out.push(`  ${p.symbol} ${STRAT(p)} ${sol(v)} (${pct(v/p.solIn*100)})${p.paper?' [paper]':' [LIVE]'}`)}
 if(C.length){const b=C.reduce((a,x)=>x.pnl>a.pnl?x:a),w=C.reduce((a,x)=>x.pnl<a.pnl?x:a);out.push(`\n🏆 Best: ${b.symbol} ${sol(b.pnl)} (${pct(b.pnlPct)}) ${STRAT(b)}`,`💀 Worst: ${w.symbol} ${sol(w.pnl)} (${pct(w.pnlPct)}) ${STRAT(w)}`)}
 out.push('\nPer-coin card: <code>/pnl $TICKER</code>');return out.join('\n')}
function equityPng(){const C=[...T.st.closed].sort((a,b)=>a.closed-b.closed);if(C.length<2)return null;const W=900,H=380,[cv,x]=frame(W,H);let s=0;const pts=C.map(c=>[c.closed,s+=c.pnl]);pts.unshift([C[0].opened||C[0].closed,0]);
 const lo=Math.min(0,...pts.map(p=>p[1])),hi=Math.max(0,...pts.map(p=>p[1]))||1e-6,t0=pts[0][0],t1=pts.at(-1)[0]||t0+1,L0=60,R=W-110,T0=60,B=H-50;
 const X=t=>L0+(t-t0)/((t1-t0)||1)*(R-L0),Y=v=>B-(v-lo)/((hi-lo)||1)*(B-T0);
 x.fillStyle=TXT;x.font='bold 24px sans-serif';x.fillText('Cumulative PnL (SOL)',L0,40);x.fillStyle=PUR;x.textAlign='right';x.fillText('PROM',W-24,40);x.textAlign='left';
 x.strokeStyle=GRID;x.beginPath();x.moveTo(L0,Y(0));x.lineTo(R,Y(0));x.stroke();x.fillStyle=DIM;x.font='13px sans-serif';x.fillText('0',R+6,Y(0)+4);x.fillText(s.toFixed(4),R+6,Y(s)+4);
 x.strokeStyle=s>=0?UP:DN;x.lineWidth=3;x.shadowColor=x.strokeStyle;x.shadowBlur=10;x.beginPath();pts.forEach(([t,v],i)=>i?x.lineTo(X(t),Y(v)):x.moveTo(X(t),Y(v)));x.stroke();x.shadowBlur=0;
 x.fillStyle=DIM;x.fillText(lagos(t0),L0,H-22);x.textAlign='right';x.fillText(lagos(t1),R,H-22);return cv.toBuffer('image/png')}
// ---- per-coin PROM card ----
function firstScan(mint){if(scans[mint])return {...scans[mint],from:'scan log'};let best=null;
 for(const o of L.observations())if(o.mint===mint&&(!best||o.t<best.t))best={t:o.t,p0:o.p0,symbol:o.symbol,from:'observations'};
 try{const w=JSON.parse(fs.readFileSync(path.join(DATA,'missed.json'))).watch?.[mint];if(w&&(!best||w.t<best.t))best={t:w.t,p0:w.p0,mc0:w.mcap,symbol:w.symbol,from:'missed watch'}}catch{}
 try{for(const l of fs.readFileSync(path.join(DATA,'missed.jsonl'),'utf8').split('\n')){if(!l.includes(mint))continue;const o=JSON.parse(l);if(o.mint===mint&&(!best||o.t<best.t))best={t:o.t,symbol:o.symbol,from:'missed log'}}}catch{}
 const tr=[...T.st.open,...T.st.closed].filter(p=>p.mint===mint).sort((a,b)=>a.opened-b.opened)[0];if(tr&&(!best||tr.opened<best.t))best={t:tr.opened,symbol:tr.symbol,from:'first buy'};return best}
async function coinCard(q,who){const mint=await parseCoin(q),pr=await bestPair(mint),su=await solUsd();const now=+pr.priceUsd,mcNow=pr.marketCap||pr.fdv,sym=pr.baseToken.symbol;
 const sc=firstScan(mint);let p0=sc?.p0||null;if(!p0&&sc?.from==='first buy'){const f=[...T.st.open,...T.st.closed].find(p=>p.mint===mint&&p.opened===sc.t);p0=f?entryUsd(f,su):null}if(!p0&&sc?.mc0&&mcNow)p0=now*sc.mc0/mcNow;const mc0=sc?.mc0||(p0&&mcNow?mcNow*p0/now:null);
 const trades=[...T.st.open.map(p=>({...p,isOpen:true})),...T.st.closed].filter(p=>p.mint===mint).sort((a,b)=>b.opened-a.opened);const tr=trades[0];
 const W=1000,H=tr?620:430,[cv,x]=frame(W,H);x.fillStyle=PUR;x.font='bold 26px sans-serif';x.shadowColor=PUR;x.shadowBlur=12;x.fillText('PROM',40,56);x.shadowBlur=0;
 x.fillStyle=DIM;x.font='18px sans-serif';x.fillText(`SNIPER · ${S.paper?'PAPER':'LIVE'} MODE`,140,55);x.textAlign='right';x.fillText(lagos(Date.now()),W-40,55);x.textAlign='left';
 x.fillStyle=TXT;x.font='bold 54px sans-serif';x.fillText('$'+sym,40,130);x.fillStyle=DIM;x.font='15px monospace';x.fillText(mint,40,158);
 const big=(lbl,val,col,X0,Y0,sub)=>{x.fillStyle=DIM;x.font='17px sans-serif';x.fillText(lbl,X0,Y0);x.fillStyle=col;x.font='bold 40px sans-serif';x.fillText(val,X0,Y0+46);if(sub){x.fillStyle=DIM;x.font='16px sans-serif';x.fillText(sub,X0,Y0+72)}};
 x.fillStyle=TXT;x.font='bold 22px sans-serif';x.fillText('Since first scan',40,210);
 if(p0){const r=now/p0,c=(r-1)*100;big('At scan',mc0?usd(mc0):price(p0),TXT,40,250,`${price(p0)} · ${lagos(sc.t)}`);big('Now',usd(mcNow),TXT,370,250,price(now));big('Move',r>=2?`${r.toFixed(2)}X`:pct(c),c>=0?UP:DN,700,250,`${pct(c)} in ${dur(Date.now()-sc.t)}`)}
 else{x.fillStyle=DIM;x.font='20px sans-serif';x.fillText(sc?`First seen ${lagos(sc.t)} (${sc.from}); no scan price recorded`:'Bot never scanned this coin',40,260);big('Now',usd(mcNow),TXT,700,250,price(now))}
 if(tr){x.strokeStyle=GRID;x.beginPath();x.moveTo(40,360);x.lineTo(W-40,360);x.stroke();const ent=entryUsd(tr,su);
  const val=tr.isOpen?(tr.last??tr.solIn)+(tr.realized||0):tr.solOut,pn=val-tr.solIn,pp=pn/tr.solIn*100,exitP=tr.isOpen?now:(ent?ent*(1+pp/100):null);
  x.fillStyle=TXT;x.font='bold 22px sans-serif';x.fillText(`🦍 Aped · ${T.label(tr).replace(/[^\x20-\x7E·]/g,'').trim()} ${tr.paper?'[PAPER]':'[LIVE]'}`,40,395);
  big('Entry',price(ent),TXT,40,425,lagos(tr.opened));big(tr.isOpen?'Now':'Exit',price(exitP),TXT,370,425,tr.isOpen?'still holding':lagos(tr.closed));big('PnL',`${pn>=0?'+':''}${pn.toFixed(4)} SOL`,pn>=0?UP:DN,700,425,`${pct(pp)} · held ${dur((tr.isOpen?Date.now():tr.closed)-tr.opened)} · in ${tr.solIn} SOL`)}
 x.fillStyle=DIM;x.font='14px sans-serif';x.fillText('Prices: DexScreener · scan data: PROM bot logs',40,H-24);if(who){x.textAlign='right';x.fillStyle=UP;x.font='bold 18px sans-serif';x.fillText('Shared by '+who,W-40,H-24);x.textAlign='left'}
 const cap=`🧾 <b>$${sym}</b> PnL card${sc?` · first seen ${lagos(sc.t)} (${sc.from})`:''}${tr?`\n${trades.length} trade(s); latest ${tr.paper?'[PAPER]':'[LIVE]'}`:'\nBot never bought it'}`;
 return {png:cv.toBuffer('image/png'),cap}}
const WHO=c=>c.from?.username?'@'+c.from.username:(c.from?.first_name||'');
const ERR=e=>e.message==='usage'?'Usage: /c $TICKER | mint | dexscreener link':'❌ '+(e.message||'failed');
function install(bot){
 bot.command('c',async c=>{const w=await c.reply('📈 Drawing chart…');try{const r=await chartMsg(c.match);await c.replyWithPhoto(new InputFile(r.png,'chart.png'),{caption:r.cap,parse_mode:'HTML',reply_markup:r.kb});c.api.deleteMessage(c.chat.id,w.message_id).catch(()=>{})}catch(e){c.api.editMessageText(c.chat.id,w.message_id,ERR(e)).catch(()=>{})}});
 bot.callbackQuery(/^ch:(\w+):(.+)$/,async c=>{c.answerCallbackQuery('Loading '+c.match[1]+'…').catch(()=>{});try{const r=await chartMsg(c.match[2],c.match[1]);await c.editMessageMedia({type:'photo',media:new InputFile(r.png,'chart.png'),caption:r.cap,parse_mode:'HTML'},{reply_markup:r.kb})}catch(e){if(!/not modified/.test(e.message))c.reply(ERR(e))}});
 bot.callbackQuery(/^pc:(.+)$/,async c=>{c.answerCallbackQuery().catch(()=>{});try{const r=await coinCard(c.match[1],WHO(c));await c.replyWithPhoto(new InputFile(r.png,'pnl.png'),{caption:r.cap,parse_mode:'HTML'})}catch(e){c.reply(ERR(e))}});
 bot.command('pnl',async c=>{const q=c.match.trim();try{if(q){const r=await coinCard(q,WHO(c));return c.replyWithPhoto(new InputFile(r.png,'pnl.png'),{caption:r.cap,parse_mode:'HTML'})}
  await c.reply(summary(),{parse_mode:'HTML'});const p=equityPng();if(p)await c.replyWithPhoto(new InputFile(p,'equity.png'),{caption:`Cumulative PnL · ${T.st.closed.length} closed trades (paper + live)`})}catch(e){c.reply(ERR(e))}});}
module.exports={install,chartMsg,summary,equityPng,coinCard,recordScan,renderCandles,candles,parseCoin};
