// Show every result as percent AND multiple, e.g. "+150.0% (2.50x)" / "-30.0% (0.70x)".
const px=(pct,d=1)=>{pct=+pct||0;return `${pct>=0?'+':''}${pct.toFixed(d)}% (${Math.max(0,1+pct/100).toFixed(2)}x)`};
module.exports={px};
