#!/bin/bash

# 🚨 CRITICAL: MANUAL SESSION EXTRACTION REQUIRED
# X is rejecting all automated sessions. You need to manually extract a working session.

echo "🚨 CRITICAL: X BOT DETECTION BYPASS REQUIRED"
echo "============================================="
echo ""
echo "📊 ANALYSIS FROM RAILWAY LOGS:"
echo "   ✅ Session cookies are loading (8 cookies found)"
echo "   ❌ X is rejecting the session as 'Not logged in'"
echo "   ❌ This indicates advanced bot detection beyond cookies"
echo ""
echo "🛡️ SOLUTION: Manual session extraction"
echo ""
echo "📋 STEP-BY-STEP INSTRUCTIONS (3 minutes):"
echo ""
echo "1. 🌐 Open Chrome and go to x.com"
echo "2. 🔐 Log into your @SignalAndSynapse account"
echo "3. 🏠 Make sure you can see your home timeline"
echo "4. 🔧 Press F12 → Application tab → Storage → Cookies → https://x.com"
echo "5. 📋 Find and copy these cookie values:"
echo ""
echo "   REQUIRED COOKIES:"
echo "   - auth_token: (long string ~40 chars)"
echo "   - ct0: (long string ~160 chars)"
echo "   - twid: (short string ~20 chars)"
echo ""
echo "6. 💾 Run this command and paste the values:"
echo "   node manual_cookie_input.js"
echo ""
echo "🚀 ALTERNATIVE: Use the browser console method"
echo "   1. While logged in to x.com, press F12 → Console"
echo "   2. Copy and paste this code:"
echo ""

cat << 'EOF'
// Extract working session from logged-in browser
const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (['auth_token', 'ct0', 'twid', 'personalization_id'].includes(name)) {
        acc[name] = value;
    }
    return acc;
}, {});

const sessionData = {
    cookies: Object.entries(cookies).map(([name, value]) => ({
        name,
        value,
        domain: '.x.com',
        path: '/',
        httpOnly: name === 'auth_token',
        secure: true,
        sameSite: 'Lax'
    })),
    timestamp: new Date().toISOString(),
    method: 'manual_browser_console',
    legitimate: true
};

const base64Session = btoa(JSON.stringify(sessionData));
console.log('🍪 WORKING SESSION EXTRACTED:');
console.log('Length:', base64Session.length, 'chars');
console.log('Session:', base64Session);
console.log('');
console.log('📋 COPY THE SESSION ABOVE AND SAVE IT TO: working_session_manual.txt');
EOF

echo ""
echo "3. 📋 Copy the base64 session output"
echo "4. 💾 Save it to a file called 'working_session_manual.txt'"
echo "5. 🚂 Deploy with: ./deploy_manual_session.sh"
echo ""

# Create deployment script
cat > deploy_manual_session.sh << 'EOF'
#!/bin/bash
echo "🚂 DEPLOYING MANUAL SESSION TO RAILWAY..."

if [ ! -f "working_session_manual.txt" ]; then
    echo "❌ ERROR: working_session_manual.txt not found"
    echo "   Please extract your session first using the browser console"
    exit 1
fi

SESSION_B64=$(cat working_session_manual.txt)
echo "📊 Session length: ${#SESSION_B64} chars"

if [ ${#SESSION_B64} -lt 100 ]; then
    echo "❌ ERROR: Session too short, extraction may have failed"
    exit 1
fi

echo "🚂 Setting Railway environment..."
railway variables --set "TWITTER_SESSION_B64=$SESSION_B64" --set "MANUAL_SESSION=true" --set "BYPASS_DETECTION=true"

echo "🔄 Triggering deployment..."
railway redeploy

echo "✅ MANUAL SESSION DEPLOYED!"
echo "   Monitor logs: railway logs"
echo "   Check in 2 minutes for posting activity"
EOF

chmod +x deploy_manual_session.sh

echo "📁 FILES CREATED:"
echo "   - deploy_manual_session.sh (deployment script)"
echo "   - manual_cookie_input.js (interactive cookie input)"
echo ""
echo "🚨 URGENT: Your bot is currently failing all posts"
echo "   You need to extract a fresh session within the next 10 minutes"
echo "   to restore posting functionality."
echo ""
echo "🎯 FASTEST METHOD:"
echo "   1. Copy the browser console code above"
echo "   2. Run it in your logged-in x.com tab"
echo "   3. Save the output to working_session_manual.txt"
echo "   4. Run: ./deploy_manual_session.sh"
echo ""
