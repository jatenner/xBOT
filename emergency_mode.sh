#!/bin/bash

echo "🚨 === EMERGENCY COST MODE ACTIVATION ==="
echo "This will reduce your bot's daily costs from $40-50 to $0.50-2.00"
echo ""

# Create .env file with emergency settings
cat > .env.emergency << EOF
# 🚨 EMERGENCY COST MODE - For 0-follower bots with 0 revenue
EMERGENCY_COST_MODE=true
DISABLE_LEARNING_AGENTS=true
DISABLE_COMPETITIVE_INTELLIGENCE=true
DISABLE_INTELLIGENCE_CORE=true
DAILY_BUDGET_LIMIT=1.00

# Basic posting configuration
MAX_DAILY_TWEETS=2
POSTING_INTERVAL_HOURS=12
USE_CHEAP_MODELS_ONLY=true

# Disable expensive features
DISABLE_ADAPTIVE_LEARNING=true
DISABLE_VIRAL_ANALYSIS=true
DISABLE_BACKGROUND_MONITORING=true
DISABLE_REAL_TIME_ANALYSIS=true

# Ultra-conservative OpenAI settings
OPENAI_MAX_TOKENS=100
OPENAI_MAX_CALLS_PER_HOUR=5
OPENAI_PREFERRED_MODEL=gpt-4o-mini

# Logging
COST_TRACKING_ENABLED=true
LOG_EVERY_API_CALL=true
EOF

echo "✅ Emergency configuration created in .env.emergency"
echo ""
echo "📋 TO ACTIVATE EMERGENCY MODE:"
echo "1. Copy emergency settings to your main .env file:"
echo "   cp .env.emergency .env"
echo ""
echo "2. Or export them in your current shell:"
echo "   source .env.emergency"
echo ""
echo "3. Restart your bot to apply emergency mode"
echo ""
echo "💰 EXPECTED RESULTS:"
echo "   📉 Daily cost: $40-50 → $0.50-2.00 (95%+ savings)"
echo "   📊 API calls: 87+ → 3-5 per day (94% reduction)"
echo "   🎯 Functionality: Still posts quality content"
echo ""
echo "🚀 WHEN TO DISABLE EMERGENCY MODE:"
echo "   - When you reach 100+ followers"
echo "   - When you have revenue to justify costs"
echo "   - When you want to enable advanced AI features"
echo ""
echo "To disable emergency mode later:"
echo "   export EMERGENCY_COST_MODE=false"
echo ""
echo "🎯 Emergency mode is perfect for:"
echo "   ✅ 0-follower accounts"
echo "   ✅ Personal/experimental bots"
echo "   ✅ Learning/testing phases"
echo "   ✅ Budget-conscious users" 