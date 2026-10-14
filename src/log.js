const fs=require('fs'),path=require('path');const {DATA}=require('./config');const j=require('./http');
const TF=path.join(DATA,'trades.jsonl'),OF=path.join(DATA,'observations.jsonl');
const app=(f,o)=>fs.appendFileSync(f,JSON.stringify(o)+'\n');
const read=f=>{try{return fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l))}catch{return[]}};
// Observation: features at scan + price at +1,+5,+15,+30 min (OBS_SCALE env shrinks for tests)
function observe(o){const scale=Number(process.env.OBS_SCALE||1),t0=Date.now(),cps=[1,5,15,30];o.t=t0;o.out={};let done=0;
 const price=async()=>{try{const a=await j('https://api.dexscreener.com/tokens/v1/solana/'+o.mint);const p=a.sort((x,y)=>(y.liquidity?.usd||0)-(x.liquidity?.usd||0))[0];return p?+p.priceUsd:null}catch{return null}};
 for(const m of cps)setTimeout(async()=>{const p=await price();o.out['m'+m]=p&&o.p0?+((p/o.p0-1)*100).toFixed(1):null;if(++done===cps.length)app(OF,o)},m*60000*scale).unref?.();}
module.exports={trade:o=>app(TF,o),observe,trades:()=>read(TF),observations:()=>read(OF),TF,OF};
