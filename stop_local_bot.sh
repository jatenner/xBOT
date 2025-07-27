#!/bin/bash

echo "🛑 === STOPPING ALL LOCAL BOT PROCESSES ==="
echo ""

# Stop all node processes related to the bot
echo "🔍 Searching for bot processes..."

# Kill main.js processes
MAIN_PROCESSES=$(pgrep -f "node.*main\.js" | wc -l)
if [ $MAIN_PROCESSES -gt 0 ]; then
    echo "🛑 Stopping main.js processes..."
    pkill -f "node.*main\.js"
    echo "✅ Stopped $MAIN_PROCESSES main.js process(es)"
else
    echo "✅ No main.js processes found"
fi

# Kill npm start processes
NPM_PROCESSES=$(pgrep -f "npm.*start" | wc -l)
if [ $NPM_PROCESSES -gt 0 ]; then
    echo "🛑 Stopping npm start processes..."
    pkill -f "npm.*start"
    echo "✅ Stopped $NPM_PROCESSES npm process(es)"
else
    echo "✅ No npm start processes found"
fi

# Kill nodemon processes
NODEMON_PROCESSES=$(pgrep -f "nodemon" | wc -l)
if [ $NODEMON_PROCESSES -gt 0 ]; then
    echo "🛑 Stopping nodemon processes..."
    pkill -f "nodemon"
    echo "✅ Stopped $NODEMON_PROCESSES nodemon process(es)"
else
    echo "✅ No nodemon processes found"
fi

echo ""
echo "🔍 Verification check..."
sleep 2

REMAINING_PROCESSES=$(ps aux | grep -E "(node.*main\.js|npm.*start|nodemon)" | grep -v grep | wc -l)
if [ $REMAINING_PROCESSES -eq 0 ]; then
    echo "✅ ALL LOCAL BOT PROCESSES STOPPED"
    echo "🚀 Render deployment can now run safely without conflicts"
else
    echo "⚠️  Some processes may still be running:"
    ps aux | grep -E "(node.*main\.js|npm.*start|nodemon)" | grep -v grep
fi

echo ""
echo "🌐 Your Render deployment is now safe to operate autonomously!"
echo "📊 Monitor at: https://dashboard.render.com" 