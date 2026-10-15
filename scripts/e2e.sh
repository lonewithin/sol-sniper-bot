#!/bin/sh
# Runs scripts/e2e-harness.js against a throwaway copy of src + data (live bot data is never touched, no Telegram traffic).
set -e;SRC="$(cd "$(dirname "$0")/.." && pwd)";H=/tmp/sniper-harness;rm -rf $H;mkdir -p $H
cp -r "$SRC/src" "$SRC/scripts" "$SRC/package.json" $H/;cp -r "$SRC/data" $H/data;rm -f $H/data/bot.pid;ln -s "$SRC/node_modules" $H/node_modules
cd $H && env -u BOT_TOKEN -u TELEGRAM_BOT_TOKEN -u SNIPER_BOT_TOKEN -u TG_CLEANER_BOT_TOKEN timeout 600 node scripts/e2e-harness.js "$@"
