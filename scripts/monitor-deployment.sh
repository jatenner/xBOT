#!/bin/bash
# Monitor Railway deployment until commit 1218966f is live

EXPECTED_SHA="1218966f44b9a56ade7e91cfa165936090a44b73"
EXPECTED_SHORT="1218966f"
MAX_ATTEMPTS=30
ATTEMPT=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🔍 MONITORING RAILWAY DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Expected SHA: $EXPECTED_SHORT"
echo "Polling every 10 seconds (max $MAX_ATTEMPTS attempts)..."
echo ""

INITIAL_BOOT_TIME=$(curl -sSf https://xbot-production-844b.up.railway.app/status 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('boot_time', 'N/A'))" 2>/dev/null || echo "N/A")
echo "Initial boot_time: $INITIAL_BOOT_TIME"
echo ""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "[$ATTEMPT/$MAX_ATTEMPTS] Checking deployment status..."
  
  STATUS=$(curl -sSf https://xbot-production-844b.up.railway.app/status 2>&1)
  
  if [ $? -eq 0 ]; then
    GIT_SHA=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('git_sha', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    APP_VERSION=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('app_version', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    BOOT_TIME=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('boot_time', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    RAILWAY_SHA=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('railway_git_commit_sha', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    
    echo "  git_sha: ${GIT_SHA:0:8}"
    echo "  app_version: ${APP_VERSION:0:8}"
    echo "  railway_git_commit_sha: ${RAILWAY_SHA:0:8}"
    echo "  boot_time: $BOOT_TIME"
    
    if [[ "$GIT_SHA" == *"$EXPECTED_SHORT"* ]] || [[ "$APP_VERSION" == *"$EXPECTED_SHORT"* ]] || [[ "$RAILWAY_SHA" == *"$EXPECTED_SHORT"* ]]; then
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "           ✅ DEPLOYMENT VERIFIED"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
      echo "✅ Commit $EXPECTED_SHORT is now live!"
      echo "✅ Boot time changed: $INITIAL_BOOT_TIME → $BOOT_TIME"
      echo ""
      exit 0
    fi
    
    if [ "$BOOT_TIME" != "$INITIAL_BOOT_TIME" ] && [ "$BOOT_TIME" != "N/A" ] && [ "$INITIAL_BOOT_TIME" != "N/A" ]; then
      echo "  ⚠️  Boot time changed but SHA doesn't match - may be deploying..."
    fi
  else
    echo "  ❌ Failed to fetch status"
  fi
  
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo "  Waiting 10 seconds..."
    sleep 10
    echo ""
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           ⚠️  DEPLOYMENT NOT DETECTED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "After $MAX_ATTEMPTS attempts, commit $EXPECTED_SHORT is not live."
echo "Current SHA: ${GIT_SHA:0:8}"
echo ""
echo "Next steps:"
echo "1. Check Railway dashboard for deployment status"
echo "2. Verify GitHub integration is enabled"
echo "3. Manually trigger deployment if needed"
echo ""
exit 1
