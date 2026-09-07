#!/bin/sh
# Container liveness probe + last-resort watchdog for the PR-TOP backend.
#
# Docker only *marks* a container unhealthy; it never restarts it. In
# September 2026 the API process spent two days wedged at 100% CPU (GC
# thrashing after slow memory growth) while the container stayed "Up" and
# every /api/* request hung. This script closes that gap:
#
#   1. Probe the lightweight liveness route (no Stripe / network calls).
#   2. Count consecutive failures in /tmp (survives between probe runs).
#   3. After HEALTHCHECK_MAX_FAILURES misses, SIGKILL the node process. The
#      container's PID 1 is docker-init (compose `init: true`), so node is a
#      normal child and the kill is honoured; the container then exits and
#      `restart: unless-stopped` recreates it with the on-disk database.
#
# A freshly started process is never killed during HEALTHCHECK_START_GRACE
# seconds so a slow boot (knowledge-base reindex) cannot cause a crash loop.

PORT="${PORT:-3001}"
URL="http://127.0.0.1:${PORT}/api/health/live"
STATE_FILE="/tmp/healthcheck.failures"
MAX_FAILURES="${HEALTHCHECK_MAX_FAILURES:-4}"
START_GRACE="${HEALTHCHECK_START_GRACE:-300}"

if wget -q -T 8 -O /dev/null "$URL" 2>/dev/null; then
  rm -f "$STATE_FILE"
  exit 0
fi

failures=$(( $(cat "$STATE_FILE" 2>/dev/null || echo 0) + 1 ))
echo "$failures" > "$STATE_FILE"
echo "healthcheck: liveness probe failed ($failures/$MAX_FAILURES)"

if [ "$failures" -lt "$MAX_FAILURES" ]; then
  exit 1
fi

# Locate the node process by its exact command line. NOT `pgrep -f`: with
# `init: true` the PID 1 command line is "/sbin/docker-init -- node src/index.js",
# which also matches, and PID 1 ignores SIGKILL sent from inside the container.
node_pid=""
for d in /proc/[0-9]*; do
  pid="${d#/proc/}"
  [ "$pid" = "1" ] && continue
  # /proc/<pid>/cmdline is NUL-separated; turn every non-printable byte into a space
  cmd=$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null)
  case "$cmd" in
    "node src/index.js"*|*"/node src/index.js"*) node_pid="$pid"; break ;;
  esac
done
if [ -z "$node_pid" ]; then
  echo "healthcheck: node process not found, nothing to kill"
  exit 1
fi

# Process age in seconds: (system uptime) - (process start time in clock ticks / CLK_TCK)
sys_uptime=$(cut -d. -f1 /proc/uptime)
start_ticks=$(awk '{print $22}' "/proc/$node_pid/stat" 2>/dev/null || echo 0)
clk_tck=$(getconf CLK_TCK 2>/dev/null || echo 100)
age=$(( sys_uptime - start_ticks / clk_tck ))

if [ "$age" -lt "$START_GRACE" ]; then
  echo "healthcheck: process is ${age}s old (< ${START_GRACE}s grace), not killing yet"
  exit 1
fi

echo "healthcheck: backend unresponsive for $failures probes, killing pid $node_pid so the restart policy recreates the container"
rm -f "$STATE_FILE"
kill -9 "$node_pid"
exit 1
