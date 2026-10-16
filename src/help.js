// Beginner-friendly /help with section buttons.
const {InlineKeyboard}=require('grammy');
const SEC={
start:['🚀 Start here',`<b>What this bot does</b>
It finds new Solana meme coins, checks they look safe, and buys and sells them for you.
Right now it runs in <b>paper mode</b>: fake money, real prices. No real SOL moves.

<b>Three strategies</b>
🎯 <b>Snipe</b>: very young coins, held for minutes.
🐋 <b>Big Play</b>: older coins with traction, held for hours.
🌙 <b>Moonbag</b>: lock profit at 2x, let a small bag ride for 10x+.

Tap a section below to learn each part. Change any rule in /set.`],
tiers:['🎯 Snipe tiers',`Each coin gets a <b>potential score</b> (0–100). The score picks the tier.

💵 <b>Trade size (paper)</b>: every trade is $5–$10, converted to SOL at the live price. Low grades (Scalp/Second) $5, Swing ~$6, Runner $8, Big Play and Moonbag $10. Change with /set buyUsdMin and /set buyUsdMax (or /set → Size). The × sizes below apply only if $ sizing is off.
<b>Let it run</b> (default ON, /set letRun): every snipe (Scalp 0.4×, Swing 0.8×, Runner 1.5× size) uses the same exits: stop loss −15%, sell 30% at +50% (stop on the rest moves to breakeven), the rest rides a 20% trailing stop from its peak, max 6 h. No quick +20% take-profit, so a 10x is not sold at +20%. Expect a lower win rate with bigger winners. Turn it off with /set letRun false to go back to the old Scalp/Swing exits.

Runners also have a <b>profit lock</b>: once up 20%, it sells if the gain falls back to +3%.
Runners skip thin pools (under $20k) and coins that jumped over 10% during the confirm wait.`],
second:['🔁 Second chance',`If the bot skipped a coin and it then pumps, second chance can buy it later at a smaller size.
It never re-buys coins with hard safety flags, coins first skipped as a spike, or coins that failed confirmation.
<b>It is OFF by default</b>, because 3 of its 4 test trades lost.`],
big:['🐋 Big Play',`Big Play buys older coins (at least 1 hour old) with market cap $100k–$10M and liquidity of $50k or more.
It needs buyers to outnumber sellers and volume to be rising.

<b>Size</b>: fixed 0.025 SOL per trade (halved: Big Play lost money in tests unless one rare 20x coin was included).
<b>Exits</b>: sells half at +50%. The other half is the runner: it sells only if it falls 40% from its peak (so a 20x keeps most of the run) or drops back to entry. Stop loss −25%.
<b>Modest-peak profit lock</b>: if it peaks 20%+ but never reaches the half-sell, it sells when the gain falls back to +3% (so a +22% blip does not trail into a loss). Real runners that hit +50% keep the trail.
<b>Hold</b>: 4 hours, extended 2 hours at a time while it keeps climbing, up to 24 hours.
<b>Flat exit</b>: sells after 50 min if it never got above +5%.`],
skills:['🧠 Skills',`<b>Skills</b> are extra checks that make Snipe and Big Play pickier. Each one passed a backtest on real price candles, and was also checked on later trades it was not tuned on.

🚫 <b>No chasing pumps</b>: skips a coin that already rose more than +50% (1.5x) in the last hour.
📈 <b>Momentum check</b>: buys only if at least 2 of the last 3 five-minute candles were green and volume is rising.
💧 <b>Volume-dry exit</b>: after 10 min, sells if 5-minute volume falls below half of what it was at entry while the trade is under +5%.

They do not apply to Moonbag or manual buys. If price candles can't be loaded, the buy goes ahead without them.
See what each one did with /skills. Switch them in /set → Skills.`],
moon:['🌙 Moonbag',`<b>🌙 Moonbag</b> is a third strategy, separate from Snipe and Big Play. It hunts coins that could run 10–100x.

<b>Rules</b> come from runner backtests: a 2-month list of 484 coins from Raydium, PumpSwap, pump.fun, Meteora and LaunchLab, plus 613 coins the bot saw. Settings were picked on the earlier coins and checked on the later ones.
<b>Buys</b> scanned coins with safety 70+ and liquidity $15k+.
<b>Size</b>: 0.05 SOL. Up to 3 Moonbag coins at once (Snipe and Big Play each have their own 3).
<b>Before 3x</b>: stop loss −40% (runners often dip hard first).
<b>Ladder</b>: sells 25% at 3x and another 25% at 10x. After the first sell, the rest is sold if price falls back to entry.
<b>The last 50%</b> rides until it falls 30% from its peak, or 10 days.

Every trade records the best multiple the coin reached. See /pnl and /gpnl. Change any rule in /set → Moonbag. Paper only.`],
runner:['🏃 Runner path',`A Big Play entry for young coins already trending.
It needs a 1h gain of 15%+ and a 6h gain of 40%+, rising 5m volume, and 15+ buyers in 5 min.
It skips coins that rose more than 10% in the last 5 min or more than 400% in the last hour (likely blow-offs).
It uses a 30% trailing stop.`],
dip:['📉 Dip reclaim',`Big Play keeps watching good coins for 6 hours, including ones it skipped for holders or got stopped out of.
If a coin drops 25% or more from its high, the bot waits for it to <b>recover</b>:
• price back above the last check and above the dip low
• more buys than sells, and rising volume
• liquidity still at least 70% of where it was
Then it re-checks safety. The dev must hold 10% or less, and the top 10 holders 80% or less.
Turn it on or off in /set → Big Play → Dip reclaim.`],
exits:['📈 Exits',`<b>Stop loss</b>: sells if the price falls a set % below your buy.
<b>Take profit</b>: sells everything at a target gain.
<b>Early take-profit</b>: at +25%, sells 35%, and moves the stop on the rest to breakeven.
<b>Sell half</b>: at the target, sells 50% and lets the rest ride.
<b>Trailing stop</b>: once up, sells if the price falls a set % from its best point.
<b>Breakeven stop</b>: after taking some profit, sells if the price returns to your buy.
<b>Time limit</b>: sells when the max hold time is up.`],
safe:['🛡 Safety checks',`<b>Hard blocks</b> (never bought): the creator can still mint or freeze, you can't sell, or a known rug.
<b>Safety score</b>: snipes need 70+, and Big Play needs 60+.
<b>Holders</b>: the top 10 wallets may hold up to 30%, and the dev up to 10%.
<b>Confirm wait</b>: after a signal, it waits 90 sec and buys only if 3+ new buyers arrived and the price didn't drop over 10% or jump over 20%.
<b>Entry window</b>: skips 5m spikes over 20% and coins dumping without strong buyers.
<b>Loss pause</b>: after 3 losses in a row, snipes pause for 30 min.`],
size:['📏 Sizing',`Snipe base size is 0.02 SOL. Tier multipliers: scalp 0.4×, swing 0.8×, runner 1.5×.
No buy is bigger than the max-per-buy limit (0.1 SOL).
In losing hours of the day, the size can be cut by half.
Big Play is always a fixed 0.05 SOL.
Paper trades take off 1.5% per sell for fees and slippage, so results stay realistic.`],
unl:['♾ Unlimited test',`<b>paperUnlimited</b> is a paper-only test setting.
When it is on, it turns off the daily SOL limits, the max coins at once, and the loss pause, and it acts as if the balance were endless.
Trade sizes stay the same, so profit and loss stay comparable.
<b>It never works in live mode.</b> If paper is off, every limit comes back.`],
users:['👥 Users',`Only <b>you</b> (the owner) can change settings, wallets, export keys or trade.
When someone new messages the bot, you get a message with <b>Accept</b> and <b>Deny</b> buttons.
Accepted users can only view: /help /gpnl /pnl /stats /positions /strategy /check /c.
/users: list approved users
/adduser ID: add someone by their numeric Telegram id
/removeuser ID: remove them
No Termux or env changes needed. The list is saved in data/users.json.`],
cmds:['📋 Commands',`/help: this guide
/gpnl: profit and loss since the test started (or /gpnl 1h, 1d)
/pnl: PnL summary. /pnl $TICKER for one coin
/stats: dashboard with buttons
/positions: open trades
/strategy: tier rules now in use
/set or /settings: all settings with buttons
/reset: settings back to defaults
/auto on|off: let the bot buy by itself
/snipe on|off, /bigplay on|off: each strategy
/paper on|off: test mode (keep on)
/check ADDRESS: score a coin
/c $TICKER: coin chart
/sellall: sell every open coin
/panic: stop buying and sell everything
/wallet, /burners, /newburner: burner wallets
/export: back up the burner key (keep it private)
/withdraw: send SOL out
/profit, /sweep: profit sweep
/profitaddress (or /set profitAddress): I ask for your wallet address, you paste it. Public address only!
/set buyUsdMin 5 · /set buyUsdMax 10: trade size in $ (paper)
/cancel: stop typing a value
/skills: which trading skills are on and what they did`]};
const kb=cur=>{const k=new InlineKeyboard();Object.entries(SEC).forEach(([id,[t]],i)=>{k.text((id===cur?'• ':'')+t,'help:'+id);if(i%2)k.row()});return k;};
function install(bot){
 bot.command('help',c=>c.reply(SEC.start[1],{parse_mode:'HTML',reply_markup:kb('start')}));
 bot.callbackQuery(/^help:(\w+)$/,c=>{const s=SEC[c.match[1]];c.answerCallbackQuery();if(s)c.editMessageText(s[1],{parse_mode:'HTML',reply_markup:kb(c.match[1])}).catch(()=>{})});
 return bot.api.setMyCommands([['help','Beginner guide'],['skills','Trading skills on/off + impact'],['gpnl','PnL since test start or window (1h, 1d…)'],['wallet','Burner address & balance'],['settings','All settings'],['strategy','Tier rules'],['auto','Auto-buy on|off'],['snipe','Snipe strategy on|off'],['bigplay','Big Play strategy on|off'],['paper','Test mode on|off'],['check','Score a token'],['positions','Open trades'],['c','Coin chart: /c $TICKER'],['pnl','PnL summary · /pnl $TICKER card'],['stats','Stats & suggestions'],['profit','Profit sweep menu'],['sweep','Send profit now'],['profitaddress','Set the wallet that receives profit'],['sellall','Sell everything'],['panic','Stop + sell all'],['burners','List burners'],['newburner','New burner wallet'],['export','Back up key'],['withdraw','Send SOL out'],['set','Settings menu'],['reset','Reset settings to defaults'],['users','Approved users (owner)'],['adduser','Add a read-only user'],['removeuser','Remove a user']].map(([command,description])=>({command,description}))).catch(e=>console.log('setMyCommands',e.message));}
module.exports={install,SEC};
