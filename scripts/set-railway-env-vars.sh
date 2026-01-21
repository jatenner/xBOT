#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# SET RAILWAY ENVIRONMENT VARIABLES
# Attempts to set variables via CLI, falls back to instructions
# ═══════════════════════════════════════════════════════════════════════════════

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🚀 SETTING RAILWAY ENVIRONMENT VARIABLES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
  echo "❌ Railway CLI not found. Install: npm i -g @railway/cli"
  echo ""
  echo "💡 Manual setup via Railway Dashboard:"
  echo "   1. Go to Railway Dashboard → Your Project → Variables"
  echo "   2. Add these variables:"
  echo "      - GROWTH_CONTROLLER_ENABLED=true"
  echo "      - MAX_POSTS_PER_HOUR=2"
  echo "      - MAX_REPLIES_PER_HOUR=6"
  echo "      - GROWTH_CONTROLLER_MAX_STEP_POSTS=1"
  echo "      - GROWTH_CONTROLLER_MAX_STEP_REPLIES=2"
  echo "   3. Railway will auto-redeploy"
  exit 1
fi

# Check if service is linked
if ! railway status &> /dev/null || railway status 2>&1 | grep -q "Service: None"; then
  echo "⚠️  Railway service not linked."
  echo ""
  echo "💡 To link service:"
  echo "   1. Run: railway service"
  echo "   2. Select your service"
  echo "   3. Then run this script again"
  echo ""
  echo "Or set variables manually via Railway Dashboard (see above)"
  exit 1
fi

echo "📥 Setting Railway environment variables..."
echo ""

# Set variables
railway variables --set "GROWTH_CONTROLLER_ENABLED=true" && echo "✅ Set GROWTH_CONTROLLER_ENABLED=true" || echo "❌ Failed to set GROWTH_CONTROLLER_ENABLED"
railway variables --set "MAX_POSTS_PER_HOUR=2" && echo "✅ Set MAX_POSTS_PER_HOUR=2" || echo "❌ Failed to set MAX_POSTS_PER_HOUR"
railway variables --set "MAX_REPLIES_PER_HOUR=6" && echo "✅ Set MAX_REPLIES_PER_HOUR=6" || echo "❌ Failed to set MAX_REPLIES_PER_HOUR"
railway variables --set "GROWTH_CONTROLLER_MAX_STEP_POSTS=1" && echo "✅ Set GROWTH_CONTROLLER_MAX_STEP_POSTS=1" || echo "❌ Failed to set GROWTH_CONTROLLER_MAX_STEP_POSTS"
railway variables --set "GROWTH_CONTROLLER_MAX_STEP_REPLIES=2" && echo "✅ Set GROWTH_CONTROLLER_MAX_STEP_REPLIES=2" || echo "❌ Failed to set GROWTH_CONTROLLER_MAX_STEP_REPLIES"

echo ""
echo "🔄 Triggering redeploy..."
railway redeploy && echo "✅ Redeploy triggered" || echo "⚠️  Redeploy may need to be triggered manually"

echo ""
echo "✅ Variables set! Railway will redeploy automatically."
echo ""
echo "📊 Verify in 2-3 minutes:"
echo "   pnpm run verify:enforcement"
