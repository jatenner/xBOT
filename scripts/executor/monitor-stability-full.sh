#!/bin/bash
# Full 15-minute stability test with comprehensive monitoring

set -e

cd "$(dirname "$0")/../.."
RUNNER_PROFILE_DIR="${RUNNER_PROFILE_DIR:-./.runner-profile}"
LOG_FILE="/tmp/stability_test_$(date +%s).log"
EVIDENCE_FILE="/tmp/stability_evidence_$(date +%s).txt"
START_TIME=$(date +%s)
END_TIME=$((START_TIME + 900)) # 15 minutes
MINUTE=0
FAILED_MINUTE=-1
FAILURE_REASON=""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🧪 EXECUTOR 15-MINUTE STABILITY TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Start time: $(date -r $START_TIME)"
echo "End time: $(date -r $END_TIME)"
echo "Log file: $LOG_FILE"
echo "Evidence file: $EVIDENCE_FILE"
echo ""

# Pre-flight checks
echo "📋 Pre-flight checks..."
if [ -f "$RUNNER_PROFILE_DIR/executor.pid" ]; then
  OLD_PID=$(cat "$RUNNER_PROFILE_DIR/executor.pid" | awk '{print $1}')
  if ps -p $OLD_PID > /dev/null 2>&1; then
    echo "⚠️  Stopping existing executor PID $OLD_PID"
    touch "$RUNNER_PROFILE_DIR/STOP_EXECUTOR"
    sleep 3
    kill $OLD_PID 2>/dev/null || true
    sleep 2
  fi
  rm -f "$RUNNER_PROFILE_DIR/executor.pid"
fi

# Ensure CDP is running
if ! curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
  echo "⚠️  CDP not running - launching Chrome..."
  RUNNER_PROFILE_DIR="$RUNNER_PROFILE_DIR" pnpm tsx scripts/runner/chrome-cdp.ts > /dev/null 2>&1 &
  sleep 10
  if ! curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
    echo "❌ Failed to launch Chrome CDP"
    exit 1
  fi
fi

INITIAL_CDP_PID=$(lsof -i :9222 2>/dev/null | tail -1 | awk '{print $2}' || echo "")

# Capture initial state
echo "📋 Initial State:" > $EVIDENCE_FILE
echo "Timestamp: $(date)" >> $EVIDENCE_FILE
echo "CDP PID: $INITIAL_CDP_PID" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

echo "CDP Port (lsof -i :9222):" >> $EVIDENCE_FILE
lsof -i :9222 2>/dev/null | head -5 >> $EVIDENCE_FILE || echo "No processes on port 9222" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

# Remove STOP switch
rm -f "$RUNNER_PROFILE_DIR/STOP_EXECUTOR"

# Start daemon
echo "🚀 Starting executor daemon..."
EXECUTION_MODE=executor \
RUNNER_MODE=true \
RUNNER_BROWSER=cdp \
RUNNER_PROFILE_DIR="$RUNNER_PROFILE_DIR" \
SAFETY_NO_KILL=true \
pnpm run executor:daemon > "$LOG_FILE" 2>&1 &
DAEMON_PID=$!

echo "✅ Daemon started (PID: $DAEMON_PID)"
echo ""

# Wait for initialization
sleep 10

if ! ps -p $DAEMON_PID > /dev/null 2>&1; then
  echo "❌ Daemon died immediately"
  echo "Last 20 lines:"
  tail -20 "$LOG_FILE"
  exit 1
fi

echo "📊 Monitoring for 15 minutes..."
echo ""

# Monitor loop
while [ $(date +%s) -lt $END_TIME ]; do
  MINUTE=$((MINUTE + 1))
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  MINUTES=$((ELAPSED / 60))
  SECONDS=$((ELAPSED % 60))
  
  echo "[$MINUTES:${SECONDS}] Minute $MINUTE/15 - Checking..."
  
  # Check daemon alive
  if ! ps -p $DAEMON_PID > /dev/null 2>&1; then
    FAILED_MINUTE=$MINUTE
    FAILURE_REASON="Daemon process died"
    echo "❌ FAIL: Daemon died at minute $MINUTE"
    break
  fi
  
  # Capture latest EXECUTOR_DAEMON lines
  LATEST_LINES=$(grep "EXECUTOR_DAEMON.*ts=" "$LOG_FILE" | tail -5)
  
  if [ -z "$LATEST_LINES" ]; then
    echo "   ⚠️  No EXECUTOR_DAEMON lines yet"
    sleep 60
    continue
  fi
  
  # Check pages=1
  PAGE_COUNTS=$(echo "$LATEST_LINES" | grep -o "pages=[0-9]*" | cut -d= -f2)
  for PAGE_COUNT in $PAGE_COUNTS; do
    if [ "$PAGE_COUNT" != "1" ] && [ "$PAGE_COUNT" != "0" ]; then
      FAILED_MINUTE=$MINUTE
      FAILURE_REASON="pages=$PAGE_COUNT (expected 1)"
      echo "❌ FAIL: Found pages=$PAGE_COUNT at minute $MINUTE"
      break
    fi
  done
  
  if [ $FAILED_MINUTE -ne -1 ]; then
    break
  fi
  
  # Check forbidden patterns
  FORBIDDEN=("new page" "spawn tab" "kill chrome" "reconnect loop" "creating page" "opening new window" "browser.close" "page cap exceeded" "HARD CAP")
  for PATTERN in "${FORBIDDEN[@]}"; do
    if echo "$LATEST_LINES" | grep -qi "$PATTERN"; then
      FAILED_MINUTE=$MINUTE
      FAILURE_REASON="Forbidden pattern: $PATTERN"
      echo "❌ FAIL: Found '$PATTERN' at minute $MINUTE"
      break
    fi
  done
  
  if [ $FAILED_MINUTE -ne -1 ]; then
    break
  fi
  
  # CPU/Memory snapshot
  CPU_MEM=$(ps -p $DAEMON_PID -o %cpu,%mem,rss 2>/dev/null | tail -1 || echo "N/A")
  
  # Record evidence
  echo "" >> $EVIDENCE_FILE
  echo "Minute $MINUTE ($(date)):" >> $EVIDENCE_FILE
  echo "$LATEST_LINES" >> $EVIDENCE_FILE
  echo "CPU/Mem: $CPU_MEM" >> $EVIDENCE_FILE
  
  sleep 60
done

# Capture final state
FINAL_CDP_PID=$(lsof -i :9222 2>/dev/null | tail -1 | awk '{print $2}' || echo "")

echo "" >> $EVIDENCE_FILE
echo "📋 Final State:" >> $EVIDENCE_FILE
echo "Timestamp: $(date)" >> $EVIDENCE_FILE
echo "CDP PID: $FINAL_CDP_PID" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

# Stop daemon via STOP switch
echo ""
echo "🛑 Stopping daemon via STOP switch..."
touch "$RUNNER_PROFILE_DIR/STOP_EXECUTOR"
STOP_START=$(date +%s)
STOP_TIMEOUT=$((STOP_START + 10))

while ps -p $DAEMON_PID > /dev/null 2>&1 && [ $(date +%s) -lt $STOP_TIMEOUT ]; do
  sleep 1
done

if ps -p $DAEMON_PID > /dev/null 2>&1; then
  echo "⚠️  Daemon did not exit within 10s - killing"
  kill $DAEMON_PID 2>/dev/null || true
  sleep 2
  FAILURE_REASON="${FAILURE_REASON:-STOP switch did not work within 10s}"
else
  STOP_ELAPSED=$(( $(date +%s) - STOP_START ))
  echo "✅ Daemon stopped via STOP switch in ${STOP_ELAPSED}s"
fi

# Test single-instance lock
echo ""
echo "🔒 Testing single-instance lock..."
EXECUTION_MODE=executor \
RUNNER_MODE=true \
RUNNER_BROWSER=cdp \
RUNNER_PROFILE_DIR="$RUNNER_PROFILE_DIR" \
SAFETY_NO_KILL=true \
pnpm run executor:daemon > /tmp/second_instance_test.log 2>&1 &
SECOND_PID=$!
sleep 5

if ps -p $SECOND_PID > /dev/null 2>&1; then
  echo "❌ Second instance did not exit (lock failed)"
  kill $SECOND_PID 2>/dev/null || true
  FAILURE_REASON="${FAILURE_REASON:-Single-instance lock failed}"
else
  echo "✅ Single-instance lock working (second instance exited)"
fi

# Determine result
if [ $FAILED_MINUTE -ne -1 ]; then
  RESULT="FAIL"
elif [ "$INITIAL_CDP_PID" != "$FINAL_CDP_PID" ] && [ -n "$INITIAL_CDP_PID" ] && [ -n "$FINAL_CDP_PID" ]; then
  RESULT="FAIL"
  FAILURE_REASON="CDP PID changed: $INITIAL_CDP_PID -> $FINAL_CDP_PID"
elif [ $MINUTE -lt 15 ]; then
  RESULT="FAIL"
  FAILURE_REASON="Test did not complete full 15 minutes (only $MINUTE minutes)"
else
  RESULT="PASS"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$RESULT" = "PASS" ]; then
  echo "           ✅ TEST PASSED"
else
  echo "           ❌ TEST FAILED"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Result: $RESULT"
if [ "$RESULT" = "FAIL" ]; then
  echo "Failed at minute: $FAILED_MINUTE"
  echo "Reason: $FAILURE_REASON"
fi
echo "Minutes completed: $MINUTE/15"
echo ""
echo "Evidence file: $EVIDENCE_FILE"
echo "Log file: $LOG_FILE"
echo ""

# Export results
echo "RESULT=$RESULT" > /tmp/stability_test_result.txt
echo "FAILED_MINUTE=$FAILED_MINUTE" >> /tmp/stability_test_result.txt
echo "FAILURE_REASON=$FAILURE_REASON" >> /tmp/stability_test_result.txt
echo "LOG_FILE=$LOG_FILE" >> /tmp/stability_test_result.txt
echo "EVIDENCE_FILE=$EVIDENCE_FILE" >> /tmp/stability_test_result.txt
echo "START_TIME=$START_TIME" >> /tmp/stability_test_result.txt
echo "END_TIME=$(date +%s)" >> /tmp/stability_test_result.txt
echo "MINUTES_COMPLETED=$MINUTE" >> /tmp/stability_test_result.txt

exit 0
