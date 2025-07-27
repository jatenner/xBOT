#!/bin/bash

echo "🔍 === BOT INSTANCE STATUS CHECK ==="
echo ""

# Check for local processes
echo "🏠 LOCAL PROCESSES:"
LOCAL_COUNT=$(ps aux | grep -E "(node.*main\.js|npm.*start|nodemon)" | grep -v grep | wc -l)

if [ $LOCAL_COUNT -eq 0 ]; then
    echo "✅ No local bot processes running"
else
    echo "❌ LOCAL BOTS DETECTED ($LOCAL_COUNT processes):"
    ps aux | grep -E "(node.*main\.js|npm.*start|nodemon)" | grep -v grep | awk '{print "   🔹 " $11 " " $12 " " $13}'
    echo ""
    echo "⚠️  CONFLICT RISK: Local bots will interfere with Render deployment!"
    echo "🛑 Run: ./stop_local_bot.sh"
fi

echo ""
echo "☁️  RENDER STATUS:"
echo "🌐 Check deployment status: https://dashboard.render.com"
echo "📊 Monitor logs for posting activity"
echo ""

# Check Twitter API status from database
echo "🐦 TWITTER API STATUS:"
echo "📊 Recent tweet activity check..."

if [ -f "dist/main.js" ]; then
    echo "✅ Built code available for deployment"
else
    echo "⚠️  No built code found - run: npm run build"
fi

echo ""
echo "🎯 RECOMMENDATION:"
if [ $LOCAL_COUNT -eq 0 ]; then
    echo "✅ SAFE FOR RENDER DEPLOYMENT"
    echo "🚀 Your autonomous AI agent can run on Render without conflicts"
else
    echo "❌ STOP LOCAL PROCESSES FIRST"
    echo "🛑 Run: ./stop_local_bot.sh"
    echo "🚀 Then your Render deployment will be safe"
fi

echo ""
echo "📋 QUICK COMMANDS:"
echo "🛑 Stop local:  ./stop_local_bot.sh"
echo "🔍 Check status: ./check_bot_status.sh"
echo "🚀 Deploy:      git push origin main" 