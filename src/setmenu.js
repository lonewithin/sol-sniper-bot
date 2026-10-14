// Interactive /set menu + /reset.
const {InlineKeyboard}=require('grammy');const C=require('./config');const S=C.settings,D=C.defaults;
const B='bool';
const META={
 Buying:{buySol:['SOL spent per snipe buy',[0.01,0.02,0.05,0.1]],maxPerTrade:['Hard limit for any single buy',[0.05,0.1,0.2]],maxDailySol:['Most SOL snipes can spend per day',[0.1,0.2,0.5,1]],maxOpen:['Most snipe coins held at once',[1,3,5,10]],slippageBps:['Allowed price slip (100 = 1%)',[500,1000,1500,2500]],priorityLamports:['Fee to get in faster (lamports)',[50000,100000,500000,1000000]],sizeByPotential:['Buy more on stronger coins (still capped)',B]},
 Selling:{potScalp:['Potential needed for SCALP tier',[25,35,45]],potSwing:['Potential needed for SWING tier',[45,55,65]],potRunner:['Potential needed for RUNNER tier',[65,75,85]],scalpTp:['SCALP take profit %',[15,20,25]],scalpSl:['SCALP stop loss %',[10,12,15]],scalpMaxMin:['SCALP max hold (min)',[3,4,5]],swingTp:['SWING take profit %',[30,50,80]],swingSl:['SWING stop loss %',[15,20,25]],swingTrail:['SWING trailing stop %',[10,15,20]],swingMaxMin:['SWING max hold (min)',[10,15,20]],runnerPartialAt:['RUNNER sells half at this gain %',[50,100]],runnerSl:['RUNNER stop loss %',[20,25,30]],runnerTrail:['RUNNER trailing %',[15,20,30]],runnerMaxMin:['RUNNER max hold (min)',[20,30,60]],momentumExit:['Sell early if potential drops below',[10,20,30]],trailingPct:['Extra trailing stop for all (0=off)',[0,10,20]]},
 Safety:{minScore:['Lowest safety score to buy',[50,60,70,80]],minLiqUsd:['Lowest liquidity $ to buy',[2000,5000,10000,25000]]},
 Snipe:{snipe:['Snipe strategy on/off',B],mode:['safe = full checks · fast = instant buy, check after',['safe','fast']],fastMigrations:['Fast-buy coins moving to PumpSwap',B],fastNewLaunches:['Fast-buy brand-new launches (very risky)',B],fastMaxDevPct:['Skip if dev bought more than %',[5,10,20]],maxCreatorLaunches:['Skip creators launching more than',[1,2,3]],fastPostMinScore:['Fast buys sell if after-check below',[30,40,50]],fastPostCheckSec:['Seconds before the after-check',[5,8,15]],fastMaxMin:['Fast buy max hold (min)',[3,5,10]],jitoTipLamports:['Jito tip (lamports, 0=off)',[0,100000,500000]]},
 'Big Play':{bigplay:['Big Play strategy on/off',B],bigBuySol:['SOL per Big Play buy',[0.03,0.05,0.1]],bigMaxOpen:['Most Big Play coins at once',[1,2,3,5]],bigMaxDailySol:['Big Play daily budget SOL',[0.1,0.15,0.3]],bigMinMcap:['Min market cap $',[50000,100000,250000]],bigMaxMcap:['Max market cap $',[5000000,20000000,50000000]],bigMinLiq:['Min liquidity $',[25000,50000,100000]],bigMinAgeH:['Min age (hours)',[0.5,1,3]],bigMinRatio:['Min 1h buys÷sells',[1.1,1.2,1.5]],bigMinScore:['Min safety score',[50,60,70]],bigPartialAt:['Sell half at gain % (100=2x)',[50,100,200]],bigTrail:['Trailing stop % on the rest',[15,25,35]],bigSl:['Stop loss %',[20,30,40]],bigMaxHoldH:['Max hold (hours)',[6,12,24,48]],bigScanMin:['Scan every N minutes',[3,5,10]],bigPollSec:['Check positions every N sec',[30,45,60]]},
 'Second chance':{secondChance:['Re-enter skipped coins that pump',B],secondChanceMinScore:['Lowest safety allowed',[40,45,55]],secondChanceSize:['× normal buy size',[0.3,0.5,1]],secondChanceSl:['Stop loss %',[10,15,20]],secondChanceGainPct:['Must have run this % since skip',[30,50,100]],secondChanceMinRatio:['Min 5m buys÷sells',[1.2,1.3,1.6]]},
 Profit:{autoSweep:['Auto send profit nightly 23:55 WAT',B],capital:['Working capital SOL (never swept)',[0.1,0.3,0.5,1]],profitAddress:['Wallet that receives profit','text'],profitReserveSol:['SOL kept for fees',[0.002,0.003,0.01]]},
 Wallet:{rotateEveryTrades:['New burner every N trades (0=off)',[0,10,25,50]],rotateDaily:['New burner every day',B],sweepTokens:['Also move tokens when rotating',B]},
 Alerts:{alerts:['Which coins to alert on',['trades','score','all','off']],missedAlerts:['Alert when skipped coins pump',B],missedAlertPct:['First missed alert at gain %',[50,100,200]],missedMinMcap:['Missed pump only counts if mcap ≥ $',[5000,10000,25000]],missedMinLiq:['…and liquidity ≥ $',[2000,5000,10000]],missedMinVol1h:['…and 1h volume ≥ $ (or 5m ≥ missedMinVol5m)',[1000,2000,5000]],missedMinVol5m:['5m volume floor $',[100,200,500]],missedBaseLiq:['Ignore skip prices from pools under $ liq',[500,1000,2000]],autotune:['Auto-apply tuned thresholds',B]}};
const catOf=k=>Object.keys(META).find(c=>k in META[c]);
const fmt=v=>typeof v==='boolean'?(v?'ON ✅':'OFF ⛔'):String(v);
const short=v=>{v=fmt(v);return v.length>10?v.slice(0,4)+'…'+v.slice(-4):v};
const CATS=Object.keys(META);
function setValue(k,raw){raw=String(raw).trim();const t=META[catOf(k)]?.[k]?.[1];
 if(t===B||typeof D[k]==='boolean'){const on=/^(on|true|1|yes)$/i.test(raw),off=/^(off|false|0|no)$/i.test(raw);if(!on&&!off)return 'Send on or off';S[k]=on;}
 else if(k==='profitAddress'){if(!require('./sweep').validAddr(raw))return 'That is not a valid Solana wallet address';S[k]=raw;}
 else if(Array.isArray(t)&&typeof t[0]==='string'){if(!t.includes(raw))return 'Choose one of: '+t.join(', ');S[k]=raw;}
 else{const n=Number(raw);if(!isFinite(n)||n<0)return 'Send a number ≥ 0';if(k==='buySol'&&n>S.maxPerTrade)return `Must be ≤ maxPerTrade (${S.maxPerTrade})`;S[k]=n;}
 C.save();return null;}
const home=()=>{const k=new InlineKeyboard();CATS.forEach((c,i)=>{k.text(c,'sm:c:'+i);if(i%3===2)k.row()});return k.row().text('♻️ Reset all to defaults','sm:resetask');};
const cat=i=>{const c=CATS[i];const k=new InlineKeyboard();Object.keys(META[c]).forEach((key,j)=>{const t=META[c][key][1];
 if(t===B)k.text(`${S[key]?'✅':'⛔'} ${key}`,'sm:t:'+key);else k.text(`${key}: ${short(S[key])}`,'sm:k:'+key);if(j%2)k.row()});return k.row().text('⬅️ Back','sm:home');};
const one=key=>{const [desc,t]=META[catOf(key)][key];const k=new InlineKeyboard();
 if(t===B)k.text(S[key]?'Turn OFF':'Turn ON','sm:t1:'+key);else if(Array.isArray(t))t.forEach(v=>k.text((String(S[key])===String(v)?'• ':'')+v,`sm:v:${key}:${v}`));
 k.row();if(t!==B)k.text('⌨️ Type a value','sm:type:'+key);k.text('↩️ Reset to default','sm:def:'+key).row().text('⬅️ Back','sm:c:'+CATS.indexOf(catOf(key)));
 return [`⚙️ <b>${key}</b>\n${desc}\n\nNow: <b>${fmt(S[key])}</b>\nDefault: ${fmt(D[key])}`,k];};
const KEEP=['auto','paper','capital','profitAddress','lastSweepDay'];
function resetAll(){for(const k of Object.keys(D))if(!KEEP.includes(k))S[k]=D[k];S.auto=true;S.paper=true;C.save();}
const waiting=new Map();
function install(bot){
 const ed=(c,t,k)=>c.editMessageText(t,{parse_mode:'HTML',reply_markup:k}).catch(()=>{});
 bot.callbackQuery('sm:home',c=>{c.answerCallbackQuery();ed(c,'⚙️ <b>Settings</b>: pick a category',home())});
 bot.callbackQuery(/^sm:c:(\d+)$/,c=>{c.answerCallbackQuery();const i=+c.match[1];ed(c,`⚙️ <b>${CATS[i]}</b>: tap a setting (toggles flip instantly)`,cat(i))});
 bot.callbackQuery(/^sm:k:(\w+)$/,c=>{c.answerCallbackQuery();const [t,k]=one(c.match[1]);ed(c,t,k)});
 bot.callbackQuery(/^sm:t:(\w+)$/,c=>{const k=c.match[1];S[k]=!S[k];C.save();c.answerCallbackQuery(`${k} ${S[k]?'ON':'OFF'}`);c.editMessageReplyMarkup({reply_markup:cat(CATS.indexOf(catOf(k)))}).catch(()=>{})});
 bot.callbackQuery(/^sm:t1:(\w+)$/,c=>{const k=c.match[1];S[k]=!S[k];C.save();c.answerCallbackQuery(`${k} ${S[k]?'ON':'OFF'}`);const [t,kb]=one(k);ed(c,t,kb)});
 bot.callbackQuery(/^sm:v:(\w+):(.+)$/,c=>{const e=setValue(c.match[1],c.match[2]);c.answerCallbackQuery(e||`${c.match[1]} = ${c.match[2]}`);if(!e){const [t,kb]=one(c.match[1]);ed(c,t,kb)}});
 bot.callbackQuery(/^sm:def:(\w+)$/,c=>{const k=c.match[1];S[k]=D[k];C.save();c.answerCallbackQuery('Reset to '+fmt(D[k]));const [t,kb]=one(k);ed(c,t,kb)});
 bot.callbackQuery(/^sm:type:(\w+)$/,c=>{c.answerCallbackQuery();waiting.set(c.chat.id,c.match[1]);c.reply(`⌨️ Send the new value for <b>${c.match[1]}</b> (or /cancel)`,{parse_mode:'HTML'})});
 bot.callbackQuery('sm:resetask',c=>{c.answerCallbackQuery();askReset(c)});
 bot.callbackQuery('sm:resetgo',c=>{resetAll();c.answerCallbackQuery('Done');ed(c,'♻️ Settings reset to defaults.\nKept: wallets, vault, capital, profit address, trade history. Auto + paper ON.',new InlineKeyboard().text('⚙️ Open settings','sm:home'))});
 bot.callbackQuery('sm:resetno',c=>{c.answerCallbackQuery();ed(c,'Reset cancelled.',undefined)});
 bot.command('cancel',c=>{waiting.delete(c.chat.id);c.reply('Cancelled')});
 bot.command('reset',c=>askReset(c));
 bot.on('message:text',(c,next)=>{const k=waiting.get(c.chat.id);if(!k||c.message.text.startsWith('/'))return next();
  const e=setValue(k,c.message.text);if(e)return c.reply('❌ '+e+'. Try again or /cancel');waiting.delete(c.chat.id);const [t,kb]=one(k);c.reply('✅ Saved.\n'+t,{parse_mode:'HTML',reply_markup:kb});});}
const askReset=c=>c.reply('♻️ Reset ALL settings to defaults?\nKeeps: wallets/vault, capital, profit address, trade history. Auto + paper stay ON.',{reply_markup:new InlineKeyboard().text('✅ Yes, reset','sm:resetgo').text('❌ Cancel','sm:resetno')});
const open=c=>c.reply('⚙️ <b>Settings</b>: pick a category',{parse_mode:'HTML',reply_markup:home()});
module.exports={install,open,META,resetAll,setValue};
