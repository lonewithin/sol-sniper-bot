require('dotenv').config();
const fs=require('fs'),path=require('path');
const DATA=path.join(__dirname,'..','data');fs.mkdirSync(DATA,{recursive:true,mode:0o700});
const SF=path.join(DATA,'settings.json');
const defaults={auto:false,paper:process.env.PAPER!=='false',minScore:70,buySol:0.02,maxPerTrade:0.1,maxDailySol:0.2,slippageBps:1500,priorityLamports:100000,tpPct:50,slPct:25,trailingPct:0,maxOpen:3,minLiqUsd:5000,alerts:true,potScalp:35,potSwing:55,potRunner:75,scalpTp:20,scalpSl:12,scalpMaxMin:4,swingTp:50,swingSl:20,swingTrail:15,swingMaxMin:15,runnerPartialAt:50,runnerSl:25,runnerTrail:20,runnerMaxMin:30,momentumExit:20,sizeByPotential:true,autotune:false,mode:'safe',fastMaxDevPct:10,maxCreatorLaunches:1,fastCheckMint:false,fastMaxMin:5,fastNewLaunches:false,fastMigrations:true,jitoTipLamports:0,rotateEveryTrades:0,rotateDaily:false,sweepTokens:false,fastPostCheckSec:8,fastPostMinScore:40,capital:0,profitAddress:'3mvvn7sLrjo8VGNcYUsGA9HnyA4rVg3LGqZawvWLx1MR',autoSweep:true,profitReserveSol:0.003,lastSweepDay:''};
let s={...defaults};try{s={...defaults,...JSON.parse(fs.readFileSync(SF))}}catch{}
const save=()=>fs.writeFileSync(SF,JSON.stringify(s,null,1));
module.exports={DATA,settings:s,save,RPC:process.env.RPC_URL||'https://api.mainnet-beta.solana.com',OWNER:Number(process.env.OWNER_ID||0),SOL:'So11111111111111111111111111111111111111112'};
