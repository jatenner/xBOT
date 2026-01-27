#!/bin/bash
# Monitor proof with checkpoints at T+30m, T+60m, T+90m

PROOF_START="2026-01-27T15:17:31Z"
PROOF_TAG="stability-1769527051690"
LOG_FILE="/Users/jonahtenner/Desktop/xBOT/.runner-profile/prove-stability-real-load.log"

# Convert start time to epoch seconds
START_EPOCH=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$PROOF_START" +%s 2>/dev/null || date -u -d "$PROOF_START" +%s 2>/dev/null || echo "0")

if [ "$START_EPOCH" = "0" ]; then
  echo "Error: Could not parse start time"
  exit 1
fi

echo "Proof monitoring started"
echo "Proof tag: $PROOF_TAG"
echo "Start time: $PROOF_START"
echo "Checkpoints: T+30m, T+60m, T+90m"
echo ""

# Checkpoint at T+30m (1800 seconds)
CHECKPOINT_30M=$((START_EPOCH + 1800))
CHECKPOINT_60M=$((START_EPOCH + 3600))
CHECKPOINT_90M=$((START_EPOCH + 5400))
COMPLETION=$((START_EPOCH + 7200))

while true; do
  CURRENT_EPOCH=$(date -u +%s)
  ELAPSED=$((CURRENT_EPOCH - START_EPOCH))
  ELAPSED_MIN=$((ELAPSED / 60))
  
  # Check if daemon is still running
  DAEMON_RUNNING=$(ps aux | grep "[p]rove-stability-real-load" | wc -l | xargs)
  
  if [ "$DAEMON_RUNNING" -eq 0 ]; then
    echo "=== Daemon stopped at T+${ELAPSED_MIN}m ==="
    break
  fi
  
  # Checkpoint at T+30m
  if [ $ELAPSED -ge 1800 ] && [ $ELAPSED -lt 1860 ]; then
    echo "=== CHECKPOINT T+30m ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) ==="
    echo "Tailing logs for 90 seconds..."
    timeout 90 tail -f "$LOG_FILE" 2>/dev/null | grep -E "(HEALTH_OK|EXECUTOR_DAEMON|ts=)" | head -20 || echo "Log tail completed"
    echo "Checking decision status..."
    cd /Users/jonahtenner/Desktop/xBOT && pnpm exec tsx scripts/proof/check-seeded-status.ts 2>&1 | grep -E "(TRANSITIONED|QUEUED|Summary)" || echo "Status check completed"
    echo ""
  fi
  
  # Checkpoint at T+60m
  if [ $ELAPSED -ge 3600 ] && [ $ELAPSED -lt 3660 ]; then
    echo "=== CHECKPOINT T+60m ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) ==="
    echo "Tailing logs for 90 seconds..."
    timeout 90 tail -f "$LOG_FILE" 2>/dev/null | grep -E "(HEALTH_OK|EXECUTOR_DAEMON|ts=)" | head -20 || echo "Log tail completed"
    echo "Checking decision status..."
    cd /Users/jonahtenner/Desktop/xBOT && pnpm exec tsx scripts/proof/check-seeded-status.ts 2>&1 | grep -E "(TRANSITIONED|QUEUED|Summary)" || echo "Status check completed"
    echo ""
  fi
  
  # Checkpoint at T+90m
  if [ $ELAPSED -ge 5400 ] && [ $ELAPSED -lt 5460 ]; then
    echo "=== CHECKPOINT T+90m ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) ==="
    echo "Tailing logs for 90 seconds..."
    timeout 90 tail -f "$LOG_FILE" 2>/dev/null | grep -E "(HEALTH_OK|EXECUTOR_DAEMON|ts=)" | head -20 || echo "Log tail completed"
    echo "Checking decision status..."
    cd /Users/jonahtenner/Desktop/xBOT && pnpm exec tsx scripts/proof/check-seeded-status.ts 2>&1 | grep -E "(TRANSITIONED|QUEUED|Summary)" || echo "Status check completed"
    echo ""
  fi
  
  # Check if proof completed
  if [ -f "/Users/jonahtenner/Desktop/xBOT/docs/proofs/stability/${PROOF_TAG}.md" ]; then
    STATUS=$(grep -E "^\*\*Status:\*\*" "/Users/jonahtenner/Desktop/xBOT/docs/proofs/stability/${PROOF_TAG}.md" 2>/dev/null | head -1 | sed 's/.*\*\*Status:\*\* //' | sed 's/ .*//')
    if echo "$STATUS" | grep -qE "(✅|❌)"; then
      echo "=== Proof completed at T+${ELAPSED_MIN}m ==="
      echo "Status: $STATUS"
      break
    fi
  fi
  
  sleep 60
done
