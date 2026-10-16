// /gpnl [window]: PnL of coins bought since test_start (or within a window like 1h, 30m, 1d, 7d). Owner-only via bot middleware.
const fs=require('fs'),path=require('path');const T=require('./trader');
const UNIT={m:6e4,min:6e4,mins:6e4,minute:6e4,minutes:6e4,h:36e5,hr:36e5,hrs:36e5,hour:36e5,hours:36e5,d:864e5,day:864e5,days:864e5,w:6048e5,week:6048e5,weeks:6048e5};
function parseWin(s){s=(s||'').trim().toLowerCase();if(!s)return null;const m=s.match(/^(\d+(?:\.\d+)?)?\s*([a-z]+)$/);if(!m||!UNIT[m[2]])return undefined;const n=m[1]?+m[1]:1;return n>0?{ms:n*UNIT[m[2]],label:(m[1]||'1')+' '+m[2]}:undefined}
function testStart(){try{const t=fs.readFileSync(path.join(__dirname,'..','data','test_start.txt'),'utf8').trim();const v=isNaN(+t)?Date.parse(t):+t;return v>0?v:0}catch{return 0}}
function compute(winMs,now=Date.now()){const since=winMs?now-winMs:testStart();const bk=p=>p.tier==='MOON'?moon:p.tier==='BIG'?big:snipe;
 const z=()=>({n:0,closed:0,open:0,spent:0,ret:0,openVal:0,wins:0,losses:0});const all=z(),snipe=z(),big=z(),moon=z();
 for(const p of T.st.closed||[]){if((p.opened||0)<since)continue;for(const a of [all,bk(p)]){a.n++;a.closed++;a.spent+=p.solIn||0;a.ret+=p.solOut||0;(p.pnl||0)>0?a.wins++:a.losses++}}
 for(const p of T.st.open||[]){if((p.opened||0)<since)continue;const v=(p.last??p.solIn??0)+(p.realized||0);for(const a of [all,bk(p)]){a.n++;a.open++;a.spent+=p.solIn||0;a.openVal+=v}}
 return {since,all,snipe,big,moon}}
const S=require('./config').settings;const best=since=>Math.max(1,...(T.st.closed||[]).filter(p=>p.tier==='MOON'&&(p.opened||0)>=since).map(p=>1+(p.peak||0)/100)).toFixed(2);
const f=x=>x.toFixed(4),sg=x=>(x>=0?'+':'')+x.toFixed(4);
function line(a){const net=a.ret+a.openVal-a.spent,pct=a.spent?net/a.spent*100:0,wr=a.closed?a.wins/a.closed*100:0;
 return `Coins bought: ${a.n} (${a.closed} closed, ${a.open} open)\nSOL spent: ${f(a.spent)}\nSOL returned (closed): ${f(a.ret)}\nOpen positions now worth: ${f(a.openVal)} (unrealised)\nNet PnL: ${sg(net)} SOL (${pct>=0?'+':''}${pct.toFixed(1)}%)\nWins ${a.wins} · Losses ${a.losses} · Win rate ${wr.toFixed(1)}%`}
function report(arg,now=Date.now()){const w=parseWin(arg);if(w===undefined)return 'Usage: /gpnl [window], e.g. /gpnl, /gpnl 1h, /gpnl 30m, /gpnl 6h, /gpnl 1d, /gpnl 7d';
 const r=compute(w?.ms,now);const head=w?`📊 PnL for coins bought in the last ${w.label}`:`📊 PnL since test start${r.since?' ('+new Date(r.since).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})+' WAT)':''}`;
 if(!r.all.n)return head+'\nNo coins bought in this period.';
 return `${head}${T.st.open?.some(p=>p.paper)||T.st.closed?.some(p=>p.paper)?' [paper]':''}\n\n${line(r.all)}\n\n🎯 Regular snipe\n${line(r.snipe)}\n\n🐋 Big Play\n${line(r.big)}\n\n🌙 Moonbag${S.moon?'':' (off)'}\n${line(r.moon)}${r.moon.closed?'\nBest multiple: '+best(r.since)+'x':''}`}
function install(bot){bot.command(['gpnl','gnpl'],c=>c.reply(report(c.match)))}
module.exports={install,report,compute,parseWin};
