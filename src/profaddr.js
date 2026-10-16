// Ask-for-address flow for the profit wallet: /set profitAddress (no value), /profitaddress, or the Change address button.
const {InlineKeyboard}=require('grammy');const {settings:S,save,OWNER}=require('./config');
const ASK='Send your Solana wallet address (public address only, never a private key or seed phrase). /cancel to stop.';
const wait=new Map();const TTL=5*60*1000;
const looksSecret=t=>{const w=t.trim().split(/\s+/);if((w.length===12||w.length===24||w.length===18||w.length===15||w.length===21)&&w.every(x=>/^[a-z]+$/i.test(x)))return true;
 if(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(t.trim()))return true;if(/^\[\s*\d+(\s*,\s*\d+){30,}\s*\]$/.test(t.trim()))return true;return false};
function ask(c){if(c.from?.id!==OWNER)return c.reply('Owner only');wait.set(c.chat.id,Date.now());return c.reply(ASK)}
function install(bot){
 bot.command('profitaddress',ask);
 bot.callbackQuery('pf:addr',c=>{c.answerCallbackQuery();return ask(c)});
 bot.command('cancel',(c,next)=>{wait.delete(c.chat.id);return next()});
 bot.on('message:text',async(c,next)=>{const t0=wait.get(c.chat.id);if(!t0||c.from?.id!==OWNER)return next();const txt=c.message.text.trim();if(txt.startsWith('/'))return next();
  if(Date.now()-t0>TTL){wait.delete(c.chat.id);await c.reply('⌛ Address request timed out. Send /profitaddress to try again.');return}
  if(looksSecret(txt)){await c.api.deleteMessage(c.chat.id,c.message.message_id).catch(()=>{});wait.set(c.chat.id,Date.now());return c.reply('⚠️ That looks like a PRIVATE KEY or SEED PHRASE. I deleted it and did NOT save it. Never send it to anyone. If it was a real wallet, move its funds to a new wallet.\n\n'+ASK)}
  if(!require('./sweep').validAddr(txt)){wait.set(c.chat.id,Date.now());return c.reply('❌ That is not a valid Solana wallet address. Try again, or /cancel.')}
  S.profitAddress=txt;save();wait.delete(c.chat.id);return c.reply(`✅ Profit address saved:\n<code>${txt}</code>${S.paper?'\n[paper mode: nothing is sent for real]':''}`,{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('💰 Profit menu','pf:menu')})});}
module.exports={install,ask,looksSecret};
