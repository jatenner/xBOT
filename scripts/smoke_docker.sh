#!/bin/bash
set -e

echo "=== DOCKER SMOKE TEST ==="

# Clean up any existing container
docker rm -f xbot-smoke 2>/dev/null || true

echo "1. Building Docker image..."
docker build -t xbot-smoke . > /tmp/docker-build.log 2>&1

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Docker build failed"
  tail -50 /tmp/docker-build.log
  exit 1
fi

echo "2. Starting container..."
docker run -d -p 8080:8080 -e PORT=8080 --name xbot-smoke xbot-smoke

# Wait for health endpoint (max 30s)
echo "3. Waiting for health endpoint..."
MAX_WAIT=30
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
  echo "Container logs:"
  docker logs xbot-smoke | tail -200
  docker rm -f xbot-smoke
  exit 1
fi

echo "4. Testing /status endpoint..."
STATUS_RESPONSE=$(curl -s http://127.0.0.1:8080/status)
if echo "$STATUS_RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Status response valid: $STATUS_RESPONSE"
else
  echo "❌ ERROR: Invalid status response: $STATUS_RESPONSE"
  docker logs xbot-smoke | tail -50
  docker rm -f xbot-smoke
  exit 1
fi

echo "5. Container logs (last 50 lines):"
docker logs xbot-smoke | tail -50

echo "6. Cleaning up..."
docker rm -f xbot-smoke

echo "✅ DOCKER SMOKE TEST PASSED"
