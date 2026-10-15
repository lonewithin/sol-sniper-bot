// Beginner-friendly /help with section buttons.
const {InlineKeyboard}=require('grammy');
const SEC={
start:['🚀 Getting started',`<b>What this bot does</b>
It watches for brand-new Solana tokens, gives each one a <b>safety score</b> (how likely it's a scam) and a <b>potential score</b> (how strong its momentum is), and alerts you. If you allow it, it can buy and sell on its own.

<b>Quick start (do these in order)</b>
1️⃣ /wallet: shows your bot's <b>burner wallet</b> address. Send it a SMALL amount of SOL (e.g. 0.3). Never use your main wallet.
2️⃣ /export CONFIRM: back up the burner key and save it offline (the message deletes itself after 60s).
3️⃣ <code>/set capital 0.3</code>: tell the bot how much SOL is your working money, so only profit above it gets swept.
4️⃣ Test first: /paper on (on by default) then /auto on. The bot "pretends" to trade with real prices and no real money.
5️⃣ Let it run for a day or more, then check /stats and /pnl.
6️⃣ Happy? /paper off to go LIVE. Panic? /panic sells everything and stops.

<b>Basic commands</b>
/start: say hi · /help: this guide · /settings: all current settings
/set: <b>tap-to-change settings menu</b> (categories → setting → quick picks, type a value, or reset to default)
/set &lt;name&gt; &lt;value&gt;: change one directly, e.g. <code>/set buySol 0.02</code>
/reset: put all settings back to defaults (keeps wallets, capital, profit address, history)`],
buy:['🛒 Buying',`/auto on|off: let the bot buy by itself. <i>Default: off</i>
/paper on|off: on = test mode, fake trades. off = LIVE, real SOL. <i>Default: on</i>
/check &lt;token address&gt;: score any token now, with Buy buttons
💲 <b>Coin lookup</b>: just send <code>$BONK</code>, <code>$&lt;address&gt;</code> or paste an address. You get a full card: price, mcap, liquidity, volume, changes, buys/sells, holders, age, safety (hard/soft reasons), potential + tier, whether the bot holds it, and buttons for links, Buy 0.02/0.05 (paper-safe) and Refresh. If several coins share a ticker, you pick from the top 3.
Alerts have <b>Buy 0.02 / Buy 0.05</b> buttons for a manual buy.

<b>Settings</b>
• <code>buySol</code>: SOL per buy. <i>0.02</i> · e.g. <code>/set buySol 0.03</code>
• <code>maxPerTrade</code>: hard limit per buy. <i>0.1</i>
• <code>maxDailySol</code>: most SOL it can spend per day. <i>0.2</i>
• <code>maxOpen</code>: most coins held at once. <i>3</i>
• <code>slippageBps</code>: allowed price slip (100 = 1%). <i>1500</i> (15%)
• <code>priorityLamports</code>: fee to get in faster. <i>100000</i> (0.0001 SOL)
• <code>sizeByPotential</code> on|off: buy more on stronger coins, still within limits. <i>on</i>
• <code>mode</code> safe|fast: <b>safe</b> waits for full checks (~20s). <b>fast</b> ⚡ buys instantly at launch/migration, checks after, and sells if it fails. <i>safe</i>
• <code>fastMigrations</code> on|off: fast-buy coins moving to PumpSwap. <i>on</i>
• <code>fastNewLaunches</code> on|off: fast-buy brand-new launches (very risky). <i>off</i>
• <code>jitoTipLamports</code>: optional Jito tip for speed. <i>0</i>`],
sell:['📈 Selling & tiers',`The bot picks a <b>tier</b> from the potential score:
• <b>SCALP</b> (≥ <code>potScalp</code> 42): quick in/out. Take profit +<code>scalpTp</code> 20%, stop loss −<code>scalpSl</code> 12%, max <code>scalpMaxMin</code> 4 min
• <b>SWING</b> (≥ <code>potSwing</code> 55): TP +<code>swingTp</code> 50%, SL −<code>swingSl</code> 18%, trailing <code>swingTrail</code> 15%, max <code>swingMaxMin</code> 15 min
• <b>RUNNER</b> (≥ <code>potRunner</code> 75): sells half at +<code>runnerPartialAt</code> 50%, trails the rest by <code>runnerTrail</code> 20%, SL −<code>runnerSl</code> 25%, max <code>runnerMaxMin</code> 30 min
• <code>momentumExit</code>: sell early if potential drops below this. <i>20</i>
• <code>fastMaxMin</code>: max hold for fast-mode buys. <i>5</i>
<i>Trailing</i> = it sells once the price falls that % from its highest point.
• <code>trailArmPct</code>: for SECOND/RUNNER/BIG the trailing stop only switches on after the coin is up this %. <i>30</i>
• <code>trailGraceMin</code>: …or after this many minutes. The normal stop loss still protects you meanwhile. <i>3</i>
• Trail size per strategy: <code>swingTrail</code> 15 · <code>runnerTrail</code> 20 · <code>secondChanceTrail</code> 20 · <code>bigTrail</code> 20
• After a partial take-profit, the stop moves to <b>breakeven</b>, so the rest can't turn into a loss.
Every sell message explains the exit in plain words.

/strategy: the live rules · /positions: what you hold
/sellall: sell everything · /panic: auto OFF + sell everything`],
safe:['🛡 Safety',`<b>Safety score (0–100)</b>. ⛔ <b>HARD</b> blockers (never bought, not even on a second chance): creator can mint, creator can freeze, can't sell (honeypot/no route), RugCheck says rugged. ⚠️ <b>soft</b> penalties lower the score only.
 takes points off for: the creator can still mint or freeze, tiny liquidity, a few wallets holding most coins, LP not locked, the dev holding a lot, can't sell back (honeypot), or flagged as rugged.
⚠️ No score can promise a coin won't rug.

• <code>minScore</code>: lowest safety score allowed to buy. <i>70</i>
• <code>minEntryPc5</code>: skip coins already falling more than this in the last 5 min (RUNNER exempt). <i>-5</i>
• <code>maxEntryPc5</code>: skip SCALP/SWING coins already up more than this in 5 min. <i>25</i>
• <code>runnerMaxEntryPc5</code>: RUNNER spike cap, skip RUNNER coins up more than this in 5 min (0=off). <i>40</i>
• <code>minEntryVol5m</code>: skip coins with under this much $ volume in the last 5 min. <i>1000</i>
• <code>minLiqUsd</code>: lowest liquidity in $ to buy or alert. <i>5000</i>
• <code>fastMaxDevPct</code>: fast mode skips if the dev bought more than this %. <i>10</i>
• <code>maxCreatorLaunches</code>: skip creators who launch many coins. <i>1</i>
• <code>fastPostMinScore</code>: fast-mode buys sell if the after-check is below this. <i>40</i>
• <code>fastPostCheckSec</code>: seconds after a fast buy to check. <i>8</i>
🔁 <b>Second chance</b>: if a coin it skipped later runs +<code>secondChanceGainPct</code> (50%) with strong buying, rising volume, enough liquidity, holders not falling, and NO hard blockers, it buys a smaller bag even if safety is below minScore. It exits RUNNER-style (sells half at +50%, trails the rest) with a tighter stop loss.
• <code>secondChance</code> on|off. <i>on</i>
• <code>secondChanceMinScore</code>: lowest safety allowed. <i>45</i>
• <code>secondChanceSize</code>: × normal buy size. <i>0.5</i>
• <code>secondChanceSl</code>: stop loss %. <i>15</i>
• <code>secondChanceGainPct</code>: how much it must have run since the skip. <i>50</i>
• <code>secondChanceMinRatio</code>: min buys÷sells in the last 5 min. <i>1.3</i>
• <code>alerts</code> all|trades|score|off: <b>trades</b> = only tell me about coins it buys, <b>score</b> = coins that pass safety + potential, <b>all</b> = everything it checks. <i>trades</i> · e.g. <code>/set alerts score</code>
Only YOUR Telegram account can control this bot.`],
wallet:['👛 Wallets & burners',`A <b>burner</b> is a throwaway wallet only this bot uses. Keep small amounts in it.
/wallet: active burner address + balance
/burners: all burners with balances
/newburner: make a new burner, move SOL into it, DM you its key (deletes in 60s)
/export CONFIRM: back up the active key · <code>/export 2 CONFIRM</code> or <code>/export all CONFIRM</code>
/withdraw &lt;address&gt; &lt;amount|all&gt;: send SOL out (asks you to confirm)
• <code>rotateEveryTrades</code>: new burner every N trades (0 = off). <i>0</i>
• <code>rotateDaily</code> on|off: new burner every day. <i>off</i>
• <code>sweepTokens</code> on|off: also move tokens when rotating. <i>off</i>
Import a key into Phantom: Add wallet → Import Private Key → paste.
Note: moving SOL between burners links them on-chain.`],
profit:['💰 Profit',`Every night at 23:55 WAT the bot can send profit (balance minus your capital) to your profit wallet.
/profit: menu with mode, address, today's PnL, and [Switch Auto/Manual] [Send now] buttons
/sweep: send profit now (asks to confirm)
• <code>capital</code>: your working money. It's never swept. <b>Must be set</b>, e.g. <code>/set capital 0.3</code>. <i>0</i>
• <code>profitAddress</code>: where profit goes. <i>3mvv…LWx1MR</i>
• <code>autoSweep</code> on|off: on = sends nightly, off = just reminds you. <i>on</i>
• <code>profitReserveSol</code>: SOL kept for fees. <i>0.003</i>
A preview is always shown first. In test mode nothing is sent.`],
win:['🏆 Win-rate rules',`<b>Extra filters on every strategy</b> (change in /set → Win rate)
• <code>confirmSec</code>: after a fresh snipe signal, wait this long and buy only if ≥ <code>confirmMinBuys</code> new buys came in, price fell no more than <code>confirmMaxDropPct</code>% and 5m buys ≥ sells. <i>90 · 3 · 10</i>
• <code>holderCheck</code>: skip if top 10 holders (pool excluded) own more than <code>maxTop10Pct</code>% or the dev owns more than <code>maxDevHoldPct</code>%. Sniper, second chance and Big Play. <i>on · 30 · 10</i>
• <code>earlyTpAt</code> / <code>earlyTpPct</code>: sniper + second chance sell <code>earlyTpPct</code>% at +<code>earlyTpAt</code>%, then the rest has a breakeven stop. <i>25 · 35</i>
• Sizes: <code>runnerSize</code> 1.5×, <code>swingSize</code> 0.8×, <code>scalpSize</code> 0.4× of buySol. SCALP also needs 5m buys÷sells ≥ <code>scalpMinRatio</code> <i>1.5</i>
• <code>lossStreakN</code> / <code>lossPauseMin</code>: after 3 losses in a row, snipe + second chance pause 30 min. <i>3 · 30</i>
• <code>paperCostPct</code>: paper sells lose this % plus the priority fee, so test PnL is realistic. <i>1.5</i>
Trades are tagged with a version (<code>ver</code>) so before/after can be compared.`],
sig:['📡 Signals',`<b>Extra signals</b> (change in /set → Signals; /reset restores these)
• <code>smartWallets</code>: the bot learns wallets that bought early in past winners (our wins + missed 2x pumps), saved in data/smartwallets.json, and watches them. When ≥ <code>smartMinWallets</code> buy the same coin within <code>smartWindowMin</code> min, potential +<code>smartBoost</code> and Big Play checks it. <i>on · 2 · 30 · 15</i>
• <code>trending</code>: coins on DexScreener's top/latest boosts get potential +<code>trendBoost</code> (safety rules still apply) and are fed to Big Play. <i>on · 10</i>
• <code>todFilter</code>: tracks profit by WAT hour. Once an hour has ≥ <code>todMinTrades</code> trades and is losing (win &lt; 40%, PnL &lt; 0), buys are sized × <code>todLosingSize</code>. Until then it only logs. <i>on · 5 · 0.5</i>
• <code>autoTune</code>: at 00:30 WAT it reviews the last 24h per tier and moves stop-loss / take-profit by at most 10% toward what worked, inside hard limits, then messages you. Paper mode only. <i>on</i>`],
big:['🐋 Big Play',
`<b>Two strategies</b>, each with its own on/off:
/snipe on|off: 🎯 fast hunting of brand-new coins (minutes). <i>on</i>
/bigplay on|off: 🐋 established coins with real traction, held for hours. <i>on</i>
Both also need /auto on. /settings has buttons for both.

<b>How Big Play picks coins</b>: trending/boosted DexScreener coins with market cap between <code>bigMinMcap</code> ($100k) and <code>bigMaxMcap</code> ($20M), liquidity ≥ <code>bigMinLiq</code> ($50k), age ≥ <code>bigMinAgeH</code> (1h), 1h volume above the 6h average, buys÷sells ≥ <code>bigMinRatio</code> (1.2), holders growing, safety ≥ <code>bigMinScore</code> (60), no ⛔ hard blockers. It enters on <b>momentum</b> (going up now) or a <b>pullback</b> (big 6h run, small 1h dip).
<b>Selling</b>: sells half at +<code>bigPartialAt</code> 50%, trails the rest by <code>bigTrail</code> 20%, stop loss −<code>bigSl</code> 25%. If it never peaks +<code>bigFlatPct</code> 5% within <code>bigFlatMin</code> 50 min, or it peaks a little then falls back under +<code>bigGaveBackPct</code> 2%, it exits to free the budget. Checks every <code>bigPollSec</code> 45s.
<b>Budget</b> (fixed amounts you set, any size): <code>bigBuySol</code> 0.05 SOL per trade · <code>bigMaxDailySol</code> 0.3 SOL/day · <code>bigMaxOpen</code> 3 · scan every <code>bigScanMin</code> 5 min. Change with /set bigBuySol 0.5 etc.\n<b>Riding winners</b>: after <code>bigBaseHoldH</code> 4h, if it's still above its trailing stop and the 1h trend is up, the hold extends by <code>bigExtendH</code> 2h at a time, up to <code>bigMaxHoldH</code> 24h.
/stats → 🐋 Big Play page.`],
 test:['🧪 Testing & stats',`/pnl: PnL today / 7d / all time, by strategy, open (unrealised), best/worst, paper vs live, plus an equity-curve chart
<code>/pnl $TICKER</code>: shareable PROM card: move since the bot first scanned it, plus entry/exit/PnL if it aped
<code>/c $TICKER</code> (or mint / DexScreener link): candle chart image with 5m/15m/1h/4h buttons, price, mcap, liq, changes and our position
/stats: dashboard with buttons. <b>Overview</b> (today/all-time, win rate bar, PnL), <b>Hunting</b> (sources, skip reasons, speed), <b>Trades</b> (by tier, best/worst, last 5), <b>Wallet</b> (balance, capital, profit, open positions)
/positions: open trades
👀 <b>Missed pumps</b>: the bot keeps watching coins it skipped (up to 6h) and tells you if one goes 2x / 5x / 10x, with why it skipped it. See /stats → Missed for skip accuracy.
• <code>missedAlerts</code> on|off: send missed-pump alerts. <i>on</i>
• <code>missedAlertPct</code>: first alert at this % gain. <i>100</i> (= 2x)
It only counts a real market: mcap ≥ <code>missedMinMcap</code> $10k, liquidity ≥ <code>missedMinLiq</code> $5k (bonding-curve coins use mcap + volume), volume ≥ <code>missedMinVol5m</code> $200/5m or <code>missedMinVol1h</code> $2k/1h. The price is measured on one pool, and the start price only counts from a pool with ≥ <code>missedBaseLiq</code> $1k liquidity. Second-chance buys use the same check.
• <code>autotune</code> on|off: auto-apply the suggested settings once there's enough data (100+ coins). <i>off</i>
• <code>trailingPct</code>: extra trailing stop for any trade (0 = off). <i>0</i>
Tip: run in test mode (/paper on) for a few days, check /stats, adjust with /set, THEN go live.`]};
const kb=cur=>{const k=new InlineKeyboard();Object.entries(SEC).forEach(([id,[t]],i)=>{k.text((id===cur?'• ':'')+t,'help:'+id);if(i%2)k.row()});return k;};
function install(bot){
 bot.command('help',c=>c.reply(SEC.start[1],{parse_mode:'HTML',reply_markup:kb('start')}));
 bot.callbackQuery(/^help:(\w+)$/,c=>{const s=SEC[c.match[1]];c.answerCallbackQuery();if(s)c.editMessageText(s[1],{parse_mode:'HTML',reply_markup:kb(c.match[1])}).catch(()=>{})});
 return bot.api.setMyCommands([['help','Beginner guide'],['wallet','Burner address & balance'],['settings','All settings'],['strategy','Tier rules'],['auto','Auto-buy on|off'],['snipe','Snipe strategy on|off'],['bigplay','Big Play strategy on|off'],['paper','Test mode on|off'],['check','Score a token'],['positions','Open trades'],['c','Coin chart: /c $TICKER'],['pnl','PnL summary · /pnl $TICKER card'],['stats','Stats & suggestions'],['profit','Profit sweep menu'],['sweep','Send profit now'],['sellall','Sell everything'],['panic','Stop + sell all'],['burners','List burners'],['newburner','New burner wallet'],['export','Back up key'],['withdraw','Send SOL out'],['set','Settings menu'],['reset','Reset settings to defaults']].map(([command,description])=>({command,description}))).catch(e=>console.log('setMyCommands',e.message));}
module.exports={install,SEC};
