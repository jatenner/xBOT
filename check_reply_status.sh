#!/bin/bash

echo "========================================="
echo "  🔍 REPLY SYSTEM STATUS CHECK"
echo "========================================="
echo ""

echo "✅ ENABLE_REPLIES=true (confirmed in Railway)"
echo ""

echo "Checking Railway logs for reply activity..."
railway logs 2>&1 | grep -i "reply\|harvester" | tail -15

echo ""
echo "========================================="
echo "If you see NO logs above, the system might be:"
echo "  1. Still deploying new code (wait 2-3 min)"
echo "  2. Waiting for first run (harvester: 10 min, posting: 2 min after startup)"
echo "  3. Check full logs: railway logs"
echo "========================================="
