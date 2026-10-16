// Users: the owner (OWNER_ID env) controls everything. Approved users get read-only commands only.
// Unknown users who message the bot trigger an owner notification with Accept/Deny. Stored in data/users.json.
const fs=require('fs'),path=require('path');const {InlineKeyboard}=require('grammy');const {OWNER,DATA}=require('./config');
const F=path.join(DATA||path.join(__dirname,'..','data'),'users.json');
let U={allowed:{},denied:{}};try{U={...U,...JSON.parse(fs.readFileSync(F,'utf8'))}}catch{}
const save=()=>{try{fs.writeFileSync(F,JSON.stringify(U,null,1))}catch(e){console.log('[users] save',e.message)}};
const READONLY=['start','help','gpnl','gnpl','pnl','stats','positions','strategy','check','c'];
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const who=f=>`${esc([f.first_name,f.last_name].filter(Boolean).join(' '))}${f.username?' @'+esc(f.username):''} (id <code>${f.id}</code>)`;
const asked=new Map();
function guard(bot){return async(ctx,next)=>{const id=ctx.from?.id;if(!id)return;if(id===OWNER)return next();
 if(U.allowed[id]){const cmd=(ctx.message?.text||'').match(/^\/(\w+)/)?.[1]?.toLowerCase();const cb=ctx.callbackQuery?.data||'';
  if(cmd&&READONLY.includes(cmd))return next();if(cb.startsWith('help:'))return next();
  if(ctx.callbackQuery)return ctx.answerCallbackQuery('Only the owner can do that').catch(()=>{});
  if(ctx.message)return ctx.reply('🔒 Only the owner can change settings, wallets or trades. You can use: '+READONLY.map(c=>'/'+c).join(' ')).catch(()=>{});return;}
 if(U.denied[id]||!ctx.message)return;if(Date.now()-(asked.get(id)||0)<6*36e5)return;asked.set(id,Date.now());
 await ctx.reply('⏳ Access request sent to the owner. You will get a message if approved.').catch(()=>{});
 await bot.api.sendMessage(OWNER,`👤 <b>New user wants access</b>\n${who(ctx.from)}\nApproved users get read-only commands only.`,{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('✅ Accept','us:ok:'+id).text('❌ Deny','us:no:'+id)}).catch(()=>{});
 U.pending=U.pending||{};U.pending[id]={name:ctx.from.first_name||'',username:ctx.from.username||'',t:Date.now()};save();}}
function add(id,info={}){U.allowed[id]={...info,t:Date.now()};delete U.denied[id];if(U.pending)delete U.pending[id];save()}
function remove(id){const had=!!U.allowed[id];delete U.allowed[id];save();return had}
function install(bot){
 bot.use(guard(bot));
 const own=c=>c.from?.id===OWNER;
 bot.callbackQuery(/^us:(ok|no):(\d+)$/,async c=>{if(!own(c))return c.answerCallbackQuery('Owner only');const id=+c.match[2];const info=U.pending?.[id]||{};
  if(c.match[1]==='ok'){add(id,info);c.answerCallbackQuery('Accepted');c.editMessageText(`✅ Accepted user ${id}`).catch(()=>{});bot.api.sendMessage(id,'✅ You now have read-only access. Tap /help.').catch(()=>{})}
  else{U.denied[id]={t:Date.now()};if(U.pending)delete U.pending[id];save();c.answerCallbackQuery('Denied');c.editMessageText(`❌ Denied user ${id}`).catch(()=>{})}});
 bot.command('users',c=>{if(!own(c))return;const a=Object.entries(U.allowed);c.reply(a.length?'👥 Approved users (read-only):\n'+a.map(([id,i])=>`• ${id}${i.username?' @'+i.username:''}${i.name?' '+i.name:''}`).join('\n')+'\n\nRemove with /removeuser ID':'No approved users yet. Add with /adduser ID')});
 bot.command('adduser',c=>{if(!own(c))return;const id=+String(c.match||'').trim();if(!(id>0)||id===OWNER)return c.reply('Usage: /adduser 123456789 (their numeric Telegram id)');add(id);c.reply(`✅ Added ${id} (read-only)`);bot.api.sendMessage(id,'✅ You now have read-only access. Tap /help.').catch(()=>{})});
 bot.command('removeuser',c=>{if(!own(c))return;const id=+String(c.match||'').trim();if(!(id>0))return c.reply('Usage: /removeuser 123456789');c.reply(remove(id)?`🗑 Removed ${id}`:`${id} was not on the list`)});}
module.exports={install,READONLY,U};
