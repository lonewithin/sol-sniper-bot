#!/bin/sh
# keeps the bot alive: restarts it if it ever exits
cd "$(dirname "$0")"
# Secrets arrive as SNIPER_BOT_TOKEN from the agent host; map to what the bot reads.
[ -n "$SNIPER_BOT_TOKEN" ] && [ -z "$BOT_TOKEN" ] && export BOT_TOKEN="$SNIPER_BOT_TOKEN"
[ -z "$OWNER_ID" ] && export OWNER_ID=6360092082
[ -z "$PAPER" ] && export PAPER=true
nohup sh scripts/watchdog.sh >/dev/null 2>&1 &  # hang watchdog (single instance)
while true; do
  node src/index.js
  ec=$?
  echo "[supervisor] bot exited code=$ec, restarting in 5s"
  sleep 5
done
