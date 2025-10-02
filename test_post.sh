#!/bin/bash

# 🧪 Test Posting Now
# This triggers the posting job directly on Railway

echo "🚀 Triggering posting job on Railway..."
echo ""

# Use railway logs to see real-time output
railway logs --tail &
LOGS_PID=$!

# Wait 3 seconds for logs to connect
sleep 3

# Check Railway for posting activity
echo "📊 Watching for posting activity..."
echo "   Look for: [POSTING_QUEUE] 📮 Processing posting queue"
echo "   Look for: ✅ RAILWAY_SESSION: Session test passed"
echo "   Look for: ✅ Posted successfully"
echo ""
echo "Press Ctrl+C to stop watching logs"
echo ""

# Keep logs running
wait $LOGS_PID

