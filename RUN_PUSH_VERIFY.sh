#!/bin/bash
# Run this script manually to push session and verify

cd /Users/jonahtenner/Desktop/xBOT

echo "🚀 Pushing Session to Railway"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check session file
if [ ! -f "./twitter_session.json" ]; then
    echo "❌ Session file not found!"
    exit 1
fi

# Verify cookies
AUTH_TOKEN=$(cat twitter_session.json | grep -o '"name": "auth_token"' | wc -l)
CT0=$(cat twitter_session.json | grep -o '"name": "ct0"' | wc -l)

echo "🍪 Cookie Check:"
if [ "$AUTH_TOKEN" -gt 0 ]; then
    echo "   auth_token: ✅ YES"
else
    echo "   auth_token: ❌ NO"
    exit 1
fi

if [ "$CT0" -gt 0 ]; then
    echo "   ct0: ✅ YES"
else
    echo "   ct0: ❌ NO"
    exit 1
fi

echo ""
echo "🚀 Pushing to Railway..."
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm exec tsx scripts/ops/push-twitter-session-to-railway.ts

echo ""
echo "🔍 Verifying auth on Railway..."
railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts 2>&1 | grep "\[HARVESTER_AUTH\]"
