#!/bin/bash
set -e

cd /Users/jonahtenner/Desktop/xBOT

echo "🚀 Pushing session to Railway..."
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm exec tsx scripts/ops/push-twitter-session-to-railway.ts

echo ""
echo "🔍 Verifying auth on Railway..."
railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts 2>&1 | grep "\[HARVESTER_AUTH\]" | head -3
