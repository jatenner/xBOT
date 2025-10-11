#!/bin/bash
echo "🚂 DEPLOYING MANUAL SESSION TO RAILWAY..."

if [ ! -f "working_session_manual.txt" ]; then
    echo "❌ ERROR: working_session_manual.txt not found"
    echo "   Please extract your session first using the browser console"
    exit 1
fi

SESSION_B64=$(cat working_session_manual.txt)
echo "📊 Session length: ${#SESSION_B64} chars"

if [ ${#SESSION_B64} -lt 100 ]; then
    echo "❌ ERROR: Session too short, extraction may have failed"
    exit 1
fi

echo "🚂 Setting Railway environment..."
railway variables --set "TWITTER_SESSION_B64=$SESSION_B64" --set "MANUAL_SESSION=true" --set "BYPASS_DETECTION=true"

echo "🔄 Triggering deployment..."
railway redeploy

echo "✅ MANUAL SESSION DEPLOYED!"
echo "   Monitor logs: railway logs"
echo "   Check in 2 minutes for posting activity"
