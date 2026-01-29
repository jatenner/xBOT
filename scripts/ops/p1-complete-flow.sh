#!/bin/bash
# P1 Complete Flow: Session Refresh → Harvest → Decisions
# 
# This script guides through the complete P1 setup flow.
# Step 1 requires manual browser interaction.

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "     P1 Complete Flow: Session Refresh → Harvest → Decisions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Session Refresh (MANUAL - requires browser interaction)
echo "📋 STEP 1: Refresh Twitter Session (MANUAL)"
echo "────────────────────────────────────────────────────────────────────"
echo ""
echo "⚠️  This step requires manual browser interaction."
echo "   Run this command in a separate terminal:"
echo ""
echo "   pnpm tsx scripts/refresh-x-session.ts"
echo ""
echo "   After login completes, press Enter here to continue..."
read -p "Press Enter after session refresh is complete... "

if [ ! -f twitter_session.json ]; then
    echo "❌ twitter_session.json not found. Please run refresh-x-session.ts first."
    exit 1
fi

echo "✅ twitter_session.json found"
echo ""

# Step 2: Export session to TWITTER_SESSION_B64
echo "📋 STEP 2: Export Session to TWITTER_SESSION_B64"
echo "────────────────────────────────────────────────────────────────────"
echo ""

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
    echo "❌ Auth verification failed. Please refresh session again."
    exit 1
fi

echo "✅ Auth verified"
echo ""

# Step 4: Harvest until pool is healthy
echo "📋 STEP 4: Harvest Fresh Opportunities"
echo "────────────────────────────────────────────────────────────────────"
echo ""

MAX_CYCLES=3
CYCLE=1

while [ $CYCLE -le $MAX_CYCLES ]; do
    echo "🌾 Harvest cycle $CYCLE/$MAX_CYCLES..."
    HARVESTING_ENABLED=true pnpm tsx scripts/ops/run-harvester-single-cycle.ts || {
        echo "⚠️  Harvest cycle $CYCLE failed, continuing..."
    }
    
    echo ""
    echo "📊 Checking opportunities freshness..."
    pnpm tsx scripts/ops/p1-diagnostic-queries.ts | grep -A 10 "Opportunities freshness" || true
    
    # Check if we have enough fresh opportunities
    FRESH_12H=$(pnpm tsx scripts/ops/p1-diagnostic-queries.ts 2>&1 | grep "fresh_12h:" | awk '{print $2}' || echo "0")
    
    if [ "$FRESH_12H" -ge 50 ] 2>/dev/null; then
        echo "✅ Pool is healthy (fresh_12h: $FRESH_12H >= 50)"
        break
    else
        echo "⚠️  Pool not yet healthy (fresh_12h: $FRESH_12H < 50)"
        if [ $CYCLE -lt $MAX_CYCLES ]; then
            echo "   Running another harvest cycle..."
            CYCLE=$((CYCLE + 1))
        else
            echo "❌ Max cycles reached. Pool may need more time or manual intervention."
            exit 1
        fi
    fi
    echo ""
done

# Step 5: Trigger Planner/Scheduler
echo "📋 STEP 5: Trigger Reply V2 Planner/Scheduler"
echo "────────────────────────────────────────────────────────────────────"
echo ""

echo "🎯 Triggering planner..."
railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts || {
    echo "⚠️  Planner trigger failed (may need Railway auth)"
    echo "   Run manually: railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts"
}

echo ""
echo "✅ P1 setup flow complete!"
echo ""
echo "Next: Ensure executor is running and monitor for successful posts."
echo "   pnpm run ops:executor:status"
echo "   tail -f ./.runner-profile/logs/executor.log | grep 'REPLY_SUCCESS'"
