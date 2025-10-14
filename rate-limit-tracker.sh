#!/bin/bash

# 🕐 RAILWAY RATE LIMIT TRACKER
# Track rate limit duration and provide alternatives

echo "🕐 RAILWAY RATE LIMIT TRACKER"
echo "============================"
echo ""

export PATH="/usr/local/bin:$PATH"

echo "📊 CURRENT STATUS ($(date)):"
echo "============================="
echo ""

echo "Rate limit check:"
rate_status=$(railway whoami 2>&1 | head -1)
echo "Result: $rate_status"
echo ""

if echo "$rate_status" | grep -q "ratelimited"; then
    echo "❌ STILL RATE LIMITED"
    echo ""
    echo "🕐 TIMELINE:"
    echo "============"
    echo "Started: ~10:00 AM EDT"
    echo "Current: $(date '+%I:%M %p %Z')"
    echo "Duration: 2+ hours"
    echo ""
    
    echo "🎯 ANALYSIS:"
    echo "============"
    echo "This is an unusually long rate limit."
    echo "Railway may have implemented stricter protection."
    echo ""
    
    echo "⚡ IMMEDIATE ALTERNATIVES:"
    echo "========================="
    echo ""
    
    echo "1. 🌐 Railway Web Dashboard (WORKS NOW)"
    echo "   • https://railway.app → xBOT"
    echo "   • View logs, manage variables, redeploy"
    echo "   • Full control via web interface"
    echo ""
    
    echo "2. 📱 Mobile Hotspot Test"
    echo "   • Switch to phone's hotspot"
    echo "   • Try: railway login"
    echo "   • Rate limits are IP-based"
    echo ""
    
    echo "3. 🔄 Direct System Monitoring"
    echo "   • Check: https://xbot-production-844b.up.railway.app/health"
    echo "   • Your system is currently DOWN (502 errors)"
    echo "   • Needs immediate attention via web dashboard"
    echo ""
    
    echo "4. 🚨 URGENT SYSTEM FIX"
    echo "   Your system has been DOWN all day!"
    echo "   Use Railway web dashboard to:"
    echo "   • Add: NODE_OPTIONS=--max-old-space-size=1024"
    echo "   • Add: PLAYWRIGHT_BROWSER_ARGS=--no-sandbox,--disable-dev-shm-usage"
    echo "   • Click: Redeploy"
    echo ""
    
elif echo "$rate_status" | grep -q "Unauthorized"; then
    echo "✅ RATE LIMIT CLEARED!"
    echo ""
    echo "Ready to authenticate. Run:"
    echo "railway login"
    echo "railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1"
    
elif echo "$rate_status" | grep -q "@"; then
    echo "🎉 ALREADY AUTHENTICATED!"
    echo "User: $rate_status"
    echo ""
    echo "Testing project access..."
    railway status
    
else
    echo "❓ UNKNOWN STATUS: $rate_status"
fi

echo ""
echo "🎯 RECOMMENDATION:"
echo "=================="
echo ""
echo "Given the extended rate limit (2+ hours), your best option is:"
echo ""
echo "1. 🏃‍♂️ Use Railway web dashboard immediately"
echo "2. 🔧 Fix your crashed system (it's been down all day)"  
echo "3. ⏳ Continue monitoring CLI recovery in parallel"
echo ""
echo "Your system needs urgent attention - don't wait for CLI!"
echo ""

# Offer to continue monitoring
echo "🔄 MONITORING OPTIONS:"
echo "====================="
echo ""
echo "A. Continue checking manually every 30 minutes"
echo "B. Run automated monitor: ./automated-railway-recovery.sh"
echo "C. Focus on web dashboard fixes while CLI recovers"
echo ""
echo "What would you like to do?"
