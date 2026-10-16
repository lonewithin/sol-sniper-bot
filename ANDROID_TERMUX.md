# Run the sniper bot on your phone (PROM Terminal)

Do one step at a time.
Type exactly what is in the box, then press Enter.
Never share your bot token or your .env file with anyone.
The bot stays in **paper mode** (fake money).

---

## Step 1. Save your old Termux files (only if you had Termux before)

Type this:
```
tar -czf /sdcard/termux-backup.tgz -C ~ .
```
You should see: nothing. It just goes back to a new line.

If it says `Permission denied` or `No such file`, type this, tap **Allow**, then do Step 1 again:
```
termux-setup-storage
```

Now delete the old Termux app:
Phone **Settings → Apps → Termux → Uninstall**.
Delete any **Termux:API** or **Termux:Boot** apps the same way.

---

## Step 2. Install PROM Terminal

Install the PROM Terminal app file (APK). Open it and wait until you see a `$` sign.

If it says **App not installed**, the old Termux is still on the phone. Uninstall it (Step 1), then try again.

---

## Step 3. Install the tools

Type this:
```
prom-setup
```
You should see: `Continue? [Y/n]`. Type `Y` and press Enter.
Wait. It takes a few minutes.
Then you see: `Clone lonewithin/sol-sniper-bot ...? [y/N]`. Type `y` and press Enter.

It asks for `Username`. Type: `lonewithin`
It asks for `Password`. Paste your **GitHub token** (not your GitHub password). You won't see it as you paste. That's normal.

You should see: `Done.`

If it says `command not found: prom-setup`, type this:
```
pkg update -y && pkg install -y git nodejs python openssh
```

If it says `Authentication failed` or `Invalid username or password`:
your token is wrong or expired. Make a new one on GitHub:
**Settings → Developer settings → Fine-grained tokens → Generate**. Pick repo **sol-sniper-bot**, then **Contents: Read-only**. Then type this:
```
git clone https://github.com/lonewithin/sol-sniper-bot ~/sol-sniper-bot
```

If it says `Permission denied (publickey)`, you used an SSH link. Use the https link above instead.

If it says `already exists, skipping`, that's fine. Go to Step 4.

---

## Step 4. Go into the bot folder

Type this:
```
cd ~/sol-sniper-bot
```
You should see: the line now shows `sol-sniper-bot`.

If it says `No such file or directory`, the download didn't work. Do Step 3 again.

---

## Step 5. Install what the bot needs

Type this:
```
npm install --omit=dev
```
You should see: `added ... packages` at the end.

If it says `command not found: node` or `command not found: npm`, type this:
```
pkg install -y nodejs
```

If it says `npm ERR! gyp` or `node-gyp`, type this, then do Step 5 again:
```
pkg install -y python make clang binutils pkg-config
```

If it says `ETIMEDOUT` or `network`, your internet dropped. Turn Wi-Fi or data off and on, then do Step 5 again.

---

## Step 6. Put in your bot details

Type this:
```
nano .env
```
You should see: an empty white page.

Type these 4 lines with **your own** token and id:
```
BOT_TOKEN=paste_your_bot_token_here
OWNER_ID=your_number_id_here
PAPER=true
RPC_URL=https://api.mainnet-beta.solana.com
```
Save: press **Ctrl + O**, then **Enter**, then **Ctrl + X**.
(Ctrl is on the extra keys row above the keyboard.)

Your bot token is in **@BotFather**. Your number id is in **@userinfobot**.

Then type this:
```
chmod 600 .env
```
You should see: nothing. That's good.

---

## Step 7. Stop the bot on the computer first ⚠️

Send this to Grok Bot in chat:
**"Stop the sniper bot on the computer, I'm starting it on my phone."**

Wait until Grok Bot says it's stopped.
If both run at the same time, the bot breaks (`409 Conflict`).

---

## Step 8. Keep the phone awake

Type this:
```
termux-wake-lock
```
You should see: nothing, or a note in your notification bar.

Also do this once:
Phone **Settings → Apps → PROM Terminal → Battery → Unrestricted**.
On Xiaomi, Tecno, Infinix, Samsung or Oppo, also turn on **Autostart**.

---

## Step 9. Start the bot

Type this:
```
nohup ./run.sh > sniper.log 2>&1 &
```
You should see: something like `[1] 12345`.

If it says `Permission denied`, type this, then do Step 9 again:
```
chmod +x run.sh
```

---

## Step 10. Check it's working

Type this:
```
tail -n 20 sniper.log
```
You should see: `mode: PAPER | auto: true`, and lines like `[BIG] scan:`.
Now send **/help** to your bot in Telegram. It should answer.

If it says `Set BOT_TOKEN and OWNER_ID in .env` or `No such file .env`, do Step 6 again. Make sure you're in the bot folder (Step 4).

If it says `401 Unauthorized` or `404 Not Found`, your bot token is wrong. Copy it again from @BotFather and do Step 6 again.

If it says `409 Conflict`, the bot is also running somewhere else. Do Step 7, then type this:
```
pkill -f run.sh; pkill -f "node src/index.js"
```
Then do Step 9 again.

If it says `429` or `ETIMEDOUT`, the internet or the free price server is busy. Wait 5 minutes. The bot tries again by itself.

**If the bot doesn't reply in Telegram:**
- Check that OWNER_ID is your **number**, not your @name.
- Type this to see if it's running:
```
pgrep -af "node src/index.js"
```
You should see: one line. If you see nothing, do Step 9 again.
If you see two lines, type the `pkill` line above, then do Step 9 again.

---

## Stop the bot

Type this:
```
pkill -f run.sh; pkill -f "node src/index.js"
```
You should see: nothing. The bot is now off.

---

## Update the bot to the newest version

Type this:
```
cd ~/sol-sniper-bot && git pull
```
You should see: `Updating ...` or `Already up to date.`

If it says `Authentication failed`, paste your GitHub token again (see Step 3).

Then type this:
```
npm install --omit=dev
```
Then stop the bot (see above), and start it again (Step 9).

---

## Add people to the bot

You don't need the phone terminal for this. It's all done in Telegram.
- When someone new messages your bot, you get **Accept** and **Deny** buttons.
- `/users` shows who has access.
- `/adduser 123456789` adds someone by their number id.
- `/removeuser 123456789` removes them.

Added people can only look (/help /gpnl /pnl /stats /positions /strategy /check /c).
Only you can change settings, wallets or trades.

---

## Other problems

**The bot stops when the screen is off:** do Step 8 again. Don't swipe PROM Terminal away from recent apps.

**Times look wrong:** turn on Phone **Settings → Date & time → Automatic**.

**Back up your bot data** (trades, users, wallet):
```
tar -czf /sdcard/Download/sniper-data-backup.tgz -C ~/sol-sniper-bot/data .
```

**Put the backup back** (stop the bot first):
```
tar -xzf /sdcard/Download/sniper-data-backup.tgz -C ~/sol-sniper-bot/data
```
Keep this backup private. Never upload it to GitHub or Drive.
