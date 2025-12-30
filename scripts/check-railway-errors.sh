#!/bin/bash

# Get the most recent build/deploy logs from Railway
# Check for errors that might be preventing startup

echo "🔍 Checking Railway Build Logs..."
echo ""

# Note: Railway logs command might hang, so we add timeout
timeout 15 railway logs --service xBOT --lines 300 2>&1 | \
  grep -E 'Error|error|BUILD|FAIL|Exception|Cannot find module|crashed|exited|ELIFECYCLE' | \
  tail -50

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If no errors shown above, check Railway dashboard directly:"
echo "https://railway.com/project/c987ff2e-2bc7-4c65-9187-11c1a82d4ac1/service/21eb1b60-57f1-40fe-bd0e-d589345fc37f"

