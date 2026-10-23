# fixV5 — stop-loss / entry / reliability fixes (paper mode)

**Restart:** 2026-10-23 21:59:41 WAT (first restart 21:56:31 WAT, final restart with throttle tweak 21:59:41 WAT). History/stats kept (no wipe).
**Baseline before (Oct 22 21:35 WAT → Oct 23 21:56 WAT):** 32 closed, 5 wins (16%), −0.53 SOL. Runner 6/1 −0.21, Swing 5/2 −0.03, Moonbag 8/1 −0.21 (all 8 opened before the Oct 23 08:52 pause), Big Play 13/1 −0.08.
Compare future reports against trades with `closed` after the restart time above.
Backup of pre-change code+data: /workspace/sol-sniper-bot-backup-20261023-2146

## Root causes found
- CLAW (−100%) and YouTube (−92%) gapped through the −15% stop while the **whole box was suspended/asleep** (log: "loop was frozen" 5–124 min; box uptime restarted 15:10 WAT). No code can sell while the machine is off; on resume the first check now sells immediately.
- Guard poll bug: the 2s DexScreener guard measured price change from the **first price it saw**, not the entry price, so a coin that crashed before/while the guard was down never tripped the stop. Fixed: measured from entry price.
- Open-position quotes waited in the same Jupiter queue as new-coin scoring (could be many seconds/minutes). Fixed: monitor uses a separate fast path, falls back to DexScreener price instead of waiting.

## Changes
1. Stops: hard loss cap (−25%, or the mode's SL if wider) in both the 5s monitor and 2s guard; rug exit when pool liquidity < $1,500 or falls >60% vs entry (paper books payout scaled by liquidity left); "no pair" warning; monitor pass timeout 60s + stuck-lock release.
2. Entry quality: 90s confirm now also fails if liquidity dropped >15% (LP pull) and, for Runner, if dev holds >5% while 5m sells ≥80% of buys.
3. Filters: thin-pool / low-liq coins (liq ≥ $8k, safety ≥ 90, buy/sell ≥ 1.5, volume rising, no hard flags) can enter at **half size** instead of being blocked. Spike skips are re-checked every 3 min (4×); buy at half size only after a 10–40% cool-off from the spike high with buy/sell ≥ 1.2.
4. Moonbag stays paused (moon:false re-asserted). Big Play sizing unchanged.
5. Reliability: RPC rotation (RPC_URL, RPC_URLS, publicnode, mainnet-beta) with backoff on 429/timeout; in-bot watchdog (monitor stalled 4 min → exit & auto-restart; no new coins 15 min → scanner restart; clock-jump aware); external scripts/watchdog.sh kills a hung process if heartbeat is stale 2×60s.
All new settings are in data/settings.json (fixV5 migration) and can be tuned/reverted there.
