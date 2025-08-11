#!/bin/bash

# Production Migration Script
# Links to production project and pushes migrations with extra safety

set -e

echo "🏭 Deploying to PRODUCTION..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Please install:${NC}"
    echo "   npm install -g supabase"
    exit 1
fi

# Check for required environment variables
if [ -z "$PROD_PROJECT_REF" ]; then
    echo -e "${RED}❌ PROD_PROJECT_REF environment variable is required${NC}"
    echo "   Export it or run: export PROD_PROJECT_REF=your_prod_ref"
    exit 1
fi

# Production safety check
echo -e "${RED}⚠️  PRODUCTION DEPLOYMENT WARNING ⚠️${NC}"
echo -e "${YELLOW}You are about to deploy migrations to PRODUCTION${NC}"
echo -e "${YELLOW}Project: $PROD_PROJECT_REF${NC}"
echo ""
echo -e "${BLUE}Please confirm:${NC}"
echo "1. Shadow tests passed successfully"
echo "2. Staging deployment was successful"
echo "3. You have verified the migrations"
echo "4. This is the intended production project"
echo ""
read -p "Type 'DEPLOY TO PRODUCTION' to continue: " confirmation

if [ "$confirmation" != "DEPLOY TO PRODUCTION" ]; then
    echo -e "${YELLOW}❌ Deployment cancelled${NC}"
    exit 1
fi

echo -e "${BLUE}🔗 Linking to production project: $PROD_PROJECT_REF${NC}"

# Check if already linked to the right project
CURRENT_PROJECT=$(supabase status --output json 2>/dev/null | jq -r '.project_ref // empty' 2>/dev/null || echo "")

if [ "$CURRENT_PROJECT" != "$PROD_PROJECT_REF" ]; then
    echo -e "${BLUE}🔗 Linking to production project...${NC}"
    
    # Link to production project (will prompt for DB password if needed)
    supabase link --project-ref $PROD_PROJECT_REF
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to link to production project${NC}"
        echo -e "${YELLOW}💡 Make sure:${NC}"
        echo "   1. PROD_PROJECT_REF is correct"
        echo "   2. You have access to the project"
        echo "   3. Database password is correct"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Already linked to production project${NC}"
fi

echo -e "${BLUE}📋 Pushing migrations to PRODUCTION...${NC}"

# Push migrations
supabase db push --include-all

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to push migrations to production${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Production deployment completed successfully${NC}"

# Run verification if verify script exists and we have psql
if [ -f "supabase/verify/verify.sql" ] && command -v psql &> /dev/null; then
    echo -e "${BLUE}🔍 Running verification on production...${NC}"
    
    # Get connection details from Supabase
    DB_URL=$(supabase status --output json 2>/dev/null | jq -r '.db_url // empty' 2>/dev/null || echo "")
    
    if [ ! -z "$DB_URL" ]; then
        psql "$DB_URL" -f supabase/verify/verify.sql
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Production verification passed${NC}"
        else
            echo -e "${RED}❌ Production verification failed!${NC}"
            echo -e "${YELLOW}⚠️  Manual investigation required${NC}"
        fi
        
        # Also run drift check
        echo -e "${BLUE}🔍 Running drift check on production...${NC}"
        psql "$DB_URL" -f supabase/verify/drift_check.sql
    else
        echo -e "${YELLOW}⚠️  Could not get DB URL for verification${NC}"
    fi
fi

echo -e "${GREEN}🎉 PRODUCTION DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}📊 Please monitor application for any issues${NC}"
