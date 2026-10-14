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

## Commands (owner only, set by `OWNER_ID`)
`/settings` `/set <key> <n>` (buySol, maxPerTrade, maxDailySol, minScore, slippageBps, priorityLamports, tpPct, slPct, trailingPct, maxOpen, minLiqUsd) · `/auto on|off` · `/paper on|off` · `/check <mint>` · `/positions` `/pnl` `/sellall` `/panic` · `/wallet` · `/export CONFIRM`

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
npm start
```

## Hosting (honest)
The bot needs a process that is **always on** (websocket plus position monitor), so Vercel serverless doesn't fit it.
- **Oracle Cloud Always Free VM:** truly free 24/7. Signup needs a card for verification but it isn't charged.
- **Google Cloud e2-micro free tier:** free 24/7 in some US regions, card required.
- **Fly.io / Railway / Render:** need a card or have small or expiring free credit. Render's free web services sleep, so they're unsuitable.
- **Your own PC or phone (Termux) or a spare machine:** free, but only runs while it's on.
- Use a free **Helius** RPC key (`RPC_URL`) for better speed. Pro-level sniping speed needs paid RPC.
