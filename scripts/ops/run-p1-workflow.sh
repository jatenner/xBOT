#!/bin/bash
# P1 Workflow Runner
# Runs P1 phases methodically with evidence collection

set -e

echo "═══════════════════════════════════════════════════════════"
echo "🎯 P1 Workflow Runner"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Phase A: Build public candidates
echo "PHASE A: Building public candidates..."
echo "Running harvest cycles until 25+ candidates..."
echo ""

# Note: Railway commands may timeout, so we'll run them in background
# and check results separately
for i in {1..5}; do
  echo "Harvest cycle $i/5..."
  railway run --service serene-cat P1_MODE=true pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts > /tmp/harvest-cycle-$i.log 2>&1 &
  HARVEST_PID=$!
  
  # Wait up to 5 minutes
  for j in {1..60}; do
    sleep 5
    if ! kill -0 $HARVEST_PID 2>/dev/null; then
      break
    fi
  done
  
  # Check count
  COUNT=$(pnpm exec tsx scripts/ops/check-public-count.ts 2>&1 | grep -o '[0-9]*' | head -1)
  echo "Current count: $COUNT"
  
  if [ "$COUNT" -ge 25 ]; then
    echo "✅ Target reached: $COUNT candidates"
    break
  fi
  
  sleep 10
done

echo ""
echo "Final count:"
pnpm exec tsx scripts/ops/check-public-count.ts

echo ""
echo "PHASE B: Running plan-only..."
railway run --service serene-cat \
  REPLY_V2_ROOT_ONLY=true \
  P1_MODE=true \
  P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 \
  REPLY_V2_PLAN_ONLY=true \
  pnpm exec tsx scripts/ops/run-reply-v2-planner-once.ts 2>&1 | tee /tmp/planner-plan-only.log

echo ""
echo "Checking probe summary..."
pnpm exec tsx scripts/ops/p1-probe-reasons.ts

echo ""
echo "PHASE C: Creating real decisions..."
railway run --service serene-cat \
  REPLY_V2_ROOT_ONLY=true \
  P1_MODE=true \
  P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 \
  pnpm exec tsx scripts/ops/run-reply-v2-planner-once.ts 2>&1 | tee /tmp/planner-real.log

echo ""
echo "Final status:"
pnpm exec tsx scripts/p1-status.ts
