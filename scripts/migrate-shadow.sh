#!/bin/bash

# Shadow Test Migration Script
# Boots PostgreSQL container, applies migrations, runs verification

set -e

echo "🧪 Starting shadow migration test..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_VERSION="15"
CONTAINER_NAME="xbot-shadow-test-$$"
DB_NAME="shadow_test"
DB_USER="postgres"
DB_PASSWORD="shadow_test_pass"
DB_PORT="5433"

# Function to cleanup
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up container...${NC}"
    docker stop $CONTAINER_NAME >/dev/null 2>&1 || true
    docker rm $CONTAINER_NAME >/dev/null 2>&1 || true
}

# Set trap for cleanup
trap cleanup EXIT

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first:${NC}"
    echo "   brew install docker"
    echo "   Then start Docker Desktop"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found. Please install PostgreSQL client:${NC}"
    echo "   brew install postgresql"
    exit 1
fi

# Start PostgreSQL container
echo -e "${BLUE}🐳 Starting PostgreSQL $POSTGRES_VERSION container...${NC}"
docker run --name $CONTAINER_NAME \
    -e POSTGRES_USER=$DB_USER \
    -e POSTGRES_PASSWORD=$DB_PASSWORD \
    -e POSTGRES_DB=$DB_NAME \
    -p $DB_PORT:5432 \
    -d postgres:$POSTGRES_VERSION

# Wait for PostgreSQL to be ready
echo -e "${BLUE}⏳ Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
    if PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start within 30 seconds${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo -e "\n${GREEN}✅ PostgreSQL is ready${NC}"

# Apply migrations in order
echo -e "${BLUE}📋 Applying migrations...${NC}"
for migration in supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo -e "${BLUE}  → $(basename "$migration")${NC}"
        PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME \
            -v ON_ERROR_STOP=1 \
            -f "$migration"
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Migration failed: $(basename "$migration")${NC}"
            exit 1
        fi
    fi
done
echo -e "${GREEN}✅ All migrations applied successfully${NC}"

# Run verification
echo -e "${BLUE}🔍 Running verification checks...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -f supabase/verify/verify.sql

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Verification failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Verification passed${NC}"

# Run drift check
echo -e "${BLUE}🔍 Running drift detection...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -f supabase/verify/drift_check.sql

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Drift check had issues (non-fatal)${NC}"
else
    echo -e "${GREEN}✅ Drift check completed${NC}"
fi

echo -e "${GREEN}🎉 Shadow test completed successfully!${NC}"
echo -e "${BLUE}📊 Migration is safe for staging deployment${NC}"
