#!/bin/bash

# 🚀 RESTORE FULL RAILWAY CONTROL
# This script will get you back complete Railway control like you had yesterday

echo "🚀 RESTORING FULL RAILWAY CONTROL"
echo "================================="
echo ""
echo "Yesterday you had full control. Today we lost it. Let's get it back!"
echo ""

# Step 1: Check what we have
echo "📊 STEP 1: Current Status Check"
echo "==============================="
echo ""

export PATH="/usr/local/bin:$PATH"

echo "Railway CLI version:"
railway --version

echo ""
echo "Git status:"
git status --porcelain | head -5

echo ""
echo "Git remote:"
git remote -v

echo ""

# Step 2: Fix Railway Authentication
echo "🔑 STEP 2: Railway Authentication Fix"
echo "===================================="
echo ""

echo "Current Railway auth status:"
railway whoami 2>&1 | head -3

echo ""
echo "The rate limit is blocking us. Here's what we'll do:"
echo ""

# Step 3: Multiple Authentication Strategies
echo "🎯 STEP 3: Authentication Strategies"
echo "==================================="
echo ""

echo "STRATEGY A: Wait for Rate Limit (Current Status)"
echo "------------------------------------------------"
echo "Railway is rate limiting our IP. This typically clears in 30-60 minutes."
echo "We can check periodically with: railway whoami"
echo ""

echo "STRATEGY B: Use Different Network (Immediate)"
echo "--------------------------------------------"
echo "If you have mobile hotspot or different WiFi:"
echo "1. Switch networks"
echo "2. Run: railway login"
echo "3. Authenticate in browser"
echo ""

echo "STRATEGY C: Use Railway Web Dashboard (Works Now)"
echo "------------------------------------------------"
echo "For immediate control while CLI is rate limited:"
echo "1. https://railway.app → xBOT → Settings"
echo "2. Manual redeploy via dashboard"
echo "3. Variable management via web interface"
echo ""

# Step 4: Git Deployment Setup
echo "🔄 STEP 4: Git Deployment Setup"
echo "==============================="
echo ""

echo "Checking if Railway is connected to GitHub..."
if git remote -v | grep -q "railway"; then
    echo "✅ Railway git remote exists"
else
    echo "❌ Railway git remote missing"
    echo "We'll need to reconnect this once CLI works"
fi

echo ""
echo "Current git remotes:"
git remote -v

echo ""

# Step 5: Deployment Methods
echo "🚀 STEP 5: Available Deployment Methods"
echo "======================================="
echo ""

echo "METHOD 1: Git Push (Preferred - Automatic)"
echo "------------------------------------------"
echo "Once Railway CLI is working:"
echo "1. git add ."
echo "2. git commit -m 'Deploy changes'"
echo "3. git push origin main"
echo "4. Railway auto-deploys from GitHub"
echo ""

echo "METHOD 2: Railway Up (Direct Deploy)"
echo "-----------------------------------"
echo "Once Railway CLI is working:"
echo "1. railway up"
echo "2. Deploys current local code directly"
echo "3. Bypasses git entirely"
echo ""

echo "METHOD 3: Manual Redeploy (Works Now)"
echo "------------------------------------"
echo "Via Railway dashboard:"
echo "1. Go to https://railway.app → xBOT"
echo "2. Click 'Redeploy' button"
echo "3. Uses latest code from GitHub"
echo ""

# Step 6: Immediate Actions
echo "⚡ STEP 6: Immediate Action Plan"
echo "==============================="
echo ""

echo "RIGHT NOW (While CLI is rate limited):"
echo "1. Use Railway dashboard for urgent changes"
echo "2. Add crash prevention variables:"
echo "   NODE_OPTIONS=--max-old-space-size=512"
echo "   PLAYWRIGHT_BROWSER_ARGS=--no-sandbox,--disable-dev-shm-usage"
echo "3. Redeploy via dashboard"
echo ""

echo "ONCE CLI WORKS (Rate limit clears):"
echo "1. railway login"
echo "2. railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
echo "3. Test: railway status"
echo "4. Test: railway logs"
echo "5. Test: railway up"
echo ""

# Step 7: Recovery Commands
echo "🔧 STEP 7: Recovery Commands"
echo "============================"
echo ""

echo "Save these commands for when rate limit clears:"
echo ""
echo "# Full Railway CLI restoration:"
echo "export PATH=\"/usr/local/bin:\$PATH\""
echo "railway login"
echo "railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
echo "railway status"
echo ""
echo "# Test deployments:"
echo "railway up --detach"
echo "railway logs"
echo ""
echo "# Git deployment setup:"
echo "git remote add railway https://railway.app/project/c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
echo "git push railway main"
echo ""

# Step 8: Monitoring
echo "📊 STEP 8: How to Monitor Rate Limit"
echo "===================================="
echo ""

echo "Check every 15 minutes:"
echo "railway whoami"
echo ""
echo "When you see 'Unauthorized' instead of 'ratelimited', run:"
echo "railway login"
echo ""

echo "🎯 SUMMARY"
echo "=========="
echo ""
echo "The issue: Railway rate limited our IP from too many auth attempts"
echo "The fix: Wait 30-60 minutes, then railway login will work"
echo "Meanwhile: Use Railway dashboard for urgent changes"
echo ""
echo "You WILL get full control back - just need to wait out the rate limit!"
echo ""
echo "🚀 YOUR FULL CONTROL WILL BE RESTORED!"
