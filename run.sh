#!/bin/sh
# keeps the bot alive: restarts it if it ever exits
cd "$(dirname "$0")"
while true; do
  node src/index.js
  ec=$?
  echo "[supervisor] bot exited code=$ec, restarting in 5s"
  sleep 5
done
