// Users: the owner (OWNER_ID env) controls everything. Approved users have a role:
//   'watch' = read-only view of the owner's bot (old behaviour)   'trade' = own burner/settings/PnL via src/friends.js
// Unknown users who message the bot trigger an owner notification with Watch/Trade/Deny. Stored in data/users.json.
const fs=require('fs'),path=require('path');const {InlineKeyboard}=require('grammy');const {OWNER,DATA}=require('./config');
const F=path.join(DATA||path.join(__dirname,'..','data'),'users.json');
let U={allowed:{},denied:{}};try{U={...U,...JSON.parse(fs.readFileSync(F,'utf8'))}}catch{}
for(const i of Object.values(U.allowed))if(!i.role)i.role='watch'; // migrate: existing approved users stay read-only
const save=()=>{try{fs.writeFileSync(F,JSON.stringify(U,null,1))}catch(e){console.log('[users] save',e.message)}};
const READONLY=['start','help','gpnl','gnpl','pnl','stats','positions','strategy','check','c','skills'];
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const who=f=>`${esc([f.first_name,f.last_name].filter(Boolean).join(' '))}${f.username?' @'+esc(f.username):''} (id <code>${f.id}</code>)`;
const roleOf=id=>U.allowed[id]?.role||null;
const FR=()=>require('./friends');
const asked=new Map();
function guard(bot){return async(ctx,next)=>{const id=ctx.from?.id;if(!id)return;if(id===OWNER)return next();
 if(U.allowed[id]){const cmd=(ctx.message?.text||'').match(/^\/(\w+)/)?.[1]?.toLowerCase();const cb=ctx.callbackQuery?.data||'';
  if(U.allowed[id].role==='trade'){ // trade users: their commands run ONLY against their own data/users/<id>/ files
   if(cmd&&FR().CMDS.includes(cmd))return FR().handle(ctx,cmd,String(ctx.message.text.replace(/^\/\w+(@\w+)?/,'')).trim()).catch(e=>ctx.reply('❌ '+e.message).catch(()=>{}));
   if(!cmd&&ctx.message?.text&&await FR().onText(ctx))return;
   if(cmd&&['strategy','check','c','skills'].includes(cmd))return next();
   if(cb.startsWith('help:'))return next();
   if(ctx.callbackQuery)return ctx.answerCallbackQuery('Not available').catch(()=>{});
   if(ctx.message)return ctx.reply('Try /help for your commands.').catch(()=>{});return;}
  if(cmd&&READONLY.includes(cmd))return next();if(cb.startsWith('help:'))return next();
  if(ctx.callbackQuery)return ctx.answerCallbackQuery('Only the owner can do that').catch(()=>{});
  if(ctx.message)return ctx.reply('🔒 You have watch-only access. You can use: '+READONLY.map(c=>'/'+c).join(' ')).catch(()=>{});return;}
 if(U.denied[id]||!ctx.message)return;if(Date.now()-(asked.get(id)||0)<6*36e5)return;asked.set(id,Date.now());
 await ctx.reply('⏳ Access request sent to the owner. You will get a message if approved.').catch(()=>{});
 await bot.api.sendMessage(OWNER,`👤 <b>New user wants access</b>\n${who(ctx.from)}\n👀 Watch = view only · 🤝 Trade = own burner wallet, settings and PnL (paper by default)`,{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('👀 Watch','us:w:'+id).text('🤝 Trade','us:t:'+id).row().text('❌ Deny','us:no:'+id)}).catch(()=>{});
 U.pending=U.pending||{};U.pending[id]={name:ctx.from.first_name||'',username:ctx.from.username||'',t:Date.now()};save();}}
function add(id,info={},role='watch'){U.allowed[id]={...U.allowed[id],...info,role,t:U.allowed[id]?.t||Date.now()};delete U.denied[id];if(U.pending)delete U.pending[id];save()}
function remove(id){const had=!!U.allowed[id];if(had&&U.allowed[id].role==='trade')FR().onRoleChange(id,'none');delete U.allowed[id];save();return had}
function find(q){q=String(q||'').trim().replace(/^@/,'').toLowerCase();if(/^\d+$/.test(q))return U.allowed[q]?+q:null;const e=Object.entries(U.allowed).find(([,i])=>(i.username||'').toLowerCase()===q);return e?+e[0]:null}
const welcome=r=>r==='trade'?'✅ You now have a 🤝 trading account with your own burner wallet (paper mode). Tap /help to start.':'✅ You now have 👀 watch-only access. Tap /help.';
function setRole(bot,id,r){const prev=roleOf(id);U.allowed[id].role=r;save();let note='';
 if(r==='trade')FR().get(id); // creates their own vault + settings on first switch
 if(prev==='trade'&&r!=='trade'){const {open}=FR().onRoleChange(id,r);note=`Auto stopped. ${open} open position(s) left in their wallet (the bot keeps managing exits).`}
 if(prev!==r)bot.api.sendMessage(id,welcome(r)).catch(()=>{});return note}
function line(id,i){let t=`• <code>${id}</code>${i.username?' @'+esc(i.username):''}${i.name?' '+esc(i.name):''} · ${i.role==='trade'?'🤝 trade':'👀 watch'}`;
 if(i.role==='trade'||fs.existsSync(path.join(DATA,'users',String(id),'positions.json'))){try{const s=FR().get(id).s;t+=`${i.live?' · live allowed':''}${s.auto?' · auto ON':''}${FR().isPaper(FR().get(id))?' · paper':' · 🔴 LIVE'}\n   ${FR().summary(id)}`}catch{}}return t}
function kbFor(id,i){return new InlineKeyboard().text((i.role==='watch'?'• ':'')+'👀 Watch','us:w:'+id).text((i.role==='trade'?'• ':'')+'🤝 Trade','us:t:'+id).text(`${i.live?'🔴 Live: on':'🧪 Live: off'}`,'us:l:'+id).text('🗑 Remove','us:rm:'+id)}
function install(bot){
 bot.use(guard(bot));
 const own=c=>c.from?.id===OWNER;
 bot.callbackQuery(/^us:(w|t|no|rm|l|ok):(\d+)$/,async c=>{if(!own(c))return c.answerCallbackQuery('Owner only');const a=c.match[1],id=+c.match[2];
  if(a==='no'){U.denied[id]={t:Date.now()};if(U.pending)delete U.pending[id];save();c.answerCallbackQuery('Denied');return c.editMessageText(`❌ Denied user ${id}`).catch(()=>{})}
  if(a==='rm'){remove(id);c.answerCallbackQuery('Removed');return c.editMessageText(`🗑 Removed ${id}. Their wallet files stay on the phone in data/users/${id}.`).catch(()=>{})}
  if(a==='l'){if(!U.allowed[id])return c.answerCallbackQuery('Not a user');U.allowed[id].live=!U.allowed[id].live;save();c.answerCallbackQuery(U.allowed[id].live?'Live allowed':'Live blocked');
   bot.api.sendMessage(id,U.allowed[id].live?'🔴 The owner allowed live trading for you. It only starts if you also sent /paper off CONFIRM.':'🧪 The owner switched you back to paper trading.').catch(()=>{});
   return c.editMessageText(line(id,U.allowed[id]),{parse_mode:'HTML',reply_markup:kbFor(id,U.allowed[id])}).catch(()=>{})}
  const r=a==='t'?'trade':'watch';
  if(!U.allowed[id]){add(id,U.pending?.[id]||{},r);if(r==='trade')FR().get(id);bot.api.sendMessage(id,welcome(r)).catch(()=>{});c.answerCallbackQuery('Accepted');return c.editMessageText(`✅ Accepted ${id} as ${r==='trade'?'🤝 trade':'👀 watch'}. Change any time in /users.`).catch(()=>{})}
  const note=setRole(bot,id,r);c.answerCallbackQuery(r);if(note)c.reply(`ℹ️ ${id}: ${note}`).catch(()=>{});
  c.editMessageText(line(id,U.allowed[id]),{parse_mode:'HTML',reply_markup:kbFor(id,U.allowed[id])}).catch(()=>{})});
 bot.command('users',async c=>{if(!own(c))return;const a=Object.entries(U.allowed);if(!a.length)return c.reply('No approved users yet. Add with /adduser ID (or wait for an Accept request).');
  await c.reply(`👥 <b>Users</b> (${a.length}). Buttons under each one: Watch / Trade / Live toggle / Remove.\nYou can see their results, never their keys.`,{parse_mode:'HTML'});
  for(const [id,i] of a)await c.reply(line(id,i),{parse_mode:'HTML',reply_markup:kbFor(id,i)})});
 bot.command('role',c=>{if(!own(c))return;const [q,r]=String(c.match||'').trim().split(/\s+/);const id=find(q);if(!id||!['watch','trade'].includes(r))return c.reply('Usage: /role ID watch|trade  (or /role @username trade)');
  const note=setRole(bot,id,r);c.reply(`✅ ${id} is now ${r==='trade'?'🤝 trade':'👀 watch'}.${note?'\n'+note:''}`)});
 bot.command('adduser',c=>{if(!own(c))return;const [a,r0]=String(c.match||'').trim().split(/\s+/);const id=+a,r=r0==='trade'?'trade':'watch';if(!(id>0)||id===OWNER)return c.reply('Usage: /adduser 123456789 [watch|trade]');add(id,{},r);if(r==='trade')FR().get(id);c.reply(`✅ Added ${id} (${r})`);bot.api.sendMessage(id,welcome(r)).catch(()=>{})});
 bot.command('removeuser',c=>{if(!own(c))return;const id=find(c.match)||+String(c.match||'').trim();if(!(id>0))return c.reply('Usage: /removeuser 123456789');c.reply(remove(id)?`🗑 Removed ${id}`:`${id} was not on the list`)});}
module.exports={install,READONLY,U,roleOf,find,setRole,_guard:guard};
