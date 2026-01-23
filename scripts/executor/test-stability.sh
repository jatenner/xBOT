#!/bin/bash
# 15-minute stability test for executor daemon

set -e

cd "$(dirname "$0")/../.."
RUNNER_PROFILE_DIR="${RUNNER_PROFILE_DIR:-./.runner-profile}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🧪 EXECUTOR STABILITY TEST (15 minutes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ensure Chrome is running with CDP
echo "📋 Step 1: Checking CDP..."
if ! curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
  echo "❌ CDP not running. Launch Chrome first:"
  echo "   RUNNER_PROFILE_DIR=$RUNNER_PROFILE_DIR pnpm tsx scripts/runner/chrome-cdp.ts"
  exit 1
fi
echo "✅ CDP is running"

# Check managed PID file
if [ -f "$RUNNER_PROFILE_DIR/cdp_chrome_pids.json" ]; then
  echo "✅ Managed PID file exists"
  cat "$RUNNER_PROFILE_DIR/cdp_chrome_pids.json"
else
  echo "⚠️  Managed PID file not found (Chrome may have been launched manually)"
fi

echo ""
echo "📋 Step 2: Starting executor daemon..."
echo "   Duration: 15 minutes"
echo "   Logs: /tmp/executor_stability_test.log"
echo ""

# Start daemon in background
EXECUTION_MODE=executor \
RUNNER_MODE=true \
RUNNER_BROWSER=cdp \
RUNNER_PROFILE_DIR="$RUNNER_PROFILE_DIR" \
SAFETY_NO_KILL=true \
pnpm run executor:daemon > /tmp/executor_stability_test.log 2>&1 &
DAEMON_PID=$!

echo "✅ Daemon started (PID: $DAEMON_PID)"
echo ""

# Monitor for 15 minutes (900 seconds)
echo "📊 Monitoring for 15 minutes..."
START_TIME=$(date +%s)
END_TIME=$((START_TIME + 900))

while [ $(date +%s) -lt $END_TIME ]; do
  sleep 30
  ELAPSED=$(( $(date +%s) - START_TIME ))
  MINUTES=$(( ELAPSED / 60 ))
  SECONDS=$(( ELAPSED % 60 ))
  echo "[$MINUTES:${SECONDS}] Checking status..."
  
  # Check if daemon is still running
  if ! ps -p $DAEMON_PID > /dev/null 2>&1; then
    echo "❌ Daemon process died!"
    break
  fi
  
  # Check page count from logs
  PAGE_COUNT=$(grep "EXECUTOR_DAEMON.*pages=" /tmp/executor_stability_test.log | tail -1 | grep -o "pages=[0-9]*" | cut -d= -f2 || echo "unknown")
  echo "   Latest page count: $PAGE_COUNT"
done

echo ""
echo "📋 Step 3: Stopping daemon..."
touch "$RUNNER_PROFILE_DIR/STOP_EXECUTOR"
sleep 5

if ps -p $DAEMON_PID > /dev/null 2>&1; then
  kill $DAEMON_PID 2>/dev/null || true
fi

echo "✅ Test complete"
echo ""
echo "📊 Results:"
echo "   Log file: /tmp/executor_stability_test.log"
echo "   Check page counts: grep 'pages=' /tmp/executor_stability_test.log | grep -o 'pages=[0-9]*' | sort | uniq -c"
