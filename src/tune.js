// Grid-search thresholds on observations (simulated with tier rules) for max expectancy. Also stats by tier/bucket.
const {settings:S}=require('./config');const {rules}=require('./potential');const {simulate}=require('./sim');const L=require('./log');
const tierOf=(o,c)=>o.safety<c.minScore?'SKIP':o.pot>=c.potRunner?'RUNNER':o.pot>=c.potSwing?'SWING':o.pot>=c.potScalp?'SCALP':'SKIP';
function evaluate(obs,c){const res=[];for(const o of obs){const t=tierOf(o,c);if(t==='SKIP')continue;const v=simulate(o,rules(t));if(v!=null)res.push({t,v})}
 const n=res.length,avg=n?res.reduce((a,x)=>a+x.v,0)/n:0,wr=n?res.filter(x=>x.v>0).length/n*100:0;return {n,avg,wr,res};}
function tune(minN=20){const obs=L.observations().filter(o=>o.out&&o.out.m1!=null);const base={...S};const cur=evaluate(obs,base);let best={c:base,...cur};
 for(const minScore of [50,60,70,80])for(const potScalp of [25,35,45])for(const potSwing of [45,55,65])for(const potRunner of [65,75,85]){
  if(!(potScalp<potSwing&&potSwing<potRunner))continue;const c={...base,minScore,potScalp,potSwing,potRunner};const e=evaluate(obs,c);
  if(e.n>=minN&&e.avg>best.avg)best={c,...e};}
 return {nObs:obs.length,current:{n:cur.n,avg:cur.avg,wr:cur.wr},best:{n:best.n,avg:best.avg,wr:best.wr,minScore:best.c.minScore,potScalp:best.c.potScalp,potSwing:best.c.potSwing,potRunner:best.c.potRunner}};}
function stats(){const t=L.trades();const g={};const add=(k,x)=>{(g[k]??={n:0,w:0,sum:0});g[k].n++;g[k].sum+=x.pnlPct;if(x.pnl>0)g[k].w++};
 for(const x of t){add('tier '+x.tier,x);add('safety '+Math.floor((x.safety||0)/10)*10+'s',x);add('pot '+Math.floor((x.pot||0)/10)*10+'s',x)}
 return Object.entries(g).sort().map(([k,v])=>`${k}: ${v.n} trades · win ${(v.w/v.n*100).toFixed(0)}% · avg ${(v.sum/v.n).toFixed(1)}%`);}
module.exports={tune,stats,evaluate,tierOf};
