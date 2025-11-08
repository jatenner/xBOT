#!/bin/bash

echo "🔍 Checking Railway logs for harvester auth issues..."
echo ""

railway logs 2>&1 | grep -E "REAL_DISCOVERY|verifyAuth|Not authenticated|Authenticated session|HARVESTER.*searching|found.*opportunities" | tail -30

echo ""
echo "---"
echo "Look for:"
echo "  ❌ 'Not authenticated' = Session rejected by Twitter"
echo "  ✅ 'Authenticated session confirmed' = Session accepted"
echo "  '0 opportunities found' = Nothing found after search"

