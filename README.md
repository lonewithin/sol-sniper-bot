# Sol Sniper Bot 🎯

Telegram bot for Solana that **scans new tokens**, gives each one a **safety score**, sends **alerts with quick-buy buttons**, and can **auto-snipe** with take-profit and stop-loss. It runs in **PAPER mode with auto-buy OFF by default.**

> ⚠️ **Risk warning:** No score can guarantee a token won't rug. Use a **fresh burner wallet with small funds only**. Never use your main wallets. Memecoin sniping usually loses money.

## Data sources (all free)
| Source | Use |
|---|---|
| PumpPortal websocket `wss://pumpportal.fun/api/data` | pump.fun migrations (new PumpSwap/Raydium pools) + optional new launches |
| DexScreener API (`token-profiles`, `token-boosts`, `tokens/v1`) | new tokens, liquidity, mcap, pool |
| Solana RPC (public or free Helius key) | mint/freeze authority, largest holders, sending txs |
| RugCheck API `api.rugcheck.xyz` | LP locked %, top holders, creator balance, risks |
| Jupiter `lite-api.jup.ag` | buy→sell quote (honeypot/tax test) and swaps |

## Safety score (starts at 100)
Mint authority not revoked −30 · freeze not revoked −30 · liquidity < $2k −25 / < $10k −10 · top-10 holders > 50% −25 / > 30% −10 · LP not locked −20 · dev > 10% −15 · round-trip sell loss > 30% −30 / > 12% −10 · no Jupiter route −25 · RugCheck rugged −100 · RugCheck danger risks −5 each · data unavailable −10/−15.

## Modes: `/set mode safe|fast`
- **safe** (default): it waits until the token is on DexScreener and Jupiter (about 20s after a migration). Then it runs the full safety score and potential score, picks a tier and buys through Jupiter.
- **fast** ⚡: it buys from the PumpPortal websocket event straight away, through the **PumpPortal trade-local API**. That API builds the transaction for the pump.fun bonding curve or PumpSwap, and the bot signs it locally, so the key never leaves your machine. PumpPortal charges a small fee per trade (check their site).
  - Before buying it only runs **instant checks**: dev initial buy ≤ `fastMaxDevPct`, a repeat-launch creator filter (`maxCreatorLaunches`, counted this session only), and mint/freeze authority for non-pump mints.
  - About `fastPostCheckSec` (8s) after buying, it runs the slow checks (RugCheck, DexScreener, Jupiter). If safety < `fastPostMinScore` it **sells straight away**.
  - It's held as a FAST tier position (SCALP-style TP/SL, max `fastMaxMin` minutes).
  - Turn on `fastMigrations` (default on) and/or `fastNewLaunches` (default off: very risky).
- Speed tricks:
  - Blockhash is cached and refreshed every 2s.
  - `skipPreflight` is on.
  - Transactions are sent in parallel to `RPC_URL` plus comma-separated `RPC_URLS`.
  - With `JITO_URL` (e.g. `https://mainnet.block-engine.jito.wtf`) and `/set jitoTipLamports 100000`, a tip transaction is also sent as a Jito bundle.
- Latency is logged to `data/latency.jsonl` (detect→build→signed→sent). `npm run fast-test` measures it in paper mode, with nothing sent.

## Potential & tiers (safe mode)
Potential score (0–100) = 5-minute buy/sell ratio + volume acceleration (5-minute vs 1-hour average) + 5-minute price change (penalised above +60%) + liquidity change + holder growth + activity + safety.

| Tier | Potential | Take-profit | Stop-loss | Trailing | Max hold | Buy size |
|---|---|---|---|---|---|---|
| SCALP | `potScalp` (35)+ | `scalpTp` +20% | `scalpSl` −12% | none | 4 min | ×0.6 |
| SWING | `potSwing` (55)+ | +50% | −20% | 15% | 15 min | ×1 |
| RUNNER | `potRunner` (75)+ | sells 50% at +50% | −25% | 20% on the rest | 30 min | ×1.5 |

- The bot re-checks every 10s and exits early if potential drops below `momentumExit` (20).
- Buy size scaling is set by `sizeByPotential` and is always capped by `maxPerTrade` and `maxDailySol`.
- `/strategy` shows the live rules. Every value can be changed with `/set`.

## Learning: logs, /stats, tune, replay
- `data/trades.jsonl` gets every closed trade. `data/observations.jsonl` gets every scanned token's features, plus its price change at +1, +5, +15 and +30 minutes.
- `/stats` shows win rate and average PnL by tier, safety bucket and potential bucket.
- `npm run tune` searches thresholds for the best simulated expectancy. It applies nothing unless `/set autotune on`, and even then only with 100+ observations.
- `npm run replay` runs the current rules over the logged observations offline. The simulation is coarse, because it only sees prices at those 4 checkpoints.

## Rotating burners
- Every burner is kept in one encrypted vault, `data/vault.enc` (AES-256-GCM).
- `/newburner` creates a new wallet, sweeps the SOL into it (and SPL tokens if `/set sweepTokens on`), and makes it active. The bot then DMs you the new key as a spoiler that **deletes after 60s**. **Save it offline.**
- Auto-rotate: `/set rotateEveryTrades 10` and/or `/set rotateDaily on`. It's skipped while live positions are open.
- `/burners` lists each burner's address, balance and trade count. `/export <n|all> CONFIRM` resends keys.
- In paper mode, rotating only creates the wallet and moves nothing.
- ⚠️ **Privacy:** rotation makes tracking harder but doesn't stop it. A sweep is an on-chain transfer, so it **links** the old and new wallet. For better separation, skip the sweep and fund each new burner manually from a different source (e.g. straight from an exchange withdrawal), then withdraw the old one elsewhere.

## Commands (owner only, set by `OWNER_ID`)
`/settings` `/set <key> <n>` (buySol, maxPerTrade, maxDailySol, minScore, slippageBps, priorityLamports, tpPct, slPct, trailingPct, maxOpen, minLiqUsd) · `/auto on|off` · `/paper on|off` · `/check <mint>` · `/positions` `/pnl` `/sellall` `/panic` · `/wallet` · `/burners` · `/newburner` · `/export [n|all] CONFIRM` · `/withdraw <addr> <amt|all>` · `/strategy` · `/stats` · `/set mode fast|safe`

Defaults: buy 0.02 SOL, max 0.1 SOL per trade, 0.2 SOL per day, TP 50%, SL 25%, max 3 open positions, min score 70.

## Wallet
- If `BURNER_PRIVATE_KEY` is empty, the bot **makes its own burner** on first run. It saves it encrypted (AES-256-GCM, scrypt) in `data/wallet.enc`. The passphrase is `WALLET_ENC_KEY`, or else a random one in `data/wallet.pass` (chmod 600). `data/` is gitignored.
- `/wallet` shows only the public address. `/export CONFIRM` (DM only) sends the key as a spoiler and deletes it after 60 seconds.
- Optional: put an existing burner's base58 key in `BURNER_PRIVATE_KEY` in `.env`. Never commit `.env`.

## Withdraw
`/withdraw <address> <amount|all>`: owner only. It checks the address, shows a Confirm/Cancel button, and for `all` keeps a small fee reserve. In paper mode it only replies with a message and sends nothing.

## Import the /export key into Phantom or Solflare
1. Send `/export CONFIRM` to the bot in a DM, tap the spoiler and copy the base58 key. The message deletes itself after 60 seconds.
2. **Phantom:** menu → Add / Connect Wallet → **Import Private Key** → name it "Burner" → paste → Import.
3. **Solflare:** Add wallet → **Import private key** (under "I already have a wallet" / Advanced) → paste → Continue.
4. Check that the address matches `/wallet`. Then clear your clipboard, and keep this burner apart from your main wallets.

## Run
```bash
npm install
cp .env.example .env   # fill BOT_TOKEN, OWNER_ID
npm run scan-test      # live scan + scores, no Telegram
npm run fast-test      # paper fast-path latency (builds+signs, never sends)
npm run tune; npm run replay
npm start
```

## Hosting (honest)
The bot needs a process that is **always on** (websocket plus position monitor), so Vercel serverless doesn't fit it.
- **Oracle Cloud Always Free VM:** truly free 24/7. Signup needs a card for verification but it isn't charged.
- **Google Cloud e2-micro free tier:** free 24/7 in some US regions, card required.
- **Fly.io / Railway / Render:** need a card or have small or expiring free credit. Render's free web services sleep, so they're unsuitable.
- **Your own PC or phone (Termux) or a spare machine:** free, but only runs while it's on.
- Use a free **Helius** RPC key (`RPC_URL`) for better speed. Pro-level sniping speed needs paid RPC.
