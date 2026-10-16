// PROM-styled PnL picture card for /gpnl and /stats. Pure-JS on phones (see canvas.js). Callers fall back to text if this throws.
const {createCanvas}=require('./canvas');const j=require('./http');
const BG='#0b0614',PANEL='#160d26',GRID='#2a1f3d',UP='#39ff88',DN='#ff3b6b',PUR='#b84dff',TXT='#e8e0ff',DIM='#8f84a8';
let su={t:0,v:null};async function solUsd(){if(Date.now()-su.t<300000&&su.v)return su.v;try{const a=await j('https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112');su={t:Date.now(),v:+a.sort((x,y)=>(y.liquidity?.usd||0)-(x.liquidity?.usd||0))[0].priceUsd}}catch{}return su.v}
const pxx=p=>`${p>=0?'+':''}${p.toFixed(1)}% (${(1+p/100).toFixed(2)}x)`;
const net=a=>{const n=(a.ret||0)+(a.openVal||0)-(a.spent||0);return {n,pct:a.spent?n/a.spent*100:0,wr:a.closed?a.wins/a.closed*100:0}};
// a = {n,closed,open,spent,ret,openVal,wins,losses}; modes = [[name,a],...]
async function card({title,window,all,modes,paper}){const usd=await solUsd();const W=900,H=330+modes.length*62;const cv=createCanvas(W,H),x=cv.getContext('2d');
 x.fillStyle=BG;x.fillRect(0,0,W,H);x.fillStyle=PUR;x.fillRect(0,0,W,6);
 x.fillStyle=PUR;x.font='18px sans-serif';x.textAlign='left';x.fillText('PROM SNIPER',36,46);x.fillStyle=DIM;x.textAlign='right';x.fillText(`${paper?'PAPER':'LIVE'} · ${window}`,W-36,46);
 x.textAlign='left';x.fillStyle=TXT;x.font='24px sans-serif';x.fillText(title,36,90);
 const t=net(all),col=t.n>=0?UP:DN;x.fillStyle=col;x.font='56px sans-serif';x.fillText(pxx(t.pct),36,165);
 x.font='22px sans-serif';x.fillText(`${t.n>=0?'+':''}${t.n.toFixed(4)} SOL${usd?`  ·  ${t.n>=0?'+':'-'}$${Math.abs(t.n*usd).toFixed(2)}`:''}`,36,205);
 x.fillStyle=DIM;x.font='18px sans-serif';x.fillText(`Trades ${all.n} (${all.closed} closed, ${all.open} open)   Win rate ${t.wr.toFixed(0)}%   W ${all.wins} / L ${all.losses}   Spent ${(all.spent||0).toFixed(4)} SOL`,36,245);
 let y=280;x.strokeStyle=GRID;x.beginPath();x.moveTo(36,y-10);x.lineTo(W-36,y-10);x.stroke();
 for(const [name,a] of modes){const m=net(a);x.fillStyle=PANEL;x.fillRect(36,y,W-72,50);x.fillStyle=TXT;x.font='20px sans-serif';x.textAlign='left';x.fillText(name,52,y+32);
  x.fillStyle=DIM;x.font='16px sans-serif';x.fillText(a.n?`${a.n} trades · win ${m.wr.toFixed(0)}%`:'no trades',280,y+32);
  x.textAlign='right';x.fillStyle=a.n?(m.n>=0?UP:DN):DIM;x.font='20px sans-serif';x.fillText(a.n?`${pxx(m.pct)}  ${m.n>=0?'+':''}${m.n.toFixed(4)} SOL`:'-',W-52,y+32);y+=62}
 x.textAlign='left';x.fillStyle=DIM;x.font='14px sans-serif';x.fillText(new Date().toLocaleString('en-GB',{timeZone:'Africa/Lagos'})+' WAT'+(usd?` · SOL $${usd.toFixed(2)}`:''),36,H-18);
 return await cv.toBuffer('image/png')}
// send picture + words; text only if rendering fails
async function sendWithCard(c,data,text,opts={}){try{const {InputFile}=require('grammy');const png=await card(data);await c.replyWithPhoto(new InputFile(png,'pnl.png'))}catch(e){console.log('[pnlcard] image failed, text only:',e.message)}return c.reply(text,opts)}
module.exports={card,sendWithCard,solUsd};
