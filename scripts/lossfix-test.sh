#!/bin/sh
set -e;SRC="$(cd "$(dirname "$0")/.." && pwd)";H=/tmp/sniper-harness-lf;rm -rf $H;mkdir -p $H
cp -r "$SRC/src" "$SRC/scripts" "$SRC/assets" "$SRC/package.json" $H/;cp -r "$SRC/data" $H/data;rm -f $H/data/bot.pid;ln -s "$SRC/node_modules" $H/node_modules
cd $H && env -u BOT_TOKEN -u TELEGRAM_BOT_TOKEN -u SNIPER_BOT_TOKEN -u TG_CLEANER_BOT_TOKEN timeout 120 node scripts/lossfix-test.js
