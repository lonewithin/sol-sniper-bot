// Beginner-friendly /help with section buttons.
const {InlineKeyboard}=require('grammy');
const SEC={
start:['🚀 Start here',`<b>What this bot does</b>
It finds new Solana meme coins, checks they look safe, and buys and sells them by itself.
It runs in <b>paper mode</b>: fake money, real prices. No real SOL moves.

<b>First steps</b>
1. /auto on lets it trade by itself (/auto off stops new buys).
2. /positions shows open trades. /gpnl shows profit since the start, as a picture card plus words.
3. /help → 📋 Commands lists every command.

<b>Strategies</b>
🎯 <b>Snipe</b>: young coins, "Let it run" exits.
🐋 <b>Big Play</b>: older coins with traction, held hours.
🌙 <b>Moonbag</b>: hunts 10x+ runners (off unless you turn it on).

Results show as % and x, for example +150% (2.5x). Tap a section below.`],
setup:['📱 Phone setup',`<b>Runs on your phone</b> in PROM Terminal (Termux), folder ~/sol-sniper-bot.
<b>.env file</b>: BOT_TOKEN, OWNER_ID, PAPER=true, RPC_URL. On every start the PAPER line decides paper or live.

<b>Start</b>
<code>cd ~/sol-sniper-bot &amp;&amp; termux-wake-lock &amp;&amp; nohup ./run.sh &gt; sniper.log 2&gt;&amp;1 &amp;</code>
<b>Alive?</b> <code>pgrep -f "node src/index.js"</code> (a number = running)
<b>Log</b> <code>tail -f sniper.log</code> (CTRL+C leaves; the bot keeps running)
<b>Stop</b> <code>pkill -f run.sh; pkill -f "node src/index.js"</code>
<b>Update</b> git pull, stop, start again.

Keep PROM Terminal in recent apps with battery set to Unrestricted. Run only ONE copy (two = Telegram 409 errors). 429 or fetch timeout lines are normal: it waits and retries.`],
paper:['🧪 Paper / live',`<b>Paper</b> (default): real prices, fake money. Each sell takes off 1.5% plus the network fee, so results stay realistic.
<b>Live</b> uses real SOL from the burner wallet. Only if you are sure:
• set PAPER=false in .env and restart, or
• /paper off CONFIRM (until the next restart)
/paper on goes back to paper at once.

⚠️ Use a small burner with money you can afford to lose. The strategy has not proven profitable yet.`],
wallet:['👛 Wallets',`The bot makes its own <b>burner wallet</b> on first run and saves it encrypted on the phone in ~/sol-sniper-bot/data.
/wallet: active burner and balance
/burners: every burner (⭐ = trading)
/newburner: fresh burner, switch to it (live: moves the SOL; sell open live trades first with /sellall)
/export CONFIRM: show the active key (self-deletes after 60s)
/export 2 CONFIRM: one burner · /export all CONFIRM: all
Import keys into Phantom (Import Private Key) as a backup.

⚠️ Never send keys or your seed phrase to anyone. Delete the data folder and un-backed-up keys are gone. When moving phones, copy the whole data folder.`],
profit:['💸 Profit',`/profitaddress: the bot asks for your wallet address, you paste it. Public address only; it refuses seed phrases and private keys.
/profit: menu (send now, auto send on/off, change address)
/sweep: send profit now (only what is above working capital)
/set capital 0.5: capital the sweep never touches
Auto sweep runs at 23:55 WAT.
/withdraw ADDRESS 0.1 or /withdraw ADDRESS all: send SOL out by hand
In paper mode these only show what would happen.`],
size:['📏 Trade size',`Every trade is <b>$5–$10</b>, worked out in SOL at the live price:
Scalp / Fast / Second chance $5 · Swing $6.25 · Runner $8 · Big Play $5 · Moonbag $10.
Change: /set buyUsdMin 5 and /set buyUsdMax 10 (/set usdSizing false = old SOL sizes).
In hours that lost money before, size can be halved (/set todFilter).
Limits: max coins open per strategy (/set maxOpen) and a pause after 3 losses in a row.`],
tiers:['🎯 Snipe + Let it run',`Each coin gets a <b>potential score</b> (0–100) that picks the tier: Scalp, Swing or Runner.

<b>Let it run</b> (ON, /set letRun) for every snipe:
• stop loss −15%
• sells 30% at +50% (1.5x), then the stop on the rest moves to break-even
• the rest rides a 20% trailing stop from its peak, up to 12 hours
So a 10x is not sold at +20%. Expect about 1 win in 4, with rare big winners paying for small losses.
/set letRun false = old quick exits.
<b>Entry checks</b>: safety, liquidity, holders, 90s confirm wait, no buying 5m spikes over +20%.`],
skills:['🧠 Skills',`<b>Skills</b> are extra checks. Each was backtested on real price candles: tuned on older coins, then checked on newer coins it had never seen. Only ones that made more money on the newer coins are on.

🚚 <b>Skip fresh migrations</b> (new): no snipes on coins straight off a pump.fun migration.
🛡 <b>Higher safety bar</b> (new): snipes need safety 75+ (/set skillMinSafetyScore).
🚫 <b>No chasing pumps</b>: skips coins already up more than +50% (1.5x) in the last hour.
📈 <b>Momentum check</b>: 2 of the last 3 five-minute candles green and volume rising.
💧 <b>Volume-dry exit</b>: OFF, it lost money with Let it run.

Not used for Moonbag or manual buys. /skills shows what each did. Switch in /set → Skills.`],
big:['🐋 Big Play',`Buys older coins (1h+), market cap $100k–$10M, liquidity $50k+, more buyers than sellers, rising volume. /bigplay on|off. ON by default. Skips coins already up more than 200% in the last hour (biggest backtest gain). Trades at $5, the minimum size, because the edge is still thin.
<b>Exits</b>: sells half at +50% (1.5x). The rest sells if it falls 40% from its peak or back to entry. Stop loss −25%.
<b>Profit lock</b>: peaked +20% but never hit +50%? Sells when the gain falls back to +3%.
<b>Hold</b>: 4h, extended 2h at a time while climbing, up to 24h. <b>Flat exit</b> after 50 min under +5%.
<b>Runner path</b>: young trending coins (1h +15%, 6h +40%) with a 30% trail.
<b>Dip reclaim</b>: re-buys good coins that dipped 25%+ and are recovering.`],
moon:['🌙 Moonbag',`Hunts coins that could run 10–100x. OFF by default (/set moon true).
Buys coins with safety 70+ and liquidity $15k+, up to 3 at once.
Stop loss −40% before the first sell. Sells 25% at 2x, 25% at 3x and 25% at 10x. After the first sell the rest sells if it drops back to entry or falls 30% from its peak, tightened to 20% once it has reached 3x (max 10 days).
Rules: /set → Moonbag.`],
safe:['🛡 Safety',`<b>Hard blocks</b> (never bought): creator can still mint or freeze, can't sell, known rugs.
<b>Holders</b>: top 10 wallets up to 30%, dev up to 10%.
<b>Confirm wait</b>: waits 90s; buys only if 3+ new buyers came and price didn't drop 10% or jump 20%.
<b>Loss pause</b>: 3 losses in a row pause snipes 30 min.
<b>Daily loss limit</b>: after losing 0.15 SOL in a day (UTC), all modes stop new buys until the next day (/set dailyLossLimitSol, 0 = off). Live mode only; paper never pauses. Only coins bought that day count.
<b>One coin, one mode</b>: a coin held or being bought by one mode is never bought by another.
<b>Thin-pool re-check</b>: coins with safety 90+ and potential 75+ skipped only for a thin pool are re-checked after 5 min (/set thinRecheckMin).
<b>Second chance</b> (OFF): buys skipped coins that pump later.
/check ADDRESS: full safety score. Send a $TICKER or address on its own for a coin card.
/panic: stop buying and sell everything.`],
cards:['🖼 Cards + charts',`/gpnl and /stats send a <b>picture card</b> and the words summary: profit as % and x, SOL and $, trades, win rate, each strategy, and the time window.
/gpnl 1h, /gpnl 1d, /gpnl 7d: only coins bought in that window.
/pnl: summary + profit curve picture · /pnl $TICKER: card for one coin
/c $TICKER: price chart (buttons for 5m/15m/1h/4h)
Pictures are drawn in plain JavaScript, so they work on the phone. If one fails, you still get the words.`],
cmds:['📋 Commands',`<b>Trading</b>
/auto on|off · /snipe on|off · /bigplay on|off
/paper on · /paper off CONFIRM (live!)
/positions · /sellall · /panic (stop + sell all)
<b>Results</b>
/gpnl (1h, 1d…) · /pnl (or $TICKER) · /stats · /c $TICKER
/strategy: rules in use · /skills: skills and what they did
<b>Coins</b>
/check ADDRESS · or just send $TICKER / an address
<b>Wallet + profit</b>
/wallet · /burners · /newburner · /export CONFIRM · /withdraw ADDRESS AMOUNT|all
/profit · /sweep · /profitaddress
<b>Settings</b>
/set: menu · /set NAME VALUE (e.g. /set buyUsdMax 10)
/settings: every value · /reset: defaults · /cancel: stop typing a value
<b>Users</b> (owner)
/users · /role ID watch|trade · /adduser ID [trade] · /removeuser ID (see 🤝 Friends)`],
friends:['🤝 Friends',`<b>Friends (owner controls everything)</b>
When someone new messages the bot you get buttons: 👀 <b>Watch</b> (view your results only) · 🤝 <b>Trade</b> (their own account) · ❌ Deny.
/users: every user with buttons Watch / Trade / Live on-off / Remove, plus their results (closed trades, win rate, % and x).
/role ID trade · /role @name watch: switch any time.

<b>Trade friends get</b> their own burner wallet (encrypted in data/users/ID), their own settings (start at $5–$10, Let it run, skills), their own trades and PnL, max 3 open. Paper by default.
They use the same commands (/auto /wallet /burners /newburner /export /profitaddress /withdraw /profit /set /settings /pnl /gpnl /stats /positions /sellall) and each one only ever touches THEIR wallet.
<b>Live</b> needs both: they send /paper off CONFIRM, and you tap Live: on in /users.

🔒 You cannot export friends' keys and they cannot see yours. You only see their results.
Trade → Watch stops their auto-buys; open trades stay and the bot still closes them by the rules.
Back up the whole data folder (it now has data/users) when moving phones.`]};
const kb=cur=>{const k=new InlineKeyboard();Object.entries(SEC).forEach(([id,[t]],i)=>{k.text((id===cur?'• ':'')+t,'help:'+id);if(i%2)k.row()});return k;};
function install(bot){
 bot.command('help',c=>c.reply(SEC.start[1],{parse_mode:'HTML',reply_markup:kb('start')}));
 bot.callbackQuery(/^help:(\w+)$/,c=>{const s=SEC[c.match[1]];c.answerCallbackQuery();if(s)c.editMessageText(s[1],{parse_mode:'HTML',reply_markup:kb(c.match[1])}).catch(()=>{})});
 return bot.api.setMyCommands([['help','Full guide'],['auto','Auto-buy on|off'],['positions','Open trades'],['gpnl','Profit card (or 1h, 1d)'],['pnl','PnL summary · /pnl $TICKER'],['stats','Dashboard + card'],['skills','Trading skills + impact'],['strategy','Rules in use'],['check','Score a coin'],['c','Chart: /c $TICKER'],['snipe','Snipe on|off'],['bigplay','Big Play on|off'],['paper','on · off CONFIRM = live'],['wallet','Burner + balance'],['burners','List burners'],['newburner','New burner + switch'],['export','Back up key (CONFIRM)'],['profitaddress','Set profit wallet'],['profit','Profit menu'],['sweep','Send profit now'],['withdraw','Send SOL out'],['sellall','Sell everything'],['panic','Stop + sell all'],['set','Settings menu'],['settings','All values'],['reset','Settings to defaults'],['cancel','Stop typing a value'],['users','Friends + buttons'],['role','ID watch|trade'],['adduser','Add user (ID trade)'],['removeuser','Remove user']].map(([command,description])=>({command,description}))).catch(e=>console.log('setMyCommands',e.message));}
module.exports={install,SEC};
