# Running the sniper bot on Android (Termux)

Paper mode only. This guide contains **no secrets**. Never commit `.env`, keys, or the `data/` folder (they are in `.gitignore`).

## 1. Install Termux
Install **Termux from F-Droid** (the Play Store version is outdated). Also install **Termux:API** from F-Droid if you want wake-lock notifications.

## 2. Install the tools
```sh
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git
termux-setup-storage   # optional, allow storage access
```

## 3. Clone the private repo
The repo is private, so use a GitHub **fine-grained personal access token** with read access to this repo only. Type it in when git asks for the password. Don't put it in the URL or in any file.
```sh
git clone https://github.com/lonewithin/sol-sniper-bot.git
cd sol-sniper-bot
npm ci --omit=dev
```

## 4. Set environment variables (never committed)
Create `.env` in the project folder. It is git-ignored. Fill in your own values on the phone:
```sh
nano .env
```
```
BOT_TOKEN=your_telegram_bot_token
OWNER_ID=your_telegram_user_id
PAPER=true
RPC_URL=https://api.mainnet-beta.solana.com
# WALLET_ENC_KEY=...   only if you use the encrypted vault
```
Lock it down: `chmod 600 .env`. Never paste it in chat, screenshots, GitHub, or Drive.

## 5. Keep the phone awake
```sh
termux-wake-lock
```
This keeps the CPU running while the screen is off. Run `termux-wake-unlock` to release it.

## 6. Turn off battery optimisation
Android Settings → Apps → Termux → Battery → **Unrestricted** (or "Don't optimise").
Do the same for Termux:API. On Xiaomi, Samsung, Oppo and similar phones, also allow **Autostart** and lock Termux in the recent-apps screen.

## 7. Start it with the supervisor
`run.sh` restarts the bot if it ever exits:
```sh
chmod +x run.sh
nohup ./run.sh > sniper.log 2>&1 &
echo $! > run.pid
```
- Watch the log: `tail -f sniper.log`
- Stop it: `kill $(cat run.pid); pkill -f "node src/index.js"`
- Make sure only **one** copy runs: `pgrep -af "node src/index.js"` should show one line.

## 8. Update later
```sh
git pull && npm ci --omit=dev
kill $(cat run.pid); pkill -f "node src/index.js"; nohup ./run.sh > sniper.log 2>&1 & echo $! > run.pid
```

## VPS alternative (more reliable)
A small Linux VPS (1 vCPU / 1 GB) runs 24/7 without battery issues.
```sh
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
git clone https://github.com/lonewithin/sol-sniper-bot.git && cd sol-sniper-bot && npm ci --omit=dev
nano .env && chmod 600 .env       # same variables as above
sudo npm i -g pm2 && pm2 start ./run.sh --name sniper && pm2 save && pm2 startup
```
Logs: `pm2 logs sniper`. Keep `PAPER=true`.
