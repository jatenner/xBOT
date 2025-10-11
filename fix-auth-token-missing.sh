#!/bin/bash

# 🚨 CRITICAL: AUTH_TOKEN EXTRACTION REQUIRED
# The manual session is missing the auth_token cookie (httpOnly)

echo "🚨 CRITICAL: AUTH_TOKEN MISSING FROM SESSION"
echo "============================================="
echo ""
echo "📊 ANALYSIS:"
echo "   ✅ 3 cookies loaded: personalization_id, ct0, twid"
echo "   ❌ MISSING: auth_token (httpOnly cookie)"
echo "   ❌ X rejects session without auth_token"
echo ""
echo "🛡️ SOLUTION: Extract auth_token using DevTools"
echo ""
echo "📋 STEP-BY-STEP INSTRUCTIONS (2 minutes):"
echo ""
echo "1. 🌐 Go to x.com and ensure you're logged in"
echo "2. 🔧 Press F12 → Application tab"
echo "3. 📁 In left sidebar: Storage → Cookies → https://x.com"
echo "4. 🔍 Find the 'auth_token' cookie and copy its VALUE"
echo "5. 📋 The auth_token should be ~40 characters long"
echo ""
echo "🚀 ALTERNATIVE: Use Playwright session creator"
echo "   This will automatically capture httpOnly cookies"
echo "   Command: node playwright-session-creator.js"
echo ""

# Create auth_token input script
cat > add_auth_token.js << 'EOF'
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔐 AUTH_TOKEN ADDITION TOOL');
console.log('===========================');
console.log('');
console.log('Current session has 3 cookies but is missing auth_token');
console.log('');

rl.question('Paste your auth_token value here: ', (authToken) => {
    if (!authToken || authToken.length < 20) {
        console.log('❌ Invalid auth_token. Must be at least 20 characters.');
        rl.close();
        return;
    }
    
    try {
        // Load existing session
        const existingSession = fs.readFileSync('working_session_manual.txt', 'utf8').trim();
        const sessionData = JSON.parse(Buffer.from(existingSession, 'base64').toString());
        
        // Add auth_token cookie
        sessionData.cookies.push({
            name: 'auth_token',
            value: authToken,
            domain: '.x.com',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Lax'
        });
        
        // Update metadata
        sessionData.timestamp = new Date().toISOString();
        sessionData.method = 'manual_with_auth_token';
        sessionData.complete = true;
        
        // Save complete session
        const completeBase64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        fs.writeFileSync('complete_working_session.txt', completeBase64);
        
        console.log('');
        console.log('✅ COMPLETE SESSION CREATED!');
        console.log(`   Length: ${completeBase64.length} chars`);
        console.log(`   Cookies: ${sessionData.cookies.length} (including auth_token)`);
        console.log('   File: complete_working_session.txt');
        console.log('');
        console.log('🚂 DEPLOYING TO RAILWAY...');
        
        // Deploy immediately
        const { execSync } = require('child_process');
        execSync(`railway variables --set "TWITTER_SESSION_B64=${completeBase64}"`);
        execSync('railway redeploy');
        
        console.log('🎉 DEPLOYMENT COMPLETE!');
        console.log('   Your bot should start posting within 2 minutes');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    rl.close();
});
EOF

echo "📁 TOOLS CREATED:"
echo "   - add_auth_token.js (interactive auth_token addition)"
echo ""
echo "🚨 URGENT: Complete the auth_token extraction now"
echo ""
echo "🎯 FASTEST METHOD:"
echo "   1. F12 → Application → Cookies → https://x.com"
echo "   2. Copy auth_token value"
echo "   3. Run: node add_auth_token.js"
echo "   4. Paste the auth_token when prompted"
echo ""
echo "⏱️ Your bot will be working in 3 minutes after this step!"
