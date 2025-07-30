#!/bin/bash

# 🚄 RAILWAY EMERGENCY START SCRIPT
echo "🚄 === RAILWAY EMERGENCY DEPLOYMENT ==="
echo "📅 Starting: $(date)"
echo "🎯 Target: Emergency bot recovery"
echo ""

# Set production environment
export NODE_ENV=production
export RAILWAY_ENVIRONMENT=production

# Start with enhanced error handling
echo "🚀 Starting emergency Twitter bot..."
exec node dist/main.js

# If main process exits, log error
echo "⚠️ Main process exited - Railway will restart"
exit 0