#!/bin/bash
set -euo pipefail

echo "🚀 xBOT Force Deploy - Growth Config"
echo "=================================="

# Preflight checks
echo "📋 Preflight checks..."

# Node version check
NODE_VERSION=$(node --version)
echo "✓ Node version: $NODE_VERSION"

# Git status check
if ! git diff --quiet; then
  echo "⚠️  Warning: Working directory has uncommitted changes"
  echo "   Continuing anyway (force deploy mode)"
fi

# Optional build
if [[ "${SKIP_BUILD:-false}" != "true" ]]; then
  echo "🔧 Building project..."
  npm ci --silent
  npm run build --silent
  echo "✓ Build complete"
fi

echo ""
echo "🌐 Railway Environment Variables Checklist"
echo "=========================================="
echo "Set these in Railway Dashboard > Variables:"
echo ""
echo "# Core Production Settings"
echo "LIVE_POSTS=true"
echo "FORCE_NO_HASHTAGS=true"
echo "EMOJI_MAX=2"
echo "TWEET_MAX_CHARS_HARD=279"
echo ""
echo "# Thread Configuration"
echo "ENABLE_THREADS=true"
echo "FALLBACK_SINGLE_TWEET_OK=false"
echo "THREAD_MIN_TWEETS=5"
echo "THREAD_MAX_TWEETS=9"
echo "THREAD_STRICT_REPLY_MODE=true"
echo ""
echo "# Longform Settings"
echo "LONGFORM_AUTODETECT=true"
echo "LONGFORM_FALLBACK_TO_THREAD=true"
echo ""
echo "# Posting Cadence"
echo "MAX_POSTS_PER_DAY=18"
echo "MAX_POSTS_PER_HOUR=3"
echo "MIN_GAP_BETWEEN_POSTS_MIN=60"
echo "MIN_GAP_SAME_FORMAT_MIN=180"
echo "THREAD_COOLDOWN_MIN=15"
echo "MIN_POSTS_PER_2HOURS=1"
echo ""
echo "# Growth Intelligence"
echo "EPM_EWMA_HALFLIFE_MIN=480"
echo "EXPLORE_RATIO_MIN=0.2"
echo "EXPLORE_RATIO_MAX=0.4"
echo "ENABLE_TWITTER_TRENDS=true"
echo "ENABLE_SMART_LIKE_BOT=true"
echo ""
echo "# Already Configured (verify present):"
echo "TWITTER_SESSION_B64=<EXISTING_SESSION>"
echo "OPENAI_API_KEY=<EXISTING_KEY>"
echo "SUPABASE_URL=<EXISTING_URL>"
echo "SUPABASE_ANON_KEY=<EXISTING_KEY>"
echo ""

# Git operations
echo "📦 Committing and deploying..."

git add .
git commit -m "chore(ops): force deploy growth config

- Add production environment variables
- Enable stable growth configuration
- Thread reply chains with human delays
- Format sanitization and linting" || echo "Nothing to commit"

git push origin main

echo "✅ Deployment triggered! Check Railway logs for deployment status."