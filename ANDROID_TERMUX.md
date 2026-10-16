# Running the sniper bot on Android with PROM Terminal

This guide uses your own app, **PROM Terminal** (github.com/lonewithin/prom-termux). It works like Termux and adds a `prom-setup` command.
It contains **no secrets**. Never commit or share `.env`, keys, `vault.enc`, `wallet.pass` or the `data/` folder.
Keep **PAPER=true**.

> ⚠️ **Only one copy of the bot may run per bot token.** The bot is currently running on the PROM box (the cloud machine). Stop that copy *before* starting it on the phone, or both will fight and show `409 Conflict` (see Troubleshooting).

---

## 1. Back up and remove official Termux
PROM Terminal uses the same package name (`com.termux`), so it can't be installed next to official Termux.

In official Termux, if you have anything to keep:
```sh
termux-setup-storage
tar -czf /sdcard/termux-home-backup.tgz -C ~ .
```
Then uninstall: Android Settings → Apps → Termux → **Uninstall**. Also uninstall Termux:API, Termux:Boot and similar add-ons from the old source, because their signatures won't match.

## 2. Install PROM Terminal
Install the PROM Terminal APK from your prom-termux build (GitHub Actions artifacts or Releases). Open it once and let it finish setting up.

## 3. Run prom-setup
```sh
prom-setup
```
- Answer **Y** to install git, nodejs, python and openssh.
- Answer **y** to clone `sol-sniper-bot` into `~/sol-sniper-bot`. The repo is private, so for the password use a **GitHub fine-grained token** with read-only access to this one repo (see Troubleshooting → git auth).
- prom-setup **never starts trading**. It only installs tools and clones the repo.

Then:
```sh
cd ~/sol-sniper-bot
npm install --omit=dev
```

## 4. Create `.env` (never committed)
```sh
cd ~/sol-sniper-bot
nano .env
```
Type your own values:
```
BOT_TOKEN=your_telegram_bot_token
OWNER_ID=your_numeric_telegram_id
PAPER=true
RPC_URL=https://api.mainnet-beta.solana.com
```
```sh
chmod 600 .env
```
`.env` is in `.gitignore`, so `git add` won't pick it up.

## 5. Restore the data folder (optional, keeps history and the burner)
If you have a backup of `data/` (trades, settings, users, encrypted burner), copy it into `~/sol-sniper-bot/data/`:
```sh
termux-setup-storage
mkdir -p ~/sol-sniper-bot/data
tar -xzf /sdcard/Download/sniper-data-backup.tgz -C ~/sol-sniper-bot/data
chmod 700 ~/sol-sniper-bot/data
```
Without a backup, the bot starts fresh with a new paper burner.

## 6. Stop the box copy, then start on the phone
1. Ask PROM/Grok Bot to **stop the bot on the box** and wait until it confirms.
2. On the phone:
```sh
cd ~/sol-sniper-bot
termux-wake-lock
chmod +x run.sh
nohup ./run.sh > sniper.log 2>&1 &
echo $! > run.pid
tail -f sniper.log          # Ctrl+C stops watching, not the bot
```
Check that exactly one copy is running:
```sh
pgrep -af "node src/index.js"
```

## 7. Stop it
```sh
cd ~/sol-sniper-bot
kill $(cat run.pid) 2>/dev/null; pkill -f "node src/index.js"
termux-wake-unlock
```

## 8. Keep it alive (battery)
- Android Settings → Apps → **PROM Terminal** → Battery → **Unrestricted** / "Don't optimise".
- On Xiaomi, Samsung, Oppo, Vivo or Tecno/Infinix phones, also turn on **Autostart**, allow background activity, and lock the app in the recent-apps screen (padlock icon).
- Keep the PROM Terminal notification. Pulling it down and tapping **Acquire wakelock** does the same as `termux-wake-lock`.

## 9. Update to the latest version
```sh
cd ~/sol-sniper-bot
git pull
npm install --omit=dev
kill $(cat run.pid) 2>/dev/null; pkill -f "node src/index.js"; sleep 2
nohup ./run.sh > sniper.log 2>&1 & echo $! > run.pid
```

## Users
Adding people is done **inside the bot**, so no PROM Terminal or `.env` work is needed.
When someone new messages the bot, you get **Accept / Deny** buttons. You can also use `/users`, `/adduser ID` and `/removeuser ID`.
Approved users can only *view* (/help /gpnl /pnl /stats /positions /strategy /check /c). Only you (OWNER_ID) can change settings, wallets, export or trade. The list is saved in `data/users.json`.

---

## Troubleshooting

### The bot doesn't reply
```sh
cd ~/sol-sniper-bot
pgrep -af "run.sh|node src/index.js"     # is it running? should be one of each
tail -n 50 sniper.log                    # last errors
```
- **Nothing running:** start it again (step 6).
- **`409 Conflict: terminated by other getUpdates request`:** two copies are running with the same token, probably the box *and* the phone, or two copies on the phone. Stop the box copy (ask Grok Bot), then on the phone:
  ```sh
  pkill -f run.sh; pkill -f "node src/index.js"; sleep 3
  nohup ./run.sh > sniper.log 2>&1 & echo $! > run.pid
  ```
- **`Set BOT_TOKEN and OWNER_ID in .env`:** `.env` is missing or misnamed. Check with `ls -la .env`, and show the variable names only, never the values: `cut -d= -f1 .env`
- **`401 Unauthorized` / `404 Not Found` from Telegram:** the bot token is wrong or was revoked. Get it again from @BotFather and fix `.env`.
- **The bot ignores you:** OWNER_ID must be *your* numeric id (ask @userinfobot), not your @username.

### npm install errors
```sh
pkg update && pkg upgrade -y
pkg install -y nodejs python make clang binutils pkg-config
cd ~/sol-sniper-bot && rm -rf node_modules && npm cache clean --force && npm install --omit=dev
```
- `gyp ERR!` or `node-gyp`: the build tools are missing; the line above installs them.
- `EACCES` / `permission denied`: don't use `sudo` (it doesn't exist here). Run `chmod -R u+rw ~/sol-sniper-bot`
- Out of space: `pkg clean && npm cache clean --force`

### git auth failures
- GitHub doesn't accept account passwords. Make a **fine-grained token**: GitHub → Settings → Developer settings → Fine-grained tokens. Allow repository `sol-sniper-bot`, with **Contents: Read-only**.
- Clone again and paste the token when git asks for the password:
  ```sh
  git clone https://github.com/lonewithin/sol-sniper-bot ~/sol-sniper-bot
  ```
- Don't put the token in the URL or in any file. To skip retyping on `git pull`, use SSH instead:
  ```sh
  ssh-keygen -t ed25519 -C phone && cat ~/.ssh/id_ed25519.pub   # add as a read-only Deploy key on the repo
  git -C ~/sol-sniper-bot remote set-url origin git@github.com:lonewithin/sol-sniper-bot.git
  ```

### Battery or Android keeps killing it
- Run `termux-wake-lock` every time you start it.
- Set battery to **Unrestricted** and turn on Autostart (step 8).
- Don't swipe PROM Terminal away from recent apps.
- If it still dies, run it on a VPS (below).

### Network or RPC 429 errors
- `429 Too Many Requests` in the log is the public Solana RPC or DexScreener limiting you. The bot retries by itself.
- If it happens constantly, put a free RPC key (Helius, QuickNode, etc.) in `.env` as `RPC_URL=...`. Keep that URL secret.
- Mobile data or flaky Wi-Fi: check `ping -c 3 api.telegram.org`

### Permission errors
```sh
chmod +x ~/sol-sniper-bot/run.sh
chmod 600 ~/sol-sniper-bot/.env
chmod 700 ~/sol-sniper-bot/data
termux-setup-storage      # needed only to read backups in /sdcard
```

### Wrong clock
Times and daily stats depend on the phone clock. Turn on Settings → Date and time → **Automatic**. Check with:
```sh
date
```
The bot reports in WAT (UTC+1).

### Restore or back up the data folder
Back up:
```sh
tar -czf /sdcard/Download/sniper-data-backup.tgz -C ~/sol-sniper-bot/data .
```
Restore (stop the bot first):
```sh
pkill -f run.sh; pkill -f "node src/index.js"
tar -xzf /sdcard/Download/sniper-data-backup.tgz -C ~/sol-sniper-bot/data
```
The backup contains the encrypted burner. Keep it private and never upload it to GitHub or Drive.

---

## VPS alternative (24/7, no battery issues)
A small Ubuntu VPS (1 vCPU, 1 GB):
```sh
sudo apt update && sudo apt install -y git curl build-essential python3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
git clone https://github.com/lonewithin/sol-sniper-bot.git && cd sol-sniper-bot && npm install --omit=dev
nano .env && chmod 600 .env          # same variables as step 4, PAPER=true
sudo npm i -g pm2 && pm2 start ./run.sh --name sniper && pm2 save && pm2 startup
pm2 logs sniper
```
The one-copy rule still applies: stop the box and phone copies before starting it on a VPS.
