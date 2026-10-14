// Profit sweep: balance - capital - reserve -> profitAddress. SOL only; never touches token positions or capital.
const {settings:S,save}=require('./config');const T=require('./trader');const {PublicKey}=require('@solana/web3.js');
const lagos=(d=new Date())=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d).map(x=>[x.type,x.value]));return {day:`${p.year}-${p.month}-${p.day}`,hm:`${p.hour}:${p.minute}`}};
const validAddr=a=>{try{return PublicKey.isOnCurve(new PublicKey(a).toBytes())}catch{return false}};
const todayPnl=()=>{const d=lagos().day;const c=T.st.closed.filter(x=>lagos(new Date(x.closed)).day===d);return {n:c.length,pnl:c.reduce((a,x)=>a+x.pnl,0),paper:c.some(x=>x.paper)}};
async function plan(){const bal=await T.balance();const amt=+(bal-S.capital-S.profitReserveSol).toFixed(6);return {bal,amt:amt>0?amt:0};}
const preview=(p,why)=>`💸 Profit sweep ${why} — preview\nBalance ${p.bal.toFixed(4)} SOL · capital ${S.capital} · reserve ${S.profitReserveSol}\n→ ${p.amt} SOL to <code>${S.profitAddress}</code>${S.paper?'\n[paper: report only]':''}`;
async function run(notify,why='daily'){
 if(!validAddr(S.profitAddress))return notify('❌ Sweep blocked: invalid profitAddress');
 if(!(S.capital>0))return notify('⚠️ Sweep skipped: set working capital first with /set capital <SOL>');
 const p=await plan();await notify(preview(p,why)); // dry-run preview always sent first
 if(p.amt<0.001)return notify('No profit above capital to sweep.');
 if(S.paper)return notify(`[paper] Would send ${p.amt} SOL. Nothing sent.`);
 const q=await plan();const amt=Math.min(p.amt,q.amt); // re-check: never more than previewed, never below capital
 if(amt<0.001)return notify('Balance changed — nothing above capital now. Skipped.');
 const sig=await T.withdraw(S.profitAddress,amt);await notify(`✅ Swept ${amt} SOL → <code>${S.profitAddress}</code>\nhttps://solscan.io/tx/${sig}`);return sig;}
function schedule(notify){setInterval(()=>{const t=lagos();if(t.hm!=='23:55'||S.lastSweepDay===t.day)return;S.lastSweepDay=t.day;save(); // max once/day
 if(S.autoSweep)run(notify,'(auto 23:55 WAT)').catch(e=>notify('❌ Sweep failed: '+e.message));
 else plan().then(p=>notify(`⏰ Manual sweep mode reminder (23:55 WAT)\nAvailable profit: ${p.amt} SOL. Use /profit → Send now.`)).catch(()=>{});},20000);}
module.exports={run,plan,schedule,lagos,validAddr,todayPnl};
