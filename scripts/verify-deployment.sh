#!/bin/bash
# Verify Railway deployment matches latest commit

EXPECTED_SHA="1218966f44b9a56ade7e91cfa165936090a44b73"
EXPECTED_SHORT="1218966f"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🔍 RAILWAY DEPLOYMENT VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Expected SHA: $EXPECTED_SHA"
echo "Expected Short: $EXPECTED_SHORT"
echo ""

# Check /status endpoint
echo "1. Checking /status endpoint..."
STATUS=$(curl -sSf https://xbot-production-844b.up.railway.app/status 2>&1)
if [ $? -eq 0 ]; then
  APP_VERSION=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('app_version', 'NOT SET'))" 2>/dev/null || echo "PARSE_ERROR")
  GIT_SHA=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('git_sha', 'NOT SET'))" 2>/dev/null || echo "PARSE_ERROR")
  echo "   app_version: $APP_VERSION"
  echo "   git_sha: $GIT_SHA"
  
  if [[ "$APP_VERSION" == *"$EXPECTED_SHORT"* ]] || [[ "$GIT_SHA" == *"$EXPECTED_SHORT"* ]]; then
    echo "   ✅ MATCH: Deployment is up to date"
  else
    echo "   ⚠️  MISMATCH: Still running old code"
  fi
else
  echo "   ❌ Failed to fetch status"
fi

echo ""
echo "2. Checking Railway runtime..."
RAILWAY_SHA=$(railway run -s xBOT -- node -e "console.log(process.env.RAILWAY_GIT_COMMIT_SHA || 'NOT SET')" 2>&1 | tail -1)
echo "   RAILWAY_GIT_COMMIT_SHA: $RAILWAY_SHA"

if [[ "$RAILWAY_SHA" == *"$EXPECTED_SHORT"* ]]; then
  echo "   ✅ MATCH: Railway runtime matches"
else
  echo "   ⚠️  MISMATCH: Railway runtime is old"
fi

echo ""
echo "3. Checking for POST_ATTEMPT events..."
POST_ATTEMPT_COUNT=$(railway run -s xBOT -- pnpm exec tsx -e "
import('dotenv/config').then(async () => {
  const { getSupabaseClient } = await import('./src/db/index.js');
  const supabase = getSupabaseClient();
  const { count } = await supabase.from('system_events').select('*', { count: 'exact', head: true }).eq('event_type', 'POST_ATTEMPT');
  console.log(count || 0);
}).catch(() => console.log('0'));
" 2>&1 | tail -1)

echo "   POST_ATTEMPT events found: $POST_ATTEMPT_COUNT"
if [ "$POST_ATTEMPT_COUNT" != "0" ] && [ "$POST_ATTEMPT_COUNT" != "" ]; then
  echo "   ✅ POST_ATTEMPT logging is active"
else
  echo "   ⚠️  No POST_ATTEMPT events (may be old code or no attempts)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
