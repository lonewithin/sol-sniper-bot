// Offline E2E test of every command + inline button. Run ONLY from an isolated copy (see scripts/e2e.sh):
// all Telegram API calls are intercepted (fake token, nothing leaves the box), settings/trades mutate the copy only.
process.env.BOT_TOKEN='1:FAKE_HARNESS_TOKEN';process.env.OWNER_ID=process.env.OWNER_ID||'6360092082';process.env.PAPER='true';
const path=require('path');if(!/harness/.test(path.resolve(__dirname,'..')))throw new Error('refusing: run from isolated harness copy');
const C=require('../src/config');if(!C.settings.paper)throw new Error('refusing: settings not paper');
const OWNER=C.OWNER;let mid=1000;const out=[];const errs=[];const issues=[];
// intercept from construction, so even calls made during install (setMyCommands) never leave the box
const GB=require(path.join(path.dirname(require.resolve('grammy')),'bot.js'));const RealBot=GB.Bot;GB.Bot=class extends RealBot{constructor(...a){super(...a);this.api.config.use((prev,m,p)=>fake(m,p))}};
const SKIP=/^(sw:go|wd:|buy:.*:0\.05|sm:resetgo)/; // side-effect buttons we never press (sweep/withdraw); resetgo tested last separately
const bytes=s=>Buffer.byteLength(s||'','utf8');
const htmlOk=t=>{const st=[];const re=/<\/?([a-z-]+)[^>]*>/gi;let m;while((m=re.exec(t))){const tag=m[1].toLowerCase();if(!['b','i','u','s','code','pre','a','tg-spoiler','blockquote'].includes(tag))return 'bad tag <'+tag+'>';if(m[0][1]==='/'){if(st.pop()!==tag)return 'unbalanced </'+tag+'>'}else st.push(tag)}return st.length?'unclosed <'+st.at(-1)+'>':null};
async function fake(method,p){
 const rec={method,p};out.push(rec);const txt=p.text??p.caption??(p.media&&p.media.caption);
 if(p.text!=null&&bytes(p.text)>4096)issues.push(`${method}: text ${p.text.length} chars > 4096`);
 if(p.caption!=null&&p.caption.length>1024)issues.push(`${method}: caption > 1024`);
 if(txt&&(p.parse_mode==='HTML'||p.media?.parse_mode==='HTML')){const e=htmlOk(txt);if(e)issues.push(`${method}: HTML ${e} :: ${txt.slice(0,80)}`)}
 if(txt&&/\b(undefined|NaN)\b|\[object Object\]/.test(txt))issues.push(`${method}: suspicious value in text :: ${(txt.match(/.{0,40}\b(undefined|NaN)\b.{0,20}|.{0,30}\[object Object\]/)||[''])[0]}`);
 const kb=p.reply_markup?.inline_keyboard;if(kb)for(const row of kb)for(const b of row){if(b.callback_data&&bytes(b.callback_data)>64)issues.push('callback_data > 64 bytes: '+b.callback_data);if(!b.callback_data&&!b.url)issues.push('button without action: '+b.text);if(b.text&&b.text.length>200)issues.push('button text too long')}
 if(method==='getMe')return {ok:true,result:{id:1,is_bot:true,first_name:'H',username:'harness_bot',can_join_groups:false,can_read_all_group_messages:false,supports_inline_queries:false}};
 if(/^(send|edit)/.test(method)){const m={message_id:p.message_id||++mid,date:Date.now()/1e3|0,chat:{id:p.chat_id||OWNER,type:'private'},text:p.text,caption:p.caption,reply_markup:p.reply_markup};return {ok:true,result:m}}
 return {ok:true,result:true}}
const {make}=require('../src/bot');const {bot}=make();
bot.catch(e=>errs.push(String(e.error?.stack||e.error||e).split('\n').slice(0,3).join(' | ')));
let uid=1;const from={id:OWNER,is_bot:false,first_name:'Prom',username:'lonewithin'};const chat={id:OWNER,type:'private'};
const cmd=t=>{const m=t.match(/^\/\w+/);return {update_id:uid++,message:{message_id:++mid,date:Date.now()/1e3|0,chat,from,text:t,entities:m?[{type:'bot_command',offset:0,length:m[0].length}]:[]}}};
const cb=(data,msg)=>({update_id:uid++,callback_query:{id:String(uid),from,chat_instance:'x',data,message:{message_id:msg?.message_id||++mid,date:Date.now()/1e3|0,chat,from:{id:1,is_bot:true,first_name:'H'},text:msg?.text||'x',reply_markup:msg?.reply_markup}}});
const settle=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
async function step(label,upd,wait=300){const o0=out.length,e0=errs.length,i0=issues.length;const t0=Date.now();
 try{await bot.handleUpdate(upd)}catch(e){errs.push(label+': '+e.message)}await settle(wait);
 const sent=out.slice(o0).filter(x=>x.method!=='answerCallbackQuery'||x.p.text);const new_errs=errs.slice(e0),new_iss=issues.slice(i0);
 const bad=sent.find(x=>/^❌|^Failed|\b(lookup|chart) failed/i.test(x.p.text||x.p.caption||''));if(bad)new_iss.push('error text: '+(bad.p.text||bad.p.caption).slice(0,160).replace(/\n/g,' ⏎ '));if(!out.slice(o0).length)new_iss.push('no reply');const fail=new_errs.length||new_iss.length;
 results.push({label,ok:!fail,ms:Date.now()-t0,calls:out.slice(o0).map(x=>x.method).join(','),errs:new_errs,issues:new_iss,first:(sent.find(x=>x.p.text||x.p.caption)?.p.text||sent.find(x=>x.p.caption)?.p.caption||'').slice(0,90).replace(/\n/g,' ⏎ ')});
 return out.slice(o0)}
const buttons=calls=>{const r=[];for(const x of calls){const kb=x.p.reply_markup?.inline_keyboard;if(kb)for(const row of kb)for(const b of row)if(b.callback_data)r.push({data:b.callback_data,msg:{message_id:x.p.message_id||mid,text:x.p.text,reply_markup:x.p.reply_markup}})}return r};
(async()=>{await bot.init();
 const T=require('../src/trader');const mintOf=T.st.closed.at(-1)?.mint||T.st.open[0]?.mint;const sym=T.st.closed.at(-1)?.symbol||'BONK';
 for(const c of ['/start','/help','/strategy','/settings','/positions','/wallet','/burners','/profit','/sweep','/export','/withdraw','/withdraw abc 1','/snipe on','/bigplay on','/auto on','/set buySol 0.03','/set buySol 0.02','/set bigBuySol 0.05','/set bigPartialAt 50','/set nosuchkey 1','/set alerts trades','/set mode safe','/set secondChance on','/reset','/cancel'])await step(c,cmd(c),c==='/wallet'||c==='/burners'||c==='/profit'||c==='/sweep'?3000:300);
 // /stats + every section button
 let r=await step('/stats',cmd('/stats'),1500);const st=r.find(x=>x.p.text);if(!/Big Play/.test(st?.p.text||''))issues.push('/stats overview missing Big Play line');
 for(const b of [...new Set(buttons(r).map(b=>b.data))]){const rr=await step('btn '+b,cb(b,buttons(r)[0].msg),2500);if(b==='st:bg'){const t=rr.find(x=>x.p.text)?.p.text||'';if(!/Fixed vs % sizing/.test(t)){issues.push('/stats Big Play missing "Fixed vs % sizing" section');results.at(-1).ok=false;results.at(-1).issues.push('missing Fixed vs % sizing')}}}
 // /settings strategy buttons (toggle twice to restore)
 for(const b of ['tg:snipe','tg:snipe','tg:bigplay','tg:bigplay','tg:auto','tg:auto','tg:info','pf:menu','pf:toggle','pf:toggle','pf:send','sw:no'])await step('btn '+b,cb(b),b.startsWith('pf')?3000:300);
 // /set menu full crawl
 r=await step('/set (menu)',cmd('/set'));const seen=new Set();let q=buttons(r);const snap=JSON.stringify(C.settings);
 while(q.length){const b=q.shift();if(seen.has(b.data)||SKIP.test(b.data))continue;seen.add(b.data);
  const rr=await step('btn '+b.data,cb(b.data,b.msg),50);for(const n of buttons(rr))if(!seen.has(n.data))q.push(n);
  if(/^sm:t1?:/.test(b.data)){await bot.handleUpdate(cb(b.data,b.msg));await settle(20)}}// toggle back
 // typed values incl Big Play fixed amounts
 for(const [k,v] of [['bigBuySol','0.07'],['bigMaxDailySol','0.5'],['bigPartialAt','50'],['buySol','0.02']]){await step('type '+k,cb('sm:type:'+k));await step('value '+k+'='+v,cmd(v))}
 await step('type bad value',cb('sm:type:bigBuySol'));const bad=await step('value abc (expect reject)',cmd('abc'));results.at(-1).ok=/❌/.test(bad.find(x=>x.p.text)?.p.text||'')&&!results.at(-1).errs.length;await step('/cancel',cmd('/cancel'));
 await step('btn sm:resetask',cb('sm:resetask'));await step('btn sm:resetno',cb('sm:resetno'));
 // /c + every timeframe button
 const qc=mintOf||'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pB263';
 r=await step('/c '+qc.slice(0,6)+'…',cmd('/c '+qc),15000);for(const b of [...new Set(buttons(r).map(b=>b.data))])await step('btn '+b.slice(0,12),cb(b,buttons(r).find(x=>x.data===b).msg),12000);
 await step('/c $BONK',cmd('/c $BONK'),15000);await step('/c (no arg → usage)',cmd('/c'),3000);results.at(-1).ok=!results.at(-1).errs.length;
 // /gpnl: all, windows, typo alias, bad arg, empty
 for(const q of ['/gpnl','/gpnl 1h','/gpnl 1 hour','/gpnl 30m','/gpnl 7d','/gnpl 24h']){const rr=await step(q,cmd(q),300);if(!/PnL/.test(rr.find(x=>x.p.text)?.p.text||''))results.at(-1).ok=false}
 {const rr=await step('/gpnl bad (usage)',cmd('/gpnl xyz'));results.at(-1).ok=/Usage/.test(rr.find(x=>x.p.text)?.p.text||'')}
 {const c0=T.st.closed,o0=T.st.open;T.st.closed=[];T.st.open=[];const rr=await step('/gpnl empty',cmd('/gpnl'));results.at(-1).ok=/No coins bought/.test(rr.find(x=>x.p.text)?.p.text||'');T.st.closed=c0;T.st.open=o0}
 {const G=require('../src/gpnl');const now=Date.now(),c0=T.st.closed,o0=T.st.open;T.st.closed=[{tier:'SWING',solIn:0.02,solOut:0.03,pnl:0.01,opened:now-30*6e4},{tier:'BIG',solIn:0.05,solOut:0.04,pnl:-0.01,opened:now-3*36e5}];T.st.open=[{tier:'SCALP',solIn:0.02,last:0.025,opened:now-10*6e4}];
  const a=G.compute(36e5,now).all,b=G.compute(864e5,now);const ok=a.n===2&&a.wins===1&&Math.abs(a.openVal-0.025)<1e-9&&b.all.n===3&&b.big.n===1&&b.snipe.n===2&&G.compute(6e4,now).all.n===0;
  results.push({label:'gpnl math (window filter, split)',ok,ms:0,calls:'',errs:[],issues:ok?[]:[JSON.stringify(a)],first:''});T.st.closed=c0;T.st.open=o0}
 // /pnl summary + cards
 await step('/pnl',cmd('/pnl'),4000);await step('/pnl $'+sym,cmd('/pnl $'+sym),15000);await step('/pnl $BONK',cmd('/pnl $BONK'),15000);
 if(mintOf)await step('btn pc:',cb('pc:'+mintOf),15000);
 // $ticker / mint lookup + buttons
 r=await step('$BONK lookup',cmd('$BONK'),15000);for(const b of buttons(r).slice(0,2))await step('btn '+b.data.slice(0,14),cb(b.data,b.msg),12000);
 if(mintOf){r=await step('mint lookup',cmd(mintOf),15000);const lk=buttons(r).find(b=>b.data.startsWith('lk:'));if(lk)await step('btn lk: refresh',cb(lk.data,lk.msg),12000);
  await step('/check mint',cmd('/check '+mintOf),15000);await step('btn buy 0.02 (paper)',cb('buy:'+mintOf+':0.02'),8000);await step('/positions after buy',cmd('/positions'));await step('/sellall (paper copy)',cmd('/sellall'),8000)}
 await step('/withdraw paper',cmd('/withdraw 3mvvn7sLrjo8VGNcYUsGA9HnyA4rVg3LGqZawvWLx1MR 0.01'));
 await step('/newburner (paper copy)',cmd('/newburner'),3000);
 await step('btn sm:resetgo (copy)',cb('sm:resetgo'));if(!C.settings.paper)issues.push('reset turned paper OFF!');
 const fails=results.filter(x=>!x.ok);
 console.log(`E2E: ${results.length} steps · ${results.length-fails.length} pass · ${fails.length} fail · ${seen.size} /set buttons crawled`);
 for(const x of (process.argv.includes('-v')?results:fails))console.log(`${x.ok?'PASS':'FAIL'} ${x.label} [${x.calls}] ${x.ms}ms ${x.errs.join(' ; ')} ${x.issues.join(' ; ')} :: ${x.first}`);
 process.exit(fails.length?1:0)})().catch(e=>{console.log('HARNESS CRASH',e.stack);process.exit(2)});
