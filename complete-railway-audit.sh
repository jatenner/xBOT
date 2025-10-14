#!/bin/bash

# 🔍 COMPLETE RAILWAY AUDIT & RECOVERY
# Full diagnostic and restoration of Railway CLI, Git, and system control

echo "🔍 COMPLETE RAILWAY AUDIT & RECOVERY"
echo "===================================="
echo ""
echo "Let's audit EVERYTHING and fix Railway properly before touching the system."
echo ""

# Set up environment
export PATH="/usr/local/bin:$PATH"

echo "📊 STEP 1: COMPLETE SYSTEM AUDIT"
echo "================================"
echo ""

echo "🔧 Railway CLI Status:"
echo "----------------------"
echo "Version: $(railway --version 2>/dev/null || echo 'CLI not working')"
echo "Location: $(which railway 2>/dev/null || echo 'Not found in PATH')"
echo "Auth Status: $(railway whoami 2>&1 | head -1)"
echo ""

echo "🔗 Git Configuration:"
echo "--------------------"
echo "Git remotes:"
git remote -v
echo ""
echo "Current branch: $(git branch --show-current)"
echo "Git status:"
git status --porcelain | head -5
echo ""

echo "🌐 Network & API Status:"
echo "------------------------"
echo "Testing Railway API connectivity..."

# Test different Railway endpoints
echo "• railway.app connectivity:"
curl -s -I "https://railway.app" | head -1 || echo "Failed to connect"

echo "• Railway API connectivity:"
curl -s -I "https://backboard.railway.app" | head -1 || echo "Failed to connect"

echo ""

echo "📂 Local Configuration:"
echo "----------------------"
echo "Railway config directory:"
if [ -d ~/.railway ]; then
    echo "✅ ~/.railway exists"
    echo "Contents:"
    ls -la ~/.railway/
    echo ""
    if [ -f ~/.railway/config.json ]; then
        echo "Config file size: $(wc -c < ~/.railway/config.json) bytes"
        echo "Config structure:"
        cat ~/.railway/config.json | jq keys 2>/dev/null || echo "Invalid JSON or jq not available"
    fi
else
    echo "❌ ~/.railway directory missing"
fi
echo ""

echo "🎯 STEP 2: IDENTIFY ALL ISSUES"
echo "=============================="
echo ""

# Check for rate limiting
echo "🚫 Rate Limiting Check:"
echo "----------------------"
railway_status=$(railway whoami 2>&1)
if echo "$railway_status" | grep -q "ratelimited"; then
    echo "❌ ISSUE: Still rate limited"
    echo "   Status: $railway_status"
    echo "   Solution: Wait longer or use different network"
elif echo "$railway_status" | grep -q "Unauthorized"; then
    echo "✅ Rate limit cleared - ready to authenticate"
elif echo "$railway_status" | grep -q "@"; then
    echo "✅ Already authenticated as: $railway_status"
else
    echo "❓ Unknown status: $railway_status"
fi
echo ""

echo "🔐 Authentication Issues:"
echo "------------------------"
# Check different auth methods
echo "Testing authentication methods..."

echo "• Browser login availability:"
railway login --help | grep -E "(browser|login)" || echo "Help not available"

echo "• Token-based auth test:"
if [ -n "$RAILWAY_TOKEN" ]; then
    echo "✅ RAILWAY_TOKEN environment variable set"
else
    echo "❌ No RAILWAY_TOKEN environment variable"
fi
echo ""

echo "🔗 Project Linking Issues:"
echo "-------------------------"
echo "Project ID we need: c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
echo "Current project link status:"
railway status 2>&1 | head -3 || echo "Cannot check - not authenticated"
echo ""

echo "🎯 STEP 3: SYSTEMATIC RECOVERY PLAN"
echo "==================================="
echo ""

if echo "$railway_status" | grep -q "ratelimited"; then
    echo "🕐 RECOVERY PLAN A: Rate Limit Active"
    echo "------------------------------------"
    echo "1. Rate limit still active - need to wait or change network"
    echo "2. Options:"
    echo "   a) Wait 30-60 more minutes"
    echo "   b) Switch to mobile hotspot/different WiFi"
    echo "   c) Try from different computer/location"
    echo ""
    echo "3. Once rate limit clears:"
    echo "   railway login"
    echo "   railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
    echo ""
    
elif echo "$railway_status" | grep -q "Unauthorized"; then
    echo "🚀 RECOVERY PLAN B: Ready to Authenticate"
    echo "-----------------------------------------"
    echo "Rate limit cleared! Let's authenticate now:"
    echo ""
    
    echo "Step 1: Clean authentication"
    rm -rf ~/.railway
    echo "✅ Cleared old auth data"
    
    echo ""
    echo "Step 2: Authenticate (will open browser)"
    read -p "Press ENTER to open browser login..." 
    
    if railway login; then
        echo "✅ Authentication successful!"
        
        echo ""
        echo "Step 3: Link to project"
        if railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1; then
            echo "✅ Project linked successfully!"
            
            echo ""
            echo "Step 4: Verify full access"
            echo "Testing commands..."
            
            echo "• railway whoami:"
            railway whoami
            
            echo "• railway status:"
            railway status
            
            echo "• railway variables (first 3):"
            railway variables | head -3
            
            echo ""
            echo "🎉 FULL RAILWAY CONTROL RESTORED!"
            echo "================================"
            echo ""
            echo "Available commands:"
            echo "✅ railway logs      # View live logs"
            echo "✅ railway up        # Deploy local code"
            echo "✅ railway variables # Manage variables"
            echo "✅ railway status    # Check health"
            echo ""
            
        else
            echo "❌ Project linking failed"
            echo "Manual link command: railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
        fi
        
    else
        echo "❌ Authentication failed"
        echo "Try: railway login --browserless"
    fi
    
elif echo "$railway_status" | grep -q "@"; then
    echo "✅ RECOVERY PLAN C: Already Authenticated"
    echo "----------------------------------------"
    echo "You're already logged in! Let's verify project linking:"
    echo ""
    
    echo "Current status:"
    railway status
    
    echo ""
    echo "If project not linked, run:"
    echo "railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
    
else
    echo "❓ RECOVERY PLAN D: Unknown State"
    echo "--------------------------------"
    echo "Unexpected Railway CLI state. Let's try manual recovery:"
    echo ""
    echo "1. Reinstall Railway CLI:"
    echo "   bash <(curl -fsSL cli.new/railway/install.sh)"
    echo ""
    echo "2. Clear all config:"
    echo "   rm -rf ~/.railway"
    echo ""
    echo "3. Fresh authentication:"
    echo "   railway login"
    echo ""
fi

echo ""
echo "🔗 STEP 4: GIT INTEGRATION SETUP"
echo "================================"
echo ""

echo "Once Railway CLI is working, set up git deployment:"
echo ""
echo "1. Add Railway git remote:"
echo "   git remote add railway https://railway.app/project/c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
echo ""
echo "2. Test git deployment:"
echo "   git push railway main"
echo ""
echo "3. Enable auto-deploy from GitHub:"
echo "   (This is configured in Railway dashboard)"
echo ""

echo "🎯 STEP 5: VERIFICATION CHECKLIST"
echo "================================="
echo ""
echo "Before touching the crashed system, verify:"
echo ""
echo "✅ railway whoami        # Shows your email"
echo "✅ railway status        # Shows project info"
echo "✅ railway logs          # Shows live logs"
echo "✅ railway variables     # Shows env vars"
echo "✅ railway up --help     # Shows deploy options"
echo "✅ git push railway main # Git deployment works"
echo ""
echo "Once ALL of these work, we can fix the system crash properly!"
echo ""
echo "🚀 READY FOR FULL RAILWAY RECOVERY!"
