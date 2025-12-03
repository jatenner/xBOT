#!/bin/bash
# 🚨 QUICK FIX FOR POSTING ISSUE
# Run: bash fix-posting-issue.sh

echo "🔍 Step 1: Checking Railway authentication..."
if ! railway whoami &>/dev/null; then
    echo "❌ Not logged in. Please run: railway login"
    exit 1
fi

echo "✅ Authenticated"
echo ""

echo "🔍 Step 2: Running diagnostic..."
railway run pnpm exec tsx scripts/railway-diagnose.ts

echo ""
echo "🔍 Step 3: Checking recent logs..."
railway logs --lines 50 | grep -E "\[POSTING_QUEUE\]|\[UNIFIED_PLAN\]|Circuit breaker" | tail -10

echo ""
echo "💡 Step 4: Quick fixes..."
echo "   To trigger plan job: railway run node -e \"require('./dist/jobs/planJob').planContent()\""
echo "   To restart service: railway restart"
echo "   To check variables: railway variables"


