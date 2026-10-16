// Friends (multi-user). Each approved user with role 'trade' gets their OWN folder data/users/<id>/:
//   vault.enc + wallet.pass (own encrypted burners), settings.json (own copy of the defaults), positions.json (own trades/PnL).
// The owner keeps using the original data/ files through trader.js/wallet.js; nothing here touches them.
// The scanner scores each coin ONCE; dispatch() then buys for every trade user with auto on, using their own settings.
const fs=require('fs'),path=require('path');const {LAMPORTS_PER_SOL,Connection,PublicKey,SystemProgram,Transaction,sendAndConfirmTransaction}=require('@solana/web3.js');
const {defaults,DATA,RPC,SOL,OWNER}=require('./config');const {createVault}=require('./wallet');
const UD=path.join(DATA,'users');
let bot=null,deps=null;const D=()=>deps||(deps={quote:require('./safety').quote,pairsFor:require('./potential').pairsFor,solUsd:require('./usdsize').solUsd,j:require('./http'),px:require('./fmt').px});
// ---------- rate limiter shared by all friends (public RPC / Jupiter friendly) ----------
function limiter(gapMs){let last=0,chain=Promise.resolve();return fn=>{const r=chain.then(async()=>{const w=last+gapMs-Date.now();if(w>0)await new Promise(z=>setTimeout(z,w));last=Date.now();return fn()});chain=r.catch(()=>{});return r}}
const rpcQ=limiter(+process.env.FRIENDS_RPC_GAP_MS||400),jupQ=limiter(+process.env.FRIENDS_JUP_GAP_MS||1100);
let conn=null;const C=()=>conn||(conn=new Connection(RPC,'confirmed'));
const balCache=new Map();async function balanceOf(pub,maxAge=30000){const c=balCache.get(pub);if(c&&Date.now()-c.t<maxAge)return c.v;const v=await rpcQ(()=>C().getBalance(new PublicKey(pub)))/LAMPORTS_PER_SOL;balCache.set(pub,{v,t:Date.now()});return v}
const qCache=new Map();function quoteC(i,o,a,bps){const k=i+o+a+bps,c=qCache.get(k);if(c&&Date.now()-c.t<5000)return c.p;const p=jupQ(()=>D().quote(i,o,a,bps));qCache.set(k,{p,t:Date.now()});p.catch(()=>qCache.delete(k));if(qCache.size>500)qCache.clear();return p}
// ---------- per-user state ----------
const USER_DEFAULTS=()=>({...defaults,paper:true,auto:false,profitAddress:'',capital:0,autoSweep:false,maxOpen:3,bigMaxOpen:3,moonMaxOpen:3,usdSizing:true,buyUsdMin:defaults.buyUsdMin,buyUsdMax:defaults.buyUsdMax,letRun:true});
const SETTABLE=['buyUsdMin','buyUsdMax','letRun','runnerSl','runnerTrail','runnerMaxMin','runnerPartialAt','runnerPartialPct','scalpTp','scalpSl','scalpMaxMin','swingTp','swingSl','swingTrail','swingMaxMin','slippageBps','maxOpen','minScore','skillMinSafety','skillMinSafetyScore','skillNoMigration','skillNoChase','tiers','alerts'];
const cache=new Map();
function dir(id){return path.join(UD,String(+id))}
function get(id){id=+id;if(cache.has(id))return cache.get(id);const d=dir(id);fs.mkdirSync(d,{recursive:true,mode:0o700});
 let s=USER_DEFAULTS();try{s={...s,...JSON.parse(fs.readFileSync(path.join(d,'settings.json'),'utf8'))}}catch{}
 let st={open:[],closed:[]};try{st=JSON.parse(fs.readFileSync(path.join(d,'positions.json'),'utf8'))}catch{}
 const u={id,s,st,vault:createVault(d,{allowEnv:false}),liveAllowed:false,pend:new Set(),
  saveS(){fs.writeFileSync(path.join(d,'settings.json'),JSON.stringify(s,null,1),{mode:0o600})},
  saveP(){const f=path.join(d,'positions.json');fs.writeFileSync(f+'.tmp',JSON.stringify(st));fs.renameSync(f+'.tmp',f)}};
 if(!fs.existsSync(path.join(d,'settings.json')))u.saveS();cache.set(id,u);return u}
let US=null;const Users=()=>US||(US=require('./users'));
const role=id=>Users().roleOf(id);const isTrade=id=>role(id)==='trade';const liveOk=id=>!!Users().U.allowed[id]?.live;
const tradeUsers=()=>Object.keys(Users().U.allowed).map(Number).filter(isTrade);
const anyAuto=()=>tradeUsers().some(id=>get(id).s.auto);
// ---------- strategy rules from the user's own settings ----------
function rulesFor(s,tier){if(s.letRun)return {tp:0,sl:s.runnerSl,trail:s.runnerTrail,pctTrail:true,maxMin:s.runnerMaxMin,partialAt:s.runnerPartialAt,partialFrac:(s.runnerPartialPct||50)/100};
 return ({SCALP:{tp:s.scalpTp,sl:s.scalpSl,trail:0,maxMin:s.scalpMaxMin},SWING:{tp:s.swingTp,sl:s.swingSl,trail:s.swingTrail,maxMin:s.swingMaxMin},RUNNER:{tp:0,sl:s.runnerSl,trail:s.runnerTrail,pctTrail:true,maxMin:s.runnerMaxMin,partialAt:s.runnerPartialAt,partialFrac:(s.runnerPartialPct||50)/100}})[tier]||{tp:s.swingTp,sl:s.swingSl,trail:s.swingTrail,maxMin:s.swingMaxMin}}
const GW={SCALP:0,SECOND:0,SWING:0.25,RUNNER:0.6};
const usdFor=(s,tier)=>{const lo=Math.min(s.buyUsdMin,s.buyUsdMax),hi=Math.max(s.buyUsdMin,s.buyUsdMax);return +(lo+(hi-lo)*(GW[tier]??0.25)).toFixed(2)};
const isPaper=u=>u.s.paper!==false||!liveOk(u.id); // live needs BOTH the user's /paper off CONFIRM and the owner's allow toggle
const send=(id,t,x={})=>bot?bot.api.sendMessage(id,t,{parse_mode:'HTML',link_preview_options:{is_disabled:true},...x}).catch(()=>{}):Promise.resolve();
const x=p=>D().px(p);
// ---------- live swaps with the USER's keypair ----------
async function swapWith(kp,q,s){const r=await D().j('https://lite-api.jup.ag/swap/v1/swap',{method:'POST',body:JSON.stringify({quoteResponse:q,userPublicKey:kp.publicKey.toBase58(),wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,prioritizationFeeLamports:s.priorityLamports})},15000);
 const SND=require('./send');const {sig}=await SND.signAndSend(Buffer.from(r.swapTransaction,'base64'),kp);await SND.confirm(sig);return sig}
// ---------- buy / sell ----------
async function buyFor(id,tok,{tier='SWING',pot=null,safety=null,src=''}={}){const u=get(id),s=u.s;
 if(!isTrade(id))throw new Error('not a trade user');if(!['SCALP','SWING','RUNNER'].includes(tier))throw new Error('tier not traded for friends');
 if(s.skillMinSafety&&safety!=null&&safety<s.skillMinSafetyScore)throw new Error('skill safety');if(s.skillNoMigration&&src==='pump.fun migration')throw new Error('skill migration');if(safety!=null&&safety<s.minScore)throw new Error('safety below '+s.minScore);
 if(u.st.open.length+u.pend.size>=s.maxOpen)throw new Error('max open positions for this mode');if(u.st.open.find(p=>p.mint===tok.mint)||u.pend.has(tok.mint))throw new Error('already holding');
 u.pend.add(tok.mint);try{const px=await D().solUsd();if(!px)throw new Error('no SOL price');const usd=usdFor(s,tier);const sol=+(usd/px).toFixed(4);const paper=isPaper(u);
  const pr=(await D().pairsFor([tok.mint]))[tok.mint];const entryUsd=+pr?.priceUsd||0;
  let sig='PAPER',tokens=null;if(!paper){const kp=u.vault.load();const bal=await balanceOf(kp.publicKey.toBase58(),0);if(bal<sol+0.003)throw new Error('balance too low');
   const q=await quoteC(SOL,tok.mint,Math.round(sol*LAMPORTS_PER_SOL),s.slippageBps);sig=await swapWith(kp,q,s);tokens=q.outAmount;balCache.delete(kp.publicKey.toBase58())}
  else if(!(entryUsd>0))throw new Error('no price');
  const p={mint:tok.mint,symbol:tok.symbol||'?',tier,solIn:sol,usdIn:usd,entryUsd,tokens,tokens0:tokens,rest:1,realized:0,peak:0,opened:Date.now(),paper,sig,rules:rulesFor(s,tier),pot,safety};u.st.open.push(p);u.saveP();
  send(id,`🎯 <b>BUY</b> ${p.symbol} · ${tier}${paper?' [paper]':' [LIVE]'}\n$${usd} (${sol} SOL) · safety ${safety??'-'} · potential ${pot??'-'}\nPlan: SL -${p.rules.sl}%${p.rules.partialAt?' · sell '+Math.round(p.rules.partialFrac*100)+'% at +'+p.rules.partialAt+'%':''}${p.rules.tp?' · TP +'+p.rules.tp+'%':''}${p.rules.trail?' · trail '+p.rules.trail+'%':''} · max ${p.rules.maxMin}m\n<code>${p.mint}</code>`);return p}finally{u.pend.delete(tok.mint)}}
async function sellFor(id,p,why,frac=1){const u=get(id),s=u.s;frac=Math.min(1,frac);let sol,sig='PAPER';
 if(p.paper){const ch=p.lastCh??0;sol=p.solIn*p.rest*frac*(1+ch/100);sol=Math.max(0,sol*(1-(s.paperCostPct||1.5)/100)-(s.priorityLamports||0)/LAMPORTS_PER_SOL)}
 else{const amt=frac>=1?p.tokens:String(BigInt(p.tokens)*BigInt(Math.round(frac*1000))/1000n);const q=await quoteC(p.mint,SOL,amt,s.slippageBps);sig=await swapWith(u.vault.load(),q,s);sol=Number(q.outAmount)/LAMPORTS_PER_SOL;if(frac<1)p.tokens=String(BigInt(p.tokens)-BigInt(amt))}
 if(frac<1){p.rest*=1-frac;p.realized+=sol;p.halfDone=true;u.saveP();send(id,`🟡 <b>PARTIAL SELL</b> ${Math.round(frac*100)}% ${p.symbol}${p.paper?' [paper]':''}\n📝 ${why}`);return null}
 const out=sol+p.realized;u.st.open=u.st.open.filter(q=>q!==p);const c={...p,solOut:out,pnl:out-p.solIn,pnlPct:(out/p.solIn-1)*100,why,closed:Date.now(),holdMin:+((Date.now()-p.opened)/6e4).toFixed(1),sellSig:sig};u.st.closed.push(c);if(u.st.closed.length>2000)u.st.closed.splice(0,u.st.closed.length-2000);u.saveP();
 send(id,`${c.pnl>=0?'✅ WIN':'🔻 LOSS'} <b>SELL</b> ${c.symbol}${c.paper?' [paper]':''}\n📝 ${why}\nPnL: ${x(c.pnlPct)} · held ${c.holdMin}m`);return c}
// ---------- monitor: ONE batched DexScreener call for every friend's open coins ----------
let monBusy=false;
async function monitor(){if(monBusy)return;monBusy=true;try{const all=[];for(const id of fs.existsSync(UD)?fs.readdirSync(UD).map(Number).filter(n=>n>0):[]){const u=get(id);for(const p of u.st.open)all.push([id,p])}
 if(!all.length)return;const pairs=await D().pairsFor([...new Set(all.map(([,p])=>p.mint))]);
 for(const [id,p] of all){try{const pr=pairs[p.mint];const age=(Date.now()-p.opened)/6e4;const r=p.rules;
  if(pr?.priceUsd&&p.entryUsd>0){p.lastCh=(+pr.priceUsd/p.entryUsd-1)*100;p.miss=0}else{p.miss=(p.miss||0)+1;if(p.miss<30&&age<r.maxMin+5)continue}
  const cur=p.lastCh??0;p.peak=Math.max(p.peak||0,cur);const f1=v=>x(v);let why=null;
  const sl=p.halfDone&&r.partialAt?0:-r.sl;
  if(cur<=sl)why=p.halfDone?`Breakeven stop on the rest (${f1(cur)})`:`Stop loss: ${f1(cur)} (limit -${r.sl}%)`;
  else if(r.partialAt&&!p.halfDone&&cur>=r.partialAt){await sellFor(id,p,`Partial take-profit at ${f1(cur)}; stop moved to breakeven`,r.partialFrac||0.5);continue}
  else if(r.tp&&cur>=r.tp)why=`Take profit: ${f1(cur)}`;
  else if(r.trail&&p.peak>=10&&(r.pctTrail?(1+cur/100)<=(1+p.peak/100)*(1-r.trail/100):cur<=p.peak-r.trail))why=`Trailing stop: fell from ${f1(p.peak)} peak, locked ${f1(cur)}`;
  else if(age>=r.maxMin)why=`Time limit ${r.maxMin}m, closed at ${f1(cur)}`;
  else if(p.miss>=30)why='No price for a long time: closed at last known value';
  if(why)await sellFor(id,p,why)}catch(e){console.log('[friends] monitor',id,p.symbol,e.message)}}
 for(const id of new Set(all.map(([i])=>i)))get(id).saveP()}finally{monBusy=false}}
// ---------- signal dispatch (coin already scored once by the scanner) ----------
async function dispatch(tok,{tier,pot,safety,src}){const ids=tradeUsers().filter(id=>get(id).s.auto);const out=[];
 for(const id of ids){try{out.push(await buyFor(id,tok,{tier,pot,safety,src}))}catch(e){if(!/max open|already|skill|safety below|tier not/.test(e.message))console.log('[friends] buy skip',id,e.message)}}return out}
// ---------- summaries ----------
function stats(id){const c=get(id).st.closed,w=c.filter(q=>q.pnl>0).length,i=c.reduce((a,q)=>a+q.solIn,0),o=c.reduce((a,q)=>a+q.solOut,0);return {n:c.length,wins:w,winRate:c.length?w/c.length*100:0,pnlPct:i?(o/i-1)*100:0,pnl:o-i,open:get(id).st.open.length}}
const summary=id=>{const t=stats(id);return `${t.n} closed · win ${t.winRate.toFixed(0)}% · ${x(t.pnlPct)} · ${t.open} open`};
function onRoleChange(id,r){const u=get(id);if(r!=='trade'&&u.s.auto){u.s.auto=false;u.saveS()}return {open:u.st.open.length}}
// ---------- commands (only ever called with ctx.from.id === the caller) ----------
const SECRET=t=>/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(t)||/^\[?\s*\d+(\s*,\s*\d+){30,}/.test(t)||t.trim().split(/\s+/).length>=12;
const ADDR=t=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t);
const awaiting=new Map();
async function handle(ctx,cmd,arg){const id=ctx.from.id,u=get(id),s=u.s,dm=ctx.chat?.type==='private';const R=(t,o={})=>ctx.reply(t,{parse_mode:'HTML',...o});
 const paper=isPaper(u);const mode=paper?'🧪 paper':'🔴 LIVE';
 switch(cmd){
 case 'start':case 'help':return R(HELP);
 case 'wallet':{const pub=u.vault.pub();let b='?';try{b=(await balanceOf(pub)).toFixed(4)}catch{}return R(`👛 <b>Your burner</b>\n<code>${pub}</code>\nBalance: ${b} SOL\nMode: ${mode}${s.paper===false&&!liveOk(id)?' (you chose live, waiting for the owner to allow it)':''}\nAuto: ${s.auto?'ON':'OFF'}`)}
 case 'burners':{const l=u.vault.list();const lines=[];for(const w of l){let b='?';try{b=(await balanceOf(w.pub)).toFixed(4)}catch{}lines.push(`${w.active?'⭐':'•'} ${w.i}: <code>${w.pub}</code> ${b} SOL`)}return R('👛 <b>Your burners</b>\n'+lines.join('\n'))}
 case 'newburner':{if(u.st.open.some(p=>!p.paper))return R('Sell your open live trades first with /sellall.');const old=u.vault.load();const i=u.vault.create('rotated');let moved='';
  if(!paper){try{const bal=await rpcQ(()=>C().getBalance(old.publicKey));const lam=bal-10000;if(lam>0){await sendAndConfirmTransaction(C(),new Transaction().add(SystemProgram.transfer({fromPubkey:old.publicKey,toPubkey:u.vault.keypair(i).publicKey,lamports:lam})),[old]);moved=`\nMoved ${(lam/LAMPORTS_PER_SOL).toFixed(4)} SOL.`}}catch(e){moved='\n⚠️ SOL move failed: '+e.message}}
  u.vault.setActive(i);await R(`✅ New burner ${i} is now your trading wallet:\n<code>${u.vault.pub()}</code>${moved}`);if(dm)return exportKeys(ctx,u,String(i));return R('Back it up with /export CONFIRM in a private chat with me.')}
 case 'export':if(!dm)return R('🔒 /export only works in a private chat with me.');if(!/CONFIRM/.test(arg))return R('This shows YOUR private key. Send /export CONFIRM (or /export all CONFIRM). Never share it.');return exportKeys(ctx,u,arg.replace('CONFIRM','').trim());
 case 'profitaddress':awaiting.set(id,'profitAddress');return R(`Current: ${s.profitAddress?'<code>'+s.profitAddress+'</code>':'none'}\nPaste your wallet's PUBLIC address now (/cancel to stop).`);
 case 'cancel':awaiting.delete(id);return R('Cancelled.');
 case 'profit':{const t=stats(id);return R(`💸 <b>Your profit</b>\n${summary(id)}\nProfit address: ${s.profitAddress?'<code>'+s.profitAddress+'</code>':'not set (/profitaddress)'}\nSend SOL out with /withdraw ADDRESS AMOUNT|all${paper?'\n(paper mode: nothing real moves)':''}`)}
 case 'withdraw':{const [to,amt]=arg.split(/\s+/);const dest=to||s.profitAddress;if(!dest||!ADDR(dest)||!(amt==='all'||+amt>0))return R('Usage: /withdraw ADDRESS 0.1  or  /withdraw ADDRESS all');
  if(paper)return R(`🧪 Paper mode: would send ${amt} SOL to <code>${dest}</code>. Nothing moved.`);const kp=u.vault.load();const bal=await rpcQ(()=>C().getBalance(kp.publicKey));const lam=amt==='all'?bal-10000:Math.round(+amt*LAMPORTS_PER_SOL);
  if(!(lam>0)||lam>bal-5000)return R('Not enough balance (keep a little for the fee).');try{const sig=await sendAndConfirmTransaction(C(),new Transaction().add(SystemProgram.transfer({fromPubkey:kp.publicKey,toPubkey:new PublicKey(dest),lamports:lam})),[kp]);balCache.delete(kp.publicKey.toBase58());return R(`✅ Sent ${(lam/LAMPORTS_PER_SOL).toFixed(4)} SOL\ntx: <code>${sig}</code>`)}catch(e){return R('❌ '+e.message)}}
 case 'set':{const [k,v]=arg.split(/\s+/);const key=SETTABLE.find(q=>q.toLowerCase()===String(k||'').toLowerCase());if(key==='profitAddress'||String(k).toLowerCase()==='profitaddress'){if(v&&ADDR(v)){s.profitAddress=v;u.saveS();return R('✅ Profit address saved')}awaiting.set(id,'profitAddress');return R('Paste your PUBLIC address now.')}
  if(!key)return R('Usage: /set NAME VALUE\nYou can change: '+SETTABLE.join(', '));const cur=s[key];let nv=typeof cur==='boolean'?/^(true|on|1|yes)$/i.test(v):typeof cur==='number'?+v:v;if(typeof cur==='number'&&!Number.isFinite(nv))return R('Needs a number.');
  if(key==='maxOpen')nv=Math.max(1,Math.min(3,nv));if(/^buyUsd/.test(key))nv=Math.max(1,Math.min(1000,nv));s[key]=nv;u.saveS();return R(`✅ ${key} = ${nv}`)}
 case 'settings':return R('⚙️ <b>Your settings</b>\n'+['auto','paper','buyUsdMin','buyUsdMax','profitAddress',...SETTABLE.filter(k=>!/^buyUsd/.test(k))].map(k=>`${k}: ${s[k]}`).join('\n')+`\nLive allowed by owner: ${liveOk(id)?'yes':'no'}`);
 case 'reset':{const keep={profitAddress:s.profitAddress,paper:s.paper,auto:s.auto};u.s=Object.assign(s,USER_DEFAULTS(),keep);u.saveS();return R('✅ Your settings are back to the defaults.')}
 case 'auto':{if(/on/i.test(arg)){s.auto=true}else if(/off/i.test(arg)){s.auto=false}else return R(`Auto is ${s.auto?'ON':'OFF'}. /auto on or /auto off`);u.saveS();return R(`Auto-buy ${s.auto?'ON':'OFF'} (${mode})`)}
 case 'paper':{if(/^on/i.test(arg)){s.paper=true;u.saveS();return R('🧪 Paper mode ON for you.')}
  if(/^off/i.test(arg)){if(!/CONFIRM/.test(arg))return R('⚠️ Live uses REAL SOL from your burner. Send /paper off CONFIRM if you are sure.');s.paper=false;u.saveS();
   if(!liveOk(id)){send(OWNER,`🔴 User ${id} asked for LIVE trading. Allow it in /users (Live button).`);return R('Saved. You stay on paper until the owner allows live for you.')}return R('🔴 LIVE mode ON for you. /paper on to go back.')}return R(`You are in ${mode}. /paper on · /paper off CONFIRM`)}
 case 'positions':{const o=u.st.open;return R(o.length?'📂 <b>Your open trades</b>\n'+o.map(p=>`• ${p.symbol} ${p.tier} ${x(p.lastCh??0)} · peak ${x(p.peak||0)} · ${((Date.now()-p.opened)/6e4).toFixed(0)}m${p.paper?' [paper]':''}`).join('\n'):'No open trades.')}
 case 'sellall':{const o=[...u.st.open];if(!o.length)return R('Nothing open.');const r=[];for(const p of o){try{const c=await sellFor(id,p,'Manual /sellall');r.push(`${p.symbol} ${x(c.pnlPct)}`)}catch(e){r.push(`${p.symbol} ❌ ${e.message}`)}}return R('Sold:\n'+r.join('\n'))}
 case 'pnl':case 'gpnl':case 'gnpl':case 'stats':{const t=stats(id),c=u.st.closed;const best=[...c].sort((a,b)=>b.pnlPct-a.pnlPct)[0];const by={};for(const q of c){(by[q.tier]??=[]).push(q)}
  return R(`📊 <b>Your results</b> (${mode})\n${t.n} closed trades · ${t.wins} wins (${t.winRate.toFixed(0)}%)\nTotal: ${x(t.pnlPct)} · ${t.pnl>=0?'+':''}${t.pnl.toFixed(4)} SOL\nOpen: ${t.open}\n`+Object.entries(by).map(([k,a])=>{const i=a.reduce((s,q)=>s+q.solIn,0),o=a.reduce((s,q)=>s+q.solOut,0);return `${k}: ${a.length} trades, ${x(i?(o/i-1)*100:0)}`}).join('\n')+(best?`\nBest: ${best.symbol} ${x(best.pnlPct)}`:''))}
 }}
async function exportKeys(ctx,u,which){const l=u.vault.list();const idx=which==='all'?l.map(w=>w.i):[which===''?u.vault.activeIndex():+which];if(idx.some(i=>!(i>=0&&i<l.length)))return ctx.reply('No burner with that number. See /burners.');
 const m=await ctx.reply('🔑 <b>Your keys</b> (deletes in 60s)\n'+idx.map(i=>`${i}: <code>${l[i].pub}</code>\nkey: <tg-spoiler>${u.vault.exportSecret(i)}</tg-spoiler>`).join('\n\n'),{parse_mode:'HTML'});
 setTimeout(()=>ctx.api.deleteMessage(ctx.chat.id,m.message_id).catch(()=>{}),60000)}
async function onText(ctx){const id=ctx.from.id,w=awaiting.get(id);if(!w)return false;const t=(ctx.message?.text||'').trim();if(t.startsWith('/'))return false;awaiting.delete(id);
 if(SECRET(t)){await ctx.deleteMessage().catch(()=>{});await ctx.reply('⛔ That looks like a private key or seed phrase. I deleted it and did NOT save it. Send your PUBLIC address.');return true}
 if(!ADDR(t)){await ctx.reply('That is not a Solana address. Try /profitaddress again.');return true}get(id).s.profitAddress=t;get(id).saveS();await ctx.reply('✅ Profit address saved: '+t);return true}
const CMDS=['start','help','wallet','burners','newburner','export','profitaddress','cancel','profit','withdraw','set','settings','reset','auto','paper','positions','sellall','pnl','gpnl','gnpl','stats'];
const HELP=`🤝 <b>Friend trading account</b>
You have your OWN burner wallet, settings and results. Nobody else, not even the owner, can see your keys or trade your wallet.
<b>Start</b>: /auto on (it trades by itself, paper by default) · /auto off
/positions · /pnl · /gpnl · /stats · /sellall
<b>Wallet</b>: /wallet · /burners · /newburner · /export CONFIRM (private chat only, deletes after 60s)
<b>Profit</b>: /profitaddress (paste your PUBLIC address) · /profit · /withdraw ADDRESS AMOUNT|all
<b>Settings</b>: /settings · /set buyUsdMin 5 · /set buyUsdMax 10 · /reset
<b>Live</b>: /paper off CONFIRM, and the owner must also allow live for you. /paper on goes back.
Trades are $5–$10, max 3 open, "Let it run" exits. Results show as % and x, e.g. +150% (2.5x).
⚠️ Use only money you can afford to lose. Back up your key in Phantom.`;
function start(b){bot=b;setInterval(()=>monitor().catch(e=>console.log('[friends] monitor',e.message)),(+process.env.FRIENDS_MONITOR_SEC||10)*1000).unref?.()}
module.exports={start,get,handle,onText,dispatch,monitor,buyFor,sellFor,stats,summary,anyAuto,tradeUsers,onRoleChange,CMDS,HELP,rulesFor,isPaper,_setDeps:d=>deps=d,_setBot:b=>bot=b,_cache:cache};
