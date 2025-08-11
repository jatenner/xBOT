#!/bin/bash

# Remote Database Verification Script
# Usage: bash scripts/remote-verify.sh "DB_URL"

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: $0 'postgresql://user:pass@host:port/db'"
    exit 1
fi

DB_URL="$1"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "🔍 Remote verification started at $(date)"
echo "📡 Target: ${DB_URL%@*}@***"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to run SQL and capture output
run_sql() {
    local script="$1"
    local name="$2"
    
    echo -e "${BLUE}🔍 Running $name...${NC}"
    
    if [ ! -f "$script" ]; then
        echo -e "${RED}❌ Script not found: $script${NC}"
        return 1
    fi
    
    # Use timeout to prevent hanging
    timeout 30s psql "$DB_URL" -f "$script" 2>&1 || {
        echo -e "${RED}❌ $name failed or timed out${NC}"
        return 1
    }
}

echo "=== VERIFICATION RESULTS ===" > "verification_${TIMESTAMP}.log"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found. Please install PostgreSQL client${NC}"
    exit 1
fi

# Test connection
echo -e "${BLUE}🔗 Testing database connection...${NC}"
if timeout 10s psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi

# Run verification
echo -e "${BLUE}📋 Running verification checks...${NC}"
if run_sql "supabase/verify/verify.sql" "verification"; then
    echo -e "${GREEN}✅ Verification completed${NC}"
    VERIFY_STATUS="PASS"
else
    echo -e "${RED}❌ Verification failed${NC}"
    VERIFY_STATUS="FAIL"
fi

# Run drift check
echo -e "${BLUE}🔍 Running drift detection...${NC}"
if run_sql "supabase/verify/drift_check.sql" "drift check"; then
    echo -e "${GREEN}✅ Drift check completed${NC}"
    DRIFT_STATUS="PASS"
else
    echo -e "${RED}❌ Drift check failed${NC}"
    DRIFT_STATUS="FAIL"
fi

# Summary
echo ""
echo "=== SUMMARY ==="
echo "Database: ${DB_URL%@*}@***"
echo "Verification: $VERIFY_STATUS"
echo "Drift Check: $DRIFT_STATUS"
echo "Timestamp: $(date)"

if [ "$VERIFY_STATUS" = "PASS" ] && [ "$DRIFT_STATUS" = "PASS" ]; then
    echo -e "${GREEN}🎉 Remote verification PASSED${NC}"
    exit 0
else
    echo -e "${RED}❌ Remote verification FAILED${NC}"
    exit 1
fi
