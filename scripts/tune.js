const {tune}=require('../src/tune');const r=tune(Number(process.argv[2]||20));
console.log(`Observations with outcomes: ${r.nObs}`);console.log('Current thresholds:',r.current);console.log('Suggested:',r.best);
console.log(r.nObs<50?'⚠️ Too few observations for reliable tuning (want 100+). Not applied.':'Apply with /set (or /set autotune on).');
