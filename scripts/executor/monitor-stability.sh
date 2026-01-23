#!/bin/bash
# 15-minute automated stability monitor for executor daemon

set -e

cd "$(dirname "$0")/../.."
RUNNER_PROFILE_DIR="${RUNNER_PROFILE_DIR:-./.runner-profile}"
LOG_FILE="/tmp/executor_stability_$(date +%s).log"
EVIDENCE_FILE="/tmp/executor_evidence_$(date +%s).txt"
START_TIME=$(date +%s)
END_TIME=$((START_TIME + 900)) # 15 minutes

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🧪 EXECUTOR 15-MINUTE STABILITY TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Start time: $(date -r $START_TIME)"
echo "End time: $(date -r $END_TIME)"
echo "Log file: $LOG_FILE"
echo "Evidence file: $EVIDENCE_FILE"
echo ""

# Check CDP is running
if ! curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
  echo "❌ CDP not running. Launch Chrome first:"
  echo "   RUNNER_PROFILE_DIR=$RUNNER_PROFILE_DIR pnpm tsx scripts/runner/chrome-cdp.ts"
  exit 1
fi

# Capture initial state
echo "📋 Initial State:" > $EVIDENCE_FILE
echo "Timestamp: $(date)" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

echo "CDP Port (lsof -i :9222):" >> $EVIDENCE_FILE
lsof -i :9222 2>/dev/null | head -5 >> $EVIDENCE_FILE || echo "No processes on port 9222" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

echo "CPU/Memory snapshot:" >> $EVIDENCE_FILE
ps aux | grep -E "executor/daemon|tsx.*executor" | grep -v grep | head -3 >> $EVIDENCE_FILE || echo "No executor process yet" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

INITIAL_CDP_PID=$(lsof -i :9222 2>/dev/null | tail -1 | awk '{print $2}' || echo "")

# Remove STOP switch
rm -f "$RUNNER_PROFILE_DIR/STOP_EXECUTOR"

# Start daemon in background
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

# Wait for daemon to initialize
sleep 10

# Check if daemon is still running
if ! ps -p $DAEMON_PID > /dev/null 2>&1; then
  echo "❌ Daemon died immediately after start"
  echo "Check logs: $LOG_FILE"
  echo "Last 20 lines:"
  tail -20 "$LOG_FILE"
  exit 1
fi

echo "📊 Monitoring for 15 minutes..."
echo ""

# Monitor loop (every minute for 15 minutes)
MINUTE=0
FAILED_MINUTE=-1
FAILURE_REASON=""

while [ $(date +%s) -lt $END_TIME ]; do
  MINUTE=$((MINUTE + 1))
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  MINUTES=$((ELAPSED / 60))
  SECONDS=$((ELAPSED % 60))
  
  echo "[$MINUTES:${SECONDS}] Minute $MINUTE/15 - Checking..."
  
  # Check if daemon is still running
  if ! ps -p $DAEMON_PID > /dev/null 2>&1; then
    FAILED_MINUTE=$MINUTE
    FAILURE_REASON="Daemon process died"
    echo "❌ FAIL: Daemon died at minute $MINUTE"
    break
  fi
  
  # Capture latest 5 lines with EXECUTOR_DAEMON
  LATEST_LINES=$(grep "EXECUTOR_DAEMON" "$LOG_FILE" | tail -5)
  
  if [ -z "$LATEST_LINES" ]; then
    echo "   ⚠️  No EXECUTOR_DAEMON lines found yet"
    sleep 60
    continue
  fi
  
  # Check for pages=1 in all lines
  PAGE_COUNTS=$(echo "$LATEST_LINES" | grep -o "pages=[0-9]*" | cut -d= -f2)
  for PAGE_COUNT in $PAGE_COUNTS; do
    if [ "$PAGE_COUNT" != "1" ] && [ "$PAGE_COUNT" != "0" ]; then
      FAILED_MINUTE=$MINUTE
      FAILURE_REASON="pages=$PAGE_COUNT (expected 1 or 0)"
      echo "❌ FAIL: Found pages=$PAGE_COUNT at minute $MINUTE"
      break
    fi
  done
  
  if [ $FAILED_MINUTE -ne -1 ]; then
    break
  fi
  
  # Check for forbidden patterns
  FORBIDDEN_PATTERNS=("new page" "new context" "browser.close" "kill chrome" "page cap exceeded" "HARD CAP EXCEEDED" "MULTIPLE PAGES")
  for PATTERN in "${FORBIDDEN_PATTERNS[@]}"; do
    if echo "$LATEST_LINES" | grep -qi "$PATTERN"; then
      FAILED_MINUTE=$MINUTE
      FAILURE_REASON="Forbidden pattern found: $PATTERN"
      echo "❌ FAIL: Found forbidden pattern '$PATTERN' at minute $MINUTE"
      break
    fi
  done
  
  if [ $FAILED_MINUTE -ne -1 ]; then
    break
  fi
  
  # Record evidence for this minute
  echo "" >> $EVIDENCE_FILE
  echo "Minute $MINUTE ($(date)):" >> $EVIDENCE_FILE
  echo "$LATEST_LINES" >> $EVIDENCE_FILE
  
  # Sleep until next minute
  sleep 60
done

# Capture final state
echo "" >> $EVIDENCE_FILE
echo "📋 Final State:" >> $EVIDENCE_FILE
echo "Timestamp: $(date)" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

echo "CDP Port (lsof -i :9222):" >> $EVIDENCE_FILE
lsof -i :9222 2>/dev/null | head -5 >> $EVIDENCE_FILE || echo "No processes on port 9222" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

FINAL_CDP_PID=$(lsof -i :9222 2>/dev/null | tail -1 | awk '{print $2}' || echo "")

echo "CPU/Memory snapshot:" >> $EVIDENCE_FILE
ps aux | grep -E "executor/daemon|tsx.*executor" | grep -v grep | head -3 >> $EVIDENCE_FILE || echo "No executor process" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

# Stop daemon
echo ""
echo "🛑 Stopping daemon..."
touch "$RUNNER_PROFILE_DIR/STOP_EXECUTOR"
sleep 5

if ps -p $DAEMON_PID > /dev/null 2>&1; then
  kill $DAEMON_PID 2>/dev/null || true
  sleep 2
fi

# Determine result
if [ $FAILED_MINUTE -ne -1 ]; then
  RESULT="FAIL"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "           ❌ TEST FAILED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Failed at minute: $FAILED_MINUTE"
  echo "Reason: $FAILURE_REASON"
  echo ""
  echo "Latest log lines:"
  tail -20 "$LOG_FILE"
else
  # Check PID stability
  if [ "$INITIAL_CDP_PID" != "$FINAL_CDP_PID" ] && [ -n "$INITIAL_CDP_PID" ] && [ -n "$FINAL_CDP_PID" ]; then
    RESULT="FAIL"
    FAILURE_REASON="CDP PID changed: $INITIAL_CDP_PID -> $FINAL_CDP_PID"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "           ❌ TEST FAILED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "CDP PID changed during test"
    echo "Initial PID: $INITIAL_CDP_PID"
    echo "Final PID: $FINAL_CDP_PID"
  else
    RESULT="PASS"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "           ✅ TEST PASSED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "All checks passed:"
    echo "  ✅ pages=1 for all minutes"
    echo "  ✅ No forbidden patterns"
    echo "  ✅ CDP PID stable: $INITIAL_CDP_PID"
    echo "  ✅ Daemon ran for 15 minutes"
  fi
fi

echo ""
echo "Evidence file: $EVIDENCE_FILE"
echo "Log file: $LOG_FILE"
echo ""

# Export results for report generation
echo "RESULT=$RESULT" > /tmp/executor_test_result.txt
echo "FAILED_MINUTE=$FAILED_MINUTE" >> /tmp/executor_test_result.txt
echo "FAILURE_REASON=$FAILURE_REASON" >> /tmp/executor_test_result.txt
echo "LOG_FILE=$LOG_FILE" >> /tmp/executor_test_result.txt
echo "EVIDENCE_FILE=$EVIDENCE_FILE" >> /tmp/executor_test_result.txt
echo "START_TIME=$START_TIME" >> /tmp/executor_test_result.txt
echo "END_TIME=$(date +%s)" >> /tmp/executor_test_result.txt

exit 0
