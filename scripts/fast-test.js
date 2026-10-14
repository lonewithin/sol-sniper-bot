// Paper fast-path latency test: live PumpPortal events → instant checks → build+sign (NOT sent) → post-check.
process.env.PAPER='true';const C=require('../src/config');Object.assign(C.settings,{paper:true,mode:'fast',fastNewLaunches:true,maxOpen:99,maxDailySol:99});
const Scanner=require('../src/scanner');const F=require('../src/fast');const T=require('../src/trader');const {score}=require('../src/safety');require('../src/send').startBlockhashCache();
const N=Number(process.argv[2]||6);let n=0;const lats=[];T.setNotify(()=>{});
const sc=new Scanner({newTokens:true});sc.on('log',m=>console.log('[scan]',m));
sc.on('raw',async(ev,t)=>{if(n>=N)return;n++;const ic=await F.instant(ev);
 if(!ic.ok){console.log(`skip ${ev.symbol} ${ic.reasons.join(' ')}`);n--;return}
 try{const p=await T.fastBuy(ev,0.02,{tDetect:t,reasons:ic.reasons});lats.push(p.lat);console.log(`⚡ ${ev.txType} ${ev.symbol} detect→build-start ${p.lat.detectToBuild}ms · build ${p.lat.buildMs}ms · detect→signed ${p.lat.detectToSigned}ms`);
  const d=await score(ev.mint,ev).catch(()=>null);console.log(`   post-check safety ${d?.score} → ${!d||d.score<C.settings.minScore?'EXIT':'hold'}`);}catch(e){console.log('err',e.message)}
 if(lats.length>=N){const a=lats.map(x=>x.detectToSigned).sort((a,b)=>a-b);console.log(`\nN=${a.length} detect→signed ms: min ${a[0]} median ${a[a.length>>1]} max ${a.at(-1)}`);process.exit(0)}});
sc.ws();setTimeout(()=>process.exit(0),150000);
