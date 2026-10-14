// No Telegram needed: scans live sources for N tokens, prints safety scores; then a paper buy/monitor test.
const Scanner=require('../src/scanner');const {score}=require('../src/safety');
const N=Number(process.argv[2]||8);const sc=new Scanner();let n=0;const seen=[];
sc.on('log',m=>console.log('[scan]',m));
sc.on('token',async t=>{if(n>=N)return;n++;try{const d=await score(t.mint,t);seen.push(d);
 console.log(`\n=== [${d.score}/100] ${d.symbol||t.symbol||'?'} (${t.src}) ${t.mint}\n liq $${(d.liqUsd||0).toFixed(0)} mcap $${(d.mcap||0).toFixed(0)} dex ${d.dex||'-'} top10 ${d.top10??'-'}% lp ${d.lpLocked??'-'}% rt ${d.roundTripLossPct??'-'}%\n `+d.reasons.join('\n '));}catch(e){console.log('err',e.message)}
 if(seen.length>=N){sc.stop();process.exit(0)}});
if(process.argv[3]!=="paper")sc.start();setTimeout(()=>{console.log('timeout');process.exit(0)},180000);
if(process.argv[3]==='paper'){(async()=>{process.env.PAPER='true';const T=require('../src/trader');const {settings}=require('../src/config');settings.paper=true;
 const p=await T.buy({mint:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',symbol:'BONK'},0.02);console.log('paper buy',p.tokens);await T.monitor(console.log);console.log('open',T.st.open.map(x=>x.last));const c=await T.sell(T.st.open[0],'test');console.log('paper sell pnl',c.pnl);process.exit(0)})()}
