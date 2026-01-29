#!/bin/bash
# P1 After Session Refresh: Export → Verify → Harvest → Decisions
# 
# Run this AFTER manually refreshing session with: pnpm tsx scripts/refresh-x-session.ts

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "     P1 After Session Refresh: Export → Verify → Harvest → Decisions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 2: Export session to TWITTER_SESSION_B64
echo "📋 STEP 2: Export Session to TWITTER_SESSION_B64"
echo "────────────────────────────────────────────────────────────────────"
echo ""

if [ ! -f twitter_session.json ]; then
    echo "❌ twitter_session.json not found."
    echo "   Please run: pnpm tsx scripts/refresh-x-session.ts first"
    exit 1
fi

base64 -i twitter_session.json > twitter_session.b64
export TWITTER_SESSION_B64=$(cat twitter_session.b64)
echo "✅ TWITTER_SESSION_B64 exported (length: ${#TWITTER_SESSION_B64})"
echo ""

# Step 3: Verify Auth
echo "📋 STEP 3: Verify Authentication"
echo "────────────────────────────────────────────────────────────────────"
echo ""

pnpm tsx scripts/ops/verify-harvester-auth.ts

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Auth verification failed. Please refresh session again."
    exit 1
fi

echo ""
echo "✅ Auth verified - logged_in=true"
echo ""

# Step 4: Harvest until pool is healthy
echo "📋 STEP 4: Harvest Fresh Opportunities"
echo "────────────────────────────────────────────────────────────────────"
echo ""

MAX_CYCLES=3
CYCLE=1
FRESH_12H=0

while [ $CYCLE -le $MAX_CYCLES ]; do
    echo "🌾 Harvest cycle $CYCLE/$MAX_CYCLES..."
    HARVESTING_ENABLED=true pnpm tsx scripts/ops/run-harvester-single-cycle.ts || {
        echo "⚠️  Harvest cycle $CYCLE had errors, checking results..."
    }
    
    echo ""
    echo "📊 Checking opportunities freshness..."
    OUTPUT=$(pnpm tsx scripts/ops/p1-diagnostic-queries.ts 2>&1)
    echo "$OUTPUT" | grep -A 10 "Opportunities freshness" || echo "$OUTPUT"
    
    # Extract fresh_12h value
    FRESH_12H=$(echo "$OUTPUT" | grep "fresh_12h:" | awk '{print $2}' || echo "0")
    
    if [ "$FRESH_12H" -ge 50 ] 2>/dev/null; then
        echo ""
        echo "✅ Pool is healthy (fresh_12h: $FRESH_12H >= 50)"
        break
    else
        echo ""
        echo "⚠️  Pool not yet healthy (fresh_12h: $FRESH_12H < 50)"
        if [ $CYCLE -lt $MAX_CYCLES ]; then
            echo "   Running another harvest cycle..."
            CYCLE=$((CYCLE + 1))
            sleep 5
        else
            echo "❌ Max cycles reached. Pool may need more time."
            echo "   Current state:"
            echo "$OUTPUT" | grep -A 10 "Opportunities freshness"
            exit 1
        fi
    fi
    echo ""
done

# Step 5: Trigger Planner/Scheduler
echo "📋 STEP 5: Trigger Reply V2 Planner/Scheduler"
echo "────────────────────────────────────────────────────────────────────"
echo ""

echo "🎯 Triggering planner (creates decisions from opportunities)..."
railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts || {
    echo ""
    echo "⚠️  Planner trigger via Railway failed (may need Railway auth)"
    echo "   Run manually: railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts"
    echo ""
    echo "   Or run locally (if configured):"
    echo "   REPLY_V2_PLAN_ONLY=true RUNNER_MODE=false pnpm tsx scripts/ops/run-reply-v2-planner-once.ts"
}

echo ""
echo "📊 Checking for new decisions..."
sleep 3

# Check decisions created in last hour
pnpm tsx scripts/ops/p1-diagnostic-queries.ts | grep -A 20 "Decisions created" || true

echo ""
echo "✅ P1 setup flow complete!"
echo ""
echo "Next steps:"
echo "  1. Ensure executor is running: pnpm run ops:executor:status"
echo "  2. Monitor executor logs: tail -f ./.runner-profile/logs/executor.log | grep 'REPLY_SUCCESS\|runtime_preflight_status'"
echo "  3. Check for posted replies: pnpm tsx scripts/ops/p1-diagnostic-queries.ts"
