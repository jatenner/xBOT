#!/bin/bash

# 🚂 BULLETPROOF RAILWAY LOGS
# Now uses OAuth authentication from browser login

echo "🚂 Fetching Railway logs..."
echo ""

# Try to get logs (uses OAuth token from ~/.railway/config.json)
railway logs 2>&1 | tee /tmp/railway_logs_output.txt

# Check if unauthorized
if grep -q "Unauthorized" /tmp/railway_logs_output.txt; then
    echo ""
    echo "⚠️ Railway CLI authentication expired"
    echo "🔄 Opening browser to re-authenticate..."
    echo ""
    
    # Re-authenticate
    railway login
    
    # Wait a moment
    sleep 2
    
    # Try logs again
    echo ""
    echo "🔄 Retrying logs..."
    echo ""
    railway logs
else
    # Logs worked, clean up
    rm -f /tmp/railway_logs_output.txt
fi

