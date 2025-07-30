#!/bin/bash

# 🔄 AUTO-RESUMING RAILWAY LOGS LAUNCHER
# Never manually click "Resume Log Stream" again!

echo "🚀 Starting Auto-Resuming Railway Log Monitor..."
echo "==============================================="
echo ""
echo "✅ Features:"
echo "   🔄 Auto-resumes when Railway pauses the stream"
echo "   �� Beautiful web interface at http://localhost:3001"
echo "   ⚡ Real-time log streaming with WebSocket"
echo "   📊 Connection stats and uptime tracking"
echo "   🎮 Manual controls (resume, clear, auto-scroll)"
echo ""
echo "🌐 Opening http://localhost:3001 in 3 seconds..."
echo ""

# Give a moment for the message to be read
sleep 3

# Start the monitor in the background
node auto_railway_logs_monitor.js &
MONITOR_PID=$!

# Wait a moment for the server to start
sleep 2

# Try to open the web interface
if command -v open &> /dev/null; then
    open http://localhost:3001
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3001
else
    echo "📱 Please open: http://localhost:3001"
fi

echo ""
echo "🎉 Auto-resuming log monitor is running!"
echo "📱 Web interface: http://localhost:3001"
echo "🛑 To stop: Press Ctrl+C or run: kill $MONITOR_PID"
echo ""

# Wait for the background process
wait $MONITOR_PID
