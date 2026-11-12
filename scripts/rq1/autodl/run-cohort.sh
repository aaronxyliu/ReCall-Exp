#!/usr/bin/env bash
set -eu
# Preserve the original absolute paths and exact Node version for resume checks.
export PATH=/root/autodl-tmp/recall-tools/node-v24.15.0-linux-x64/bin:$PATH
cd '/Users/aaronxyliu/GitHub/ReCall Research/ReCall Exp'
root=${1:-results/rq1-autodl-first-accept-top3-26}
python3 -u scripts/rq1/run.py --endpoint http://127.0.0.1:11435 \
  --ast-first --ungated --retain-conflicts --top-k "${RECALL_TOP_K:-3}" \
  --priority-subject webpack/freeCodeCamp--freeCodeCamp \
  --output "$root" >> "$root/remote-dispatcher.log" 2>&1 &
driver=$!
printf '%s\n' "$driver" > "$root/remote-driver.pid"
while kill -0 "$driver" 2>/dev/null; do
  python3 scripts/rq1/report.py "$root" >> "$root/remote-reporter.log" 2>&1 || true
  date -u +%FT%TZ > "$root/remote-heartbeat.txt"
  sleep 30
done
wait "$driver"
python3 scripts/rq1/report.py "$root" >> "$root/remote-reporter.log" 2>&1
