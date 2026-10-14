// Shadow A/B for Big Play sizing: real paper trades use fixed bigBuySol; a shadow
// records what %-of-balance sizing would have made with the same entry/exit (pnlPct already includes paper costs).
// Read-only for settings. File: data/bigplay_ab.json (readable by the morning report).
const fs=require('fs'),path=require('path');const F=path.join(__dirname,'..','data','bigplay_ab.json');
const PCT=10,START=1,MAXSOL=1,MINSOL=0.01;
const blank=()=>({pct:PCT,startBal:START,maxSol:MAXSOL,shadowBal:START,trades:[],updated:null});
function load(){try{return {...blank(),...JSON.parse(fs.readFileSync(F,'utf8'))}}catch{return blank()}}
function record(c){if(!c||c.tier!=='BIG')return;const d=load();if(d.trades.some(t=>t.mint===c.mint&&t.opened===c.opened))return;
 const pct=(c.pnlPct??((c.solOut/c.solIn-1)*100));const size=+Math.max(MINSOL,Math.min(MAXSOL,d.shadowBal*d.pct/100)).toFixed(4);
 const sp=+(size*pct/100).toFixed(6);d.shadowBal=+(d.shadowBal+sp).toFixed(6);
 d.trades.push({mint:c.mint,symbol:c.symbol,opened:c.opened,closed:c.closed,pnlPct:+pct.toFixed(2),fixed:{solIn:c.solIn,pnl:+c.pnl.toFixed(6)},shadow:{solIn:size,pnl:sp,balAfter:d.shadowBal}});
 d.updated=new Date().toISOString();const tmp=F+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d,null,1));fs.renameSync(tmp,F);}
function summary(){const d=load();const agg=k=>{const n=d.trades.length,w=d.trades.filter(t=>t[k].pnl>0).length,i=d.trades.reduce((a,t)=>a+t[k].solIn,0),p=d.trades.reduce((a,t)=>a+t[k].pnl,0);return {n,w,wr:n?w/n*100:0,in:i,pnl:p,roi:i?p/i*100:0}};
 return {fixed:agg('fixed'),shadow:agg('shadow'),pct:d.pct,shadowBal:d.shadowBal,startBal:d.startBal};}
module.exports={record,summary,load,F};
