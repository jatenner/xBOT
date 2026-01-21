#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ENABLE ENFORCEMENT IN RAILWAY
# Sets required environment variables for Growth Controller enforcement
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🚀 ENABLING GROWTH CONTROLLER ENFORCEMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
  echo "❌ Railway CLI not found. Install: npm i -g @railway/cli"
  echo ""
  echo "💡 Manual setup:"
  echo "   1. Go to Railway Dashboard → Variables"
  echo "   2. Add: GROWTH_CONTROLLER_ENABLED=true"
  echo "   3. Add: MAX_POSTS_PER_HOUR=2"
  echo "   4. Add: MAX_REPLIES_PER_HOUR=6"
  echo "   5. Redeploy"
  exit 1
fi

# Check if linked to project
if ! railway status &> /dev/null; then
  echo "⚠️  Not linked to Railway project. Run: railway link"
  exit 1
fi

echo "📥 Setting Railway environment variables..."
echo ""

# Enable controller
railway variables --set "GROWTH_CONTROLLER_ENABLED=true"
echo "✅ Set GROWTH_CONTROLLER_ENABLED=true"

# Set conservative envelopes
railway variables --set "MAX_POSTS_PER_HOUR=2"
echo "✅ Set MAX_POSTS_PER_HOUR=2"

railway variables --set "MAX_REPLIES_PER_HOUR=6"
echo "✅ Set MAX_REPLIES_PER_HOUR=6"

railway variables --set "GROWTH_CONTROLLER_MAX_STEP_POSTS=1"
echo "✅ Set GROWTH_CONTROLLER_MAX_STEP_POSTS=1"

railway variables --set "GROWTH_CONTROLLER_MAX_STEP_REPLIES=2"
echo "✅ Set GROWTH_CONTROLLER_MAX_STEP_REPLIES=2"

echo ""
echo "🔄 Redeploying Railway service..."
railway redeploy

echo ""
echo "✅ Enforcement enabled! Railway will redeploy automatically."
echo ""
echo "📊 Next steps:"
echo "   1. Wait for redeploy (2-3 minutes)"
echo "   2. Run: pnpm run verify:enforcement"
echo "   3. Check logs: railway logs | grep GROWTH_CONTROLLER"
echo ""
