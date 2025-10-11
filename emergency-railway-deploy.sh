#!/bin/bash

# 🚂 EMERGENCY RAILWAY DEPLOYMENT SCRIPT
# Automatically deploy the fixed Twitter session to Railway

echo "🚂 EMERGENCY RAILWAY DEPLOYMENT"
echo "==============================="
echo ""

# Check if emergency session file exists
if [ ! -f "emergency_session_b64.txt" ]; then
    echo "❌ ERROR: emergency_session_b64.txt not found"
    echo "   Please run the emergency-twitter-session-fix.js script first"
    exit 1
fi

# Read the session data
SESSION_B64=$(cat emergency_session_b64.txt)
SESSION_LENGTH=${#SESSION_B64}

echo "📊 SESSION VALIDATION:"
echo "   Length: $SESSION_LENGTH characters"
echo "   Railway limit: 32768 characters"

if [ $SESSION_LENGTH -ge 32768 ]; then
    echo "   Status: ❌ OVER LIMIT - Cannot deploy"
    echo ""
    echo "🔧 SOLUTION: Creating ultra-minimal session..."
    
    # Extract just the essential parts using Node.js
    node -e "
    const fs = require('fs');
    const sessionData = JSON.parse(Buffer.from('$SESSION_B64', 'base64').toString());
    const minimalSession = {
        cookies: sessionData.cookies.filter(c => ['auth_token', 'ct0'].includes(c.name)),
        timestamp: new Date().toISOString(),
        method: 'ultra_minimal'
    };
    const minimalB64 = Buffer.from(JSON.stringify(minimalSession)).toString('base64');
    fs.writeFileSync('emergency_session_b64.txt', minimalB64);
    console.log('✅ Ultra-minimal session created: ' + minimalB64.length + ' chars');
    "
    
    # Re-read the minimal session
    SESSION_B64=$(cat emergency_session_b64.txt)
    SESSION_LENGTH=${#SESSION_B64}
    echo "   New length: $SESSION_LENGTH characters"
fi

if [ $SESSION_LENGTH -ge 32768 ]; then
    echo "   Status: ❌ STILL OVER LIMIT - Manual intervention required"
    exit 1
else
    echo "   Status: ✅ UNDER LIMIT - Ready to deploy"
fi

echo ""
echo "🚀 DEPLOYING TO RAILWAY..."

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Deploy the session
echo "🔧 Setting TWITTER_SESSION_B64 environment variable..."
railway variables set TWITTER_SESSION_B64="$SESSION_B64"

if [ $? -eq 0 ]; then
    echo "✅ Environment variable updated successfully"
    echo ""
    echo "🔄 Triggering Railway deployment..."
    railway deploy
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 DEPLOYMENT SUCCESSFUL!"
        echo "   Your Twitter bot should be operational within 2-3 minutes"
        echo "   Monitor logs: railway logs"
        echo ""
        echo "📊 NEXT STEPS:"
        echo "   1. Wait 3 minutes for deployment to complete"
        echo "   2. Check Railway logs for posting activity"
        echo "   3. Verify tweets are being posted to @SignalAndSynapse"
        echo ""
    else
        echo "❌ Railway deployment failed"
        echo "   Check Railway dashboard for details"
    fi
else
    echo "❌ Failed to set environment variable"
    echo "   You may need to set it manually in Railway dashboard"
fi
