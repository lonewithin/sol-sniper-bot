// Signals: smart-wallet copy, DexScreener trending, time-of-day filter, nightly self-tune. Paper-safe: never sends transactions.
const fs=require('fs'),path=require('path');const {settings:S,DATA,save,SOL}=require('./config');const j=require('./http');const L=require('./log');
const SWF=path.join(DATA,'smartwallets.json'),TUNEF=path.join(DATA,'autotune.jsonl');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const rpc=(m,p)=>require('./safety').rpc(m,p);
const lagos=d=>require('./sweep').lagos(d);const hourWAT=(t=Date.now())=>+lagos(new Date(t)).hm.slice(0,2);
let log=console.log,say=()=>{};
// ---------- smart wallets ----------
let SW={wallets:{},done:[],updated:0};try{SW={...SW,...JSON.parse(fs.readFileSync(SWF))}}catch{}
const saveSW=()=>fs.writeFileSync(SWF,JSON.stringify(SW,null,1));
const smartList=()=>Object.entries(SW.wallets).filter(([,v])=>v.wins>=2).sort((a,b)=>b[1].wins-a[1].wins).map(([k])=>k);
function winners(){const m=new Map();for(const t of L.trades())if(t.pnl>0&&t.pnlPct>=20)m.set(t.mint,t.symbol);
 try{for(const l of fs.readFileSync(path.join(DATA,'missed.jsonl'),'utf8').split('\n').filter(Boolean)){const x=JSON.parse(l);if(x.peakPct>=100)m.set(x.mint,x.symbol)}}catch{}
 try{for(const w of Object.values(JSON.parse(fs.readFileSync(path.join(DATA,'missed.json'))).watch||{}))if((w.peak||0)>=100)m.set(w.mint,w.symbol)}catch{}
 return [...m].filter(([k])=>!SW.done.includes(k));}
async function txBuys(sig,owner){const tx=await rpc('getTransaction',[sig,{encoding:'jsonParsed',maxSupportedTransactionVersion:0}]);if(!tx||tx.meta?.err)return {signer:null,mints:[]};
 const keys=tx.transaction.message.accountKeys;const signer=(keys.find(k=>k.signer)||{}).pubkey;const who=owner||signer;const pre={};
 for(const b of tx.meta.preTokenBalances||[])if(b.owner===who)pre[b.mint]=+b.uiTokenAmount.amount;
 const mints=(tx.meta.postTokenBalances||[]).filter(b=>b.owner===who&&b.mint!==SOL&&+b.uiTokenAmount.amount>(pre[b.mint]||0)).map(b=>b.mint);return {signer,mints};}
async function earlyBuyers(mint){let before,sigs=[];for(let i=0;i<4;i++){const r=await rpc('getSignaturesForAddress',[mint,{limit:1000,...(before?{before}:{})}]);sigs=r.length?r:sigs;if(r.length<1000)break;before=r.at(-1).signature;await sleep(400)}
 if(sigs.length>=1000)return null; // too many txs to reach the launch on the public RPC
 const early=sigs.filter(s=>!s.err).slice(-25).reverse();const out=new Set();
 for(const s of early){try{const b=await txBuys(s.signature);if(b.signer&&b.mints.includes(mint))out.add(b.signer)}catch{}await sleep(350)}return [...out];}
let building=false;
async function build(){if(building||!S.smartWallets)return;building=true;let ok=0,skip=0;const W=winners().slice(0,12);
 try{for(const [mint,sym] of W){try{const b=await earlyBuyers(mint);SW.done.push(mint);if(!b){skip++;continue}ok++;
   for(const w of b.slice(1)){const v=SW.wallets[w]??={wins:0,mints:[]};if(!v.mints.includes(mint)){v.mints.push(mint);v.wins++}}}catch(e){log(`[smart] ${sym} early buyers failed: ${e.message}`)}}
  SW.done=SW.done.slice(-500);SW.updated=Date.now();saveSW();
  log(`[smart] build: ${W.length} new winners, ${ok} scanned, ${skip} too busy for public RPC · tracked ${Object.keys(SW.wallets).length} wallets, ${smartList().length} smart (≥2 wins)`);}
 finally{building=false}}
const hits=new Map(),seen=new Set();let watchBusy=false;
async function watch(){if(watchBusy||!S.smartWallets)return;watchBusy=true;try{const L2=smartList().slice(0,20);for(const w of L2){try{const r=await rpc('getSignaturesForAddress',[w,{limit:5}]);
  for(const s of r){if(seen.has(s.signature)||s.err||Date.now()/1000-(s.blockTime||0)>S.smartWindowMin*60){seen.add(s.signature);continue}seen.add(s.signature);
   const b=await txBuys(s.signature,w);for(const m of b.mints){const h=hits.get(m)??new Map();h.set(w,s.blockTime*1000);hits.set(m,h);const n=smartCount(m);try{fs.appendFileSync(path.join(DATA,'smart_buys.jsonl'),JSON.stringify({mint:m,wallet:w,tBuy:s.blockTime*1000,tSeen:Date.now(),n})+'\n')}catch{}log(`[smart] ${w.slice(0,6)}… bought ${m} · ${n} smart wallet(s) in ${S.smartWindowMin}m${n>=S.smartMinWallets?' → SIGNAL':''}`)}await sleep(300)}}catch{}await sleep(300)}
  if(seen.size>20000)seen.clear();}finally{watchBusy=false}}
function smartCount(m){const h=hits.get(m);if(!h)return 0;const cut=Date.now()-S.smartWindowMin*6e4;for(const [w,t] of h)if(t<cut)h.delete(w);return h.size;}
const hotMints=()=>[...hits.keys()].filter(m=>smartCount(m)>=S.smartMinWallets);
// ---------- trending ----------
let trend=new Map(),trendAt=0;
async function refreshTrend(){if(!S.trending)return;const m=new Map();for(const [u,k] of [['https://api.dexscreener.com/token-boosts/top/v1','top boost'],['https://api.dexscreener.com/token-boosts/latest/v1','new boost']])
 try{for(const t of await j(u))if(t.chainId==='solana'&&!m.has(t.tokenAddress))m.set(t.tokenAddress,`${k} ${t.totalAmount||t.amount||''}`.trim())}catch(e){log('[trend] fetch fail '+e.message)}
 if(m.size){trend=m;trendAt=Date.now()}log(`[trend] ${trend.size} trending/boosted Solana coins`);}
const trendMints=()=>S.trending?[...trend.keys()]:[];
const lastLog=new Map();
function boost(mint){const out={n:0,why:[]};if(!mint)return out;
 if(S.trending&&trend.has(mint)){out.n+=S.trendBoost;out.why.push('trending ('+trend.get(mint)+')')}
 if(S.smartWallets){const c=smartCount(mint);if(c>=S.smartMinWallets){out.n+=S.smartBoost;out.why.push(c+' smart wallets bought')}}
 if(out.n&&!(lastLog.get(mint)>Date.now()-6e5)){lastLog.set(mint,Date.now());log(`[signal] ${mint} +${out.n} potential: ${out.why.join(', ')}`)}return out;}
// ---------- time of day ----------
function todStats(){const g={};for(const t of L.trades()){if(!t.opened)continue;const h=hourWAT(t.opened);const b=g[h]??={n:0,w:0,pnl:0};b.n++;b.pnl+=t.pnl;if(t.pnl>0)b.w++}return g;}
let todLogged=-1;
function todFactor(){const h=hourWAT(),b=todStats()[h]||{n:0,w:0,pnl:0};let f=1,why;
 if(b.n<S.todMinTrades)why=`only ${b.n}/${S.todMinTrades} trades → log only`;
 else if(b.pnl<0&&b.w/b.n<0.4){why=`losing hour (${b.w}/${b.n} wins, ${b.pnl.toFixed(4)} SOL)`;if(S.todFilter)f=S.todLosingSize;else why+=' → filter off, log only'}else why=`ok (${b.w}/${b.n} wins, ${b.pnl>=0?'+':''}${b.pnl.toFixed(4)} SOL)`;
 if(todLogged!==h){todLogged=h;log(`[tod] ${String(h).padStart(2,'0')}:00 WAT: ${why} · size ×${f}`)}return {f,h,why};}
// ---------- nightly self-tune ----------
const KNOBS={SCALP:{sl:['scalpSl',8,20],tp:['scalpTp',10,40]},SWING:{sl:['swingSl',10,25],tp:['swingTp',25,100]},RUNNER:{sl:['runnerSl',15,35],tp:['runnerPartialAt',30,150]},SECOND:{sl:['secondChanceSl',8,25]},BIG:{sl:['bigSl',15,35],tp:['bigPartialAt',30,150]}};
const r05=x=>Math.round(x*2)/2,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function nudge(k,dir,lo,hi,changes,why){const cur=S[k];const nv=clamp(r05(cur*(1+0.1*dir)),lo,hi);if(nv!==cur){changes.push({key:k,from:cur,to:nv,why});S[k]=nv}}
function autoTune(){const T=require('./trader');const since=Date.now()-864e5;const changes=[],lines=[];
 for(const [tier,K] of Object.entries(KNOBS)){const c=T.st.closed.filter(x=>x.tier===tier&&x.closed>=since);if(c.length<3){lines.push(`${tier}: ${c.length} trades, no change`);continue}
  const wins=c.filter(x=>x.pnl>0),sl=c.filter(x=>/^Stop loss/.test(x.why||'')),wr=wins.length/c.length;
  const slWinBack=sl.filter(x=>(x.peak||0)>=5).length; // stopped after being green: stop too tight
  if(sl.length/c.length>=0.5&&slWinBack/Math.max(1,sl.length)>=0.5)nudge(K.sl[0],+1,K.sl[1],K.sl[2],changes,`${tier}: ${slWinBack}/${sl.length} stop-outs had been green → wider stop`);
  else if(sl.length/c.length>=0.4&&wr<0.4)nudge(K.sl[0],-1,K.sl[1],K.sl[2],changes,`${tier}: ${sl.length}/${c.length} stop-outs, win ${Math.round(wr*100)}% → tighter stop`);
  if(K.tp){const cur=S[K.tp[0]];const pk=wins.map(x=>x.peak||0).sort((a,b)=>a-b);const med=pk.length?pk[pk.length>>1]:0;const missed=c.filter(x=>(x.peak||0)>=cur*0.6&&(x.peak||0)<cur&&x.pnl<=0).length;
   if(wins.length>=2&&med>=cur*1.3)nudge(K.tp[0],+1,K.tp[1],K.tp[2],changes,`${tier}: winners peaked ~+${med.toFixed(0)}% → higher target`);
   else if(missed/c.length>=0.3)nudge(K.tp[0],-1,K.tp[1],K.tp[2],changes,`${tier}: ${missed} trades got close to +${cur}% then lost → lower target`)}
  lines.push(`${tier}: ${c.length} trades, win ${Math.round(wr*100)}%, ${sl.length} stop-outs`);}
 if(changes.length)save();const rec={t:Date.now(),changes,lines};fs.appendFileSync(TUNEF,JSON.stringify(rec)+'\n');
 log('[autotune] '+(changes.length?changes.map(c=>`${c.key} ${c.from}→${c.to} (${c.why})`).join('; '):'no changes')+' | '+lines.join(' | '));
 return rec;}
function start(l,s){log=l;say=s;refreshTrend();setInterval(refreshTrend,3*6e4);setTimeout(build,60e3);setInterval(build,6*36e5);setInterval(watch,90e3);todFactor();
 setInterval(()=>{const t=lagos();if(t.hm!=='00:30'||S.lastAutoTuneDay===t.day)return;S.lastAutoTuneDay=t.day;save();if(!S.autoTune||!S.paper)return log('[autotune] skipped (off or live mode)');
  try{const r=autoTune();say(`🧠 Nightly self-tune (00:30 WAT) [paper]\n${r.changes.length?r.changes.map(c=>`• ${c.key}: ${c.from} → ${c.to}\n  ${c.why}`).join('\n'):'No changes: not enough evidence.'}\n${r.lines.join('\n')}`)}catch(e){log('[autotune] err '+e.message)}},20e3);}
module.exports={start,boost,todFactor,todStats,autoTune,trendMints,hotMints,build,smartList};
