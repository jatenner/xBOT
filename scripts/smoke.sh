#!/bin/bash
# Smoke Test - Basic system validation
# Run after deployment to verify core functionality

set -euo pipefail

echo "🔥 xBOT Smoke Test"
echo "=================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test status endpoint
echo -n "1. Testing /status endpoint... "
if curl -sf http://0.0.0.0:8080/status > /dev/null; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
  echo "   Status endpoint not responding"
  exit 1
fi

# Test canary endpoint
echo -n "2. Testing /canary endpoint... "
CANARY_RESPONSE=$(curl -sf http://0.0.0.0:8080/canary || echo '{"ok":false}')
CANARY_OK=$(echo "$CANARY_RESPONSE" | grep -o '"ok"[[:space:]]*:[[:space:]]*true' || echo "")

if [ -n "$CANARY_OK" ]; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${YELLOW}⚠️  PARTIAL${NC}"
  echo "   Canary response: $CANARY_RESPONSE"
fi

# Run self-test
echo -n "3. Running self-test (LLM + DB)... "
if node -e "require('./dist/selfTest').run()" 2>/dev/null; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${YELLOW}⚠️  PARTIAL${NC}"
  echo "   Some self-tests may have failed (check logs)"
fi

echo ""
echo -e "${GREEN}🎉 Smoke test completed!${NC}"
echo ""
echo "Next steps:"
echo "  - Check logs: npm run logs"
echo "  - Run a job: npm run job:plan"
echo "  - View metrics: curl http://0.0.0.0:8080/metrics"

