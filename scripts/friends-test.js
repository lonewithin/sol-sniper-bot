process.env.OWNER_ID='6360092082';process.env.BOT_TOKEN='x';process.env.FRIENDS_MONITOR_SEC='9999';
const assert=require('assert');const W=require('./src/wallet');const ownerPub=W.pub();const ownerPos=require('fs').readFileSync('data/positions.json','utf8');
const U=require('./src/users'),FR=require('./src/friends');let price={};const sent=[];
FR._setDeps({quote:()=>{throw new Error('NETWORK QUOTE CALLED')},pairsFor:async ms=>Object.fromEntries(ms.filter(m=>price[m]).map(m=>[m,{priceUsd:price[m]}])),solUsd:async()=>150,j:()=>{throw new Error('net')},px:require('./src/fmt').px});
const handlers={cmd:{},cb:[]};const bot={api:{sendMessage:async(id,t)=>{sent.push([id,t]);return {message_id:1}},deleteMessage:async()=>{}},use(m){handlers.mw=m},command(n,f){handlers.cmd[n]=f},callbackQuery(re,f){handlers.cb.push([re,f])}};
FR._setBot(bot);U.install(bot);
const ctx=(id,text,chat='private')=>{const out=[];return {out,from:{id,first_name:'F'+id},chat:{id,type:chat},message:{text},match:text.replace(/^\/\w+\s*/,''),reply:async t=>{out.push(t);return {message_id:2}},deleteMessage:async()=>{out.push('[deleted]')},api:bot.api,answerCallbackQuery:async()=>{},editMessageText:async t=>out.push(t)}};
const cb=async(id,data)=>{const c=ctx(id,'');c.callbackQuery={data};for(const [re,f] of handlers.cb){const m=data.match(re);if(m){c.match=m;await f(c)}}return c};
(async()=>{const O=6360092082,A=111,B=222;
 // A asks, owner accepts as trade; B as watch
 await handlers.mw(ctx(A,'hi'),()=>{});await handlers.mw(ctx(B,'hi'),()=>{});
 assert(sent.some(([id,t])=>id===O&&/Watch/.test(t)));await cb(O,'us:t:'+A);await cb(O,'us:w:'+B);
 assert.equal(U.roleOf(A),'trade');assert.equal(U.roleOf(B),'watch');
 // non-owner cannot press buttons
 await cb(A,'us:t:'+B);assert.equal(U.roleOf(B),'watch');
 const run=async(id,t,chat)=>{const c=ctx(id,t,chat);let nexted=false;await handlers.mw(c,()=>{nexted=true});return {out:c.out.join('\n'),nexted}};
 let r=await run(A,'/wallet');assert(/Your burner/.test(r.out));const aPub=FR.get(A).vault.pub();assert.notEqual(aPub,ownerPub);
 r=await run(A,'/export CONFIRM','group');assert(/private chat/.test(r.out));
 r=await run(A,'/export CONFIRM');assert(r.out.includes(FR.get(A).vault.exportSecret()));assert(!r.out.includes(W.exportSecret()));
 r=await run(B,'/export CONFIRM');assert(!r.nexted&&/watch-only/.test(r.out));
 r=await run(B,'/pnl');assert(r.nexted); // watch users still see owner view
 r=await run(A,'/profitaddress');r=await run(A,'word '.repeat(12).trim());assert(/deleted/.test(r.out)&&!FR.get(A).s.profitAddress);
 await run(A,'/profitaddress');r=await run(A,'3mvvn7sLrjo8VGNcYUsGA9HnyA4rVg3LGqZawvWLx1MR');assert(/saved/.test(r.out));
 r=await run(A,'/set buyUsdMax 8');assert.equal(FR.get(A).s.buyUsdMax,8);
 r=await run(A,'/paper off CONFIRM');assert(FR.isPaper(FR.get(A)),'owner has not allowed live');
 await cb(O,'us:l:'+A);assert(!FR.isPaper(FR.get(A)));await cb(O,'us:l:'+A);assert(FR.isPaper(FR.get(A)));await run(A,'/paper on');
 // second trade user via /role
 await handlers.cmd.adduser(ctx(O,'/adduser 333'));{const c=ctx(O,'/role 333 trade');c.match='333 trade';await handlers.cmd.role(c)}assert.equal(U.roleOf(333),'trade');
 assert.notEqual(FR.get(333).vault.pub(),aPub);
 await run(A,'/auto on');await run(333,'/auto on');assert(FR.anyAuto());
 // signals: scanner scored once -> both buy
 for(let i=0;i<5;i++){price['M'+i]=1;await FR.dispatch({mint:'M'+i,symbol:'C'+i},{tier:['SCALP','SWING','RUNNER'][i%3],pot:60,safety:80,src:'dex'})}
 assert.equal(FR.get(A).st.open.length,3,'3 open limit');assert.equal(FR.get(333).st.open.length,3);
 // low safety skipped by skill
 price.LOW=1;await FR.dispatch({mint:'LOW',symbol:'L'},{tier:'SCALP',safety:60,src:'dex'});
 // price moves: M0 +60% partial, M1 -20% stop, M2 flat
 price.M0=1.6;price.M1=0.8;await FR.monitor();const a=FR.get(A);
 assert(a.st.open.find(p=>p.mint==='M0').halfDone);assert(!a.st.open.find(p=>p.mint==='M1'));
 price.M0=1.0;await FR.monitor();assert(!a.st.open.find(p=>p.mint==='M0'));// breakeven stop after partial
 // trade -> watch stops auto, leaves positions
 const c=await cb(O,'us:w:333');assert.equal(FR.get(333).s.auto,false);assert(c.out.join().includes('open position'));assert.equal(FR.get(333).st.open.length,1);
 r=await run(A,'/pnl');console.log(r.out);r=await run(A,'/sellall');console.log(r.out);
 const uc=ctx(O,'/users');await handlers.cmd.users(uc);console.log(uc.out.join('\n---\n'));
 assert.equal(require('fs').readFileSync('data/positions.json','utf8'),ownerPos,'owner positions untouched');assert.equal(W.pub(),ownerPub);
 console.log('ALL TESTS PASSED');process.exit(0)})().catch(e=>{console.error(e);process.exit(1)});
