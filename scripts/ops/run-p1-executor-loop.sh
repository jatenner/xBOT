#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════"
echo "🚀 P1 Executor-Verified Pipeline"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Harvest public candidates
echo "📊 Step 1: Harvesting public candidates..."
echo "───────────────────────────────────────────────────────────"

HARVEST_CYCLES=0
MAX_HARVEST_CYCLES=10
STRICT_COUNT=0

while [ $HARVEST_CYCLES -lt $MAX_HARVEST_CYCLES ] && [ $STRICT_COUNT -lt 25 ]; do
  HARVEST_CYCLES=$((HARVEST_CYCLES + 1))
  echo ""
  echo "[$HARVEST_CYCLES/$MAX_HARVEST_CYCLES] Running harvest cycle..."
  
  P1_STORE_ALL_STATUS_URLS=true pnpm exec tsx scripts/ops/run-harvester-local-prod.ts || {
    echo "⚠️  Harvest cycle failed, continuing..."
  }
  
  # Check strict_count
  STRICT_COUNT=$(pnpm exec tsx scripts/ops/check-public-count.ts 2>&1 | grep "strict_count=" | head -1 | sed 's/.*strict_count=\([0-9]*\).*/\1/' || echo "0")
  echo "Current strict_count: $STRICT_COUNT"
  
  if [ "$STRICT_COUNT" -ge 25 ]; then
    echo "✅ Target reached: strict_count >= 25"
    break
  fi
  
  echo "Waiting 5s before next cycle..."
  sleep 5
done

if [ "$STRICT_COUNT" -lt 25 ]; then
  echo "⚠️  Warning: strict_count=$STRICT_COUNT < 25 after $HARVEST_CYCLES cycles"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔍 Step 2: Executor verification"
echo "═══════════════════════════════════════════════════════════"

VERIFY_CYCLES=0
MAX_VERIFY_CYCLES=10
OK_COUNT=0

while [ $VERIFY_CYCLES -lt $MAX_VERIFY_CYCLES ] && [ $OK_COUNT -lt 10 ]; do
  VERIFY_CYCLES=$((VERIFY_CYCLES + 1))
  echo ""
  echo "[$VERIFY_CYCLES/$MAX_VERIFY_CYCLES] Running executor verification..."
  
  EXECUTION_MODE=executor RUNNER_MODE=true pnpm exec tsx scripts/ops/executor-verify-candidates.ts --limit 50 || {
    echo "❌ Executor verification failed"
    exit 1
  }
  
  # Extract ok count from output
  OK_COUNT=$(EXECUTION_MODE=executor RUNNER_MODE=true pnpm exec tsx scripts/ops/executor-verify-candidates.ts --limit 50 2>&1 | grep "ok=" | tail -1 | sed 's/.*ok=\([0-9]*\).*/\1/' || echo "0")
  echo "Current ok_count: $OK_COUNT"
  
  if [ "$OK_COUNT" -ge 10 ]; then
    echo "✅ Target reached: ok_count >= 10"
    break
  fi
  
  echo "Waiting 5s before next cycle..."
  sleep 5
done

if [ "$OK_COUNT" -lt 10 ]; then
  echo "⚠️  Warning: ok_count=$OK_COUNT < 10 after $VERIFY_CYCLES cycles"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📋 Step 3: Planner (verified-only)"
echo "═══════════════════════════════════════════════════════════"

P1_MODE=true REPLY_V2_ROOT_ONLY=true REPLY_V2_PLAN_ONLY=true pnpm exec tsx scripts/ops/run-reply-v2-planner-once.ts || {
  echo "⚠️  Planner failed, but continuing..."
}

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🤖 Step 4: Start executor daemon"
echo "═══════════════════════════════════════════════════════════"

# Check if executor daemon is running
if pgrep -f "executor.*daemon" > /dev/null; then
  echo "✅ Executor daemon already running"
else
  echo "🚀 Starting executor daemon..."
  EXECUTION_MODE=executor RUNNER_MODE=true pnpm run executor:daemon &
  EXECUTOR_PID=$!
  echo "Executor daemon started (PID: $EXECUTOR_PID)"
  sleep 5 # Give it time to start
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "⏳ Step 5: Poll for posted reply"
echo "═══════════════════════════════════════════════════════════"

# Get initial reply count (check for posted tweet_id)
INITIAL_TWEET_ID=$(pnpm exec tsx scripts/p1-status.ts 2>&1 | grep "tweet_id:" | head -1 | awk '{print $2}' || echo "")
echo "Initial tweet_id: ${INITIAL_TWEET_ID:-none}"

POLL_COUNT=0
MAX_POLLS=10
POLL_INTERVAL=60

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
  POLL_COUNT=$((POLL_COUNT + 1))
  echo ""
  echo "[$POLL_COUNT/$MAX_POLLS] Checking for new reply..."
  
  CURRENT_TWEET_ID=$(pnpm exec tsx scripts/p1-status.ts 2>&1 | grep "tweet_id:" | head -1 | awk '{print $2}' || echo "")
  CURRENT_URL=$(pnpm exec tsx scripts/p1-status.ts 2>&1 | grep "reply_url:" | head -1 | awk '{print $2}' || echo "")
  
  echo "Current tweet_id: ${CURRENT_TWEET_ID:-none}"
  
  if [ -n "$CURRENT_TWEET_ID" ] && [ "$CURRENT_TWEET_ID" != "$INITIAL_TWEET_ID" ]; then
    echo "✅ New reply posted! (tweet_id: $CURRENT_TWEET_ID)"
    
    if [ -n "$CURRENT_URL" ]; then
      echo "Reply URL: $CURRENT_URL"
    fi
    
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "✅ SUCCESS: P1 reply posted!"
    echo "═══════════════════════════════════════════════════════════"
    exit 0
  fi
  
  if [ $POLL_COUNT -lt $MAX_POLLS ]; then
    echo "Waiting ${POLL_INTERVAL}s before next poll..."
    sleep $POLL_INTERVAL
  fi
done

echo ""
echo "⚠️  No new reply detected after $MAX_POLLS polls"
echo "═══════════════════════════════════════════════════════════"
exit 1
