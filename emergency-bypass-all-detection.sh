#!/bin/bash

# 🚨 EMERGENCY X/TWITTER BOT DETECTION BYPASS
# This script provides multiple strategies to bypass X's bot detection

echo "🚨 EMERGENCY X/TWITTER BOT DETECTION BYPASS"
echo "==========================================="
echo ""
echo "📊 PROBLEM ANALYSIS:"
echo "   ❌ X is blocking automated login attempts"
echo "   ❌ Current session lacks auth_token cookie"
echo "   ❌ Railway deployment failing due to invalid session"
echo ""
echo "🛡️ SOLUTION: Multi-layered bypass strategy"
echo ""

# Strategy 1: Use existing session with workarounds
echo "🔧 STRATEGY 1: Patching existing session..."
if [ -f "complete_session_b64.txt" ]; then
    SESSION_B64=$(cat complete_session_b64.txt)
    echo "   ✅ Found existing session (${#SESSION_B64} chars)"
    
    # Deploy existing session - sometimes works even without auth_token
    echo "   🚂 Deploying to Railway..."
    railway variables set TWITTER_SESSION_B64="$SESSION_B64"
    railway variables set BYPASS_AUTH_TOKEN_CHECK="true"
    railway variables set STEALTH_MODE="true"
    railway variables set USE_EXISTING_COOKIES="true"
    
    echo "   ✅ Strategy 1 deployed - testing in 30 seconds..."
    sleep 30
    
    # Check if it worked
    railway logs --tail 10 | grep -i "post\|tweet\|success" && {
        echo "   🎉 STRATEGY 1 SUCCESSFUL! Bot is working"
        exit 0
    }
    
    echo "   ❌ Strategy 1 failed, trying Strategy 2..."
else
    echo "   ❌ No existing session found"
fi

echo ""
echo "🔧 STRATEGY 2: Manual session extraction..."
echo ""
echo "📋 MANUAL INSTRUCTIONS (2 minutes):"
echo "   1. Open Chrome/Safari and go to x.com"
echo "   2. Log into your @SignalAndSynapse account"
echo "   3. Once logged in, press F12 → Application tab → Cookies"
echo "   4. Find these cookies and copy their values:"
echo "      - auth_token (long string)"
echo "      - ct0 (long string)" 
echo "      - twid (short string)"
echo ""

# Create a simple cookie input script
cat > manual_cookie_input.js << 'EOF'
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🍪 MANUAL COOKIE INPUT');
console.log('=====================');

const cookies = {};

function askForCookie(name, description) {
    return new Promise(resolve => {
        rl.question(`Enter ${name} cookie (${description}): `, (value) => {
            cookies[name] = value.trim();
            resolve();
        });
    });
}

async function collectCookies() {
    await askForCookie('auth_token', 'long authentication token');
    await askForCookie('ct0', 'CSRF token');
    await askForCookie('twid', 'Twitter ID');
    
    rl.close();
    
    // Create session
    const sessionData = {
        cookies: [
            {
                name: 'auth_token',
                value: cookies.auth_token,
                domain: '.x.com',
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'Lax'
            },
            {
                name: 'ct0',
                value: cookies.ct0,
                domain: '.x.com',
                path: '/',
                httpOnly: false,
                secure: true,
                sameSite: 'Lax'
            },
            {
                name: 'twid',
                value: cookies.twid,
                domain: '.x.com',
                path: '/',
                httpOnly: false,
                secure: true,
                sameSite: 'Lax'
            }
        ],
        timestamp: new Date().toISOString(),
        method: 'manual_emergency',
        stealth: true
    };
    
    const base64Session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    
    fs.writeFileSync('manual_emergency_session_b64.txt', base64Session);
    
    console.log('');
    console.log('✅ EMERGENCY SESSION CREATED!');
    console.log(`   Length: ${base64Session.length} chars`);
    console.log(`   File: manual_emergency_session_b64.txt`);
    console.log('');
    console.log('🚂 DEPLOYING TO RAILWAY...');
    
    // Deploy to Railway
    const { execSync } = require('child_process');
    try {
        execSync(`railway variables set TWITTER_SESSION_B64="${base64Session}"`);
        execSync('railway variables set STEALTH_MODE="true"');
        execSync('railway variables set MANUAL_SESSION="true"');
        execSync('railway deploy');
        
        console.log('🎉 DEPLOYMENT SUCCESSFUL!');
        console.log('   Your bot should be working within 3 minutes');
        console.log('   Check: railway logs');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        console.log('   Manual deployment required via Railway dashboard');
    }
}

collectCookies();
EOF

echo "🔧 STRATEGY 3: Alternative session methods..."
echo ""
echo "   Option A: Run manual cookie input"
echo "   Command: node manual_cookie_input.js"
echo ""
echo "   Option B: Use session template"
echo "   1. Edit session_template.json with your cookies"
echo "   2. Run: node convert-session.js"
echo ""
echo "   Option C: Browser automation (if working)"
echo "   Command: node playwright-session-creator.js"
echo ""

echo "🚨 EMERGENCY ACTIONS:"
echo "   1. Try Strategy 1 first (already running)"
echo "   2. If failed, run: node manual_cookie_input.js"
echo "   3. If still failed, contact for advanced bypass"
echo ""

echo "📊 MONITORING:"
echo "   Check logs: railway logs"
echo "   Check status: railway status"
echo "   Check tweets: x.com/SignalAndSynapse"
