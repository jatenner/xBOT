#!/bin/bash
# Railway CLI Cheat Sheet for xBOT
# Quick commands for common operations

set -euo pipefail

SERVICE="xbot-production"

echo "🚂 Railway CLI Cheat Sheet for xBOT"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

show_help() {
  echo "Usage: ./scripts/railway-cheats.sh [command]"
  echo ""
  echo "Commands:"
  echo "  logs          - Follow live logs (tail mode, press q to exit)"
  echo "  logs-last     - Show last 300 lines of logs"
  echo "  logs-errors   - Filter logs for errors only"
  echo "  run-plan      - Run planning job once"
  echo "  run-posting   - Run posting job once"
  echo "  run-reply     - Run reply job once"
  echo "  run-learn     - Run learning job once"
  echo "  seed          - Run plan + posting to seed the system"
  echo "  deploy        - Deploy current code"
  echo "  status        - Show service status"
  echo "  vars          - Show environment variables"
  echo "  set-live      - Set MODE=live (enable real posting)"
  echo "  set-shadow    - Set MODE=shadow (disable posting)"
  echo ""
}

# Command routing
case "${1:-help}" in
  logs)
    echo -e "${BLUE}📡 Following live logs... (press q to quit)${NC}"
    railway logs --service "$SERVICE" --tail
    ;;
    
  logs-last)
    echo -e "${BLUE}📄 Last 300 lines:${NC}"
    railway logs --service "$SERVICE" --tail | tail -n 300
    ;;
    
  logs-errors)
    echo -e "${BLUE}🔍 Filtering for errors and warnings:${NC}"
    railway logs --service "$SERVICE" --tail | grep -E "ERROR|FAIL|❌|⚠️"
    ;;
    
  run-plan)
    echo -e "${GREEN}🧠 Running plan job once...${NC}"
    railway run --service "$SERVICE" -- npm run job:plan
    ;;
    
  run-posting)
    echo -e "${GREEN}📮 Running posting job once...${NC}"
    railway run --service "$SERVICE" -- npm run job:posting
    ;;
    
  run-reply)
    echo -e "${GREEN}💬 Running reply job once...${NC}"
    railway run --service "$SERVICE" -- npm run job:reply
    ;;
    
  run-learn)
    echo -e "${GREEN}🎓 Running learning job once...${NC}"
    railway run --service "$SERVICE" -- npm run job:learn
    ;;
    
  seed)
    echo -e "${GREEN}🌱 Seeding system (plan + posting)...${NC}"
    railway run --service "$SERVICE" -- npm run job:plan
    railway run --service "$SERVICE" -- npm run job:posting
    echo -e "${GREEN}✅ Seed completed${NC}"
    ;;
    
  deploy)
    echo -e "${YELLOW}🚀 Deploying to Railway...${NC}"
    railway up --service "$SERVICE" --yes
    ;;
    
  status)
    echo -e "${BLUE}📊 Service status:${NC}"
    railway status --service "$SERVICE"
    ;;
    
  vars)
    echo -e "${BLUE}🔧 Environment variables:${NC}"
    railway variables --service "$SERVICE"
    ;;
    
  set-live)
    echo -e "${YELLOW}⚡ Setting MODE=live (enabling real posting)${NC}"
    railway variables --service "$SERVICE" --set MODE=live
    echo -e "${GREEN}✅ MODE set to live. Restart service for changes to take effect.${NC}"
    ;;
    
  set-shadow)
    echo -e "${YELLOW}🌙 Setting MODE=shadow (disabling posting for testing)${NC}"
    railway variables --service "$SERVICE" --set MODE=shadow
    echo -e "${GREEN}✅ MODE set to shadow. Restart service for changes to take effect.${NC}"
    ;;
    
  help|*)
    show_help
    ;;
esac

