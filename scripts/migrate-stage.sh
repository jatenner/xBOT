#!/bin/bash

# Staging Migration Script
# Links to staging project and pushes migrations

set -e

echo "🚀 Deploying to staging..."

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
if [ -z "$STAGING_PROJECT_REF" ]; then
    echo -e "${RED}❌ STAGING_PROJECT_REF environment variable is required${NC}"
    echo "   Export it or run: export STAGING_PROJECT_REF=your_staging_ref"
    exit 1
fi

echo -e "${BLUE}🔗 Linking to staging project: $STAGING_PROJECT_REF${NC}"

# Check if already linked to the right project
CURRENT_PROJECT=$(supabase status --output json 2>/dev/null | jq -r '.project_ref // empty' 2>/dev/null || echo "")

if [ "$CURRENT_PROJECT" != "$STAGING_PROJECT_REF" ]; then
    echo -e "${BLUE}🔗 Linking to staging project...${NC}"
    
    # Link to staging project (will prompt for DB password if needed)
    supabase link --project-ref $STAGING_PROJECT_REF
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to link to staging project${NC}"
        echo -e "${YELLOW}💡 Make sure:${NC}"
        echo "   1. STAGING_PROJECT_REF is correct"
        echo "   2. You have access to the project"
        echo "   3. Database password is correct"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Already linked to staging project${NC}"
fi

echo -e "${BLUE}📋 Pushing migrations to staging...${NC}"

# Push migrations
supabase db push --include-all

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to push migrations to staging${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Staging deployment completed successfully${NC}"

# Run verification if verify script exists and we have psql
if [ -f "supabase/verify/verify.sql" ] && command -v psql &> /dev/null; then
    echo -e "${BLUE}🔍 Running verification on staging...${NC}"
    
    # Get connection details from Supabase
    DB_URL=$(supabase status --output json 2>/dev/null | jq -r '.db_url // empty' 2>/dev/null || echo "")
    
    if [ ! -z "$DB_URL" ]; then
        psql "$DB_URL" -f supabase/verify/verify.sql
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Staging verification passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Staging verification had issues${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Could not get DB URL for verification${NC}"
    fi
fi

echo -e "${GREEN}🎉 Staging deployment pipeline completed!${NC}"
