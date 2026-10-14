// Daily profit sweep: balance - capital - reserve -> profitAddress. Never touches token positions (SOL only).
const {settings:S,save}=require('./config');const W=require('./wallet');const T=require('./trader');
const lagos=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).map(x=>[x.type,x.value]));return {day:`${p.year}-${p.month}-${p.day}`,hm:`${p.hour}:${p.minute}`}};
async function plan(){const bal=await T.balance();const amt=+(bal-S.capital-S.profitReserveSol).toFixed(6);return {bal,amt:amt>0?amt:0};}
async function run(notify,why='daily'){const {bal,amt}=await plan();
 const head=`💸 Profit sweep (${why})\nBalance ${bal.toFixed(4)} · capital ${S.capital} · reserve ${S.profitReserveSol}`;
 if(!(S.capital>0))return notify(`${head}\n⚠️ Skipped: set working capital first with /set capital <SOL>`);
 if(amt<0.001)return notify(`${head}\nNo profit to sweep.`);
 if(S.paper)return notify(`${head}\n[paper] Would send ${amt} SOL → <code>${S.profitAddress}</code>`);
 const sig=await T.withdraw(S.profitAddress,amt);notify(`${head}\n✅ Sent ${amt} SOL → <code>${S.profitAddress}</code>\nhttps://solscan.io/tx/${sig}`);return sig;}
function schedule(notify){setInterval(()=>{if(!S.profitSweep)return;const t=lagos();if(t.hm==='23:55'&&S.lastSweepDay!==t.day){S.lastSweepDay=t.day;save();run(notify).catch(e=>notify('❌ Sweep failed: '+e.message))}},20000);}
module.exports={run,plan,schedule,lagos};
