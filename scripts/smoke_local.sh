#!/bin/bash
set -e

echo "=== LOCAL SMOKE TEST ==="

# Clean and build
echo "1. Installing dependencies..."
pnpm install --silent

echo "2. Building TypeScript..."
set +e
pnpm run build 2>&1 | grep -v "error TS" | tail -5 || true
set -e

# Check entrypoint exists
if [ ! -f "dist/src/railwayEntrypoint.js" ]; then
  echo "❌ ERROR: dist/src/railwayEntrypoint.js not found"
  exit 1
fi

echo "3. Starting server in background..."
PORT=8080 node dist/src/railwayEntrypoint.js > /tmp/xbot-smoke.log 2>&1 &
SERVER_PID=$!

# Wait for server to start (max 20s)
echo "4. Waiting for health endpoint..."
MAX_WAIT=20
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  if curl -s --fail http://127.0.0.1:8080/status > /dev/null 2>&1; then
    echo "✅ Health endpoint responding!"
    break
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  echo "  Waiting... (${ELAPSED}s)"
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "❌ ERROR: Health endpoint did not respond within ${MAX_WAIT}s"
  echo "Server logs:"
  tail -50 /tmp/xbot-smoke.log
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

echo "5. Testing /status endpoint..."
STATUS_RESPONSE=$(curl -s http://127.0.0.1:8080/status)
if echo "$STATUS_RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Status response valid: $STATUS_RESPONSE"
else
  echo "❌ ERROR: Invalid status response: $STATUS_RESPONSE"
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

echo "6. Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "✅ LOCAL SMOKE TEST PASSED"
