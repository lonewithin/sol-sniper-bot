#!/bin/sh
# Simulated multi-user test with fake users + fake prices, in a temp copy (never touches real data/, no network trades).
set -e; R=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d); cp -r "$R/src" "$R/package.json" "$T/"; ln -s "$R/node_modules" "$T/node_modules"; mkdir "$T/data"
for f in settings.json positions.json vault.enc wallet.pass; do [ -f "$R/data/$f" ] && cp "$R/data/$f" "$T/data/"; done; [ -f "$T/data/positions.json" ] || echo '{"open":[],"closed":[],"daily":{}}' > "$T/data/positions.json"
cp "$R/scripts/friends-test.js" "$T/t.js"; cd "$T" && node t.js; rm -rf "$T"
