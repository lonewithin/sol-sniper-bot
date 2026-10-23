#!/bin/sh
# external watchdog: if data/heartbeat (written every 15s by the bot) is stale on two checks 60s apart, the node process is hung -> kill it; run.sh restarts it.
cd "$(dirname "$0")/.."
WP=data/watchdog.pid; o=$(cat $WP 2>/dev/null); [ -n "$o" ] && kill -0 "$o" 2>/dev/null && exit 0; echo $$ > $WP
stale=0; while true; do sleep 60; hb=data/heartbeat; [ -f "$hb" ] || continue
  age=$(( $(date +%s) - $(stat -c %Y "$hb") )); if [ "$age" -gt 120 ]; then stale=$((stale+1)); else stale=0; fi
  if [ "$stale" -ge 2 ]; then pid=$(cat data/bot.pid 2>/dev/null); echo "[watchdog] heartbeat stale ${age}s, killing hung bot pid $pid" >> sniper.log; [ -n "$pid" ] && grep -q 'src/index.js' /proc/$pid/cmdline 2>/dev/null && kill -9 "$pid"; stale=0; fi; done
