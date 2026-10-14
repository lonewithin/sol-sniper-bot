// Simulate tier exit rules on an observation's checkpoint path (coarse: +1,+5,+15,+30m). Conservative: SL checked before TP at each step.
const CP=[1,5,15,30];
function simulate(o,r){if(!r)return null;let peak=0,sold=0,acc=0;
 for(const m of CP){const v=o.out?.['m'+m];if(v==null)continue;if(m>r.maxMin){break}
  peak=Math.max(peak,v);
  if(v<=-r.sl)return acc+(1-sold)*v;
  if(r.partialAt&&!sold&&v>=r.partialAt){acc+=0.5*v;sold=0.5}
  if(r.tp&&v>=r.tp)return acc+(1-sold)*r.tp;
  if(r.trail&&peak>=10&&v<=peak-r.trail*(1+peak/100))return acc+(1-sold)*v;}
 const last=CP.filter(m=>m<=r.maxMin||m===1).map(m=>o.out?.['m'+m]).filter(v=>v!=null).at(-1);
 return last==null?null:acc+(1-sold)*last;}
module.exports={simulate,CP};
