const {tune}=require('../src/tune');const r=tune(Number(process.argv[2]||20));
console.log(`Observations with outcomes: ${r.nObs}`);console.log('Current thresholds:',r.current);console.log('Suggested:',r.best);
console.log(r.nObs<50?'⚠️ Too few observations for reliable tuning (want 100+). Not applied.':'Apply with /set (or /set autotune on).');
const m=require('../src/tune').missedReport();console.log(`\nMissed-pump data (skipped coins watched up to 6h): ${m.n}`);for(const [k,v] of Object.entries(m.byWhy))console.log(` ${k}: ${v.n} skipped, ${v.pumped} went 2x+ (${(v.pumped/v.n*100).toFixed(0)}%) → ${v.pumped/v.n>0.2?'consider loosening':'filter looks fine'}`);
