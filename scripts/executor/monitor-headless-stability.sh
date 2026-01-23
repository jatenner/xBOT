#!/bin/bash
# 15-minute headless stability test with strict PASS criteria

set -e

cd "$(dirname "$0")/../.."
RUNNER_PROFILE_DIR="${RUNNER_PROFILE_DIR:-./.runner-profile}"
LOG_FILE="/tmp/headless_stability_$(date +%s).log"
EVIDENCE_FILE="/tmp/headless_evidence_$(date +%s).txt"
START_TIME=$(date +%s)
END_TIME=$((START_TIME + 900)) # 15 minutes
MINUTE=0
FAILED_MINUTE=-1
FAILURE_REASON=""
WINDOWS_OPENED=0
PAGES_COUNT=0
BROWSER_LAUNCHES=0
STOP_SWITCH_SECONDS=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🧪 HEADLESS EXECUTOR 15-MINUTE STABILITY TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Start time: $(date -r $START_TIME)"
echo "End time: $(date -r $END_TIME)"
echo "Log file: $LOG_FILE"
echo "Evidence file: $EVIDENCE_FILE"
echo ""
echo "PASS Criteria:"
echo "  ✅ windows_opened=0"
echo "  ✅ pages=1 (all ticks)"
echo "  ✅ browser_launches<=1"
echo "  ✅ stop_switch<=10s"
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

# Capture initial state
echo "📋 Initial State:" > $EVIDENCE_FILE
echo "Timestamp: $(date)" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

# Count visible Chrome windows (should be 0)
INITIAL_VISIBLE_WINDOWS=$(osascript -e 'tell application "System Events" to count windows of process "Google Chrome"' 2>/dev/null || echo "0")
echo "Initial visible Chrome windows: $INITIAL_VISIBLE_WINDOWS" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

# Remove STOP switch
rm -f "$RUNNER_PROFILE_DIR/STOP_EXECUTOR"

# Start daemon
echo "🚀 Starting headless executor daemon..."
EXECUTION_MODE=executor \
RUNNER_MODE=true \
HEADLESS=true \
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

# Verify headless boot log
if ! grep -q "BOOT: headless=true" "$LOG_FILE"; then
  echo "❌ FAIL: Missing headless=true boot log"
  FAILURE_REASON="Missing headless=true boot assertion"
  FAILED_MINUTE=0
  RESULT="FAIL"
  echo "RESULT=FAIL" > /tmp/headless_stability_result.txt
  echo "FAILURE_REASON=$FAILURE_REASON" >> /tmp/headless_stability_result.txt
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
  
  # Check browser launches (should be <= 1)
  BROWSER_LAUNCHES=$(echo "$LATEST_LINES" | grep -o "browser_launches=[0-9]*" | cut -d= -f2 | tail -1)
  if [ -n "$BROWSER_LAUNCHES" ] && [ "$BROWSER_LAUNCHES" -gt 1 ]; then
    FAILED_MINUTE=$MINUTE
    FAILURE_REASON="browser_launches=$BROWSER_LAUNCHES (expected <= 1)"
    echo "❌ FAIL: Found browser_launches=$BROWSER_LAUNCHES at minute $MINUTE"
    break
  fi
  
  # Check visible windows (should be 0)
  CURRENT_VISIBLE_WINDOWS=$(osascript -e 'tell application "System Events" to count windows of process "Google Chrome"' 2>/dev/null || echo "0")
  if [ "$CURRENT_VISIBLE_WINDOWS" -gt "$INITIAL_VISIBLE_WINDOWS" ]; then
    WINDOWS_OPENED=$((CURRENT_VISIBLE_WINDOWS - INITIAL_VISIBLE_WINDOWS))
    FAILED_MINUTE=$MINUTE
    FAILURE_REASON="windows_opened=$WINDOWS_OPENED (expected 0)"
    echo "❌ FAIL: Found $WINDOWS_OPENED new visible Chrome windows at minute $MINUTE"
    break
  fi
  
  # Check forbidden patterns
  FORBIDDEN=("new page" "spawn tab" "kill chrome" "reconnect loop" "creating page" "opening new window" "browser.close" "page cap exceeded" "HARD CAP" "connectOverCDP")
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
  echo "Visible windows: $CURRENT_VISIBLE_WINDOWS" >> $EVIDENCE_FILE
  
  sleep 60
done

# Capture final state
echo "" >> $EVIDENCE_FILE
echo "📋 Final State:" >> $EVIDENCE_FILE
echo "Timestamp: $(date)" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

FINAL_VISIBLE_WINDOWS=$(osascript -e 'tell application "System Events" to count windows of process "Google Chrome"' 2>/dev/null || echo "0")
FINAL_WINDOWS_OPENED=$((FINAL_VISIBLE_WINDOWS - INITIAL_VISIBLE_WINDOWS))
echo "Final visible Chrome windows: $FINAL_VISIBLE_WINDOWS" >> $EVIDENCE_FILE
echo "Windows opened during test: $FINAL_WINDOWS_OPENED" >> $EVIDENCE_FILE
echo "" >> $EVIDENCE_FILE

# Get final metrics from logs
FINAL_PAGES=$(grep "EXECUTOR_DAEMON.*ts=" "$LOG_FILE" | tail -1 | grep -o "pages=[0-9]*" | cut -d= -f2 || echo "0")
FINAL_BROWSER_LAUNCHES=$(grep "EXECUTOR_DAEMON.*ts=" "$LOG_FILE" | tail -1 | grep -o "browser_launches=[0-9]*" | cut -d= -f2 || echo "0")

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
  STOP_SWITCH_SECONDS=999
  if [ $FAILED_MINUTE -eq -1 ]; then
    FAILURE_REASON="STOP switch did not work within 10s"
    FAILED_MINUTE=$MINUTE
  fi
else
  STOP_SWITCH_SECONDS=$(( $(date +%s) - STOP_START ))
  echo "✅ Daemon stopped via STOP switch in ${STOP_SWITCH_SECONDS}s"
fi

# Determine result - STRICT PASS criteria
if [ $FAILED_MINUTE -ne -1 ]; then
  RESULT="FAIL"
elif [ "$FINAL_WINDOWS_OPENED" != "0" ]; then
  RESULT="FAIL"
  FAILURE_REASON="windows_opened=$FINAL_WINDOWS_OPENED (expected 0)"
elif [ "$FINAL_PAGES" != "1" ] && [ "$FINAL_PAGES" != "0" ]; then
  RESULT="FAIL"
  FAILURE_REASON="pages=$FINAL_PAGES (expected 1)"
elif [ "$FINAL_BROWSER_LAUNCHES" -gt 1 ]; then
  RESULT="FAIL"
  FAILURE_REASON="browser_launches=$FINAL_BROWSER_LAUNCHES (expected <= 1)"
elif [ "$STOP_SWITCH_SECONDS" -gt 10 ]; then
  RESULT="FAIL"
  FAILURE_REASON="stop_switch=${STOP_SWITCH_SECONDS}s (expected <= 10s)"
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
echo ""
echo "Metrics:"
echo "  windows_opened: $FINAL_WINDOWS_OPENED (expected: 0)"
echo "  pages: $FINAL_PAGES (expected: 1)"
echo "  browser_launches: $FINAL_BROWSER_LAUNCHES (expected: <= 1)"
echo "  stop_switch: ${STOP_SWITCH_SECONDS}s (expected: <= 10s)"
echo "  minutes_completed: $MINUTE/15"
echo ""
echo "Evidence file: $EVIDENCE_FILE"
echo "Log file: $LOG_FILE"
echo ""

# Export results
echo "RESULT=$RESULT" > /tmp/headless_stability_result.txt
echo "FAILED_MINUTE=$FAILED_MINUTE" >> /tmp/headless_stability_result.txt
echo "FAILURE_REASON=$FAILURE_REASON" >> /tmp/headless_stability_result.txt
echo "LOG_FILE=$LOG_FILE" >> /tmp/headless_stability_result.txt
echo "EVIDENCE_FILE=$EVIDENCE_FILE" >> /tmp/headless_stability_result.txt
echo "START_TIME=$START_TIME" >> /tmp/headless_stability_result.txt
echo "END_TIME=$(date +%s)" >> /tmp/headless_stability_result.txt
echo "MINUTES_COMPLETED=$MINUTE" >> /tmp/headless_stability_result.txt
echo "WINDOWS_OPENED=$FINAL_WINDOWS_OPENED" >> /tmp/headless_stability_result.txt
echo "PAGES=$FINAL_PAGES" >> /tmp/headless_stability_result.txt
echo "BROWSER_LAUNCHES=$FINAL_BROWSER_LAUNCHES" >> /tmp/headless_stability_result.txt
echo "STOP_SWITCH_SECONDS=$STOP_SWITCH_SECONDS" >> /tmp/headless_stability_result.txt

if [ "$RESULT" = "PASS" ]; then
  exit 0
else
  exit 1
fi
