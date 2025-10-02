#!/bin/bash

# Auto-test posting after deployment
echo "🔄 Waiting for new deployment with fresh session..."
echo ""

MAX_ATTEMPTS=20
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  
  echo "[$ATTEMPT/$MAX_ATTEMPTS] Checking deployment status..."
  
  # Check if session file exists (indicates new deployment)
  SESSION_EXISTS=$(curl -s https://xbot-production-844b.up.railway.app/status 2>/dev/null | jq -r '.sessionFileExists' 2>/dev/null)
  
  if [ "$SESSION_EXISTS" = "true" ]; then
    echo "✅ New deployment detected with session file!"
    echo ""
    
    # Wait a few seconds for system to stabilize
    echo "⏳ Waiting 10 seconds for system to stabilize..."
    sleep 10
    
    # Trigger immediate post
    echo "🚀 Triggering immediate content generation and posting..."
    echo ""
    
    RESULT=$(curl -s -X POST "https://xbot-production-844b.up.railway.app/admin/generate-and-post-now" \
      -H "Authorization: Bearer xbot-admin-2025" \
      -H "Content-Type: application/json" 2>/dev/null)
    
    echo "Response: $RESULT"
    echo ""
    
    # Wait for posting to complete
    echo "⏳ Waiting 30 seconds for posting to complete..."
    sleep 30
    
    # Check Railway logs for posting results
    echo ""
    echo "📊 Recent logs:"
    echo "─────────────────────────────────────────────────"
    railway logs --service xBOT 2>&1 | grep -E "POSTING_START|POSTING_DONE|POSTING_FAIL|X_SESSION|PW\]" | tail -20
    
    echo ""
    echo "✅ Test complete! Check logs above for posting results."
    exit 0
  fi
  
  # Wait before next attempt
  sleep 15
done

echo "❌ Timeout waiting for deployment. Check Railway dashboard manually."
exit 1

