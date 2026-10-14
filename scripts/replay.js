// Offline replay: run current tier rules over data/observations.jsonl
const {settings:S}=require('../src/config');const L=require('../src/log');const {evaluate,tierOf}=require('../src/tune');
const obs=L.observations();const e=evaluate(obs,S);const by={};for(const x of e.res){(by[x.t]??=[]).push(x.v)}
console.log(`Replayed ${obs.length} observations → ${e.n} simulated trades, win ${e.wr.toFixed(0)}%, avg ${e.avg.toFixed(1)}%/trade`);
for(const [t,v] of Object.entries(by))console.log(` ${t}: ${v.length} · avg ${(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1)}%`);
for(const o of obs.slice(-10))console.log(` ${o.symbol} safety ${o.safety} pot ${o.pot} → ${tierOf(o,S)} path ${JSON.stringify(o.out)}`);
