#!/bin/bash
set -euo pipefail

SERVICE_URL="${SERVICE_URL:-https://xbot-production.up.railway.app}"
MAX_WAIT_SECONDS=240

echo "🧪 xBOT Smoke Tests"
echo "=================="
echo "Service URL: $SERVICE_URL"
echo ""

# Wait for service to be ready
echo "⏳ Waiting for service to be ready (max ${MAX_WAIT_SECONDS}s)..."

for i in $(seq 1 $((MAX_WAIT_SECONDS / 10))); do
  if curl -fsS "$SERVICE_URL/status" >/dev/null 2>&1; then
    echo "✅ Service is responding"
    break
  fi
  
  if [[ $i -eq $((MAX_WAIT_SECONDS / 10)) ]]; then
    echo "❌ Service not ready after ${MAX_WAIT_SECONDS}s"
    exit 1
  fi
  
  echo "   Attempt $i/$((MAX_WAIT_SECONDS / 10))... waiting 10s"
  sleep 10
done

echo ""
echo "🔥 Test 1: Single Post (Clean Format)"
echo "====================================="
echo "Request: GET /ai-post?format=single&topic=sleep&hook=tip"
echo ""

if curl -fsS "$SERVICE_URL/ai-post?format=single&topic=sleep&hook=tip"; then
  echo ""
  echo "✅ Single post test passed"
  echo ""
  echo "EXPECTED LOG LINES:"
  echo "  FORMAT_DECISION: final=single, reason=engine, tweets=1"
  echo "  FORMAT_SANITIZER: removed_thread_language_single (if thread language detected)"
  echo "  LINTER: format=single, tweets=1, t1_chars=XXX, actions=[...]"
  echo "  POST_START"
  echo "  LOGIN_CHECK: Confirmed logged in to X"
  echo "  POST_DONE: id=XXXXXXXXX"
  echo "  ✅ Posted intelligent tweet successfully"
else
  echo "❌ Single post test failed"
  exit 1
fi

echo ""
echo "🧵 Test 2: Thread Reply Chain (5-7 tweets)"
echo "========================================="
echo "Request: GET /force-thread?topic=stress recovery&mode=how_to"
echo ""

if curl -fsS "$SERVICE_URL/force-thread?topic=stress%20recovery&mode=how_to"; then
  echo ""
  echo "✅ Thread test passed"
  echo ""
  echo "EXPECTED LOG LINES:"
  echo "  FORMAT_DECISION: final=thread, reason=engine, tweets=5-7"
  echo "  LINTER: format=thread, tweets=N, t1_chars=XXX, actions=[...]"
  echo "  POST_START"
  echo "  THREAD_CHAIN: k=1/N, in_reply_to=none"
  echo "  POST_DONE: id=XXXXXXXXX"
  echo "  THREAD_CHAIN: k=2/N, in_reply_to=XXXXXXXXX"
  echo "  POST_DONE: id=YYYYYYYYY"
  echo "  ... (for each tweet in chain)"
  echo "  SESSION_SAVED: cookies=XX"
else
  echo "❌ Thread test failed"
  exit 1
fi

echo ""
echo "📄 Test 3: Longform → Thread Fallback"
echo "===================================="
echo "Request: GET /ai-post?format=longform_single&topic=ultra-processed food"
echo ""

if curl -fsS "$SERVICE_URL/ai-post?format=longform_single&topic=ultra-processed%20food"; then
  echo ""
  echo "✅ Longform fallback test passed"
  echo ""
  echo "EXPECTED LOG LINES (if longform unavailable):"
  echo "  FORMAT_DECISION: final=thread, reason=fallback_longform_to_thread, tweets=5-7"
  echo "  LINTER: format=thread, tweets=N, t1_chars=XXX, actions=[...]"
  echo "  THREAD_CHAIN: k=1/N, in_reply_to=none"
  echo "  ... (thread posting sequence)"
  echo ""
  echo "EXPECTED LOG LINES (if longform available):"
  echo "  FORMAT_DECISION: final=longform_single, reason=engine, tweets=1"
  echo "  LINTER: format=longform_single, tweets=1, t1_chars=XXX, actions=[...]"
  echo "  POST_START"
  echo "  POST_DONE: id=XXXXXXXXX"
else
  echo "❌ Longform fallback test failed"
  exit 1
fi

echo ""
echo "🔐 Authentication Check"
echo "======================"
echo "EXPECTED AUTH LOG LINE:"
echo "  LOGIN_CHECK: Found authenticated indicator: [data-testid=\"SideNav_AccountSwitcher_Button\"]"
echo "  OR: LOGIN_CHECK: Confirmed logged in to X"
echo ""
echo "❌ BAD AUTH LOG LINE:"
echo "  POST_SKIPPED_PLAYWRIGHT: login_required"
echo ""

echo "✅ All smoke tests completed successfully!"
echo ""
echo "🔍 Next Steps:"
echo "1. Check Railway logs for the expected log lines above"
echo "2. Verify no hashtags appear in any posted content"
echo "3. Confirm threads appear as proper reply chains on X/Twitter"
echo "4. Monitor engagement and growth metrics"