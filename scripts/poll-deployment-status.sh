#!/bin/bash
# Poll Railway status endpoint until deployment succeeds

EXPECTED_SHORT="66949ad3"
MAX_ATTEMPTS=60
ATTEMPT=0
INTERVAL=10

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🔍 POLLING RAILWAY DEPLOYMENT STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Expected SHA: $EXPECTED_SHORT"
echo "Polling every $INTERVAL seconds (max $MAX_ATTEMPTS attempts = $((MAX_ATTEMPTS * INTERVAL / 60)) minutes)"
echo ""

INITIAL_BOOT_TIME=$(curl -sSf https://xbot-production-844b.up.railway.app/status 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('boot_time', 'N/A'))" 2>/dev/null || echo "N/A")
INITIAL_BOOT_ID=$(curl -sSf https://xbot-production-844b.up.railway.app/status 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('boot_id', 'N/A'))" 2>/dev/null || echo "N/A")

echo "Initial boot_time: $INITIAL_BOOT_TIME"
echo "Initial boot_id: ${INITIAL_BOOT_ID:0:8}..."
echo ""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "[$ATTEMPT/$MAX_ATTEMPTS] $(date '+%H:%M:%S') - Checking status..."
  
  STATUS=$(curl -sSf https://xbot-production-844b.up.railway.app/status 2>&1)
  
  if [ $? -eq 0 ]; then
    GIT_SHA=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('git_sha', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    APP_VERSION=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('app_version', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    RAILWAY_SHA=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('railway_git_commit_sha', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    BOOT_TIME=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('boot_time', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    BOOT_ID=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('boot_id', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    
    echo "  git_sha: ${GIT_SHA:0:8}"
    echo "  app_version: ${APP_VERSION:0:8}"
    echo "  railway_git_commit_sha: ${RAILWAY_SHA:0:8}"
    echo "  boot_time: $BOOT_TIME"
    echo "  boot_id: ${BOOT_ID:0:8}..."
    
    SHA_MATCH=false
    if [[ "$GIT_SHA" == *"$EXPECTED_SHORT"* ]] || [[ "$APP_VERSION" == *"$EXPECTED_SHORT"* ]] || [[ "$RAILWAY_SHA" == *"$EXPECTED_SHORT"* ]]; then
      SHA_MATCH=true
    fi
    
    BOOT_CHANGED=false
    if [ "$BOOT_TIME" != "$INITIAL_BOOT_TIME" ] && [ "$BOOT_TIME" != "N/A" ] && [ "$INITIAL_BOOT_TIME" != "N/A" ]; then
      BOOT_CHANGED=true
    fi
    
    if [ "$SHA_MATCH" = true ] && [ "$BOOT_CHANGED" = true ]; then
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "           ✅ DEPLOYMENT VERIFIED"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
      echo "✅ Commit $EXPECTED_SHORT is now live!"
      echo "✅ Boot time changed: $INITIAL_BOOT_TIME → $BOOT_TIME"
      echo "✅ Boot ID changed: ${INITIAL_BOOT_ID:0:8}... → ${BOOT_ID:0:8}..."
      echo ""
      echo "Full status JSON:"
      echo "$STATUS" | python3 -m json.tool
      echo ""
      exit 0
    elif [ "$SHA_MATCH" = true ] && [ "$BOOT_CHANGED" = false ]; then
      echo "  ⚠️  SHA matches but boot_time unchanged - may be deploying..."
    elif [ "$SHA_MATCH" = false ] && [ "$BOOT_CHANGED" = true ]; then
      echo "  ⚠️  Boot time changed but SHA doesn't match - wrong deployment?"
    fi
  else
    echo "  ❌ Failed to fetch status"
  fi
  
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo "  Waiting $INTERVAL seconds..."
    sleep $INTERVAL
    echo ""
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           ⚠️  DEPLOYMENT NOT DETECTED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "After $MAX_ATTEMPTS attempts ($((MAX_ATTEMPTS * INTERVAL / 60)) minutes), commit $EXPECTED_SHORT is not live."
echo "Current SHA: ${GIT_SHA:0:8}"
echo ""
echo "Next steps:"
echo "1. Check Railway dashboard for deployment status"
echo "2. Verify build completed successfully"
echo "3. Check for healthcheck failures"
echo ""
exit 1
